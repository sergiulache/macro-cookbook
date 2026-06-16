import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useShoppingList } from "../../lib/data/useShoppingList";
import { useWeekPlan, isoWeekKey } from "../../lib/data/useWeekPlan";
import { aggregate, CATEGORY_ORDER } from "../../lib/shopping/aggregate";
import { useRecipeIndex } from "../../lib/recipes/RecipeIndex";

export function ShoppingPage() {
  const weekKey = isoWeekKey(new Date());
  const { byId } = useRecipeIndex();
  const { entries } = useWeekPlan(weekKey);
  const { items, weekKey: listWeek, toggle, addManual, clearChecked, generate } = useShoppingList();
  const [manual, setManual] = useState("");

  const onGenerate = () => {
    const fresh = aggregate(entries, byId);
    if (!fresh.length) return;
    if (items.length && !confirm("Replace the shopping list with this week's plan? (your manual items are kept)")) return;
    generate(fresh, weekKey);
  };

  const cats = CATEGORY_ORDER.filter((c) => items.some((i) => i.category === c));
  const remaining = items.filter((i) => !i.checked).length;

  return (
    <div className="mx-auto max-w-[720px] px-5 pb-24">
      <header className="flex items-center justify-between pt-10 pb-4">
        <div>
          <h1 className="font-display text-[30px] font-700 tracking-tight">Shopping List</h1>
          {listWeek && <p className="mt-1 text-[13px] text-mute">From plan {listWeek} · {remaining} left</p>}
        </div>
        <button onClick={onGenerate} className="inline-flex h-9 items-center rounded-full bg-ink px-4 text-[13px] font-500 text-canvas hover:bg-ink-deep">
          Generate from week
        </button>
      </header>

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
                        {i.amount != null && <span className="font-mono text-[13px] text-body tabular-nums">{i.amount}{i.unit ?? ""}</span>}
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </section>
          ))}

          <div className="flex items-center gap-2 pt-2">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && manual.trim()) { addManual(manual.trim()); setManual(""); } }}
              placeholder="Add an item…"
              className="h-10 flex-1 rounded-full bg-surface-soft px-4 text-[15px] outline-none placeholder:text-mute"
            />
            <button onClick={() => { if (manual.trim()) { addManual(manual.trim()); setManual(""); } }} className="h-10 rounded-full border border-hairline-strong px-4 text-[13px] font-500 hover:border-ink">Add</button>
            <button onClick={clearChecked} className="h-10 rounded-full px-3 text-[13px] text-mute hover:text-ink">Clear ✓</button>
          </div>
        </div>
      )}
    </div>
  );
}
