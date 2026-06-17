import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useShoppingList } from "../../lib/data/useShoppingList";
import { useWeekPlan, isoWeekKey } from "../../lib/data/useWeekPlan";
import { aggregate } from "../../lib/shopping/aggregate";
import { useRecipeIndex } from "../../lib/recipes/RecipeIndex";
import { useAISettings } from "../../lib/data/useAISettings";
import { tidyShoppingList } from "../../lib/ai/shopping";
import { AiError } from "../../lib/ai/ai";

export function ShoppingPage() {
  const weekKey = isoWeekKey(new Date());
  const { byId } = useRecipeIndex();
  const { entries } = useWeekPlan(weekKey);
  const { items, weekKey: listWeek, sections, toggle, setAllChecked, addManual, clearChecked, generate, applyTidy, setSections } = useShoppingList();
  const { addUsage } = useAISettings();
  const [manual, setManual] = useState("");
  const [tidying, setTidying] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const [lastTok, setLastTok] = useState<number | null>(null);
  const [storeOpen, setStoreOpen] = useState(false);
  const [sectionsDraft, setSectionsDraft] = useState("");

  const onGenerate = () => {
    const fresh = aggregate(entries, byId);
    if (!fresh.length) return;
    if (items.length && !confirm("Replace the shopping list with this week's plan? (your manual items are kept)")) return;
    generate(fresh, weekKey);
  };

  const onTidy = async () => {
    if (!items.length) return;
    setTidying(true); setAiErr(null);
    try {
      const { items: tidied, usage } = await tidyShoppingList(items, sections);
      applyTidy(tidied);
      addUsage(usage);
      setLastTok(usage.totalTokenCount ?? null);
    } catch (e) {
      setAiErr(e instanceof AiError ? e.message : "Tidy failed. Try again.");
    } finally {
      setTidying(false);
    }
  };

  const present = [...new Set(items.map((i) => i.category))];
  const cats = [...sections.filter((s) => present.includes(s)), ...present.filter((p) => !sections.includes(p)).sort()];
  const remaining = items.filter((i) => !i.checked).length;
  const allChecked = items.length > 0 && items.every((i) => i.checked);

  return (
    <div className="mx-auto max-w-[720px] px-5 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3 pt-10 pb-4">
        <div>
          <h1 className="font-display text-[30px] font-700 tracking-tight">Shopping List</h1>
          {listWeek && <p className="mt-1 text-[13px] text-mute">From plan {listWeek} · {remaining} left</p>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onTidy} disabled={tidying || !items.length}
            className="inline-flex h-9 items-center rounded-full border border-hairline-strong px-4 text-[13px] font-500 text-ink hover:border-ink disabled:opacity-30">
            {tidying ? "Tidying…" : "✦ Tidy with AI"}
          </button>
          <button onClick={onGenerate} className="inline-flex h-9 items-center rounded-full bg-ink px-4 text-[13px] font-500 text-canvas hover:bg-ink-deep">
            Generate from week
          </button>
        </div>
      </header>

      {/* store section order (drives ordering + the AI tidy) */}
      <div className="mb-4">
        <button onClick={() => { setSectionsDraft(sections.join("\n")); setStoreOpen((v) => !v); }} className="text-[13px] text-body hover:text-ink">
          {storeOpen ? "Hide store order" : "Store order"}
        </button>
        <AnimatePresence>
          {storeOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <p className="mt-2 text-[12px] text-mute">One section per line, in the order you walk your store. The list and the AI tidy follow this order.</p>
              <textarea value={sectionsDraft} onChange={(e) => setSectionsDraft(e.target.value)} rows={6}
                className="mt-2 w-full resize-y rounded-xl border border-hairline bg-surface-soft p-3 text-[14px] leading-relaxed outline-none focus:border-ink" />
              <button onClick={() => { setSections(sectionsDraft.split("\n").map((s) => s.trim()).filter(Boolean)); setStoreOpen(false); }}
                className="mt-2 h-8 rounded-full bg-ink px-4 text-[12px] font-500 text-canvas hover:bg-ink-deep">Save order</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {aiErr && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border-2 border-ink bg-surface-soft px-4 py-3">
          <span className="text-[15px]">⚠</span><span className="text-[14px] font-600 text-ink">{aiErr}</span>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-hairline p-8 text-center text-body">
          Plan some recipes this week, then generate your list.
        </div>
      ) : (
        <div className="space-y-6">
          {cats.map((cat) => (
            <section key={cat}>
              <h2 className="text-[13px] font-600 uppercase tracking-wide text-mute">{cat}</h2>
              <ul className="mt-1.5">
                <AnimatePresence>
                  {items.filter((i) => i.category === cat).map((i) => (
                    <motion.li key={i.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <button onClick={() => toggle(i.id)} className="flex w-full items-center gap-3 border-b border-hairline py-2.5 text-left">
                        <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${i.checked ? "border-ink bg-ink text-canvas" : "border-hairline-strong"}`}>{i.checked ? "✓" : ""}</span>
                        <span className={`flex-1 text-[15px] ${i.checked ? "text-mute line-through" : "text-ink"}`}>{i.item}</span>
                        {i.amount != null && <span className="font-mono text-[13px] text-body tabular-nums">{i.approx ? "~" : ""}{i.amount}{i.unit ?? ""}</span>}
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </section>
          ))}

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && manual.trim()) { addManual(manual.trim()); setManual(""); } }}
              placeholder="Add an item…"
              className="h-10 min-w-[140px] flex-1 rounded-full bg-surface-soft px-4 text-[15px] outline-none placeholder:text-mute"
            />
            <button onClick={() => { if (manual.trim()) { addManual(manual.trim()); setManual(""); } }} className="h-10 rounded-full border border-hairline-strong px-4 text-[13px] font-500 hover:border-ink">Add</button>
            <button onClick={() => setAllChecked(!allChecked)} className="h-10 rounded-full px-3 text-[13px] text-mute hover:text-ink">{allChecked ? "Deselect all" : "Select all"}</button>
            <button onClick={clearChecked} className="h-10 rounded-full px-3 text-[13px] text-mute hover:text-ink">Clear ✓</button>
          </div>
          {lastTok != null && <p className="text-right text-[11px] text-mute tabular-nums">tidy used {lastTok.toLocaleString()} tokens</p>}
        </div>
      )}
    </div>
  );
}
