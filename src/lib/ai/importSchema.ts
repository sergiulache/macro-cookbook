import { z } from "zod";

/** Validates the model's JSON before it touches the UI (the hard gate, D33). */
export const AiIngredient = z.object({
  name: z.string().min(1),
  grams: z.number().nonnegative(),
  calories: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
});

export const AiRecipeDraft = z.object({
  title: z.string().min(1),
  servings: z.number().int().positive(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
  ingredients: z.array(AiIngredient).min(1),
  steps: z.array(z.string()).default([]),
  notes: z.string().optional(),
});
export type AiRecipeDraft = z.infer<typeof AiRecipeDraft>;

/** JSON Schema handed to Gemini's responseSchema so it returns this exact shape. */
export const IMPORT_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    servings: { type: "integer" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          grams: { type: "number" },
          calories: { type: "number" },
          protein: { type: "number" },
          fat: { type: "number" },
          carbs: { type: "number" },
        },
        required: ["name", "grams", "calories", "protein", "fat", "carbs"],
      },
    },
    steps: { type: "array", items: { type: "string" } },
    notes: { type: "string" },
  },
  required: ["title", "servings", "ingredients", "steps"],
} as const;
