import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../lib/auth/auth";
import { useRecipeIndex } from "../../lib/recipes/RecipeIndex";
import { searchAll, loadUsda, usdaReady, ingredientLabel } from "../../lib/recipes/ingredientSearch";
import { lineMacros, totalMacros, perServingMacros } from "../../lib/recipes/custom";
import type { IngredientDBEntry } from "../../lib/schema/ingredient";
import type { CustomLine, CustomRecipe } from "../../lib/schema/custom";

const round1 = (n: number) => Math.round(n * 10) / 10;
const BOOK_CAT: Record<string, string> = { meat: "Meat & Seafood", fruit: "Fruit", vegetable: "Vegetable", seasoning: "Seasoning", pantry: "Pantry" };
const catLabel = (e: IngredientDBEntry) => (e.source === "book" ? BOOK_CAT[e.category] ?? e.category : e.category);

/** Small monochrome tag marking an ingredient that came from the external USDA database. */
function UsdaTag() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-hairline-strong px-1.5 text-[10px] font-600 uppercase tracking-wide text-mute">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" /></svg>
      USDA
    </span>
  );
}

function ResultRow({ e, onAdd }: { e: IngredientDBEntry; onAdd: () => void }) {
  return (
    <button onMouseDown={(ev) => { ev.preventDefault(); onAdd(); }} className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-surface-soft">
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[14px] text-ink">{ingredientLabel(e)}</span>
          {e.source === "usda" && <UsdaTag />}
        </span>
        <span className="text-[12px] text-mute">{catLabel(e)}</span>
      </span>
      <span className="shrink-0 text-right font-mono text-[11px] text-body tabular-nums">
        {e.macros.calories} cal · {e.macros.protein}g P
        <span className="block text-mute">/ {e.per.amount}{e.per.unit}</span>
      </span>
    </button>
  );
}

export function BuilderPage() {
  const { id: editId } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { customById, saveCustom, removeCustom } = useRecipeIndex();

  const idRef = useRef<string>(editId ?? `c-${crypto.randomUUID()}`);
  const [title, setTitle] = useState("");
  const [servings, setServings] = useState(1);
  const [lines, setLines] = useState<CustomLine[]>([]);
  const [stepsText, setStepsText] = useState("");
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const [loaded, setLoaded] = useState(!editId);
  const [usdaOn, setUsdaOn] = useState(usdaReady());
  const [saving, setSaving] = useState(false);

  // pull the USDA set in as soon as the builder opens (book results work meanwhile)
  useEffect(() => { let m = true; loadUsda().then(() => m && setUsdaOn(true)).catch(() => {}); return () => { m = false; }; }, []);

  // edit mode: populate once the doc arrives from Firestore
  const existing = editId ? customById.get(editId) : undefined;
  useEffect(() => {
    if (editId && existing && !loaded) {
      setTitle(existing.title); setServings(existing.servings); setLines(existing.lines);
      setStepsText(existing.steps.join("\n")); idRef.current = existing.id; setLoaded(true);
    }
  }, [editId, existing, loaded]);

  const res = useMemo(() => searchAll(q), [q, usdaOn]);
  const total = useMemo(() => totalMacros(lines), [lines]);
  const per = useMemo(() => perServingMacros(lines, servings), [lines, servings]);
  const ownsIt = !editId || (existing && existing.ownerUid === user?.uid);

  const addLine = (e: IngredientDBEntry) => {
    setLines((ls) => [...ls, {
      ingredientId: e.id, name: ingredientLabel(e), source: e.source,
      grams: e.per.amount, per: { amount: e.per.amount, unit: e.per.unit }, macros: e.macros,
    }]);
    setQ("");
  };
  const setGrams = (i: number, grams: number) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, grams: Math.max(0, grams) } : l)));
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, j) => j !== i));

  const canSave = title.trim().length > 0 && lines.length > 0 && servings >= 1;
  const onSave = async () => {
    if (!canSave || !user) return;
    setSaving(true);
    const now = Date.now();
    const rec: CustomRecipe = {
      id: idRef.current, ownerUid: user.uid, title: title.trim(), category: "Custom", servings, lines,
      steps: stepsText.split("\n").map((s) => s.trim()).filter(Boolean),
      createdAt: existing?.createdAt ?? now, updatedAt: now,
    };
    try { await saveCustom(rec); nav(`/r/${rec.id}`); } finally { setSaving(false); }
  };
  const onDelete = async () => { if (editId && confirm("Delete this custom recipe?")) { await removeCustom(editId); nav("/"); } };

  if (editId && !ownsIt && loaded) {
    return <div className="mx-auto max-w-[720px] px-5 py-24 text-center text-body">You can only edit your own custom recipes. <Link to={`/r/${editId}`} className="underline">View it</Link></div>;
  }

  const showResults = focused && q.trim().length > 0;
  const noMatches = showResults && usdaOn && res.book.length === 0 && res.usda.length === 0;

  return (
    <div className="mx-auto max-w-[760px] px-5 pb-28">
      <Link to="/" className="mt-6 inline-flex items-center gap-1 text-[13px] text-body hover:text-ink">← All recipes</Link>
      <h1 className="mt-4 font-display text-[30px] font-700 tracking-tight">{editId ? "Edit recipe" : "New recipe"}</h1>
      <p className="mt-1 text-[13px] text-mute">Macros compute automatically. Search the book's ingredients or the USDA food database.</p>

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <label className="flex-1">
          <span className="text-[13px] font-500 text-body">Name</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My high-protein bowl"
            className="mt-1 h-11 w-full rounded-xl bg-surface-soft px-4 text-[16px] outline-none placeholder:text-mute" />
        </label>
        <label>
          <span className="text-[13px] font-500 text-body">Servings</span>
          <div className="mt-1 flex h-11 items-center gap-1 rounded-xl bg-surface-soft px-2">
            <button onClick={() => setServings((s) => Math.max(1, s - 1))} className="h-8 w-8 rounded-full text-ink hover:bg-canvas">−</button>
            <span className="w-8 text-center font-500 tabular-nums">{servings}</span>
            <button onClick={() => setServings((s) => s + 1)} className="h-8 w-8 rounded-full text-ink hover:bg-canvas">+</button>
          </div>
        </label>
      </div>

      {/* live macro summary */}
      <div className="mt-6 grid grid-cols-5 gap-2 rounded-2xl border border-hairline p-5 text-center">
        {[{ k: "Cal", v: per.calories }, { k: "Protein", v: per.protein, s: "g" }, { k: "Carbs", v: per.carbs, s: "g" }, { k: "Fat", v: per.fat, s: "g" }].map((x) => (
          <div key={x.k}><div className="font-display text-[22px] font-700 tabular-nums">{x.v}{x.s ?? ""}</div><div className="text-[12px] text-mute">{x.k}/serv</div></div>
        ))}
        <div><div className="font-display text-[22px] font-700 tabular-nums">{total.calories}</div><div className="text-[12px] text-mute">Total cal</div></div>
      </div>

      {/* ingredient search */}
      <section className="mt-8">
        <h2 className="font-display text-[18px] font-600">Ingredients</h2>
        <div className="relative mt-2">
          <input
            value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 120)}
            placeholder="Search ingredients (tortilla, chicken breast, oats…)"
            className="h-11 w-full rounded-xl bg-surface-soft px-4 text-[15px] outline-none placeholder:text-mute" />

          <AnimatePresence>
            {showResults && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}
                className="absolute z-20 mt-1 max-h-[26rem] w-full overflow-auto rounded-xl border border-hairline bg-canvas py-1 shadow-sm">
                {res.book.length > 0 && (
                  <>
                    <div className="px-4 pb-1 pt-2 text-[11px] font-600 uppercase tracking-wide text-mute">From the book</div>
                    {res.book.map((e) => <ResultRow key={e.id} e={e} onAdd={() => addLine(e)} />)}
                  </>
                )}
                <div className="flex items-center justify-between px-4 pb-1 pt-3 text-[11px] font-600 uppercase tracking-wide text-mute">
                  <span>USDA database</span>
                  {usdaOn && res.usdaTotal > res.usda.length && <span className="font-400 normal-case tracking-normal">top {res.usda.length} of {res.usdaTotal} · keep typing to narrow</span>}
                </div>
                {!usdaOn ? (
                  <div className="px-4 py-2 text-[13px] text-mute">Loading USDA foods…</div>
                ) : res.usda.length > 0 ? (
                  res.usda.map((e) => <ResultRow key={e.id} e={e} onAdd={() => addLine(e)} />)
                ) : (
                  <div className="px-4 py-2 text-[13px] text-mute">No USDA match.</div>
                )}
                {noMatches && res.book.length === 0 && <div className="px-4 py-3 text-[13px] text-mute">No ingredient matches “{q}”.</div>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {lines.length === 0 ? (
          <p className="mt-3 text-[14px] text-mute">No ingredients yet. Search above to add lines.</p>
        ) : (
          <ul className="mt-3 divide-y divide-hairline">
            <AnimatePresence initial={false}>
              {lines.map((l, i) => {
                const m = lineMacros(l);
                return (
                  <motion.li key={i} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-3 py-2.5">
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="truncate text-[15px] text-ink">{l.name}</span>
                      {l.source === "usda" && <UsdaTag />}
                    </span>
                    <span className="hidden w-28 shrink-0 text-right font-mono text-[12px] text-mute tabular-nums sm:block">{Math.round(m.calories)}cal · {round1(m.protein)}gP</span>
                    <div className="flex items-center rounded-full bg-surface-soft">
                      <input type="number" value={l.grams} min={0} onChange={(e) => setGrams(i, Number(e.target.value))} className="h-9 w-16 bg-transparent pl-3 text-right text-[14px] tabular-nums outline-none" />
                      <span className="px-2 text-[13px] text-mute">g</span>
                    </div>
                    <button onClick={() => removeLine(i)} className="text-mute hover:text-ink" aria-label="Remove">✕</button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </section>

      {/* optional directions */}
      <section className="mt-8">
        <h2 className="font-display text-[18px] font-600">Directions <span className="text-[13px] font-400 text-mute">(optional)</span></h2>
        <textarea value={stepsText} onChange={(e) => setStepsText(e.target.value)} rows={5}
          placeholder={"One step per line.\nMix everything.\nBake 20 min at 200C."}
          className="mt-2 w-full rounded-xl bg-surface-soft p-4 text-[15px] leading-relaxed outline-none placeholder:text-mute" />
      </section>

      {/* actions */}
      <div className="mt-8 flex items-center gap-3">
        <button onClick={onSave} disabled={!canSave || saving} className="inline-flex h-11 items-center rounded-full bg-ink px-6 text-[14px] font-500 text-canvas hover:bg-ink-deep disabled:opacity-30">
          {saving ? "Saving…" : editId ? "Save changes" : "Save recipe"}
        </button>
        {editId && ownsIt && <button onClick={onDelete} className="inline-flex h-11 items-center rounded-full border border-hairline-strong px-5 text-[14px] font-500 text-charcoal hover:border-ink">Delete</button>}
        {!canSave && <span className="text-[13px] text-mute">Add a name and at least one ingredient.</span>}
      </div>
    </div>
  );
}
