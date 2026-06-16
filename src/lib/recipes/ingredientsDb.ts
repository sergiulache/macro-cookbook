import data from "../../data/generated/ingredients.json";
import { IngredientDBArray, type IngredientDBEntry } from "../schema/ingredient";

/** The book's per-ingredient macro database (D2), validated at load like recipes (D33). */
export const ingredients: IngredientDBEntry[] = IngredientDBArray.parse(data);
export const ingredientById = new Map(ingredients.map((i) => [i.id, i]));

/** Human label for a DB entry: name plus brand when the book specified one. */
export const ingredientLabel = (i: IngredientDBEntry) => (i.brand ? `${i.name} (${i.brand})` : i.name);

const CATEGORY_ORDER: Record<string, number> = { meat: 0, vegetable: 1, fruit: 2, pantry: 3, seasoning: 4 };

/** Cheap client-side search over name + brand, ranked by match position then category. */
export function searchIngredients(query: string, limit = 30): IngredientDBEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored = ingredients
    .map((i) => {
      const hay = `${i.name} ${i.brand ?? ""}`.toLowerCase();
      const idx = hay.indexOf(q);
      return { i, idx };
    })
    .filter((x) => x.idx >= 0)
    .sort(
      (a, b) =>
        a.idx - b.idx ||
        (CATEGORY_ORDER[a.i.category] ?? 9) - (CATEGORY_ORDER[b.i.category] ?? 9) ||
        a.i.name.localeCompare(b.i.name),
    );
  return scored.slice(0, limit).map((x) => x.i);
}

export type { IngredientDBEntry };
