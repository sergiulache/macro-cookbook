import type { Recipe } from "../schema/recipe";
import { recipes } from "./loadRecipes";

const STOP = new Set(["the", "of", "and", "a", "to", "fat", "free", "low", "with", "or", "fresh", "ground", "g", "grams"]);
const wordsOf = (r: Recipe) =>
  new Set(
    r.ingredientGroups
      .flatMap((g) => g.ingredients)
      .flatMap((i) => i.item.toLowerCase().split(/\W+/))
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );

const wordCache = new Map<string, Set<string>>();
const getWords = (r: Recipe) => {
  let w = wordCache.get(r.id);
  if (!w) { w = wordsOf(r); wordCache.set(r.id, w); }
  return w;
};

/** Related recipes by shared category + shared key ingredients + macro proximity (D25). */
export function relatedTo(recipe: Recipe, limit = 4): Recipe[] {
  const mine = getWords(recipe);
  return recipes
    .filter((r) => r.id !== recipe.id)
    .map((r) => {
      const shared = [...getWords(r)].filter((w) => mine.has(w)).length;
      const sameCat = r.category === recipe.category ? 2 : 0;
      const calProx = recipe.macros.calories && r.macros.calories
        ? 1 - Math.min(1, Math.abs(r.macros.calories - recipe.macros.calories) / 600)
        : 0;
      return { r, score: shared + sameCat + calProx };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.r);
}
