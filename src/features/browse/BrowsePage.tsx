import Fuse from "fuse.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useRecipeIndex } from "../../lib/recipes/RecipeIndex";
import { loadBrowseState, patchBrowseState } from "../../lib/browseState";
import { deriveTags, ALL_TAGS, totalTimeMin } from "../../lib/recipes/tags";
import { RecipeCard } from "../../components/RecipeCard";
import { useFavorites } from "../../lib/data/useFavorites";
import type { Recipe } from "../../lib/schema/recipe";

type Sort = "featured" | "calories" | "protein" | "time" | "name";
const SORTS: { key: Sort; label: string }[] = [
  { key: "featured", label: "Featured" },
  { key: "protein", label: "Most protein" },
  { key: "calories", label: "Fewest calories" },
  { key: "time", label: "Quickest" },
  { key: "name", label: "A-Z" },
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
  const saved = useMemo(loadBrowseState, []);
  const [q, setQ] = useState(saved.q ?? "");
  const [cats, setCats] = useState<Set<string>>(new Set(saved.cats ?? []));
  const [tags, setTags] = useState<Set<string>>(new Set(saved.tags ?? []));
  const [sort, setSort] = useState<Sort>((saved.sort as Sort) ?? "featured");
  const [favView, setFavView] = useState<"off" | "mine" | "partner">((saved.favView as "off" | "mine" | "partner") ?? "off");
  const [page, setPage] = useState(saved.page ?? 1);
  const PER_PAGE = 24;
  const { favorites, partnerFavorites, partnerName } = useFavorites();
  const { all } = useRecipeIndex();

  const fuse = useMemo(
    () => new Fuse(all, {
      keys: [
        { name: "title", weight: 3 },
        { name: "ingredientGroups.ingredients.item", weight: 1 },
        { name: "tips", weight: 0.5 },
      ],
      threshold: 0.38,
      ignoreLocation: true,
    }),
    [all],
  );
  const tagsOf = useMemo(() => new Map(all.map((r) => [r.id, deriveTags(r)])), [all]);
  const categories = useMemo(() => Array.from(new Set(all.map((r) => r.category))), [all]);

  const results = useMemo(() => {
    let list: Recipe[] = q.trim() ? fuse.search(q).map((r) => r.item) : all.slice();
    if (favView === "mine") list = list.filter((r) => favorites.has(r.id));
    else if (favView === "partner") list = list.filter((r) => partnerFavorites.has(r.id));
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
  }, [q, cats, tags, sort, favView, favorites, partnerFavorites, all, fuse, tagsOf]);

  // reset to first page on a user-driven filter change, but NOT on mount (so a
  // restored page survives) or when favorites load in asynchronously
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    setPage(1);
  }, [q, cats, tags, sort, favView]);

  const pageCount = Math.max(1, Math.ceil(results.length / PER_PAGE));
  const curPage = Math.min(page, pageCount);
  const pageItems = results.slice((curPage - 1) * PER_PAGE, curPage * PER_PAGE);

  // persist filters/search/sort/page; restore scroll on mount and save it on leave
  useEffect(() => {
    patchBrowseState({ q, cats: [...cats], tags: [...tags], sort, favView, page: curPage });
  }, [q, cats, tags, sort, favView, curPage]);
  useEffect(() => {
    const y = saved.scrollY ?? 0;
    if (y) requestAnimationFrame(() => window.scrollTo(0, y));
    const onLeave = () => patchBrowseState({ scrollY: window.scrollY });
    window.addEventListener("pagehide", onLeave);
    return () => { window.removeEventListener("pagehide", onLeave); patchBrowseState({ scrollY: window.scrollY }); };
  }, []);

  const toggle = (set: Set<string>, v: string, fn: (s: Set<string>) => void) => {
    const n = new Set(set);
    n.has(v) ? n.delete(v) : n.add(v);
    fn(n);
  };

  return (
    <div className="mx-auto max-w-[1100px] px-5 pb-24">
      <header className="pt-10 pb-6">
        <div className="flex items-start justify-between gap-4">
          <h1 className="font-display text-[34px] font-700 leading-none tracking-tight">The Cookbook</h1>
          <Link to="/build" className="inline-flex h-9 shrink-0 items-center rounded-full bg-ink px-4 text-[13px] font-500 text-canvas hover:bg-ink-deep">+ New recipe</Link>
        </div>
        <p className="mt-2 text-body">{all.length} recipes · search, filter by macros, plan your week.</p>
      </header>

      {/* search + filters (non-sticky so it scrolls away on mobile) */}
      <div className="-mx-5 px-5 py-1">
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
          <Chip active={favView === "mine"} onClick={() => setFavView((v) => (v === "mine" ? "off" : "mine"))}>♥ Favorites</Chip>
          {partnerName && partnerFavorites.size > 0 && (
            <Chip active={favView === "partner"} onClick={() => setFavView((v) => (v === "partner" ? "off" : "partner"))}>♥ {partnerName}'s</Chip>
          )}
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
          {pageItems.map((r) => <RecipeCard key={r.id} recipe={r} />)}
        </AnimatePresence>
      </motion.div>

      {pageCount > 1 && (
        <div className="mt-12 flex items-center justify-center gap-2">
          <button
            onClick={() => { setPage(Math.max(1, curPage - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            disabled={curPage === 1}
            className="h-9 rounded-full border border-hairline-strong px-4 text-[13px] font-500 disabled:opacity-30 enabled:hover:border-ink"
          >Prev</button>
          <span className="px-2 text-[13px] text-body">Page {curPage} of {pageCount}</span>
          <button
            onClick={() => { setPage(Math.min(pageCount, curPage + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            disabled={curPage === pageCount}
            className="h-9 rounded-full border border-hairline-strong px-4 text-[13px] font-500 disabled:opacity-30 enabled:hover:border-ink"
          >Next</button>
        </div>
      )}

      {results.length === 0 && (
        <div className="py-24 text-center text-body">No recipes match. <button onClick={() => { setQ(""); setCats(new Set()); setTags(new Set()); }} className="underline">Clear filters</button></div>
      )}
    </div>
  );
}
