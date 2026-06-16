import { z } from "zod";

/**
 * A user-built recipe (D8/D31): full structure minus a photo. Stored per-person
 * at users/{uid}/customRecipes/{id} (Mutually-Viewable, D15). Macros are NOT
 * stored; they are computed from the line grams against the ingredient DB so
 * they always stay consistent with the book's numbers. `name` is snapshotted on
 * each line so a recipe still renders if a DB id ever changes.
 */
export const CustomLine = z.object({
  ingredientId: z.string().min(1),
  name: z.string().min(1),
  grams: z.number().nonnegative(),
});
export type CustomLine = z.infer<typeof CustomLine>;

export const CustomRecipe = z.object({
  id: z.string().min(1),
  ownerUid: z.string().min(1),
  title: z.string().min(1),
  category: z.string().default("Custom"),
  servings: z.number().positive(),
  lines: z.array(CustomLine),
  steps: z.array(z.string()).default([]),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type CustomRecipe = z.infer<typeof CustomRecipe>;
export const CustomRecipeArray = z.array(CustomRecipe);
