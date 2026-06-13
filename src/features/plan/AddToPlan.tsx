import { useState } from "react";
import { useWeekPlan, isoWeekKey, DAY_NAMES } from "../../lib/data/useWeekPlan";

/** Add a recipe to a day of the current week's plan, at the chosen serving count. */
export function AddToPlan({ recipeId, servings }: { recipeId: string; servings: number }) {
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState<number | null>(null);
  const { add } = useWeekPlan(isoWeekKey(new Date()));

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-hairline-strong px-4 text-[13px] font-500 text-ink hover:border-ink"
      >
        {added != null ? `Added to ${DAY_NAMES[added]} ✓` : "Add to plan"}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 flex gap-1 rounded-full border border-hairline bg-canvas p-1 shadow-sm">
          {DAY_NAMES.map((d, i) => (
            <button
              key={d}
              onClick={() => { add(i, recipeId, servings); setAdded(i); setOpen(false); setTimeout(() => setAdded(null), 2000); }}
              className="h-8 w-9 rounded-full text-[12px] font-500 text-charcoal hover:bg-ink hover:text-canvas"
            >{d}</button>
          ))}
        </div>
      )}
    </div>
  );
}
