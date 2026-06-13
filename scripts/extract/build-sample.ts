/**
 * Slice-0 sample build — fully parser-driven (D6). For each sample we give only
 * the photo + content page numbers; ALL text/numbers come from the text layer
 * via the parser. Enrich with optimized hero image, validate, write, report.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { renderPage } from "./render.js";
import { optimizeHero } from "./images.js";
import { getPage } from "./pdf.js";
import { parseRecipeSpread } from "./parser.js";
import { RecipeArray, type Recipe } from "../../src/lib/schema/recipe.js";
import { DATA_OUT } from "./config.js";

// Each sample is the set of pages forming one recipe spread (photo + content).
const SAMPLES: number[][] = [
  [47, 48],   // Banana Pancakes — grouped (WET/DRY), tips, video link
  [49, 50],   // Japanese Pancakes — flat list, 12 steps, no tips
  [119, 120], // Dominos Cheesy Bread — macros on photo page, 6 groups incl. nested DOUGH, sub-recipe ref
  [149, 150], // Lou's Sausage Deep Dish Pizza — deep-dish layout
  [291, 292], // Foolproof Homemade Marinara — sub-recipe, "(61G SERVING)" macros
];

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-");

const recipes: Recipe[] = [];
for (const pageNums of SAMPLES) {
  const pages = await Promise.all(pageNums.map((n) => getPage(n)));
  const parsed = parseRecipeSpread(pages, pageNums);
  const photoPageNum = pageNums.find((n, i) => !pages[i].items.some((it) => /INGREDIENTS/.test(it.str.replace(/\s/g, "")))) ?? pageNums[0];
  const image = await optimizeHero(renderPage(photoPageNum), slugify(parsed.title));
  const recipe: Recipe = { id: slugify(parsed.title), ...parsed, image, sourcePages: pageNums };
  recipes.push(recipe);
  const nIng = recipe.ingredientGroups.reduce((n, g) => n + g.ingredients.length, 0);
  console.log(`✓ ${recipe.title} [${recipe.category}]: ${recipe.macros.calories}cal ${recipe.macros.protein}p · groups ${recipe.ingredientGroups.map((g) => g.name + "(" + g.ingredients.length + ")").join("/")} · ${nIng} ing · ${recipe.steps.length} steps · prep ${recipe.prepTimeMin} cook ${recipe.cookTimeMin} · video ${recipe.videoUrl ? "yes" : "no"}`);
}

const validated = RecipeArray.parse(recipes);
mkdirSync(DATA_OUT, { recursive: true });
writeFileSync(`${DATA_OUT}/recipes.sample.json`, JSON.stringify(validated, null, 2) + "\n");
console.log(`\n✓ ${validated.length} recipes validated → ${DATA_OUT}/recipes.sample.json`);
