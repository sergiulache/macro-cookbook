/**
 * Slice-0 sample: recipes I authored by reading the rendered pages (D6), then
 * enriched with optimized hero images + decoded video URLs, validated against
 * the zod schema, and written to disk. Proves the method + schema end-to-end on
 * representative cases (grouped vs flat ingredients, tips vs none, group refs).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { renderPage } from "./render.js";
import { optimizeHero } from "./images.js";
import { decodeQrFromPage } from "./qr.js";
import { RecipeArray, type Recipe } from "../../src/lib/schema/recipe.js";
import { DATA_OUT, PAGES_DIR } from "./config.js";

// ---- authored from the pages (photo page / content page) -------------------

type Authored = Omit<Recipe, "image" | "videoUrl"> & { photoPage: number; contentPage: number };

const authored: Authored[] = [
  {
    id: "banana-pancakes",
    title: "Banana Pancakes",
    category: "Breakfast Bliss",
    servings: 1,
    macros: { calories: 351, fat: 2, carbs: 72, netCarbs: 47, protein: 37 },
    ingredientGroups: [
      { name: "Wet", ingredients: [
        { amount: 120, unit: "g", item: "banana" },
        { amount: 100, unit: "g", item: "egg whites" },
        { amount: 4.2, unit: "g", item: "vanilla extract" },
        { amount: 25, unit: "g", item: "granulated erythritol" },
      ]},
      { name: "Dry", ingredients: [
        { amount: 20, unit: "g", item: "all-purpose flour" },
        { amount: 30, unit: "g", item: "PEScience Gourmet Vanilla protein powder" },
        { amount: 1, unit: "g", item: "salt" },
        { amount: 1.5, unit: "g", item: "baking powder" },
      ]},
    ],
    steps: [
      { n: 1, text: "Mash the banana with a fork or hand mixer, add the rest of your Wet Ingredients, and stir to combine." },
      { n: 2, text: "In a separate bowl, combine the Dry Ingredients and mix together." },
      { n: 3, text: "Pour your dry ingredients into your wet ingredients and whisk until just combined." },
      { n: 4, text: "Lightly coat a pan with oil and preheat on medium. When the pan is preheated, add enough batter to the pan to form pancakes in your desired size." },
      { n: 5, text: "After 2-3 minutes or when the bottom of the pancakes are browned, lightly spray the top of the pancakes with oil to prevent any sticking, then flip, and cook the topside." },
      { n: 6, text: "Once cooked to your liking, remove the pancakes from pan, and optionally garnish with a few slices of bananas." },
      { n: 7, text: "Time to eat." },
    ],
    prepTimeMin: 5,
    cookTimeMin: 10,
    tips: ["If bulking or for greater flavor, substitute two whole eggs for the egg whites."],
    references: [
      { raw: "Wet Ingredients", kind: "group", target: "Wet", seconds: null },
      { raw: "Dry Ingredients", kind: "group", target: "Dry", seconds: null },
    ],
    sourcePages: [47, 48],
    photoPage: 47,
    contentPage: 48,
  },
  {
    id: "japanese-pancakes",
    title: "Japanese Pancakes",
    category: "Breakfast Bliss",
    servings: 1,
    macros: { calories: 330, fat: 11, carbs: 45, netCarbs: 20, protein: 38 },
    ingredientGroups: [
      { name: "Ingredients", ingredients: [
        { amount: 2, unit: "egg", item: "eggs" },
        { amount: 40, unit: "g", item: "fat free milk" },
        { amount: 2.1, unit: "g", item: "vanilla extract" },
        { amount: 0.4, unit: "g", item: "salt", note: "pinch" },
        { amount: 18, unit: "g", item: "all-purpose flour" },
        { amount: 30, unit: "g", item: "PEScience Gourmet Vanilla protein powder" },
        { amount: 1, unit: "g", item: "baking powder" },
        { amount: 2, unit: "g", item: "granulated erythritol" },
        { amount: null, unit: null, item: "cream of tartar", note: "dash" },
      ]},
    ],
    steps: [
      { n: 1, text: "In a large bowl, separate egg whites from the yolks and place yolks in a separate bowl." },
      { n: 2, text: "Add milk, vanilla extract, and salt to the yolks." },
      { n: 3, text: "Into the egg yolk mixture, sift flour, protein powder, and baking powder, then mix to combine until smooth." },
      { n: 4, text: "Start blending the egg whites using a hand mixer on low speed. When it begins to foam, add half of the erythritol at a time, adding more once the sweetener is completely mixed in." },
      { n: 5, text: "Once the erythritol has been completely mixed in, the egg whites should be very close to forming stiff peaks; add the cream of tartar and mix for an additional 30 seconds or until stiff peaks have formed." },
      { n: 6, text: "Take a quarter of the meringue and vigorously mix it into the egg yolk mixture." },
      { n: 7, text: "Take the remaining meringue, pour it on top, and gently fold it in until the mixture has just barely come together. The goal here is to not overwork the batter because that will cause the pancake to be noticeably less fluffy." },
      { n: 8, text: "Transfer finished batter to a plastic gallon bag and, when ready to cook, cut the corner of the bag off." },
      { n: 9, text: "Lightly spray a preheated pan on low with oil and pipe batter into the pan where the middle of the pancake will be. Let gravity do the work while slowly raising the bag up as the pancake gets taller and spreads out." },
      { n: 10, text: "Repeat for the other pancakes, add a few drops of water into the pan, and cover." },
      { n: 11, text: "Let pancakes cook for an additional 2-3 minutes, plate it, pour some sugar-free syrup on top, and enjoy!" },
    ],
    prepTimeMin: 10,
    cookTimeMin: 10,
    tips: [],
    references: [],
    sourcePages: [49, 50],
    photoPage: 49,
    contentPage: 50,
  },
];

// ---- pipeline --------------------------------------------------------------

const recipes: Recipe[] = [];
for (const a of authored) {
  const { photoPage, contentPage, ...rest } = a;
  const photoPng = renderPage(photoPage);
  const contentPng = renderPage(contentPage);
  const image = await optimizeHero(photoPng, a.id);
  const decoded = await decodeQrFromPage(contentPng);
  const videoUrl = decoded && /youtu/.test(decoded) ? decoded : null;
  console.log(`${a.id}: video ${videoUrl ?? "(none found)"}`);
  recipes.push({ ...rest, image, videoUrl });
}

const validated = RecipeArray.parse(recipes); // build-time gate (D33)
mkdirSync(DATA_OUT, { recursive: true });
writeFileSync(`${DATA_OUT}/recipes.sample.json`, JSON.stringify(validated, null, 2) + "\n");
console.log(`\n✓ ${validated.length} recipes validated and written to ${DATA_OUT}/recipes.sample.json`);
