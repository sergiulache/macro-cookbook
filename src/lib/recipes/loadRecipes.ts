import data from "../../data/generated/recipes.json";
import { RecipeArray, type Recipe } from "../schema/recipe";

// Validate the bundled data at load - the build-time gate (D33).
export const recipes: Recipe[] = RecipeArray.parse(data);
export const recipeById = new Map(recipes.map((r) => [r.id, r]));
export const categories = Array.from(new Set(recipes.map((r) => r.category)));

/** Resolve a bundled image path against the deploy base (D26 routing/base). */
export const imageUrl = (src: string) => import.meta.env.BASE_URL + src;

export type { Recipe };
