/**
 * Parse a recipe content page into structured fields from the exact text layer
 * (D6: text layer is source of truth; never visual reading). Geometry-driven:
 * ingredients in the left column, directions in the right, macros bottom-left,
 * category in the footer, video from the title link annotation (D3).
 */
import type { PageData, TextItem } from "./pdf.js";
import type { Macros, IngredientGroup, Ingredient, Step, Reference } from "../../src/lib/schema/recipe.js";

export interface ParsedRecipe {
  title: string;
  category: string;
  servings: number;
  macros: Macros;
  ingredientGroups: IngredientGroup[];
  steps: Step[];
  prepTimeMin: number | null;
  cookTimeMin: number | null;
  tips: string[];
  videoUrl: string | null;
  references: Reference[];
}

const UNITS = new Set(["g", "kg", "mg", "ml", "l", "tbsp", "tsp", "oz", "lb", "cup", "cups", "qt"]);

/** Collapse the design's letter-spacing ("W E T" → "WET") while keeping word gaps (2+ spaces). */
export function deLetterSpace(s: string): string {
  return s
    .split(/\s{2,}/)
    .map((word) => {
      const t = word.split(" ");
      const singles = t.filter((x) => x.length === 1).length;
      return t.length > 1 && singles / t.length >= 0.6 ? t.join("") : word;
    })
    .join(" ")
    .trim();
}

const norm = (s: string) => deLetterSpace(s).replace(/\s+/g, " ").trim();
/** group items into lines by similar y */
function lines(items: TextItem[]): { y: number; x: number; items: TextItem[]; text: string }[] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const out: { y: number; x: number; items: TextItem[]; text: string }[] = [];
  for (const it of sorted) {
    const last = out[out.length - 1];
    if (last && Math.abs(it.y - last.y) <= 4) {
      last.items.push(it);
      last.text += " " + it.str;
    } else {
      out.push({ y: it.y, x: it.x, items: [it], text: it.str });
    }
  }
  return out;
}

function findLabelY(page: PageData, label: string): number | null {
  const it = page.items.find((i) => norm(i.str).toUpperCase() === label);
  return it ? it.y : null;
}

function parseIngredientLine(text: string): Ingredient | null {
  const t = text.trim();
  if (!t) return null;
  // "Pinch salt (~.4 grams)" / "Dash cream of tartar"
  const pinch = /^(pinch|dash)\s+(.*)$/i.exec(t);
  if (pinch) {
    const m = /\(~?\s*(\.?\d*\.?\d+)\s*grams?\)/i.exec(pinch[2]);
    const item = pinch[2].replace(/\s*\(.*?\)\s*/g, "").trim();
    return { amount: m ? Number(m[1]) : null, unit: m ? "g" : null, item, note: pinch[1].toLowerCase() };
  }
  // leading amount with attached unit ("120g banana") or spaced count ("2 eggs")
  const m = /^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?\s+(.*)$/.exec(t);
  if (m) {
    const amount = Number(m[1]);
    const maybeUnit = m[2]?.toLowerCase();
    if (maybeUnit && UNITS.has(maybeUnit)) return { amount, unit: maybeUnit, item: m[3].trim() };
    // no recognized unit -> token belongs to the item ("2 eggs")
    return { amount, unit: null, item: [m[2], m[3]].filter(Boolean).join(" ").trim() };
  }
  return { amount: null, unit: null, item: t };
}

function isGroupHeader(text: string): boolean {
  const n = norm(text);
  return /^[A-Z][A-Z ]+$/.test(n) && !/\d/.test(n) && n.length <= 24;
}

function parseMacros(page: PageData, macrosY: number): Macros {
  const macro: Partial<Macros> = {};
  for (const ln of lines(page.items.filter((i) => i.x < 150 && i.y > macrosY + 5))) {
    const n = norm(ln.text).toUpperCase().replace(/\s+/g, "");
    const m = /^(\d+)G?(CALORIES|FAT|NETCARBS|CARBS|PROTEIN)$/.exec(n);
    if (!m) continue;
    const v = Number(m[1]);
    if (m[2] === "CALORIES") macro.calories = v;
    else if (m[2] === "FAT") macro.fat = v;
    else if (m[2] === "NETCARBS") macro.netCarbs = v;
    else if (m[2] === "CARBS") macro.carbs = v;
    else if (m[2] === "PROTEIN") macro.protein = v;
  }
  return {
    calories: macro.calories ?? 0, fat: macro.fat ?? 0, carbs: macro.carbs ?? 0,
    netCarbs: macro.netCarbs ?? null, protein: macro.protein ?? 0,
  };
}

function parseTimes(page: PageData): { servings: number; prep: number | null; cook: number | null } {
  const valueBelow = (label: string): string | null => {
    const lab = page.items.find((i) => norm(i.str).toUpperCase() === label);
    if (!lab) return null;
    // value may be split across items ("1 0" + "M I N S"); gather the whole row
    const row = page.items
      .filter((i) => i.y > lab.y && i.y < lab.y + 22 && i.x > lab.x - 20 && i.x < lab.x + 90)
      .sort((a, b) => a.x - b.x)
      .map((i) => i.str)
      .join(" ");
    return row ? norm(row) : null;
  };
  const mins = (s: string | null) => (s ? Number((/(\d+)\s*MIN/i.exec(s.replace(/\s+/g, "")) ?? [])[1] ?? NaN) : NaN);
  const serves = valueBelow("SERVES");
  return {
    servings: serves ? Number((/\d+/.exec(serves.replace(/\s+/g, "")) ?? ["1"])[0]) : 1,
    prep: Number.isFinite(mins(valueBelow("PREP"))) ? mins(valueBelow("PREP")) : null,
    cook: Number.isFinite(mins(valueBelow("COOK"))) ? mins(valueBelow("COOK")) : null,
  };
}

export function parseRecipePage(page: PageData, sourcePages: number[]): ParsedRecipe {
  const ingHeaderY = findLabelY(page, "INGREDIENTS") ?? 220;
  const dirHeaderX = page.items.find((i) => norm(i.str).toUpperCase() === "DIRECTIONS")?.x ?? 210;
  const colSplit = Math.min(dirHeaderX - 10, 180);
  const macrosY = findLabelY(page, "MACROS") ?? page.height - 180;
  const tipItem = page.items.find((i) => /^TIP/i.test(norm(i.str)));
  const tipY = tipItem ? tipItem.y : Infinity;

  // ---- title: largest-font item in the top band (not the running header) ----
  const topItems = page.items.filter((i) => i.y < ingHeaderY - 10 && norm(i.str).toUpperCase() !== "DIET CHEAT CODES");
  const title = norm([...topItems].sort((a, b) => b.h - a.h)[0]?.str ?? "Untitled")
    .replace(/\b([A-Z])([A-Z]+)\b/g, (_, a, b) => a + b.toLowerCase()); // TITLECASE the all-caps heading

  // ---- category: footer-left text ----
  const footer = page.items.filter((i) => i.y > page.height - 40 && !/^\d+$/.test(i.str.trim()));
  const category = norm(footer.sort((a, b) => a.x - b.x)[0]?.str ?? "Uncategorized");

  // ---- ingredients (left column, gap-bounded so the photo caption is excluded) ----
  const leftLines = lines(page.items.filter((i) => i.x < colSplit && i.y > ingHeaderY + 4 && i.y < macrosY - 4));
  const groups: IngredientGroup[] = [];
  let cur: IngredientGroup | null = null;
  let prevY = ingHeaderY;
  for (const ln of leftLines) {
    if (ln.y - prevY > 30 && cur) break; // big gap -> end of ingredient block (caption follows)
    prevY = ln.y;
    const text = ln.text.replace(/\s+/g, " ").trim();
    if (isGroupHeader(text)) { cur = { name: norm(text), ingredients: [] }; groups.push(cur); continue; }
    if (!cur) { cur = { name: "Ingredients", ingredients: [] }; groups.push(cur); }
    // continuation line (no leading number, previous ingredient exists) -> append
    if (cur.ingredients.length && !/^(\d|\bpinch\b|\bdash\b)/i.test(text)) {
      const last = cur.ingredients[cur.ingredients.length - 1];
      last.item = (last.item + " " + text).trim();
      continue;
    }
    const ing = parseIngredientLine(text);
    if (ing) cur.ingredients.push(ing);
  }

  // ---- directions (right column, bounded above the tip block) ----
  const rightItems = page.items.filter((i) => i.x >= colSplit && i.y > ingHeaderY + 4 && i.y < tipY - 2 && norm(i.str).toUpperCase() !== "DIRECTIONS");
  const stepStarts = rightItems.filter((i) => /^\d+\.$/.test(i.str.trim())).sort((a, b) => a.y - b.y);
  const steps: Step[] = stepStarts.map((s, idx) => {
    const yEnd = stepStarts[idx + 1]?.y ?? Infinity;
    const text = rightItems
      .filter((i) => !/^\d+\.$/.test(i.str.trim()) && i.y >= s.y - 3 && i.y < yEnd - 3 && i.x > s.x + 5)
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((i) => i.str).join(" ").replace(/\s+/g, " ").trim();
    return { n: Number(s.str.replace(".", "")), text };
  }).filter((s) => s.text);

  // ---- tips ----
  const tips: string[] = [];
  if (tipItem) {
    const tipText = page.items
      .filter((i) => i !== tipItem && i.y >= tipItem.y - 2 && i.y < page.height - 40 && i.x >= tipItem.x - 2)
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((i) => i.str).join(" ")
      .replace(/^\s*:?\s*/, "").replace(/\s+/g, " ").trim();
    if (tipText) tips.push(tipText);
  }

  // ---- video: youtube link annotation (usually on the title) ----
  const videoUrl = page.links.find((l) => /youtu\.?be|youtube/.test(l.url))?.url ?? null;

  // ---- references: group names mentioned in steps (D21) ----
  const groupNames = groups.map((g) => g.name).filter((n) => n.toLowerCase() !== "ingredients");
  const references: Reference[] = [];
  for (const s of steps) {
    for (const g of groupNames) {
      const re = new RegExp(`\\b${g}\\s+Ingredients\\b|\\b${g}\\b(?=\\s+Ingredients)`, "i");
      if (re.test(s.text) && !references.some((r) => r.target === g)) {
        references.push({ raw: `${g} Ingredients`, kind: "group", target: g, seconds: null });
      }
    }
  }

  const { servings, prep, cook } = parseTimes(page);
  return { title, category, servings, macros: parseMacros(page, macrosY), ingredientGroups: groups, steps, prepTimeMin: prep, cookTimeMin: cook, tips, videoUrl, references };
}
