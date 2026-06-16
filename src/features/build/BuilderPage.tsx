import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../lib/auth/auth";
import { useRecipeIndex } from "../../lib/recipes/RecipeIndex";
import { searchIngredients, ingredientById, ingredientLabel } from "../../lib/recipes/ingredientsDb";
import { lineMacros, totalMacros, perServingMacros } from "../../lib/recipes/custom";
import type { CustomLine, CustomRecipe } from "../../lib/schema/custom";

const round1 = (n: number) => Math.round(n * 10) / 10;
const CAT_LABEL: Record<string, string> = { meat: "Meat & Seafood", fruit: "Fruit", vegetable: "Vegetable", seasoning: "Seasoning", pantry: "Pantry" };

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
  const [loaded, setLoaded] = useState(!editId);
  const [saving, setSaving] = useState(false);

  // edit mode: populate once the doc arrives from Firestore
  const existing = editId ? customById.get(editId) : undefined;
  useEffect(() => {
    if (editId && existing && !loaded) {
      setTitle(existing.title);
      setServings(existing.servings);
      setLines(existing.lines);
      setStepsText(existing.steps.join("\n"));
      idRef.current = existing.id;
      setLoaded(true);
    }
  }, [editId, existing, loaded]);

  const results = useMemo(() => searchIngredients(q), [q]);
  const total = useMemo(() => totalMacros(lines), [lines]);
  const per = useMemo(() => perServingMacros(lines, servings), [lines, servings]);

  const ownsIt = !editId || (existing && existing.ownerUid === user?.uid);

  const addLine = (ingredientId: string) => {
    const e = ingredientById.get(ingredientId);
    if (!e) return;
    setLines((ls) => [...ls, { ingredientId, name: ingredientLabel(e), grams: e.per.amount }]);
    setQ("");
  };
  const setGrams = (i: number, grams: number) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, grams: Math.max(0, grams) } : l)));
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, j) => j !== i));

  const canSave = title.trim().length > 0 && lines.length > 0 && servings >= 1;

  const onSave = async () => {
    if (!canSave || !user) return;
    setSaving(true);
    const now = Date.now();
    const rec: CustomRecipe = {
      id: idRef.current,
      ownerUid: user.uid,
      title: title.trim(),
      category: "Custom",
      servings,
      lines,
      steps: stepsText.split("\n").map((s) => s.trim()).filter(Boolean),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    try {
      await saveCustom(rec);
      nav(`/r/${rec.id}`);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!editId || !confirm("Delete this custom recipe?")) return;
    await removeCustom(editId);
    nav("/");
  };

  if (editId && !ownsIt && loaded) {
    return (
      <div className="mx-auto max-w-[720px] px-5 py-24 text-center text-body">
        You can only edit your own custom recipes. <Link to={`/r/${editId}`} className="underline">View it</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[760px] px-5 pb-28">
      <Link to="/" className="mt-6 inline-flex items-center gap-1 text-[13px] text-body hover:text-ink">← All recipes</Link>
      <h1 className="mt-4 font-display text-[30px] font-700 tracking-tight">{editId ? "Edit recipe" : "New recipe"}</h1>
      <p className="mt-1 text-[13px] text-mute">Macros compute automatically from the book's ingredient database.</p>

      {/* title + servings */}
      <div className="mt-6 flex flex-wrap items-end gap-4">
        <label className="flex-1">
          <span className="text-[13px] font-500 text-body">Name</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="My high-protein bowl"
            className="mt-1 h-11 w-full rounded-xl bg-surface-soft px-4 text-[16px] outline-none placeholder:text-mute"
          />
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
        {[
          { k: "Cal", v: per.calories },
          { k: "Protein", v: per.protein, s: "g" },
          { k: "Carbs", v: per.carbs, s: "g" },
          { k: "Fat", v: per.fat, s: "g" },
        ].map((x) => (
          <div key={x.k}>
            <div className="font-display text-[22px] font-700 tabular-nums">{x.v}{x.s ?? ""}</div>
            <div className="text-[12px] text-mute">{x.k}/serv</div>
          </div>
        ))}
        <div>
          <div className="font-display text-[22px] font-700 tabular-nums">{total.calories}</div>
          <div className="text-[12px] text-mute">Total cal</div>
        </div>
      </div>

      {/* ingredient search */}
      <section className="mt-8">
        <h2 className="font-display text-[18px] font-600">Ingredients</h2>
        <div className="relative mt-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search ingredients (chicken, oats, banana…)"
            className="h-11 w-full rounded-xl bg-surface-soft px-4 text-[15px] outline-none placeholder:text-mute"
          />
          {results.length > 0 && (
            <div className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-xl border border-hairline bg-canvas py-1 shadow-sm">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => addLine(r.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-surface-soft"
                >
                  <span className="text-[15px] text-ink">{ingredientLabel(r)}</span>
                  <span className="shrink-0 text-[12px] text-mute">
                    {CAT_LABEL[r.category]} · {r.macros.calories}cal/{r.macros.protein}g·{r.per.amount}{r.per.unit}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {lines.length === 0 ? (
          <p className="mt-3 text-[14px] text-mute">No ingredients yet. Search above to add lines.</p>
        ) : (
          <ul className="mt-3 divide-y divide-hairline">
            {lines.map((l, i) => {
              const m = lineMacros(ingredientById.get(l.ingredientId), l.grams);
              return (
                <li key={i} className="flex items-center gap-3 py-2.5">
                  <span className="flex-1 text-[15px] text-ink">{l.name}</span>
                  <span className="hidden w-28 shrink-0 text-right font-mono text-[12px] text-mute tabular-nums sm:block">
                    {Math.round(m.calories)}cal · {round1(m.protein)}gP
                  </span>
                  <div className="flex items-center rounded-full bg-surface-soft">
                    <input
                      type="number"
                      value={l.grams}
                      min={0}
                      onChange={(e) => setGrams(i, Number(e.target.value))}
                      className="h-9 w-16 bg-transparent pl-3 text-right text-[14px] tabular-nums outline-none"
                    />
                    <span className="px-2 text-[13px] text-mute">g</span>
                  </div>
                  <button onClick={() => removeLine(i)} className="text-mute hover:text-ink" aria-label="Remove">✕</button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* optional directions */}
      <section className="mt-8">
        <h2 className="font-display text-[18px] font-600">Directions <span className="text-[13px] font-400 text-mute">(optional)</span></h2>
        <textarea
          value={stepsText}
          onChange={(e) => setStepsText(e.target.value)}
          placeholder={"One step per line.\nMix everything.\nBake 20 min at 200C."}
          rows={5}
          className="mt-2 w-full rounded-xl bg-surface-soft p-4 text-[15px] leading-relaxed outline-none placeholder:text-mute"
        />
      </section>

      {/* actions */}
      <div className="mt-8 flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={!canSave || saving}
          className="inline-flex h-11 items-center rounded-full bg-ink px-6 text-[14px] font-500 text-canvas hover:bg-ink-deep disabled:opacity-30"
        >
          {saving ? "Saving…" : editId ? "Save changes" : "Save recipe"}
        </button>
        {editId && ownsIt && (
          <button onClick={onDelete} className="inline-flex h-11 items-center rounded-full border border-hairline-strong px-5 text-[14px] font-500 text-charcoal hover:border-ink">
            Delete
          </button>
        )}
        {!canSave && <span className="text-[13px] text-mute">Add a name and at least one ingredient.</span>}
      </div>
    </div>
  );
}
