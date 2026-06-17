import type { Macros, Recipe } from "../schema/recipe";
import type { CustomLine, CustomRecipe } from "../schema/custom";
import { ingredientById } from "./ingredientsDb";

const ZERO: Macros = { calories: 0, fat: 0, carbs: 0, netCarbs: null, protein: 0 };
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Reference {per, macros} for a line: the stored snapshot, or (legacy lines) the book DB. */
function lineRef(line: CustomLine): { per: { amount: number }; macros: Macros } | null {
  if (line.macros && line.per) return { per: line.per, macros: line.macros };
  const e = ingredientById.get(line.ingredientId);
  return e ? { per: e.per, macros: e.macros } : null;
}

/**
 * Macro contribution of one line, scaled linearly from the ingredient's
 * reference amount (the book's method, D8): value * grams / per.amount.
 */
export function lineMacros(line: CustomLine): Macros {
  const ref = lineRef(line);
  if (!ref || ref.per.amount <= 0 || line.grams <= 0) return ZERO;
  const f = line.grams / ref.per.amount;
  return {
    calories: ref.macros.calories * f,
    fat: ref.macros.fat * f,
    carbs: ref.macros.carbs * f,
    netCarbs: null, // owner does not rely on net carbs; left null for custom recipes
    protein: ref.macros.protein * f,
  };
}

/** Sum the whole-recipe macros across all lines. */
export function totalMacros(lines: CustomLine[]): Macros {
  const t = { calories: 0, fat: 0, carbs: 0, protein: 0 };
  for (const l of lines) {
    const m = lineMacros(l);
    t.calories += m.calories;
    t.fat += m.fat;
    t.carbs += m.carbs;
    t.protein += m.protein;
  }
  return { calories: round1(t.calories), fat: round1(t.fat), carbs: round1(t.carbs), netCarbs: null, protein: round1(t.protein) };
}

/** Whole-recipe macros divided by serving count (what the cards/detail show). */
export function perServingMacros(lines: CustomLine[], servings: number): Macros {
  const t = totalMacros(lines);
  const s = Math.max(1, servings);
  return {
    calories: Math.round(t.calories / s),
    fat: round1(t.fat / s),
    carbs: round1(t.carbs / s),
    netCarbs: null,
    protein: round1(t.protein / s),
  };
}

/**
 * Adapt a stored CustomRecipe to the Recipe shape so it renders and aggregates
 * exactly like a book recipe everywhere (browse, detail, scaler, planner,
 * shopping - D31). Image/video/times are null; tips/references empty.
 */
export function customToRecipe(c: CustomRecipe, lang: "en" | "ro" = "en"): Recipe {
  const ro = lang === "ro";
  const ingredients = c.lines.map((l) => ({ amount: l.grams, unit: "g", item: (ro && l.name_ro) || l.name }));
  const stepSrc = ro && c.steps_ro?.length ? c.steps_ro : c.steps;
  const steps = stepSrc
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text, i) => ({ n: i + 1, text }));
  return {
    id: c.id,
    title: (ro && c.title_ro) || c.title,
    category: c.category || "Custom",
    servings: c.servings,
    macros: perServingMacros(c.lines, c.servings),
    ingredientGroups: [{ name: "Ingredients", ingredients }],
    steps,
    image: null,
    videoUrl: null,
    prepTimeMin: null,
    cookTimeMin: null,
    tips: [],
    references: [],
    sourcePages: [],
  };
}

export const isCustomId = (id: string) => id.startsWith("c-");
/** A custom recipe has a switchable Romanian version when the AI produced one. */
export const hasRomanian = (c: CustomRecipe) => !!(c.title_ro || c.steps_ro?.length || c.lines.some((l) => l.name_ro));
