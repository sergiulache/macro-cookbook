import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useWeekPlan, isoWeekKey, weekDates, shiftWeek, DAY_NAMES } from "../../lib/data/useWeekPlan";
import { useRecipeIndex } from "../../lib/recipes/RecipeIndex";

export function PlanPage() {
  const { byId } = useRecipeIndex();
  const [base, setBase] = useState(() => new Date());
  const weekKey = isoWeekKey(base);
  const dates = weekDates(base);
  const { entries, remove, setServings } = useWeekPlan(weekKey);
  const today = new Date().toDateString();
  const dd = (d: Date) => `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  const range = `${dd(dates[0])} - ${dd(dates[6])}`;

  return (
    <div className="mx-auto max-w-[900px] px-5 pb-24">
      <header className="flex items-center justify-between pt-10 pb-2">
        <h1 className="font-display text-[30px] font-700 tracking-tight">Weekly Plan</h1>
        <Link to="/shopping" className="inline-flex h-9 items-center rounded-full bg-ink px-4 text-[13px] font-500 text-canvas hover:bg-ink-deep">Shopping list →</Link>
      </header>

      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => setBase((b) => shiftWeek(b, -1))} className="grid h-8 w-8 place-items-center rounded-full border border-hairline-strong hover:border-ink" aria-label="Previous week"><ChevronLeft size={16} /></button>
        <span className="text-[14px] font-500 tabular-nums">{range}</span>
        <button onClick={() => setBase((b) => shiftWeek(b, 1))} className="grid h-8 w-8 place-items-center rounded-full border border-hairline-strong hover:border-ink" aria-label="Next week"><ChevronRight size={16} /></button>
        <button onClick={() => setBase(new Date())} className="text-[13px] text-body hover:text-ink">This week</button>
      </div>

      <div className="space-y-4">
        {dates.map((date, day) => {
          const dayEntries = entries.filter((e) => e.day === day);
          const cal = dayEntries.reduce((s, e) => s + (byId.get(e.recipeId)?.macros.calories ?? 0) * e.servings, 0);
          const protein = dayEntries.reduce((s, e) => s + (byId.get(e.recipeId)?.macros.protein ?? 0) * e.servings, 0);
          const isToday = date.toDateString() === today;
          return (
            <section key={day} className={`rounded-2xl border p-4 ${isToday ? "border-ink" : "border-hairline"}`}>
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-[16px] font-600">{DAY_NAMES[day]} <span className="text-mute">{date.getDate()}/{date.getMonth() + 1}</span></h2>
                {dayEntries.length > 0 && <span className="text-[12px] text-body">{cal} cal · {protein}g protein</span>}
              </div>
              {dayEntries.length === 0 ? (
                <p className="mt-2 text-[13px] text-mute">Nothing planned. Add recipes from their pages.</p>
              ) : (
                <ul className="mt-2 divide-y divide-hairline">
                  {dayEntries.map((e) => {
                    const r = byId.get(e.recipeId);
                    return (
                      <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                        <Link to={`/r/${e.recipeId}`} className="flex-1 truncate text-[15px] hover:underline">{r?.title ?? e.recipeId}</Link>
                        <div className="flex items-center gap-1 rounded-full bg-surface-soft p-0.5">
                          <button onClick={() => setServings(e.id, Math.max(1, e.servings - 1))} className="h-6 w-6 rounded-full hover:bg-canvas">−</button>
                          <span className="w-6 text-center text-[13px] tabular-nums">{e.servings}</span>
                          <button onClick={() => setServings(e.id, e.servings + 1)} className="h-6 w-6 rounded-full hover:bg-canvas">+</button>
                        </div>
                        <button onClick={() => remove(e.id)} className="text-mute hover:text-ink" aria-label="Remove"><X size={15} /></button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
