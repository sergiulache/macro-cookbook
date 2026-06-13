/**
 * Deterministic completeness check: every title word, macro number, and
 * ingredient in the extracted JSON must appear in the source page text. Catches
 * wrong/hallucinated/jumbled data without vision. Normalizes away letter-spacing
 * and line-wraps by stripping all non-alphanumerics before substring matching.
 *
 *   yarn verify
 */
import { readFileSync } from "node:fs";
import { getPage } from "./pdf.js";
import { RecipeArray } from "../../src/lib/schema/recipe.js";
import { DATA_OUT } from "./config.js";

const recipes = RecipeArray.parse(JSON.parse(readFileSync(`${DATA_OUT}/recipes.json`, "utf8")));
const flat = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
const STOP = new Set(["the", "of", "and", "a", "to", "with", "or", "on", "for", "in"]);

let problems = 0;
for (const r of recipes) {
  let text = "";
  for (const p of r.sourcePages) {
    try { text += (await getPage(p)).items.map((i) => i.str).join(" "); } catch {}
  }
  const hay = flat(text);
  const issues: string[] = [];

  // title: every significant word should appear
  for (const w of r.title.split(/\s+/)) if (w.length > 2 && !STOP.has(w.toLowerCase()) && !hay.includes(flat(w))) issues.push(`title word "${w}"`);

  // macros: every nonzero value should appear as digits in the source
  for (const [k, v] of Object.entries(r.macros)) if (typeof v === "number" && v > 0 && !hay.includes(String(v))) issues.push(`macro ${k}=${v}`);

  // ingredients: the longest word of each item should appear
  for (const g of r.ingredientGroups) for (const ing of g.ingredients) {
    const longest = ing.item.split(/\s+/).filter((w) => !STOP.has(w.toLowerCase())).sort((a, b) => b.length - a.length)[0] ?? "";
    if (longest.length > 3 && !hay.includes(flat(longest))) issues.push(`ingredient "${ing.item}"`);
  }

  if (issues.length) { problems++; console.log(`\n✗ ${r.id} (pp.${r.sourcePages.join(",")})`); issues.slice(0, 8).forEach((i) => console.log("    " + i)); }
}
console.log(`\n${problems === 0 ? "✓ all clean" : `✗ ${problems}/${recipes.length} recipes have content not found in source`}`);
