/**
 * Parse a recipe SPREAD (photo page + content page, sometimes more) into
 * structured fields from the exact text layer (D6). Geometry-driven and robust
 * to layout variance discovered on real pages:
 *  - macros and ingredients can live on different pages of the spread
 *  - the photo-page caption is the canonical (full) title
 *  - parent headers (DOUGH) sit over sub-groups (DRY/WET) as header-only groups
 *  - prep/cook may be in hours; the footer holds the category
 *  - the video URL is a link annotation (usually on the title) (D3)
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

function lines(items: TextItem[]): { y: number; x: number; text: string }[] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const out: { y: number; x: number; text: string }[] = [];
  for (const it of sorted) {
    const last = out[out.length - 1];
    // join separate items with a DOUBLE space so deLetterSpace keeps the word
    // boundary for letter-spaced multi-word headers ("INSIDE  CHEESE" → "INSIDE CHEESE")
    if (last && Math.abs(it.y - last.y) <= 4) { last.text += "  " + it.str; }
    else out.push({ y: it.y, x: it.x, text: it.str });
  }
  return out;
}
const labelItem = (page: PageData, label: string) => page.items.find((i) => norm(i.str).toUpperCase() === label);
const hasLabel = (page: PageData, label: string) => !!labelItem(page, label);

function parseIngredientLine(text: string): Ingredient | null {
  const t = text.trim();
  if (!t) return null;
  const pinch = /^(pinch|dash)\s+(.*)$/i.exec(t);
  if (pinch) {
    const m = /\(~?\s*(\.?\d*\.?\d+)\s*grams?\)/i.exec(pinch[2]);
    const item = pinch[2].replace(/\s*\(.*?\)\s*/g, "").trim();
    return { amount: m ? Number(m[1]) : null, unit: m ? "g" : null, item, note: pinch[1].toLowerCase() };
  }
  const m = /^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?\s+(.*)$/.exec(t);
  if (m) {
    const amount = Number(m[1]);
    const maybeUnit = m[2]?.toLowerCase();
    if (maybeUnit && UNITS.has(maybeUnit)) return { amount, unit: maybeUnit, item: m[3].trim() };
    return { amount, unit: null, item: [m[2], m[3]].filter(Boolean).join(" ").trim() };
  }
  return { amount: null, unit: null, item: t };
}
// Letter-spaced multi-word headers collapse to one token ("INSIDECHEESE") with
// the word boundary lost in the text layer. Recover it with a greedy
// longest-match over the closed vocabulary of every header word in the book
// (validated to segment all 106 unique headers). Trailing digits ("DREDGE
// STATION 1") are preserved.
const HEADER_VOCAB = [
  "NICKCHICKEN", "NICKWRAP", "CHEESECAKE", "CHOCOLATE", "PARMESAN", "MARINARA", "INGREDIENTS",
  "EMULSIFIER", "QUESADILLA", "SEASONINGS", "SEASONING", "FINISHING", "TOUCHES", "MEATBALL",
  "SANDWICH", "BREAKFAST", "BAGUETTE", "GORDITA", "TANGZHONG", "MEXICAN", "CILANTRO", "FOOLPROOF",
  "HOMEMADE", "GARLIC", "STATIONS", "STATION", "FILLINGS", "FILLING", "DRESSING", "FROSTING",
  "CRACKER", "ANIMAL", "FREEZE", "CHICKEN", "CALZONE", "MASHED", "POTATO", "PROTEIN", "REFRIED",
  "RUSSIAN", "TZATZIKI", "TOSTADA", "MIXTURE", "SAUSAGE", "COOKIE", "CRUNCH", "SPREAD", "BURGER",
  "SALAD", "GYRO", "MARINADE", "BUILD", "BLENDER", "BLEND", "CHEESE", "INSIDE", "OUTSIDE",
  "TOPPINGS", "TOPPING", "COATING", "DOUGH", "DREDGE", "BOWL", "EGGROLL", "EGG", "ROLL", "WASH",
  "ELOTE", "PIZZA", "PASTA", "PINT", "SAUCE", "SPICY", "RANCH", "SALSA", "CREMA", "PICKLED",
  "ONION", "BEANS", "STEAK", "FAJITA", "TACO", "PLATE", "HONEY", "BUTTER", "FRENCH", "TOAST",
  "GLAZE", "ICING", "MEAL", "PREP", "POTPIE", "POT", "PIE", "BUN", "PITA", "WET", "DRY", "MIX",
  "MAC", "AND", "JUS", "SERVING", "WINGS", "BEEF", "LIME", "CHIP", "SPIN", "BREAD", "OG", "AU",
  "ONE", "BATCH", "OIL", "PARM", "FOR",
  // continuation-page + misc recipe section words
  "VEGETABLES", "AROMATICS", "CONDIMENTS", "ROASTED", "SEAFOOD", "BALANCE", "VERDE", "RICE",
  "ROAST", "SLOW", "SHAKE", "MILK", "SLAW", "CRUMBLE", "STREUSEL", "DRIZZLE", "ASSEMBLY", "CRUST",
  "ITALIAN",
].sort((a, b) => b.length - a.length);

export function splitHeaderWords(name: string): string {
  if (name.includes(" ")) return name; // already spaced
  const up = name.toUpperCase();
  const out: string[] = [];
  let i = 0;
  while (i < up.length) {
    if (/\d/.test(up[i])) { const m = up.slice(i).match(/^\d+/)![0]; out.push(m); i += m.length; continue; }
    const w = HEADER_VOCAB.find((v) => up.startsWith(v, i));
    if (!w) return name; // unknown -> leave concatenated (validator will flag it)
    out.push(w);
    i += w.length;
  }
  return out.join(" ");
}
const isGroupHeader = (text: string) => {
  const n = norm(text);
  return /^[A-Z][A-Z0-9 ]*$/.test(n) && n.length <= 28 && !["INGREDIENTS", "DIRECTIONS", "MACROS"].includes(n);
};

function parseMacros(page: PageData): Macros {
  const macrosY = labelItem(page, "MACROS")?.y ?? -1;
  const macro: Partial<Macros> = {};
  if (macrosY < 0) return { calories: 0, fat: 0, carbs: 0, netCarbs: null, protein: 0 };
  for (const ln of lines(page.items.filter((i) => i.y > macrosY + 5 && i.y < macrosY + 160))) {
    const n = norm(ln.text).toUpperCase().replace(/\s+/g, "");
    const m = /(\d+)G?(CALORIES|FAT|NETCARBS|CARBS|PROTEIN)/.exec(n);
    if (!m) continue;
    const v = Number(m[1]);
    if (m[2] === "CALORIES") macro.calories = v;
    else if (m[2] === "FAT") macro.fat = v;
    else if (m[2] === "NETCARBS") macro.netCarbs = v;
    else if (m[2] === "CARBS") macro.carbs = v;
    else if (m[2] === "PROTEIN") macro.protein = v;
  }
  return { calories: macro.calories ?? 0, fat: macro.fat ?? 0, carbs: macro.carbs ?? 0, netCarbs: macro.netCarbs ?? null, protein: macro.protein ?? 0 };
}

function durationMin(s: string | null): number | null {
  if (!s) return null;
  const c = s.replace(/\s+/g, "");
  const hr = /(\d+\.?\d*)\s*HRS?/i.exec(c);
  if (hr) return Math.round(Number(hr[1]) * 60);
  const mn = /(\d+)\s*MIN/i.exec(c);
  return mn ? Number(mn[1]) : null;
}
function parseTimes(page: PageData) {
  const valueBelow = (label: string): string | null => {
    const lab = labelItem(page, label);
    if (!lab) return null;
    const row = page.items
      .filter((i) => i.y > lab.y && i.y < lab.y + 22 && i.x > lab.x - 20 && i.x < lab.x + 90)
      .sort((a, b) => a.x - b.x).map((i) => i.str).join(" ");
    return row ? norm(row) : null;
  };
  const serves = valueBelow("SERVES");
  return {
    servings: serves ? Number((/\d+/.exec(serves.replace(/\s+/g, "")) ?? ["1"])[0]) : 1,
    prep: durationMin(valueBelow("PREP")),
    cook: durationMin(valueBelow("COOK")),
  };
}

// a caption is a short Title-Case phrase (every word capitalized), no trailing period
const isCaption = (t: string) =>
  /^[A-Z0-9][A-Za-z0-9'’.&-]*(?:\s+[A-Z0-9][A-Za-z0-9'’.&-]*)*$/.test(t) &&
  t.split(/\s+/).length <= 6 && /[a-z]/.test(t) && !/\.$/.test(t) && t.toUpperCase() !== "DIET CHEAT CODES";

const TITLE_SMALL = new Set(["and", "on", "the", "of", "with", "a", "to", "in", "or", "for"]);
const titleCase = (s: string) =>
  s.toLowerCase()
    .replace(/(^|\s|-)([a-z])([\wáéíóúñ'’]*)/g, (_, sep, first, rest, off) =>
      sep + (off > 0 && TITLE_SMALL.has(first + rest) ? first : first.toUpperCase()) + rest)
    .replace(/\bOg\b/g, "OG");

/** The left-aligned title block at the top of the PRIMARY content page (title + subtitle).
 *  Must use only the primary page: a continuation page's top-left holds "INGREDIENTS, CONT". */
const TITLE_SKIP = new Set(["DIET CHEAT CODES", "SERVES", "PREP", "COOK", "INGREDIENTS", "DIRECTIONS"]);
function headingTitle(page: PageData): string {
  // title block sits above the serves/prep/cook row (y < 160); drop those labels +
  // their numeric values by content so a centered title (e.g. "REUBEN") is kept.
  const items = page.items.filter((i) => {
    if (i.y >= 160) return false;
    const n = norm(i.str).toUpperCase();
    const c = n.replace(/\s+/g, "");
    return !TITLE_SKIP.has(n) && !/^\d/.test(c) && !/^(MINS?|HRS?)$/.test(c); // drop labels, numbers, stray time units
  });
  if (!items.length) return "";
  return titleCase(norm(lines(items).map((l) => l.text).join(" ")));
}

function parseTitle(pages: PageData[], contentPage: PageData): string {
  let caption = "";
  for (const p of pages) {
    // on a content page the caption shares its row with ingredient/step columns,
    // so restrict to the centered band (x 60-200); on a photo page allow any x
    const isContentPg = !!ingHeaderItem(p);
    const cap = p.items
      .filter((i) => i.y > 470 && i.y < 535 && (!isContentPg || (i.x >= 60 && i.x <= 200)))
      .map((i) => norm(i.str)).find(isCaption);
    if (cap) { caption = cap; break; }
  }
  const heading = headingTitle(contentPage);
  // pick the fuller name (caption is fuller for some recipes, heading for others)
  const wc = (s: string) => (s ? s.trim().split(/\s+/).length : 0);
  const best = wc(heading) > wc(caption) ? heading : caption || heading;
  return best || "Untitled";
}

// Normalize the book's playful section names to plain categories.
const CATEGORY_MAP: Record<string, string> = {
  "Breakfast Bliss": "Breakfast",
  "Midday Munchies": "Lunch",
  "Dinner is Served": "Dinner",
  "Sweet Treats": "Desserts",
  "Blender Ice Cream": "Ice Cream",
  "Ice Cream Pints": "Ice Cream",
  "Fruit Sorbets": "Sorbets",
  "Cookie Dough": "Cookie Dough",
  "Shareables": "Snacks",
  "Let's Get Saucy": "Sauces",
  "Doughlicious": "Breads",
  "Prep School": "Meal Prep",
};
function parseCategory(page: PageData): string {
  const footer = page.items.filter((i) => i.y > page.height - 22 && !/^\d+$/.test(i.str.trim()));
  const raw = norm(footer.sort((a, b) => a.x - b.x)[0]?.str ?? "Uncategorized").replace(/[’']/g, "'");
  return CATEGORY_MAP[raw] ?? raw;
}

const ingHeaderItem = (p: PageData) => p.items.find((i) => /^INGREDIENTS/.test(norm(i.str).toUpperCase()));
const dirHeaderX = (p: PageData) => p.items.find((i) => /^DIRECTIONS/.test(norm(i.str).toUpperCase()))?.x ?? 210;

function parseIngredients(page: PageData): IngredientGroup[] {
  const ingItem = ingHeaderItem(page);
  if (!ingItem) return [];
  const ingY = ingItem.y;
  const colSplit = Math.min(dirHeaderX(page) - 10, 180);
  const macrosY = labelItem(page, "MACROS")?.y ?? page.height;
  const ll = lines(page.items.filter((i) => i.x < colSplit && i.y > ingY + 4 && i.y < Math.min(macrosY - 4, page.height - 22)));
  const groups: IngredientGroup[] = [];
  let cur: IngredientGroup | null = null;
  let prevY = ingY;
  for (const ln of ll) {
    if (ln.y - prevY > 70 && cur?.ingredients.length) break; // caption/photo gap on single-page layouts
    prevY = ln.y;
    const text = ln.text.replace(/\s+/g, " ").trim();
    // an all-caps line right after an ingredient whose text ends in CAPS is a
    // wrapped continuation (e.g. "40g FOOLPROOF HOMEMADE" + "MARINARA"), NOT a header
    const lastIng = cur?.ingredients[cur.ingredients.length - 1];
    const contCaps = !!lastIng && /[A-Z]{2,}\s*$/.test(lastIng.item) && /^[A-Z][A-Z' ]*$/.test(norm(text));
    if (isGroupHeader(text) && !contCaps) { cur = { name: splitHeaderWords(norm(text)), ingredients: [] }; groups.push(cur); continue; }
    if (!cur) { cur = { name: "Ingredients", ingredients: [] }; groups.push(cur); }
    if (cur.ingredients.length && !/^(\d|\bpinch\b|\bdash\b)/i.test(text)) {
      const last = cur.ingredients[cur.ingredients.length - 1];
      last.item = (last.item + " " + text).trim();
      continue;
    }
    const ing = parseIngredientLine(text);
    if (ing) cur.ingredients.push(ing);
  }
  // title-case all-caps ingredient items (cross-reference names like "FOOLPROOF HOMEMADE MARINARA")
  for (const g of groups) for (const ing of g.ingredients)
    if (/^[A-Z][A-Z'’ ]{3,}$/.test(ing.item)) ing.item = titleCase(ing.item);
  return groups.filter((g) => g.ingredients.length || isGroupHeader(g.name)); // keep header-only parents
}

// Header-independent: works on the primary content page AND on a directions
// continuation page (two-page-instruction recipes, macros/steps on page 2).
function parseSteps(page: PageData): Step[] {
  const starts = page.items.filter((i) => /^\d+\.$/.test(i.str.trim())).sort((a, b) => a.y - b.y);
  if (!starts.length) return [];
  const tipItem = page.items.find((i) => /^TIP/i.test(norm(i.str)));
  const tipY = tipItem ? tipItem.y : page.height - 22;
  return starts.map((s, idx) => {
    const yEnd = Math.min(starts[idx + 1]?.y ?? Infinity, tipY);
    const text = page.items
      .filter((i) => !/^\d+\.$/.test(i.str.trim()) && i.x > s.x + 5 && i.y >= s.y - 3 && i.y < yEnd - 3 && i.y < page.height - 22)
      .sort((a, b) => a.y - b.y || a.x - b.x).map((i) => i.str).join(" ").replace(/\s+/g, " ").trim();
    return { n: Number(s.str.replace(".", "")), text };
  }).filter((s) => s.text);
}

export function parseRecipeSpread(pages: PageData[], sourcePages: number[]): ParsedRecipe {
  // pages that hold ingredients (incl. "INGREDIENTS, CONT" continuation pages)
  const ingPages = pages.filter((p) => ingHeaderItem(p));
  const contentPage = ingPages[0] ?? pages[pages.length - 1];
  const macrosPage = pages.find((p) => hasLabel(p, "MACROS")) ?? contentPage;
  const tipItem = contentPage.items.find((i) => /^TIP/i.test(norm(i.str)));

  const ingredientGroups: IngredientGroup[] = [];
  for (const g of ingPages.flatMap(parseIngredients)) {
    const existing = ingredientGroups.find((m) => m.name === g.name);
    if (existing) existing.ingredients.push(...g.ingredients);
    else ingredientGroups.push(g);
  }
  // merge steps across the whole spread (continuation pages carry steps 8..N)
  const byN = new Map<number, Step>();
  for (const p of pages) for (const s of parseSteps(p)) if (!byN.has(s.n)) byN.set(s.n, s);
  const steps = [...byN.values()].sort((a, b) => a.n - b.n);

  const tips: string[] = [];
  if (tipItem) {
    const tipText = contentPage.items
      .filter((i) => i !== tipItem && i.y >= tipItem.y - 2 && i.y < contentPage.height - 40 && i.x >= tipItem.x - 2)
      .sort((a, b) => a.y - b.y || a.x - b.x).map((i) => i.str).join(" ")
      .replace(/^\s*:?\s*/, "").replace(/\s+/g, " ").trim();
    if (tipText) tips.push(tipText);
  }

  const videoUrl = pages.flatMap((p) => p.links).find((l) => /youtu\.?be|youtube/.test(l.url))?.url ?? null;

  const groupNames = ingredientGroups.map((g) => g.name).filter((n) => n.toLowerCase() !== "ingredients");
  const references: Reference[] = [];
  for (const s of steps) {
    for (const g of groupNames) {
      const words = g.replace(/\s+/g, "\\s+");
      if (new RegExp(`\\b${words}\\b`, "i").test(s.text) && !references.some((r) => r.target === g)) {
        references.push({ raw: g, kind: "group", target: g, seconds: null });
      }
    }
  }

  const { servings, prep, cook } = parseTimes(contentPage);
  return {
    title: parseTitle(pages, contentPage),
    category: parseCategory(contentPage),
    servings, macros: parseMacros(macrosPage), ingredientGroups, steps,
    prepTimeMin: prep, cookTimeMin: cook, tips, videoUrl, references,
  };
}
