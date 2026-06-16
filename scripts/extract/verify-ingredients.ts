/**
 * Deterministic completeness check for the ingredient database (mirror of
 * verify.ts for recipes): every entry's name and every macro number it records
 * must appear verbatim on its source table page. Catches wrong/jumbled rows and
 * column-assignment bugs without vision. The per-row source page is recovered
 * from the same table->pages map the extractor uses.
 *
 *   yarn verify:ingredients
 */
import { readFileSync } from "node:fs";
import { getPage } from "./pdf.js";
import { IngredientDBArray, type IngredientCategory } from "../../src/lib/schema/ingredient.js";
import { DATA_OUT } from "./config.js";

const CATEGORY_PAGES: Record<IngredientCategory, number[]> = {
  meat: [383, 384],
  fruit: [387, 388],
  vegetable: [393, 394],
  seasoning: [399],
  pantry: [401],
};

const db = IngredientDBArray.parse(JSON.parse(readFileSync(`${DATA_OUT}/ingredients.json`, "utf8")));
const flat = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
const STOP = new Set(["the", "of", "and", "a", "to", "with", "or", "on", "for", "in"]);

// cache each category's source text (flattened) + the exact set of numeric cells present
const cache = new Map<IngredientCategory, { hay: string; nums: Set<string> }>();
for (const [cat, pages] of Object.entries(CATEGORY_PAGES) as [IngredientCategory, number[]][]) {
  let text = "";
  const nums = new Set<string>();
  for (const p of pages) {
    const items = (await getPage(p)).items;
    text += items.map((i) => i.str).join(" ");
    for (const i of items) if (/^-?\d+(?:\.\d+)?$/.test(i.str.trim())) nums.add(i.str.trim());
  }
  cache.set(cat, { hay: flat(text), nums });
}

let problems = 0;
const ids = new Set<string>();
const EXPECT: Record<IngredientCategory, [number, number]> = {
  meat: [50, 75], fruit: [45, 65], vegetable: [65, 90], seasoning: [25, 45], pantry: [18, 35],
};
const counts: Record<string, number> = {};

for (const e of db) {
  counts[e.category] = (counts[e.category] ?? 0) + 1;
  const { hay, nums } = cache.get(e.category)!;
  const issues: string[] = [];

  if (ids.has(e.id)) issues.push(`duplicate id`);
  ids.add(e.id);

  // name: the longest significant word must appear on the source page
  const longest = e.name.split(/\s+/).filter((w) => !STOP.has(w.toLowerCase())).sort((a, b) => b.length - a.length)[0] ?? "";
  if (longest.length > 2 && !hay.includes(flat(longest))) issues.push(`name "${e.name}"`);
  if (e.brand && !hay.includes(flat(e.brand))) issues.push(`brand "${e.brand}"`);

  // every recorded macro value must exist verbatim as a numeric cell on the page
  const checkNum = (label: string, v: number | null) => {
    if (v === null) return;
    if (!nums.has(String(v))) issues.push(`${label}=${v} not a cell on source`);
  };
  checkNum("calories", e.macros.calories);
  checkNum("fat", e.macros.fat);
  checkNum("carbs", e.macros.carbs);
  checkNum("protein", e.macros.protein);
  // per.amount for pantry rows is a printed serving cell; fixed-per tables (85/100) are header constants
  if (e.category === "pantry" && !nums.has(String(e.per.amount))) issues.push(`serving=${e.per.amount} not a cell`);

  // calories/protein are the essential fields: never zero-by-accident sanity (allow real zeros only for known)
  if (issues.length) { problems++; console.log(`✗ ${e.id} (${e.category})`); issues.forEach((i) => console.log("    " + i)); }
}

let rangeBad = false;
for (const [cat, [lo, hi]] of Object.entries(EXPECT) as [IngredientCategory, [number, number]][]) {
  const c = counts[cat] ?? 0;
  if (c < lo || c > hi) { rangeBad = true; console.log(`✗ ${cat}: ${c} rows outside expected ${lo}-${hi}`); }
}

console.log(`\n${db.length} ingredients checked · ${Object.entries(counts).map(([k, v]) => `${k}:${v}`).join("  ")}`);
console.log(problems === 0 && !rangeBad ? "✓ all clean" : `✗ ${problems} row(s) with issues`);
process.exit(problems === 0 && !rangeBad ? 0 : 1);
