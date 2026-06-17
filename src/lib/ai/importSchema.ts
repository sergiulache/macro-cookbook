import { z } from "zod";

/** Validates the model's JSON before it touches the UI (the hard gate, D33). */
export const AiIngredient = z.object({
  name: z.string().min(1),
  name_ro: z.string().optional(),
  grams: z.number().nonnegative(),
  calories: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  optional: z.boolean().optional(),
});

export const AiRecipeDraft = z.object({
  title: z.string().min(1),
  title_ro: z.string().optional(),
  servings: z.number().int().positive(),
  category: z.string().optional(),
  prepTimeMin: z.number().nullable().optional(),
  cookTimeMin: z.number().nullable().optional(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
  ingredients: z.array(AiIngredient).min(1),
  steps: z.array(z.string()).default([]),
  steps_ro: z.array(z.string()).default([]),
  notes: z.string().optional(),
});
export type AiRecipeDraft = z.infer<typeof AiRecipeDraft>;

/** JSON Schema handed to Gemini's responseSchema so it returns this exact shape. */
export const IMPORT_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    title_ro: { type: "string" },
    servings: { type: "integer" },
    category: { type: "string" },
    prepTimeMin: { type: "integer" },
    cookTimeMin: { type: "integer" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          name_ro: { type: "string" },
          grams: { type: "number" },
          calories: { type: "number" },
          protein: { type: "number" },
          fat: { type: "number" },
          carbs: { type: "number" },
          optional: { type: "boolean" },
        },
        required: ["name", "name_ro", "grams", "calories", "protein", "fat", "carbs"],
      },
    },
    steps: { type: "array", items: { type: "string" } },
    steps_ro: { type: "array", items: { type: "string" } },
    notes: { type: "string" },
  },
  required: ["title", "title_ro", "servings", "category", "prepTimeMin", "cookTimeMin", "ingredients", "steps", "steps_ro"],
} as const;
