/**
 * Build a verified external ingredient set from USDA FoodData Central (SR Legacy)
 * so the custom-recipe builder can find foods the book never tabulated (e.g.
 * tortillas). USDA data is US-government, public domain, analytically derived,
 * and per 100g - which maps straight onto our IngredientDBEntry schema
 * (netCarbs = carbs - fiber, exactly like our own tables).
 *
 * The raw dataset is external and NOT committed (like the source PDF). Download
 * once, then this script normalizes it into a committed JSON:
 *
 *   curl -o /tmp/srl.zip \
 *     https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
 *   unzip -o /tmp/srl.zip -d /tmp/srl
 *   USDA_DIR=/tmp/srl/FoodData_Central_sr_legacy_food_csv_2018-04 \
 *     tsx scripts/extract/usda.ts
 *
 * Output: src/data/generated/usda-ingredients.json
 */
import { createReadStream, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createInterface } from "node:readline";
import { IngredientDBArray, type IngredientDBEntry } from "../../src/lib/schema/ingredient.js";
import { DATA_OUT } from "./config.js";

const DIR = process.env.USDA_DIR ?? "/tmp/srl/FoodData_Central_sr_legacy_food_csv_2018-04";

/** Parse one CSV line: double-quoted fields, embedded commas, "" escapes. */
function parseCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

// USDA food_category_id -> a friendly group for the builder. Ids per food_category.csv.
const GROUP: Record<string, string> = {
  "1": "Dairy & Egg", "2": "Spices", "4": "Fats & Oils", "5": "Meat & Seafood",
  "6": "Soups & Sauces", "7": "Meat & Seafood", "8": "Grains & Cereal", "9": "Fruit",
  "10": "Meat & Seafood", "11": "Vegetable", "12": "Nuts & Seeds", "13": "Meat & Seafood",
  "14": "Beverages", "15": "Meat & Seafood", "16": "Legumes", "17": "Meat & Seafood",
  "18": "Baked Goods", "19": "Sweets", "20": "Grains & Pasta", "21": "Fast Food",
  "22": "Meals & Sides", "23": "Snacks", "24": "Other", "25": "Restaurant",
  "28": "Beverages",
};
const SKIP_CATEGORIES = new Set(["3", "26", "27"]); // Baby Foods, Branded DB, QC Materials

// macro nutrient ids (nutrient.csv)
const ENERGY_KCAL = "1008", ENERGY_ATWATER_SPECIFIC = "2048", ENERGY_ATWATER_GENERAL = "2047", ENERGY_KJ = "1062";
const PROTEIN = "1003", FAT = "1004", CARBS = "1005", FIBER = "1079";
const WANT = new Set([ENERGY_KCAL, ENERGY_ATWATER_SPECIFIC, ENERGY_ATWATER_GENERAL, ENERGY_KJ, PROTEIN, FAT, CARBS, FIBER]);

interface Food { desc: string; cat: string }
const foods = new Map<string, Food>();
for (const line of readFileSync(`${DIR}/food.csv`, "utf8").split(/\r?\n/).slice(1)) {
  if (!line) continue;
  const f = parseCsv(line);
  // drop USDA's boilerplate program note so names stay clean/searchable
  const desc = f[2].trim().replace(/\s*\(Includes foods for USDA'?s Food Distribution Program\)\s*/i, " ").replace(/\s+/g, " ").trim();
  foods.set(f[0], { desc, cat: f[3] });
}

// stream the big food_nutrient.csv, keeping only macro nutrients per food
const nut = new Map<string, Record<string, number>>();
const rl = createInterface({ input: createReadStream(`${DIR}/food_nutrient.csv`), crlfDelay: Infinity });
let first = true;
for await (const line of rl) {
  if (first) { first = false; continue; }
  if (!line) continue;
  // cheap pre-filter before full parse
  const f = parseCsv(line);
  const id = f[2];
  if (!WANT.has(id)) continue;
  const fdc = f[1];
  const amt = Number(f[3]);
  if (!Number.isFinite(amt)) continue;
  (nut.get(fdc) ?? nut.set(fdc, {}).get(fdc)!)[id] = amt;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const entries: IngredientDBEntry[] = [];
let incomplete = 0;
for (const [fdc, food] of foods) {
  if (SKIP_CATEGORIES.has(food.cat)) continue;
  const n = nut.get(fdc);
  if (!n) { incomplete++; continue; }
  const kcal = n[ENERGY_KCAL] ?? n[ENERGY_ATWATER_SPECIFIC] ?? n[ENERGY_ATWATER_GENERAL] ?? (n[ENERGY_KJ] != null ? n[ENERGY_KJ] / 4.184 : undefined);
  const protein = n[PROTEIN], fat = n[FAT], carbs = n[CARBS];
  if (kcal == null || protein == null || fat == null || carbs == null) { incomplete++; continue; }
  const fiber = n[FIBER];
  entries.push({
    id: `usda-${fdc}`,
    name: food.desc,
    brand: null,
    category: GROUP[food.cat] ?? "Other",
    source: "usda",
    per: { amount: 100, unit: "g" },
    macros: {
      calories: Math.round(kcal),
      fat: round1(fat),
      carbs: round1(carbs),
      netCarbs: fiber != null ? Math.max(0, round1(carbs - fiber)) : null,
      protein: round1(protein),
    },
    note: "USDA FoodData Central · per 100g",
  });
}

entries.sort((a, b) => a.name.localeCompare(b.name));
const validated = IngredientDBArray.parse(entries);
mkdirSync(DATA_OUT, { recursive: true });
writeFileSync(`${DATA_OUT}/usda-ingredients.json`, JSON.stringify(validated) + "\n");

const byCat: Record<string, number> = {};
for (const e of validated) byCat[e.category] = (byCat[e.category] ?? 0) + 1;
console.log(`\n✓ ${validated.length} USDA ingredients → ${DATA_OUT}/usda-ingredients.json  (skipped ${incomplete} incomplete)`);
console.log("  " + Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join("  "));
