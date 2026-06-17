import { z } from "zod";

/** Per-serving nutrition (D4). netCarbs is null when the book doesn't list it. */
export const Macros = z.object({
  calories: z.number(),
  fat: z.number(),
  carbs: z.number(),
  netCarbs: z.number().nullable(),
  protein: z.number(),
});
export type Macros = z.infer<typeof Macros>;

/** One ingredient line. amount/unit null = "to taste" / countless. */
export const Ingredient = z.object({
  amount: z.number().nullable(),
  unit: z.string().nullable(),
  item: z.string().min(1),
  note: z.string().optional(), // "(optional)", brand hints, prep ("diced")
  optional: z.boolean().optional(), // shown de-emphasized, can be skipped
});
export type Ingredient = z.infer<typeof Ingredient>;

/**
 * A capitalized group ("DOUGH", "Wet Ingredients") referenced from steps (D21).
 * `ingredients` may be empty: some recipes use a parent header (e.g. DOUGH) over
 * sub-groups (DRY/WET) - the header-only group is kept to preserve structure.
 */
export const IngredientGroup = z.object({
  name: z.string().min(1),
  ingredients: z.array(Ingredient),
});
export type IngredientGroup = z.infer<typeof IngredientGroup>;

export const Step = z.object({
  n: z.number(),
  text: z.string().min(1),
});
export type Step = z.infer<typeof Step>;

export const RecipeImage = z.object({
  src: z.string(), // primary optimized asset (webp)
  srcset: z.string(), // responsive set
  width: z.number(),
  height: z.number(),
  blurDataURL: z.string(), // tiny inline placeholder for blur-up
});
export type RecipeImage = z.infer<typeof RecipeImage>;

/** Resolved cross-reference found in a step (D21-D23). */
export const Reference = z.object({
  raw: z.string(), // the literal text matched
  kind: z.enum(["group", "recipe", "video-timestamp"]),
  target: z.string().nullable(), // group name, recipe id, or null
  seconds: z.number().nullable(), // for video-timestamp
});
export type Reference = z.infer<typeof Reference>;

export const Recipe = z.object({
  id: z.string().min(1), // slug
  title: z.string().min(1),
  category: z.string().min(1),
  servings: z.number().positive(),
  macros: Macros,
  ingredientGroups: z.array(IngredientGroup).min(1),
  steps: z.array(Step).min(1),
  image: RecipeImage.nullable(),
  videoUrl: z.string().url().nullable(),
  prepTimeMin: z.number().nullable(),
  cookTimeMin: z.number().nullable(),
  tips: z.array(z.string()).default([]), // empty → not rendered (D5)
  references: z.array(Reference).default([]),
  sourcePages: z.array(z.number()), // provenance for verification
});
export type Recipe = z.infer<typeof Recipe>;

export const RecipeArray = z.array(Recipe);
