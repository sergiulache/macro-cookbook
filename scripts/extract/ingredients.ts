/**
 * Parse the book's per-ingredient macro reference TABLES (D2) into the typed
 * ingredient database that powers the custom-recipe builder (D8/D31).
 *
 * The tables are clean, column-aligned grids in the REFERENCE TABLES section
 * (pp.376-401). Each ingredient table is printed in several sort orders that
 * repeat the same rows; we read ONLY the alphabetical page(s) of each so nothing
 * is double-counted. Geometry: one name item on the left (x<nameMax) plus N
 * right-aligned numeric items, one per macro column. Source of truth is the
 * exact text layer (D6); numbers are never read visually.
 *
 *   yarn extract:ingredients   ->  src/data/generated/ingredients.json
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { getPage, type TextItem } from "./pdf.js";
import { IngredientDBArray, type IngredientDBEntry, type IngredientCategory } from "../../src/lib/schema/ingredient.js";
import { DATA_OUT } from "./config.js";

/** Column keys, in left-to-right print order, per table. */
type Col = "serving" | "calories" | "fat" | "carbs" | "protein" | "fiber";

interface TableSpec {
  category: IngredientCategory;
  pages: number[]; // alphabetical sort only (skip the by-calories / by-fiber dupes)
  cols: Col[]; // numeric columns left-to-right
  centers: number[]; // x of each numeric column's printed value (parallel to cols)
  per: { amount: number; unit: string } | "row"; // "row" = serving size is the first column
  note?: string;
  nameMaxX: number; // x below which an item belongs to the name, not a number
  expect: [number, number]; // [min, max] sanity range for row count
}

// Numbers are assigned to columns by nearest printed x-center, so a blank cell
// (e.g. fruit/veg with no fiber listed, like "Fiddleheads") leaves that column
// empty instead of shifting every value one column left.
const TOL = 40;
const TABLES: TableSpec[] = [
  { category: "meat", pages: [383, 384], cols: ["calories", "fat", "carbs", "protein"], centers: [266, 346, 422, 499],
    per: { amount: 85, unit: "g" }, note: "per 85g cooked (113g raw)", nameMaxX: 210, expect: [50, 75] },
  { category: "fruit", pages: [387, 388], cols: ["calories", "fat", "carbs", "protein", "fiber"], centers: [243, 310, 372, 439, 504],
    per: { amount: 100, unit: "g" }, nameMaxX: 200, expect: [45, 65] },
  { category: "vegetable", pages: [393, 394], cols: ["calories", "fat", "carbs", "protein", "fiber"], centers: [243, 310, 372, 439, 504],
    per: { amount: 100, unit: "g" }, nameMaxX: 200, expect: [65, 90] },
  { category: "seasoning", pages: [399], cols: ["calories", "fat", "carbs", "protein"], centers: [266, 346, 422, 499],
    per: { amount: 100, unit: "g" }, nameMaxX: 210, expect: [25, 45] },
  { category: "pantry", pages: [401], cols: ["serving", "calories", "fat", "carbs", "protein"], centers: [200, 278, 345, 413, 495],
    per: "row", nameMaxX: 165, expect: [18, 35] },
];

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-");
const isNum = (s: string) => /^-?\d+(?:\.\d+)?$/.test(s.trim());
const num = (s: string) => Number(s.trim());

/** Group a page's items into print rows (same baseline within 4px). */
function rows(items: TextItem[]): { y: number; cells: TextItem[] }[] {
  const out: { y: number; cells: TextItem[] }[] = [];
  for (const it of [...items].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const last = out[out.length - 1];
    if (last && Math.abs(it.y - last.y) <= 4) last.cells.push(it);
    else out.push({ y: it.y, cells: [it] });
  }
  return out;
}

/** Split a brand out of a trailing "(...)" only for the pantry table. */
function splitBrand(name: string): { name: string; brand: string | null } {
  const m = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(name);
  if (m) return { name: m[1].trim(), brand: m[2].trim() };
  return { name, brand: null };
}

const skipped: string[] = [];

function parseTable(spec: TableSpec, pageItems: Map<number, TextItem[]>): IngredientDBEntry[] {
  const entries: IngredientDBEntry[] = [];
  for (const pn of spec.pages) {
    const items = pageItems.get(pn)!;
    const height = Math.max(...items.map((i) => i.y), 720);
    // data band: below the column-header row (~y101), above the footer (~y696)
    const band = items.filter((i) => i.y > 110 && i.y < height - 24);
    for (const r of rows(band)) {
      const nameCells = r.cells.filter((c) => c.x < spec.nameMaxX).sort((a, b) => a.x - b.x);
      const numCells = r.cells.filter((c) => c.x >= spec.nameMaxX && isNum(c.str)).sort((a, b) => a.x - b.x);
      const rawName = nameCells.map((c) => c.str).join(" ").replace(/\s+/g, " ").trim();
      if (!rawName) continue;
      // assign each numeric cell to its nearest column by printed x-center
      const byCol: Partial<Record<Col, number>> = {};
      for (const c of numCells) {
        let best = -1, bestD = Infinity;
        spec.centers.forEach((cx, i) => { const d = Math.abs(c.x - cx); if (d < bestD) { bestD = d; best = i; } });
        if (bestD <= TOL) byCol[spec.cols[best]] = num(c.str);
      }
      // essentials must be present (D: calories + protein are the must-haves); else it is a footnote/noise row
      if (byCol.calories == null || byCol.protein == null) {
        skipped.push(`p${pn} y${r.y.toFixed(0)} "${rawName.slice(0, 48)}" (no cal/protein; ${numCells.length} nums)`);
        continue;
      }

      const { name, brand } = spec.category === "pantry" ? splitBrand(rawName) : { name: rawName, brand: null };
      const carbs = byCol.carbs ?? 0;
      const fiber = byCol.fiber;
      // netCarbs only where the book gives fiber (fruit/veg); null otherwise (D: owner does not rely on it)
      const netCarbs = typeof fiber === "number" ? Math.max(0, Math.round((carbs - fiber) * 10) / 10) : null;
      const per = spec.per === "row" ? { amount: byCol.serving ?? 0, unit: "g" } : spec.per;

      entries.push({
        id: slugify(brand ? `${name}-${brand}` : name),
        name,
        brand,
        category: spec.category,
        per,
        macros: {
          calories: byCol.calories ?? 0,
          fat: byCol.fat ?? 0,
          carbs,
          netCarbs,
          protein: byCol.protein ?? 0,
        },
        ...(spec.note ? { note: spec.note } : {}),
      });
    }
  }
  const n = entries.length;
  if (n < spec.expect[0] || n > spec.expect[1])
    console.warn(`  ! ${spec.category}: ${n} rows outside expected ${spec.expect[0]}-${spec.expect[1]}`);
  return entries;
}

// ---- run ----
const pageItems = new Map<number, TextItem[]>();
for (const pn of TABLES.flatMap((t) => t.pages)) pageItems.set(pn, (await getPage(pn)).items);

const all: IngredientDBEntry[] = [];
const perCat: Record<string, number> = {};
for (const spec of TABLES) {
  const e = parseTable(spec, pageItems);
  perCat[spec.category] = e.length;
  all.push(...e);
}

// de-duplicate ids (e.g. a name shared across tables) with a numeric suffix
const seen = new Map<string, number>();
for (const e of all) {
  if (seen.has(e.id)) { const k = seen.get(e.id)! + 1; seen.set(e.id, k); e.id = `${e.id}-${k}`; }
  else seen.set(e.id, 1);
}

const validated = IngredientDBArray.parse(all);
mkdirSync(DATA_OUT, { recursive: true });
writeFileSync(`${DATA_OUT}/ingredients.json`, JSON.stringify(validated, null, 2) + "\n");

console.log(`\n✓ ${validated.length} ingredients → ${DATA_OUT}/ingredients.json`);
console.log("  " + Object.entries(perCat).map(([k, v]) => `${k}:${v}`).join("  "));
if (skipped.length) {
  console.log(`\nskipped ${skipped.length} non-data row(s) (expected: footnotes):`);
  skipped.forEach((s) => console.log("  - " + s));
}
