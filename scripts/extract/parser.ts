/**
 * Parse a recipe SPREAD (photo page + content page, sometimes more) into
 * structured fields from the exact text layer (D6). Geometry-driven and robust
 * to layout variance discovered on real pages:
 *  - macros and ingredients can live on different pages of the spread
 *  - the photo-page caption is the canonical (full) title
 *  - parent headers (DOUGH) sit over sub-groups (DRY/WET) as header-only groups
 *  - prep/cook may be in hours; the footer holds the category
 *  - the video URL is a link annotation (usually on the title) (D3)
 */
import type { PageData, TextItem } from "./pdf.js";
import type { Macros, IngredientGroup, Ingredient, Step, Reference } from "../../src/lib/schema/recipe.js";

export interface ParsedRecipe {
  title: string;
  category: string;
  servings: number;
  macros: Macros;
  ingredientGroups: IngredientGroup[];
  steps: Step[];
  prepTimeMin: number | null;
  cookTimeMin: number | null;
  tips: string[];
  videoUrl: string | null;
  references: Reference[];
}

const UNITS = new Set(["g", "kg", "mg", "ml", "l", "tbsp", "tsp", "oz", "lb", "cup", "cups", "qt"]);

/** Collapse the design's letter-spacing ("W E T" → "WET") while keeping word gaps (2+ spaces). */
export function deLetterSpace(s: string): string {
  return s
    .split(/\s{2,}/)
    .map((word) => {
      const t = word.split(" ");
      const singles = t.filter((x) => x.length === 1).length;
      return t.length > 1 && singles / t.length >= 0.6 ? t.join("") : word;
    })
    .join(" ")
    .trim();
}
const norm = (s: string) => deLetterSpace(s).replace(/\s+/g, " ").trim();

function lines(items: TextItem[]): { y: number; x: number; text: string }[] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const out: { y: number; x: number; text: string }[] = [];
  for (const it of sorted) {
    const last = out[out.length - 1];
    // join separate items with a DOUBLE space so deLetterSpace keeps the word
    // boundary for letter-spaced multi-word headers ("INSIDE  CHEESE" → "INSIDE CHEESE")
    if (last && Math.abs(it.y - last.y) <= 4) { last.text += "  " + it.str; }
    else out.push({ y: it.y, x: it.x, text: it.str });
  }
  return out;
}
const labelItem = (page: PageData, label: string) => page.items.find((i) => norm(i.str).toUpperCase() === label);
const hasLabel = (page: PageData, label: string) => !!labelItem(page, label);

function parseIngredientLine(text: string): Ingredient | null {
  const t = text.trim();
  if (!t) return null;
  const pinch = /^(pinch|dash)\s+(.*)$/i.exec(t);
  if (pinch) {
    const m = /\(~?\s*(\.?\d*\.?\d+)\s*grams?\)/i.exec(pinch[2]);
    const item = pinch[2].replace(/\s*\(.*?\)\s*/g, "").trim();
    return { amount: m ? Number(m[1]) : null, unit: m ? "g" : null, item, note: pinch[1].toLowerCase() };
  }
  const m = /^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?\s+(.*)$/.exec(t);
  if (m) {
    const amount = Number(m[1]);
    const maybeUnit = m[2]?.toLowerCase();
    if (maybeUnit && UNITS.has(maybeUnit)) return { amount, unit: maybeUnit, item: m[3].trim() };
    return { amount, unit: null, item: [m[2], m[3]].filter(Boolean).join(" ").trim() };
  }
  return { amount: null, unit: null, item: t };
}
// Letter-spaced multi-word headers collapse to one token ("INSIDECHEESE"); the
// word boundary is lost in the text layer. Recover it with a section vocabulary
// (greedy longest-prefix). Hardened against the full book in Slice 2.
const HEADER_VOCAB = [
  "INSIDE", "OUTSIDE", "CHEESES", "CHEESE", "DOUGH", "DRY", "WET", "TOPPINGS", "TOPPING",
  "COATING", "FILLING", "SAUCE", "BATCH", "GARLIC", "OIL", "SAUSAGE", "ITALIAN", "PIZZA",
  "BUILD", "MARINARA", "GLAZE", "CRUST", "SEASONINGS", "SEASONING", "BREADING", "ASSEMBLY",
  "CHICKEN", "BEEF", "MEAT", "BUTTER", "GLAZE", "FROSTING", "BATTER", "WINGS", "RICE",
];
function splitHeaderWords(name: string): string {
  if (name.includes(" ")) return name;
  const up = name.toUpperCase();
  const words: string[] = [];
  let i = 0;
  while (i < up.length) {
    const w = HEADER_VOCAB.find((v) => up.startsWith(v, i));
    if (!w) return name; // unknown token -> leave concatenated (flagged for Slice 2)
    words.push(w);
    i += w.length;
  }
  return words.join(" ");
}
const isGroupHeader = (text: string) => {
  const n = norm(text);
  return /^[A-Z][A-Z ]+$/.test(n) && !/\d/.test(n) && n.length <= 24 && !["INGREDIENTS", "DIRECTIONS", "MACROS"].includes(n);
};

function parseMacros(page: PageData): Macros {
  const macrosY = labelItem(page, "MACROS")?.y ?? -1;
  const macro: Partial<Macros> = {};
  if (macrosY < 0) return { calories: 0, fat: 0, carbs: 0, netCarbs: null, protein: 0 };
  for (const ln of lines(page.items.filter((i) => i.y > macrosY + 5 && i.y < macrosY + 160))) {
    const n = norm(ln.text).toUpperCase().replace(/\s+/g, "");
    const m = /(\d+)G?(CALORIES|FAT|NETCARBS|CARBS|PROTEIN)/.exec(n);
    if (!m) continue;
    const v = Number(m[1]);
    if (m[2] === "CALORIES") macro.calories = v;
    else if (m[2] === "FAT") macro.fat = v;
    else if (m[2] === "NETCARBS") macro.netCarbs = v;
    else if (m[2] === "CARBS") macro.carbs = v;
    else if (m[2] === "PROTEIN") macro.protein = v;
  }
  return { calories: macro.calories ?? 0, fat: macro.fat ?? 0, carbs: macro.carbs ?? 0, netCarbs: macro.netCarbs ?? null, protein: macro.protein ?? 0 };
}

function durationMin(s: string | null): number | null {
  if (!s) return null;
  const c = s.replace(/\s+/g, "");
  const hr = /(\d+\.?\d*)\s*HRS?/i.exec(c);
  if (hr) return Math.round(Number(hr[1]) * 60);
  const mn = /(\d+)\s*MIN/i.exec(c);
  return mn ? Number(mn[1]) : null;
}
function parseTimes(page: PageData) {
  const valueBelow = (label: string): string | null => {
    const lab = labelItem(page, label);
    if (!lab) return null;
    const row = page.items
      .filter((i) => i.y > lab.y && i.y < lab.y + 22 && i.x > lab.x - 20 && i.x < lab.x + 90)
      .sort((a, b) => a.x - b.x).map((i) => i.str).join(" ");
    return row ? norm(row) : null;
  };
  const serves = valueBelow("SERVES");
  return {
    servings: serves ? Number((/\d+/.exec(serves.replace(/\s+/g, "")) ?? ["1"])[0]) : 1,
    prep: durationMin(valueBelow("PREP")),
    cook: durationMin(valueBelow("COOK")),
  };
}

// a caption is a short Title-Case phrase (every word capitalized), no trailing period
const isCaption = (t: string) =>
  /^[A-Z][A-Za-z'’.&-]*(?:\s+[A-Z0-9][A-Za-z'’.&-]*)*$/.test(t) &&
  t.split(/\s+/).length <= 6 && /[a-z]/.test(t) && !/\.$/.test(t) && t.toUpperCase() !== "DIET CHEAT CODES";

function parseTitle(pages: PageData[]): string {
  // the title-case caption near the photo/macros (y ~ 480-515) is the canonical full title
  for (const p of pages) {
    const cap = lines(p.items.filter((i) => i.y > 478 && i.y < 520))
      .map((l) => norm(l.text)).find(isCaption);
    if (cap) return cap;
  }
  // fallback: largest-font heading in the top band, title-cased
  const top = pages.flatMap((p) => p.items).filter((i) => i.y < 200 && norm(i.str).toUpperCase() !== "DIET CHEAT CODES");
  const big = [...top].sort((a, b) => b.h - a.h)[0];
  return norm(big?.str ?? "Untitled").replace(/\b([A-Z])([A-Z]+)\b/g, (_, a, b) => a + b.toLowerCase());
}

function parseCategory(page: PageData): string {
  const footer = page.items.filter((i) => i.y > page.height - 22 && !/^\d+$/.test(i.str.trim()));
  return norm(footer.sort((a, b) => a.x - b.x)[0]?.str ?? "Uncategorized");
}

function parseIngredients(page: PageData, colSplit: number): IngredientGroup[] {
  const ingY = labelItem(page, "INGREDIENTS")?.y ?? 210;
  const macrosY = labelItem(page, "MACROS")?.y ?? page.height;
  const ll = lines(page.items.filter((i) => i.x < colSplit && i.y > ingY + 4 && i.y < Math.min(macrosY - 4, page.height - 22)));
  const groups: IngredientGroup[] = [];
  let cur: IngredientGroup | null = null;
  let prevY = ingY;
  for (const ln of ll) {
    if (ln.y - prevY > 70 && cur?.ingredients.length) break; // caption/photo gap on single-page layouts
    prevY = ln.y;
    const text = ln.text.replace(/\s+/g, " ").trim();
    if (isGroupHeader(text)) { cur = { name: splitHeaderWords(norm(text)), ingredients: [] }; groups.push(cur); continue; }
    if (!cur) { cur = { name: "Ingredients", ingredients: [] }; groups.push(cur); }
    if (cur.ingredients.length && !/^(\d|\bpinch\b|\bdash\b)/i.test(text)) {
      const last = cur.ingredients[cur.ingredients.length - 1];
      last.item = (last.item + " " + text).trim();
      continue;
    }
    const ing = parseIngredientLine(text);
    if (ing) cur.ingredients.push(ing);
  }
  return groups.filter((g) => g.ingredients.length || isGroupHeader(g.name)); // keep header-only parents
}

// Header-independent: works on the primary content page AND on a directions
// continuation page (two-page-instruction recipes, macros/steps on page 2).
function parseSteps(page: PageData): Step[] {
  const starts = page.items.filter((i) => /^\d+\.$/.test(i.str.trim())).sort((a, b) => a.y - b.y);
  if (!starts.length) return [];
  const tipItem = page.items.find((i) => /^TIP/i.test(norm(i.str)));
  const tipY = tipItem ? tipItem.y : page.height - 22;
  return starts.map((s, idx) => {
    const yEnd = Math.min(starts[idx + 1]?.y ?? Infinity, tipY);
    const text = page.items
      .filter((i) => !/^\d+\.$/.test(i.str.trim()) && i.x > s.x + 5 && i.y >= s.y - 3 && i.y < yEnd - 3 && i.y < page.height - 22)
      .sort((a, b) => a.y - b.y || a.x - b.x).map((i) => i.str).join(" ").replace(/\s+/g, " ").trim();
    return { n: Number(s.str.replace(".", "")), text };
  }).filter((s) => s.text);
}

export function parseRecipeSpread(pages: PageData[], sourcePages: number[]): ParsedRecipe {
  const contentPage = pages.find((p) => hasLabel(p, "INGREDIENTS")) ?? pages[pages.length - 1];
  const macrosPage = pages.find((p) => hasLabel(p, "MACROS")) ?? contentPage;
  const dirX = labelItem(contentPage, "DIRECTIONS")?.x ?? 210;
  const colSplit = Math.min(dirX - 10, 180);
  const tipItem = contentPage.items.find((i) => /^TIP/i.test(norm(i.str)));
  const tipY = tipItem ? tipItem.y : Infinity;

  const ingredientGroups = parseIngredients(contentPage, colSplit);
  // merge steps across the whole spread (continuation pages carry steps 8..N)
  const byN = new Map<number, Step>();
  for (const p of pages) for (const s of parseSteps(p)) if (!byN.has(s.n)) byN.set(s.n, s);
  const steps = [...byN.values()].sort((a, b) => a.n - b.n);

  const tips: string[] = [];
  if (tipItem) {
    const tipText = contentPage.items
      .filter((i) => i !== tipItem && i.y >= tipItem.y - 2 && i.y < contentPage.height - 40 && i.x >= tipItem.x - 2)
      .sort((a, b) => a.y - b.y || a.x - b.x).map((i) => i.str).join(" ")
      .replace(/^\s*:?\s*/, "").replace(/\s+/g, " ").trim();
    if (tipText) tips.push(tipText);
  }

  const videoUrl = pages.flatMap((p) => p.links).find((l) => /youtu\.?be|youtube/.test(l.url))?.url ?? null;

  const groupNames = ingredientGroups.map((g) => g.name).filter((n) => n.toLowerCase() !== "ingredients");
  const references: Reference[] = [];
  for (const s of steps) {
    for (const g of groupNames) {
      const words = g.replace(/\s+/g, "\\s+");
      if (new RegExp(`\\b${words}\\b`, "i").test(s.text) && !references.some((r) => r.target === g)) {
        references.push({ raw: g, kind: "group", target: g, seconds: null });
      }
    }
  }

  const { servings, prep, cook } = parseTimes(contentPage);
  return {
    title: parseTitle(pages),
    category: parseCategory(contentPage),
    servings, macros: parseMacros(macrosPage), ingredientGroups, steps,
    prepTimeMin: prep, cookTimeMin: cook, tips, videoUrl, references,
  };
}
