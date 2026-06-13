/**
 * Build a human review report (out/sample/report.html): each extracted recipe
 * shown side-by-side with its source page render(s), so losslessness can be
 * verified by eye (D6, verification gate). Low-confidence fields are flagged.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { RecipeArray, type Recipe } from "../../src/lib/schema/recipe.js";
import { DATA_OUT, OUT_DIR } from "./config.js";

const recipes = RecipeArray.parse(JSON.parse(readFileSync(`${DATA_OUT}/recipes.sample.json`, "utf8")));

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
const pagePath = (p: number) => `pages/page-${String(p).padStart(3, "0")}.png`;
const heroPath = (src: string) => `../../src/assets/recipes/${src.replace(/^recipes\//, "")}`;

function macrosRow(m: Recipe["macros"]) {
  return `cal <b>${m.calories}</b> · fat <b>${m.fat}g</b> · carbs <b>${m.carbs}g</b> · net <b>${m.netCarbs ?? "—"}g</b> · protein <b>${m.protein}g</b>`;
}

function card(r: Recipe): string {
  const renders = r.sourcePages.map((p) => `<img src="${pagePath(p)}" alt="p${p}">`).join("");
  const groups = r.ingredientGroups.map((g) =>
    `<div class="grp"><h4>${esc(g.name)}</h4><ul>${g.ingredients
      .map((i) => `<li>${i.amount ?? ""}${i.unit ? esc(i.unit) : ""} ${esc(i.item)}${i.note ? ` <em>(${esc(i.note)})</em>` : ""}</li>`)
      .join("")}</ul></div>`).join("");
  const steps = r.steps.map((s) => `<li>${esc(s.text)}</li>`).join("");
  const tips = r.tips.length ? `<div class="tips"><b>Tips:</b><ul>${r.tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>` : `<div class="muted">no tips</div>`;
  const refs = r.references.length ? r.references.map((x) => `<code>${esc(x.raw)}→${x.kind}:${x.target ?? x.seconds}</code>`).join(" ") : `<span class="muted">none</span>`;
  const video = r.videoUrl ? `<a href="${r.videoUrl}">${esc(r.videoUrl)}</a>` : `<span class="warn">no QR/video found ⚠</span>`;
  return `<section>
    <div class="renders">${renders}</div>
    <div class="data">
      <h2>${esc(r.title)} <span class="ok">✓ schema</span></h2>
      <p class="meta">${esc(r.category)} · serves ${r.servings} · prep ${r.prepTimeMin ?? "—"}m · cook ${r.cookTimeMin ?? "—"}m · pp.${r.sourcePages.join(",")}</p>
      <p class="macros">${macrosRow(r.macros)}</p>
      <div class="hero"><img src="${heroPath(r.image?.src ?? "")}" width="180"><span class="muted">optimized hero (${r.image ? "ok" : "MISSING"})</span></div>
      <div class="groups">${groups}</div>
      <ol class="steps">${steps}</ol>
      ${tips}
      <p class="refs"><b>refs:</b> ${refs}</p>
      <p><b>video:</b> ${video}</p>
    </div>
  </section>`;
}

const html = `<!doctype html><meta charset="utf8"><title>Extraction sample — review</title>
<style>
  body{font:15px/1.5 system-ui;margin:0;background:#fafafa;color:#171717}
  header{padding:24px 32px;border-bottom:1px solid #e5e5e5;background:#fff}
  h1{margin:0;font-size:22px} .sub{color:#737373}
  section{display:grid;grid-template-columns:minmax(300px,40%) 1fr;gap:24px;padding:32px;border-bottom:1px solid #e5e5e5;background:#fff;align-items:start}
  .renders{position:sticky;top:16px} .renders img{width:100%;border:1px solid #e5e5e5;border-radius:8px;margin-bottom:8px}
  h2{font-size:20px;margin:.2em 0} .ok{font-size:12px;color:#16794a;border:1px solid #16794a;border-radius:999px;padding:2px 8px}
  .meta,.macros{color:#525252} .macros b{color:#171717}
  .grp h4{margin:.6em 0 .2em;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#737373}
  ul,ol{margin:.2em 0 .6em 1.2em} .hero{display:flex;gap:8px;align-items:center;margin:8px 0}
  .hero img{border-radius:8px} .tips{background:#fafafa;border-left:3px solid #d4d4d4;padding:6px 12px;margin:8px 0}
  .muted{color:#a3a3a3} .warn{color:#b45309} code{background:#f0f0f0;padding:1px 5px;border-radius:4px;font-size:12px}
</style>
<header><h1>Extraction sample — review</h1><p class="sub">${recipes.length} recipes · compare each render with the extracted data · every recipe passed the zod schema</p></header>
${recipes.map(card).join("")}`;

writeFileSync(`${OUT_DIR}/report.html`, html);
console.log(`✓ report → ${OUT_DIR}/report.html`);
