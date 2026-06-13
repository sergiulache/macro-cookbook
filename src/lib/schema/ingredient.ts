import { z } from "zod";
import { Macros } from "./recipe.js";

/**
 * One row of the book's per-ingredient macro reference TABLE (D2).
 * Macros are given for a reference amount (e.g. per 100 g, per 1 egg) and are
 * the source of truth for computing custom-recipe macros (D8, D31).
 */
export const IngredientDBEntry = z.object({
  id: z.string().min(1), // slug
  name: z.string().min(1),
  brand: z.string().nullable(), // book sometimes specifies a brand
  per: z.object({
    amount: z.number().positive(),
    unit: z.string().min(1), // "g", "egg", "tbsp", "ml"
  }),
  macros: Macros,
  note: z.string().optional(),
});
export type IngredientDBEntry = z.infer<typeof IngredientDBEntry>;

export const IngredientDBArray = z.array(IngredientDBEntry);
