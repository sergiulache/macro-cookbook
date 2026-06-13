/**
 * Full extraction (Slice 2): every recipe in the book → typed, schema-validated
 * JSON + optimized hero images, plus a coverage report flagging low-confidence
 * recipes for spot-check (D-verification). Tolerates corrupt pages.
 *
 *   yarn extract:all
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { getPage, type PageData } from "./pdf.js";
import { renderPage } from "./render.js";
import { optimizeHero } from "./images.js";
import { parseRecipeSpread } from "./parser.js";
import { Recipe, RecipeArray } from "../../src/lib/schema/recipe.js";
import { DATA_OUT, OUT_DIR } from "./config.js";

interface ScanPage { n: number; isContent: boolean; category: string; corrupt?: boolean; }
const scan: ScanPage[] = JSON.parse(readFileSync(`${OUT_DIR}/scan.json`, "utf8"));
const corruptSet = new Set(scan.filter((p) => p.corrupt).map((p) => p.n));
const contentPages = scan.filter((p) => p.isContent && p.category !== "Recipe Page Breakdown").map((p) => p.n);

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-");
const safeGetPage = async (n: number): Promise<PageData | null> => {
  if (corruptSet.has(n)) return null;
  try { return await getPage(n); } catch { corruptSet.add(n); return null; }
};

interface Row { recipe: Recipe | null; flags: string[]; pages: number[]; title: string; }
const rows: Row[] = [];
const ids = new Map<string, number>();

for (const c of contentPages) {
  let spreadNums = [c - 1, c];
  let pages = (await Promise.all(spreadNums.map(safeGetPage))).filter(Boolean) as PageData[];
  const flags: string[] = [];
  if (!pages.some((p) => p.items.some((i) => /INGREDIENTS/.test(i.str.replace(/\s/g, ""))))) {
    rows.push({ recipe: null, flags: ["no-content-page", ...(corruptSet.has(c) ? ["corrupt-page"] : [])], pages: spreadNums, title: `(page ${c})` });
    continue;
  }
  let parsed = parseRecipeSpread(pages, spreadNums);
  // two-page-instruction recipes: macros (and steps 8..N) overflow to page c+1.
  // Only extend when the base spread has NO macros, so we never grab the next
  // recipe's macros from its photo page.
  const allMacrosZero = (m: typeof parsed.macros) => !m.calories && !m.carbs && !m.protein && !m.fat;
  if (allMacrosZero(parsed.macros)) {
    const ext = [...spreadNums, c + 1];
    const extPages = (await Promise.all(ext.map(safeGetPage))).filter(Boolean) as PageData[];
    const extParsed = parseRecipeSpread(extPages, ext);
    if (extParsed.macros.calories > 0) { spreadNums = ext; pages = extPages; parsed = extParsed; }
  }
  if (spreadNums.some((n) => corruptSet.has(n))) flags.push("corrupt-page");
  let id = slugify(parsed.title) || `recipe-${c}`;
  if (ids.has(id)) { const k = (ids.get(id)! + 1); ids.set(id, k); id = `${id}-${k}`; } else ids.set(id, 1);

  // optimize hero from the photo page (content-1); fall back to content page
  let image = null;
  for (const pn of [c - 1, c]) {
    if (corruptSet.has(pn)) continue;
    try { image = await optimizeHero(renderPage(pn), id); break; } catch {}
  }
  if (!image) flags.push("no-image");

  const nIng = parsed.ingredientGroups.reduce((s, g) => s + g.ingredients.length, 0);
  if (allMacrosZero(parsed.macros)) flags.push("macros-missing");
  if (parsed.steps.length < 2) flags.push("few-steps");
  if (nIng < 1) flags.push("no-ingredients");
  if (!parsed.videoUrl) flags.push("no-video");
  if (!/^[A-Z]/.test(parsed.title) || parsed.title.length < 3) flags.push("title?");
  // structural anomaly checks (catch the bug classes found in spot-checks)
  if (parsed.ingredientGroups.some((g) => g.name.split(/\s+/).some((w) => w.length >= 13))) flags.push("header-unsplit");
  if (parsed.ingredientGroups.some((g) => g.ingredients.some((i) => i.amount == null && /^[A-Z][A-Z0-9'’ ]{4,}$/.test(i.item) && i.item !== i.item.toLowerCase())))
    flags.push("ingredient-as-header");
  if (parsed.title.split(/\s+/).length === 1) flags.push("title-single-word");

  const candidate = { id, ...parsed, image, sourcePages: spreadNums };
  const res = Recipe.safeParse(candidate);
  if (res.success) rows.push({ recipe: res.data, flags, pages: spreadNums, title: parsed.title });
  else rows.push({ recipe: null, flags: ["schema-fail", ...flags], pages: spreadNums, title: parsed.title });
}

const valid = rows.filter((r) => r.recipe).map((r) => r.recipe!) as Recipe[];
RecipeArray.parse(valid);
mkdirSync(DATA_OUT, { recursive: true });
writeFileSync(`${DATA_OUT}/recipes.json`, JSON.stringify(valid, null, 2) + "\n");

// ---- coverage report ----
const flagged = rows.filter((r) => r.flags.filter((f) => f !== "no-video").length);
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
const rowHtml = (r: Row) => `<tr class="${r.recipe ? "" : "fail"}">
  <td>${esc(r.title)}</td><td>${esc(r.recipe?.category ?? "")}</td>
  <td>${r.recipe ? r.recipe.ingredientGroups.reduce((s, g) => s + g.ingredients.length, 0) : "-"}</td>
  <td>${r.recipe?.steps.length ?? "-"}</td><td>${r.recipe?.macros.calories ?? "-"}</td>
  <td>${r.recipe?.videoUrl ? "✓" : ""}</td><td>${r.recipe?.image ? "✓" : ""}</td>
  <td>pp.${r.pages.join(",")}</td><td class="flags">${r.flags.map((f) => `<span>${f}</span>`).join(" ")}</td></tr>`;
const html = `<!doctype html><meta charset=utf8><title>Extraction coverage</title>
<style>body{font:14px system-ui;margin:24px;color:#171717}table{border-collapse:collapse;width:100%}
td,th{border-bottom:1px solid #e5e5e5;padding:6px 10px;text-align:left}th{color:#737373}
.fail{background:#fff1f0}.flags span{background:#fde68a;border-radius:4px;padding:1px 6px;font-size:12px;margin-right:3px}
.flags span:empty{display:none}h1{font-size:20px}.sub{color:#737373}</style>
<h1>Extraction coverage</h1>
<p class=sub>${valid.length} recipes validated · ${rows.length - valid.length} failed · ${flagged.length} flagged for spot-check · corrupt pages: ${[...corruptSet].sort((a,b)=>a-b).join(", ")}</p>
<h2>Flagged (${flagged.length})</h2>
<table><tr><th>Title<th>Category<th>Ing<th>Steps<th>Cal<th>Vid<th>Img<th>Pages<th>Flags</tr>${flagged.map(rowHtml).join("")}</table>`;
writeFileSync(`${OUT_DIR}/coverage.html`, html);

const cats = [...new Set(valid.map((r) => r.category))];
console.log(`\n✓ ${valid.length}/${rows.length} recipes validated → ${DATA_OUT}/recipes.json`);
console.log(`categories: ${cats.length} | flagged for review: ${flagged.length} | failed: ${rows.length - valid.length}`);
console.log(`coverage report → ${OUT_DIR}/coverage.html`);
