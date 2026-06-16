import type { IngredientDBEntry } from "../schema/ingredient";
import { ingredients as bookIngredients, ingredientLabel } from "./ingredientsDb";

/**
 * Unified ingredient search over the book's DB (always loaded, the author's own
 * numbers) and the USDA set (lazy-loaded, ~7.4k verified foods). USDA SR Legacy
 * names are "Base, qualifier, qualifier" (e.g. "Tortillas, ready-to-bake or
 * -fry, flour"), so relevance is driven by how the query matches the BASE
 * segment, and concise/canonical entries (fewer qualifiers) rank above the long
 * tail of flavor/brand variants. This is what keeps a query like "tortilla" from
 * dumping 26 equally-weighted rows on you.
 */

let usdaCache: IngredientDBEntry[] | null = null;
let usdaPromise: Promise<IngredientDBEntry[]> | null = null;

export const usdaReady = () => usdaCache !== null;
export async function loadUsda(): Promise<IngredientDBEntry[]> {
  if (usdaCache) return usdaCache;
  if (!usdaPromise) {
    usdaPromise = import("../../data/generated/usda-ingredients.json").then((m) => {
      usdaCache = m.default as unknown as IngredientDBEntry[];
      return usdaCache;
    });
  }
  return usdaPromise;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s,]/g, " ").replace(/\s+/g, " ").trim();

/** A name word matches a query word on equality or sensible prefix (handles plurals: "tortilla"~"tortillas"). */
const wordHit = (nameWords: string[], w: string) =>
  nameWords.some((nw) => nw === w || (w.length >= 3 && nw.startsWith(w)) || (nw.length >= 4 && w.startsWith(nw)));

// USDA food groups: nudge basic whole foods up, prepared/branded-ish groups down.
const CAT_BOOST: Record<string, number> = {
  Vegetable: 60, Fruit: 60, "Meat & Seafood": 55, "Dairy & Egg": 45, Legumes: 45,
  "Nuts & Seeds": 40, "Grains & Pasta": 40, "Grains & Cereal": 35, "Fats & Oils": 35,
  Spices: 30, "Baked Goods": 12,
  "Soups & Sauces": -40, Beverages: -60, Sweets: -70, Snacks: -80,
  "Meals & Sides": -120, Restaurant: -150, "Fast Food": -160,
};

/** Relevance score for an entry against a normalized query; negative = no match. */
export function scoreEntry(entry: IngredientDBEntry, q: string): number {
  const name = norm(`${entry.name} ${entry.brand ?? ""}`);
  const qWords = q.split(" ").filter(Boolean);
  for (const w of qWords) if (!name.includes(w)) return -1; // every query word present (AND)

  const segs = name.split(",").map((s) => s.trim()).filter(Boolean);
  const base = segs[0] ?? name;
  const baseWords = base.split(" ");
  const allWords = name.split(/[\s,]+/).filter(Boolean);
  const phrase = q;

  // treat a trailing-plural base as an exact base match ("tortillas"=="tortilla", "bananas"=="banana")
  const plural = base === `${phrase}s` || phrase === `${base}s` || base === `${phrase}es`;
  let s: number;
  if (name === phrase) s = 1000;
  else if (base === phrase || plural) s = 650;
  else if (base.startsWith(phrase)) s = 470;
  else if (name.startsWith(phrase)) s = 380; // multiword base prefix ("chicken breast")
  else if (qWords.length === 1 && wordHit(baseWords, qWords[0])) s = 430; // single word hits a base word
  else if (qWords.every((w) => wordHit(baseWords, w))) s = 300; // all words hit base words
  else if (segs.some((seg) => { const sw = seg.split(" "); return qWords.every((w) => wordHit(sw, w)); })) s = 190;
  else if (base.includes(phrase)) s = 150;
  else s = 50;

  for (const w of qWords) {
    if (wordHit(baseWords, w)) s += 40;
    else if (wordHit(allWords, w)) s += 15;
  }

  // prefer concise/canonical entries
  s -= (segs.length - 1) * 12;
  s -= Math.min(60, name.length * 0.15);
  // food-group quality + de-emphasize branded (ALL-CAPS token) and regional/notes parentheticals
  s += CAT_BOOST[entry.category] ?? 0;
  if (/\b[A-Z]{2,}\b/.test(entry.name)) s -= 90;
  if (entry.name.includes("(")) s -= 60; // regional/notes parentheticals e.g. "(Navajo)"
  return s;
}

export interface SearchResult {
  book: IngredientDBEntry[];
  usda: IngredientDBEntry[];
  bookTotal: number;
  usdaTotal: number;
}

function rank(list: IngredientDBEntry[], q: string, limit: number) {
  const scored: { e: IngredientDBEntry; s: number }[] = [];
  for (const e of list) {
    const s = scoreEntry(e, q);
    if (s >= 0) scored.push({ e, s });
  }
  scored.sort((a, b) => b.s - a.s || a.e.name.length - b.e.name.length || a.e.name.localeCompare(b.e.name));
  return { total: scored.length, items: scored.slice(0, limit).map((x) => x.e) };
}

export function searchAll(query: string, bookLimit = 6, usdaLimit = 12): SearchResult {
  const q = norm(query);
  if (!q) return { book: [], usda: [], bookTotal: 0, usdaTotal: 0 };
  const b = rank(bookIngredients, q, bookLimit);
  const u = usdaCache ? rank(usdaCache, q, usdaLimit) : { total: 0, items: [] };
  return { book: b.items, usda: u.items, bookTotal: b.total, usdaTotal: u.total };
}

export { ingredientLabel };
