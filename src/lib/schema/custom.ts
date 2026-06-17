import { z } from "zod";
import { Macros } from "./recipe";
import { IngredientSource } from "./ingredient";

/**
 * A user-built recipe (D8/D31): full structure minus a photo. Stored per-person
 * at users/{uid}/customRecipes/{id} (Mutually-Viewable, D15).
 *
 * Each line snapshots the chosen ingredient's reference amount + macros, so a
 * custom recipe is self-contained: it renders and totals correctly on browse,
 * detail, planner and shopping WITHOUT loading the large USDA set. `per`/`macros`
 * are optional for backward-compatibility with the earliest book-only lines
 * (those fall back to a lookup in the bundled book DB).
 */
export const CustomLine = z.object({
  ingredientId: z.string().min(1),
  name: z.string().min(1),
  source: IngredientSource.default("book"),
  optional: z.boolean().optional(),
  grams: z.number().nonnegative(),
  per: z.object({ amount: z.number().positive(), unit: z.string().min(1) }).optional(),
  macros: Macros.optional(),
});
export type CustomLine = z.infer<typeof CustomLine>;

export const CustomRecipe = z.object({
  id: z.string().min(1),
  ownerUid: z.string().min(1),
  title: z.string().min(1),
  category: z.string().default("Custom"),
  servings: z.number().positive(),
  prepTimeMin: z.number().nullable().optional(),
  cookTimeMin: z.number().nullable().optional(),
  lines: z.array(CustomLine),
  steps: z.array(z.string()).default([]),
  image: z.string().nullable().optional(), // YouTube thumbnail URL or an uploaded data URL
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type CustomRecipe = z.infer<typeof CustomRecipe>;
export const CustomRecipeArray = z.array(CustomRecipe);
