import type { Recipe } from "../schema/recipe";

/** Auto-tags derived from data we already have (D7): macro-, time-, meal-type-based. */
export function deriveTags(r: Recipe): string[] {
  const t: string[] = [];
  const m = r.macros;
  if (m.protein >= 30) t.push("High Protein");
  if (m.calories > 0 && m.calories <= 400) t.push("Low Calorie");
  if (m.netCarbs != null && m.netCarbs <= 15) t.push("Low Carb");
  const time = (r.prepTimeMin ?? 0) + (r.cookTimeMin ?? 0);
  if (time > 0 && time <= 30) t.push("Quick");
  if (/ice cream|sorbet|cookie|sweet|dough/i.test(r.category)) t.push("Dessert");
  return t;
}

export const ALL_TAGS = ["High Protein", "Low Calorie", "Low Carb", "Quick", "Dessert"] as const;

export const totalTimeMin = (r: Recipe) => (r.prepTimeMin ?? 0) + (r.cookTimeMin ?? 0);
