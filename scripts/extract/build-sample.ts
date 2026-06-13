/**
 * Slice-0 sample build — fully parser-driven (D6). For each sample we give only
 * the photo + content page numbers; ALL text/numbers come from the text layer
 * via the parser. Enrich with optimized hero image, validate, write, report.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { renderPage } from "./render.js";
import { optimizeHero } from "./images.js";
import { getPage } from "./pdf.js";
import { parseRecipePage } from "./parser.js";
import { RecipeArray, type Recipe } from "../../src/lib/schema/recipe.js";
import { DATA_OUT } from "./config.js";

const SAMPLES = [
  { photoPage: 47, contentPage: 48 }, // Banana Pancakes (grouped, tips, video link)
  { photoPage: 49, contentPage: 50 }, // Japanese Pancakes (flat list, 12 steps, no tips)
];

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-");

const recipes: Recipe[] = [];
for (const s of SAMPLES) {
  const page = await getPage(s.contentPage);
  const parsed = parseRecipePage(page, [s.photoPage, s.contentPage]);
  const image = await optimizeHero(renderPage(s.photoPage), slugify(parsed.title));
  const recipe: Recipe = { id: slugify(parsed.title), ...parsed, image, sourcePages: [s.photoPage, s.contentPage] };
  recipes.push(recipe);
  console.log(`✓ ${recipe.title}: ${recipe.macros.calories}cal ${recipe.macros.protein}p · ${recipe.ingredientGroups.reduce((n, g) => n + g.ingredients.length, 0)} ingredients · ${recipe.steps.length} steps · video ${recipe.videoUrl ?? "none"}`);
}

const validated = RecipeArray.parse(recipes);
mkdirSync(DATA_OUT, { recursive: true });
writeFileSync(`${DATA_OUT}/recipes.sample.json`, JSON.stringify(validated, null, 2) + "\n");
console.log(`\n✓ ${validated.length} recipes validated → ${DATA_OUT}/recipes.sample.json`);
