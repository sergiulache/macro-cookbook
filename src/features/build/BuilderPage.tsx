import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../lib/auth/auth";
import { useRecipeIndex } from "../../lib/recipes/RecipeIndex";
import { searchAll, loadUsda, usdaReady, ingredientLabel } from "../../lib/recipes/ingredientSearch";
import { lineMacros, totalMacros, perServingMacros } from "../../lib/recipes/custom";
import type { IngredientDBEntry, IngredientSource } from "../../lib/schema/ingredient";
import type { CustomLine, CustomRecipe } from "../../lib/schema/custom";
import { AiImportPanel, type AppliedDraft } from "./AiImportPanel";

const round1 = (n: number) => Math.round(n * 10) / 10;
const BOOK_CAT: Record<string, string> = { meat: "Meat & Seafood", fruit: "Fruit", vegetable: "Vegetable", seasoning: "Seasoning", pantry: "Pantry" };
const catLabel = (e: IngredientDBEntry) => (e.source === "book" ? BOOK_CAT[e.category] ?? e.category : e.category);

/** Small monochrome tag marking an ingredient that did not come from the book's own tables. */
function SourceTag({ source }: { source: IngredientSource }) {
  if (source === "book") return null;
  const label = source === "usda" ? "USDA" : source === "ai" ? "AI" : "Custom";
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-hairline-strong px-1.5 text-[10px] font-600 uppercase tracking-wide text-mute">
      {source === "usda" ? (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" /></svg>
      ) : null}
      {label}
    </span>
  );
}

function ResultRow({ e, index, active, onAdd, onHover }: { e: IngredientDBEntry; index: number; active: boolean; onAdd: () => void; onHover: () => void }) {
  return (
    <button
      data-i={index}
      onMouseEnter={onHover}
      onMouseDown={(ev) => { ev.preventDefault(); onAdd(); }}
      className={`flex w-full items-center gap-3 px-4 py-2 text-left ${active ? "bg-surface-soft" : ""}`}
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[14px] text-ink">{ingredientLabel(e)}</span>
          <SourceTag source={e.source} />
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

const numField = "h-9 w-full rounded-lg bg-canvas px-2 text-right text-[14px] tabular-nums outline-none border border-hairline focus:border-ink";

export function BuilderPage() {
  const { id: editId } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { customById, saveCustom, removeCustom } = useRecipeIndex();

  const idRef = useRef<string>(editId ?? `c-${crypto.randomUUID()}`);
  const [title, setTitle] = useState("");
  const [titleRo, setTitleRo] = useState("");
  const [servings, setServings] = useState(1);
  const [lines, setLines] = useState<CustomLine[]>([]);
  const [stepsText, setStepsText] = useState("");
  const [stepsRoText, setStepsRoText] = useState("");
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const [loaded, setLoaded] = useState(!editId);
  const [usdaOn, setUsdaOn] = useState(usdaReady());
  const [saving, setSaving] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // manual "add your own" ingredient
  const [manualOpen, setManualOpen] = useState(false);
  const [mName, setMName] = useState("");
  const [mPer, setMPer] = useState("100");
  const [mCal, setMCal] = useState("");
  const [mPro, setMPro] = useState("");
  const [mFat, setMFat] = useState("");
  const [mCarb, setMCarb] = useState("");

  useEffect(() => { let m = true; loadUsda().then(() => m && setUsdaOn(true)).catch(() => {}); return () => { m = false; }; }, []);

  const existing = editId ? customById.get(editId) : undefined;
  useEffect(() => {
    if (editId && existing && !loaded) {
      setTitle(existing.title); setServings(existing.servings); setLines(existing.lines);
      setStepsText(existing.steps.join("\n")); setTitleRo(existing.title_ro ?? ""); setStepsRoText((existing.steps_ro ?? []).join("\n"));
      idRef.current = existing.id; setLoaded(true);
    }
  }, [editId, existing, loaded]);

  const res = useMemo(() => searchAll(q), [q, usdaOn]);
  const flat = useMemo(() => [...res.book, ...res.usda], [res]);
  const total = useMemo(() => totalMacros(lines), [lines]);
  const per = useMemo(() => perServingMacros(lines, servings), [lines, servings]);
  const ownsIt = !editId || (existing && existing.ownerUid === user?.uid);

  useEffect(() => setActive(0), [q]);
  const act = flat.length ? Math.min(active, flat.length - 1) : -1;
  useEffect(() => { listRef.current?.querySelector(`[data-i="${act}"]`)?.scrollIntoView({ block: "nearest" }); }, [act]);

  const addLine = (e: IngredientDBEntry) => {
    setLines((ls) => {
      const i = ls.findIndex((l) => l.ingredientId === e.id);
      if (i >= 0) { const c = [...ls]; c[i] = { ...c[i], grams: round1(c[i].grams + e.per.amount) }; return c; }
      return [...ls, { ingredientId: e.id, name: ingredientLabel(e), source: e.source, grams: e.per.amount, per: { amount: e.per.amount, unit: e.per.unit }, macros: e.macros }];
    });
    setQ("");
  };
  const setGrams = (i: number, grams: number) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, grams: Math.max(0, grams) } : l)));
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, j) => j !== i));

  const canAddManual = mName.trim().length > 0 && (Number(mCal) > 0 || Number(mPro) > 0);
  const addManual = () => {
    if (!canAddManual) return;
    const p = Math.max(1, Number(mPer) || 100);
    setLines((ls) => [...ls, {
      ingredientId: `manual-${crypto.randomUUID()}`, name: mName.trim(), source: "manual",
      grams: p, per: { amount: p, unit: "g" },
      macros: { calories: Math.round(Number(mCal) || 0), fat: Number(mFat) || 0, carbs: Number(mCarb) || 0, netCarbs: null, protein: Number(mPro) || 0 },
    }]);
    setMName(""); setMPer("100"); setMCal(""); setMPro(""); setMFat(""); setMCarb(""); setManualOpen(false);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!flat.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(flat.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (flat[act]) addLine(flat[act]); }
    else if (e.key === "Escape") { setFocused(false); e.currentTarget.blur(); }
  };

  const canSave = title.trim().length > 0 && lines.length > 0 && servings >= 1;
  const zeroLines = lines.filter((l) => l.grams === 0).length;
  const onSave = async () => {
    if (!canSave || !user) return;
    setSaving(true);
    const now = Date.now();
    const rec: CustomRecipe = {
      id: idRef.current, ownerUid: user.uid, title: title.trim(), category: "Custom", servings, lines,
      steps: stepsText.split("\n").map((s) => s.trim()).filter(Boolean),
      title_ro: titleRo.trim() || undefined,
      steps_ro: stepsRoText.split("\n").map((s) => s.trim()).filter(Boolean),
      createdAt: existing?.createdAt ?? now, updatedAt: now,
    };
    try { await saveCustom(rec); nav(`/r/${rec.id}`); } finally { setSaving(false); }
  };
  const onDelete = async () => { if (editId && confirm("Delete this custom recipe?")) { await removeCustom(editId); nav("/"); } };
  const applyDraft = (a: AppliedDraft) => { setTitle(a.title); setTitleRo(a.titleRo); setServings(a.servings); setLines(a.lines); setStepsText(a.steps); setStepsRoText(a.stepsRo); };

  if (editId && !ownsIt && loaded) {
    return <div className="mx-auto max-w-[720px] px-5 py-24 text-center text-body">You can only edit your own custom recipes. <Link to={`/r/${editId}`} className="underline">View it</Link></div>;
  }

  const showResults = focused && q.trim().length > 0;

  return (
    <div className="mx-auto max-w-[760px] px-5 pb-28">
      <Link to="/" className="mt-6 inline-flex items-center gap-1 text-[13px] text-body hover:text-ink">← All recipes</Link>
      <h1 className="mt-4 font-display text-[30px] font-700 tracking-tight">{editId ? "Edit recipe" : "New recipe"}</h1>
      <p className="mt-1 text-[13px] text-mute">Macros compute automatically. Import a recipe with AI, or search the book's ingredients and the USDA food database.</p>

      {!editId && <AiImportPanel onApply={applyDraft} />}

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

      <div className="mt-6 grid grid-cols-5 gap-2 rounded-2xl border border-hairline p-5 text-center">
        {[{ k: "Cal", v: per.calories }, { k: "Protein", v: per.protein, s: "g" }, { k: "Carbs", v: per.carbs, s: "g" }, { k: "Fat", v: per.fat, s: "g" }].map((x) => (
          <div key={x.k}><div className="font-display text-[22px] font-700 tabular-nums">{x.v}{x.s ?? ""}</div><div className="text-[12px] text-mute">{x.k}/serv</div></div>
        ))}
        <div><div className="font-display text-[22px] font-700 tabular-nums">{total.calories}</div><div className="text-[12px] text-mute">Total cal</div></div>
      </div>

      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-[18px] font-600">Ingredients</h2>
          <button onClick={() => setManualOpen((v) => !v)} className="text-[13px] text-body hover:text-ink">{manualOpen ? "Close" : "+ Add your own"}</button>
        </div>

        {/* manual add-your-own ingredient */}
        <AnimatePresence>
          {manualOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mt-2 rounded-xl border border-hairline bg-surface-soft p-4">
                <p className="text-[12px] text-mute">For a packaged item the databases don't have (a specific tortilla brand, a sauce…). Enter the macros off the label.</p>
                <input value={mName} onChange={(e) => setMName(e.target.value)} placeholder="Ingredient name"
                  className="mt-3 h-10 w-full rounded-lg border border-hairline bg-canvas px-3 text-[15px] outline-none placeholder:text-mute focus:border-ink" />
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {[
                    { l: "Per (g)", v: mPer, set: setMPer },
                    { l: "Calories", v: mCal, set: setMCal },
                    { l: "Protein", v: mPro, set: setMPro },
                    { l: "Fat", v: mFat, set: setMFat },
                    { l: "Carbs", v: mCarb, set: setMCarb },
                  ].map((f) => (
                    <label key={f.l} className="text-[12px] text-mute">
                      {f.l}
                      <input type="number" min={0} value={f.v} onChange={(e) => f.set(e.target.value)} className={numField + " mt-1"} />
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button onClick={addManual} disabled={!canAddManual} className="h-9 rounded-full bg-ink px-5 text-[13px] font-500 text-canvas hover:bg-ink-deep disabled:opacity-30">Add ingredient</button>
                  <span className="text-[12px] text-mute">Needs a name and calories or protein.</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative mt-3">
          <input
            value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
            onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 120)}
            role="combobox" aria-expanded={showResults} aria-controls="ingredient-results"
            placeholder="Search ingredients (tortilla, chicken breast, oats…)"
            className="h-11 w-full rounded-xl bg-surface-soft px-4 text-[15px] outline-none placeholder:text-mute" />

          <AnimatePresence>
            {showResults && (
              <motion.div ref={listRef} id="ingredient-results"
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}
                className="absolute z-20 mt-1 max-h-[26rem] w-full overflow-auto rounded-xl border border-hairline bg-canvas py-1 shadow-sm">
                {res.book.length > 0 && (
                  <>
                    <div className="px-4 pb-1 pt-2 text-[11px] font-600 uppercase tracking-wide text-mute">From the book</div>
                    {res.book.map((e, i) => <ResultRow key={e.id} e={e} index={i} active={act === i} onAdd={() => addLine(e)} onHover={() => setActive(i)} />)}
                  </>
                )}
                <div className="flex items-center justify-between px-4 pb-1 pt-3 text-[11px] font-600 uppercase tracking-wide text-mute">
                  <span>USDA database</span>
                  {usdaOn && res.usdaTotal > res.usda.length && <span className="font-400 normal-case tracking-normal">top {res.usda.length} of {res.usdaTotal} · keep typing to narrow</span>}
                </div>
                {!usdaOn ? (
                  <div className="px-4 py-2 text-[13px] text-mute">Loading USDA foods…</div>
                ) : res.usda.length > 0 ? (
                  res.usda.map((e, i) => <ResultRow key={e.id} e={e} index={res.book.length + i} active={act === res.book.length + i} onAdd={() => addLine(e)} onHover={() => setActive(res.book.length + i)} />)
                ) : (
                  <div className="flex items-center justify-between gap-3 px-4 py-2 text-[13px] text-mute">
                    <span>No match for “{q}”.</span>
                    <button onMouseDown={(ev) => { ev.preventDefault(); setMName(q); setManualOpen(true); setFocused(false); }} className="shrink-0 text-ink underline">Add it yourself</button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {lines.length === 0 ? (
          <p className="mt-3 text-[14px] text-mute">No ingredients yet. Search above, or add your own.</p>
        ) : (
          <>
            <ul className="mt-3 divide-y divide-hairline">
              <AnimatePresence initial={false}>
                {lines.map((l, i) => {
                  const m = lineMacros(l);
                  return (
                    <motion.li key={l.ingredientId + i} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-3 py-2.5">
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <span className={`truncate text-[15px] ${l.grams === 0 ? "text-mute" : "text-ink"}`}>{l.name}</span>
                        <SourceTag source={l.source} />
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
            {zeroLines > 0 && <p className="mt-2 text-[12px] text-mute">{zeroLines} line{zeroLines > 1 ? "s" : ""} at 0 g won't be counted.</p>}
          </>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-[18px] font-600">Directions <span className="text-[13px] font-400 text-mute">(optional)</span></h2>
        <textarea value={stepsText} onChange={(e) => setStepsText(e.target.value)} rows={5}
          placeholder={"One step per line.\nMix everything.\nBake 20 min at 200C."}
          className="mt-2 w-full rounded-xl bg-surface-soft p-4 text-[15px] leading-relaxed outline-none placeholder:text-mute" />
      </section>

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
