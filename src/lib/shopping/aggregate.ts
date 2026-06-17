import type { Recipe, Ingredient } from "../schema/recipe";
import type { PlanEntry } from "../data/useWeekPlan";

export interface ShopItem {
  id: string; item: string; unit: string | null; amount: number | null;
  category: string; checked: boolean; manual?: boolean;
  approx?: boolean; // AI-tidied quantity is an approximation/conversion
  estimated?: boolean; // the model decided the count (recipe gave no quantity)
  servingsFor?: number; // for no-quantity items: how many servings they are needed for
  name_ro?: string; // Romanian-localized name (from AI tidy); falls back to item
}

/** Default grocery section order; editable per household (joint), drives list ordering. */
export const DEFAULT_SECTIONS = ["Produce", "Bakery", "Dairy & Eggs", "Meat", "Fish", "Frozen", "Pantry", "Spices & Sauces", "Snacks & Sweets", "Drinks", "Household", "Other"];

// Basic store categories (D13). A clean seam for later AI aisle-ordering (D14).
const CATEGORY_RULES: [RegExp, string][] = [
  [/chicken|beef|pork|bacon|sausage|steak|turkey|\bham\b|ground|patty|patties|meatball|deli/i, "Meat"],
  [/milk|cheese|yogurt|butter|\begg\b|eggs|cream|mozzarella|parmesan|parmigiano|feta|cheddar/i, "Dairy & Eggs"],
  [/onion|tomato|lettuce|garlic|pepper|cucumber|lemon|lime|banana|potato|parsley|cilantro|spinach|avocado|jalape|romaine|scallion|herb|fruit|berry|berries|apple|pickled/i, "Produce"],
  [/frozen|ice cream/i, "Frozen"],
  [/flour|sugar|salt|\boil\b|sauce|spice|powder|\brice\b|pasta|bread|tortilla|vinegar|erythritol|baking|yeast|cornmeal|panko|breadcrumb|seasoning|honey|syrup|marinara|bouillon|mustard|sriracha|broth|stock|extract|cocoa/i, "Pantry"],
];
const categorize = (item: string) => CATEGORY_RULES.find(([re]) => re.test(item))?.[1] ?? "Other";

const normTitle = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

/** If an ingredient line names another (multi-word) recipe, return that recipe (D24 sub-recipes). */
function matchSubRecipe(ing: Ingredient, titleMap: Map<string, Recipe>, seen: Set<string>): Recipe | null {
  if (!/^[A-Z]/.test(ing.item)) return null; // book capitalizes sub-recipe references; generics are lowercase
  const cands = [normTitle(ing.item), normTitle(ing.item.split(",")[0])];
  for (const c of cands) {
    for (const key of [c, c.replace(/s$/, ""), `${c}s`]) {
      const r = titleMap.get(key);
      if (r && r.title.trim().split(/\s+/).length >= 2 && !seen.has(r.id)) return r;
    }
  }
  return null;
}
const recipeTotalGrams = (r: Recipe) =>
  r.ingredientGroups.reduce((s, g) => s + g.ingredients.reduce((a, i) => a + (i.amount ?? 0), 0), 0);

/**
 * Aggregate a week's planned recipes into a shopping list (D13): sum quantities
 * with matching item+unit, keep mismatched units as separate lines, group by
 * store category. Quantities scale by each entry's serving count. Ingredient
 * lines that are themselves recipes (e.g. "Tzatziki Sauce", a homemade marinara)
 * are NOT added as a line - we expand them into the real ingredients needed for
 * that amount and recurse (D24), so you shop for what you actually buy.
 */
export function aggregate(entries: PlanEntry[], byId: Map<string, Recipe>): ShopItem[] {
  const titleMap = new Map<string, Recipe>();
  for (const r of byId.values()) if (!titleMap.has(normTitle(r.title))) titleMap.set(normTitle(r.title), r);

  const map = new Map<string, ShopItem>();
  // `servings` = the planned portions this line is for, so the AI can infer a
  // count for no-quantity items (e.g. "buns" for 5 servings -> 5 buns).
  const addLine = (ing: Ingredient, factor: number, servings: number) => {
    const key = `${ing.item.toLowerCase().trim()}|${ing.unit ?? ""}`;
    const scaled = ing.amount != null ? ing.amount * factor : null;
    const ex = map.get(key);
    if (ex) {
      if (ex.amount != null && scaled != null) ex.amount += scaled;
      if (scaled == null) ex.servingsFor = (ex.servingsFor ?? 0) + Math.round(servings);
    } else {
      map.set(key, { id: key.replace(/\W+/g, "-").slice(0, 60), item: ing.item, unit: ing.unit, amount: scaled, category: categorize(ing.item), checked: false, ...(scaled == null ? { servingsFor: Math.round(servings) } : {}) });
    }
  };
  const expand = (r: Recipe, factor: number, servings: number, seen: Set<string>, depth: number) => {
    for (const g of r.ingredientGroups) {
      for (const ing of g.ingredients) {
        const sub = depth < 5 ? matchSubRecipe(ing, titleMap, seen) : null;
        if (sub && ing.amount != null) {
          const totalG = recipeTotalGrams(sub);
          if (totalG > 0) { expand(sub, factor * (ing.amount / totalG), servings, new Set([...seen, sub.id]), depth + 1); continue; }
        }
        addLine(ing, factor, servings);
      }
    }
  };

  for (const e of entries) {
    const r = byId.get(e.recipeId);
    if (!r) continue;
    expand(r, e.servings / r.servings, e.servings, new Set([r.id]), 0);
  }
  return [...map.values()]
    .map((i) => ({ ...i, amount: i.amount != null ? Math.round(i.amount * 10) / 10 : null }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.item.localeCompare(b.item));
}

export const CATEGORY_ORDER = ["Produce", "Meat", "Dairy & Eggs", "Pantry", "Frozen", "Other"];
