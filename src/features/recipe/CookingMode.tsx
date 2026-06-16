import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useRecipeIndex } from "../../lib/recipes/RecipeIndex";
import { renderStep } from "../../lib/recipes/references";

export function CookingMode() {
  const { id } = useParams();
  const { byId } = useRecipeIndex();
  const recipe = id ? byId.get(id) : undefined;
  const [i, setI] = useState(0);

  // keep the screen awake while cooking (D10)
  useEffect(() => {
    let lock: any;
    const acquire = async () => {
      try { lock = await (navigator as any).wakeLock?.request("screen"); } catch {}
    };
    acquire();
    const onVis = () => document.visibilityState === "visible" && acquire();
    document.addEventListener("visibilitychange", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); lock?.release?.(); };
  }, []);

  if (!recipe || recipe.steps.length === 0)
    return <div className="p-10">No steps to cook. <Link to={id ? `/r/${id}` : "/"} className="underline">Back</Link></div>;
  const step = recipe.steps[Math.min(i, recipe.steps.length - 1)];
  const last = recipe.steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas">
      <header className="flex items-center justify-between border-b border-hairline px-5 py-3">
        <span className="font-display text-[15px] font-600">{recipe.title}</span>
        <Link to={`/r/${recipe.id}`} className="text-[13px] text-body hover:text-ink">Exit ✕</Link>
      </header>

      <div className="h-1 bg-hairline">
        <div className="h-full bg-ink transition-all" style={{ width: `${((i + 1) / recipe.steps.length) * 100}%` }} />
      </div>

      <div className="flex flex-1 items-center justify-center px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.25 }}
            className="max-w-[640px]"
          >
            <div className="font-display text-[15px] font-600 uppercase tracking-wide text-mute">Step {step.n} of {recipe.steps.length}</div>
            <p className="mt-3 text-[26px] leading-snug text-ink sm:text-[30px]">{renderStep(step.text, recipe)}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-hairline px-5 py-4">
        <button
          onClick={() => setI((n) => Math.max(0, n - 1))}
          disabled={i === 0}
          className="h-11 rounded-full border border-hairline-strong px-6 font-500 disabled:opacity-30"
        >Back</button>
        {i < last ? (
          <button onClick={() => setI((n) => n + 1)} className="h-11 flex-1 rounded-full bg-ink px-6 font-500 text-canvas hover:bg-ink-deep">Next step</button>
        ) : (
          <Link to={`/r/${recipe.id}`} className="flex h-11 flex-1 items-center justify-center rounded-full bg-ink px-6 font-500 text-canvas hover:bg-ink-deep">Done 🎉</Link>
        )}
      </footer>
    </div>
  );
}
