import type { Recipe } from "../schema/recipe";
import type { PlanEntry } from "../data/useWeekPlan";

export interface ShopItem {
  id: string; item: string; unit: string | null; amount: number | null;
  category: string; checked: boolean; manual?: boolean;
}

// Basic store categories (D13). A clean seam for later AI aisle-ordering (D14).
const CATEGORY_RULES: [RegExp, string][] = [
  [/chicken|beef|pork|bacon|sausage|steak|turkey|\bham\b|ground|patty|patties|meatball|deli/i, "Meat"],
  [/milk|cheese|yogurt|butter|\begg\b|eggs|cream|mozzarella|parmesan|parmigiano|feta|cheddar/i, "Dairy & Eggs"],
  [/onion|tomato|lettuce|garlic|pepper|cucumber|lemon|lime|banana|potato|parsley|cilantro|spinach|avocado|jalape|romaine|scallion|herb|fruit|berry|berries|apple|pickled/i, "Produce"],
  [/frozen|ice cream/i, "Frozen"],
  [/flour|sugar|salt|\boil\b|sauce|spice|powder|\brice\b|pasta|bread|tortilla|vinegar|erythritol|baking|yeast|cornmeal|panko|breadcrumb|seasoning|honey|syrup|marinara|bouillon|mustard|sriracha|broth|stock|extract|cocoa/i, "Pantry"],
];
const categorize = (item: string) => CATEGORY_RULES.find(([re]) => re.test(item))?.[1] ?? "Other";

/**
 * Aggregate a week's planned recipes into a shopping list (D13): sum quantities
 * with matching item+unit, keep mismatched units as separate lines, group by
 * store category. Quantities scale by each entry's serving count.
 */
export function aggregate(entries: PlanEntry[], byId: Map<string, Recipe>): ShopItem[] {
  const map = new Map<string, ShopItem>();
  for (const e of entries) {
    const r = byId.get(e.recipeId);
    if (!r) continue;
    const factor = e.servings / r.servings;
    for (const g of r.ingredientGroups) {
      for (const ing of g.ingredients) {
        const key = `${ing.item.toLowerCase().trim()}|${ing.unit ?? ""}`;
        const scaled = ing.amount != null ? ing.amount * factor : null;
        const ex = map.get(key);
        if (ex) { if (ex.amount != null && scaled != null) ex.amount += scaled; }
        else map.set(key, { id: key.replace(/\W+/g, "-").slice(0, 60), item: ing.item, unit: ing.unit, amount: scaled, category: categorize(ing.item), checked: false });
      }
    }
  }
  return [...map.values()]
    .map((i) => ({ ...i, amount: i.amount != null ? Math.round(i.amount * 10) / 10 : null }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.item.localeCompare(b.item));
}

export const CATEGORY_ORDER = ["Produce", "Meat", "Dairy & Eggs", "Pantry", "Frozen", "Other"];
