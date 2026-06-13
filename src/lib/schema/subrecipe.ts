import { z } from "zod";
import { IngredientGroup, Step, RecipeImage } from "./recipe.js";

/**
 * A reusable sub-procedure referenced by many recipes (D24): a marinara, a
 * pizza dough, the "Deep Dish Process" spread. Extracted once; recipes link to
 * it (D22). Macros/servings are optional because some are pure technique.
 */
export const SubRecipe = z.object({
  id: z.string().min(1), // slug; recipe references resolve to this
  title: z.string().min(1),
  kind: z.enum(["sub-recipe", "process"]), // ingredients+steps vs technique-only
  ingredientGroups: z.array(IngredientGroup).default([]),
  steps: z.array(Step).min(1),
  image: RecipeImage.nullable(),
  sourcePages: z.array(z.number()),
});
export type SubRecipe = z.infer<typeof SubRecipe>;

export const SubRecipeArray = z.array(SubRecipe);
