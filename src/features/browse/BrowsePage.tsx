import Fuse from "fuse.js";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { recipes, categories } from "../../lib/recipes/loadRecipes";
import { deriveTags, ALL_TAGS, totalTimeMin } from "../../lib/recipes/tags";
import { RecipeCard } from "../../components/RecipeCard";
import type { Recipe } from "../../lib/schema/recipe";

const tagsOf = new Map(recipes.map((r) => [r.id, deriveTags(r)]));
const fuse = new Fuse(recipes, {
  keys: [
    { name: "title", weight: 3 },
    { name: "ingredientGroups.ingredients.item", weight: 1 },
    { name: "tips", weight: 0.5 },
  ],
  threshold: 0.38,
  ignoreLocation: true,
});

type Sort = "featured" | "calories" | "protein" | "time" | "name";
const SORTS: { key: Sort; label: string }[] = [
  { key: "featured", label: "Featured" },
  { key: "protein", label: "Most protein" },
  { key: "calories", label: "Fewest calories" },
  { key: "time", label: "Quickest" },
  { key: "name", label: "A–Z" },
];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`h-8 rounded-full border px-3.5 text-[13px] font-500 transition-colors ${
        active ? "border-ink bg-ink text-canvas" : "border-hairline-strong bg-canvas text-charcoal hover:border-ink"
      }`}
    >
      {children}
    </button>
  );
}

export function BrowsePage() {
  const [q, setQ] = useState("");
  const [cats, setCats] = useState<Set<string>>(new Set());
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<Sort>("featured");

  const results = useMemo(() => {
    let list: Recipe[] = q.trim() ? fuse.search(q).map((r) => r.item) : recipes.slice();
    if (cats.size) list = list.filter((r) => cats.has(r.category));
    if (tags.size) list = list.filter((r) => (tagsOf.get(r.id) ?? []).some((t) => tags.has(t)));
    const by: Record<Sort, (a: Recipe, b: Recipe) => number> = {
      featured: () => 0,
      calories: (a, b) => (a.macros.calories || 9e9) - (b.macros.calories || 9e9),
      protein: (a, b) => b.macros.protein - a.macros.protein,
      time: (a, b) => (totalTimeMin(a) || 9e9) - (totalTimeMin(b) || 9e9),
      name: (a, b) => a.title.localeCompare(b.title),
    };
    if (sort !== "featured" || !q) list = [...list].sort(by[sort]);
    return list;
  }, [q, cats, tags, sort]);

  const toggle = (set: Set<string>, v: string, fn: (s: Set<string>) => void) => {
    const n = new Set(set);
    n.has(v) ? n.delete(v) : n.add(v);
    fn(n);
  };

  return (
    <div className="mx-auto max-w-[1100px] px-5 pb-24">
      <header className="pt-10 pb-6">
        <h1 className="font-display text-[34px] font-700 leading-none tracking-tight">The Cookbook</h1>
        <p className="mt-2 text-body">{recipes.length} recipes · search, filter by macros, plan your week.</p>
      </header>

      {/* search */}
      <div className="sticky top-0 z-10 -mx-5 bg-canvas/90 px-5 py-3 backdrop-blur">
        <div className="flex h-11 items-center gap-2 rounded-full bg-surface-soft px-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-mute">
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search recipes, ingredients…"
            className="h-full w-full bg-transparent text-[15px] outline-none placeholder:text-mute"
          />
          {q && <button onClick={() => setQ("")} className="text-mute hover:text-ink">✕</button>}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {ALL_TAGS.map((t) => (
            <Chip key={t} active={tags.has(t)} onClick={() => toggle(tags, t, setTags)}>{t}</Chip>
          ))}
          <span className="mx-1 h-5 w-px bg-hairline" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="h-8 rounded-full border border-hairline-strong bg-canvas px-3 text-[13px] font-500 text-charcoal outline-none hover:border-ink"
          >
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {categories.map((c) => (
            <Chip key={c} active={cats.has(c)} onClick={() => toggle(cats, c, setCats)}>{c}</Chip>
          ))}
        </div>
      </div>

      <p className="mt-5 text-[13px] text-mute">{results.length} {results.length === 1 ? "recipe" : "recipes"}</p>

      <motion.div layout className="mt-4 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        <AnimatePresence mode="popLayout">
          {results.map((r) => <RecipeCard key={r.id} recipe={r} />)}
        </AnimatePresence>
      </motion.div>

      {results.length === 0 && (
        <div className="py-24 text-center text-body">No recipes match. <button onClick={() => { setQ(""); setCats(new Set()); setTags(new Set()); }} className="underline">Clear filters</button></div>
      )}
    </div>
  );
}
