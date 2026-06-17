import { z } from "zod";
import { Macros } from "./recipe";

/**
 * One row of the book's per-ingredient macro reference TABLE (D2).
 * Macros are given for a reference amount (e.g. per 100 g, per 1 egg) and are
 * the source of truth for computing custom-recipe macros (D8, D31).
 */
/** Book-table category (the 5 reference tables); drives grouping/filtering in the builder. */
export const IngredientCategory = z.enum(["meat", "fruit", "vegetable", "seasoning", "pantry"]);
export type IngredientCategory = z.infer<typeof IngredientCategory>;

/** Where an ingredient's macros come from: the book's tables, the USDA database, or hand-entered. */
export const IngredientSource = z.enum(["book", "usda", "manual", "ai"]);
export type IngredientSource = z.infer<typeof IngredientSource>;

export const IngredientDBEntry = z.object({
  id: z.string().min(1), // slug
  name: z.string().min(1),
  brand: z.string().nullable(), // book sometimes specifies a brand
  category: z.string().min(1), // book: meat/fruit/... · usda: a friendly food group
  source: IngredientSource.default("book"),
  per: z.object({
    amount: z.number().positive(),
    unit: z.string().min(1), // "g", "egg", "tbsp", "ml"
  }),
  macros: Macros,
  note: z.string().optional(), // e.g. "per 85g cooked (113g raw)"
});
export type IngredientDBEntry = z.infer<typeof IngredientDBEntry>;

export const IngredientDBArray = z.array(IngredientDBEntry);
