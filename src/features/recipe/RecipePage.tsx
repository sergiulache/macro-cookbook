import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { recipeById, imageUrl } from "../../lib/recipes/loadRecipes";
import { AnimatedNumber } from "../../components/AnimatedNumber";
import { renderStep, groupAnchor } from "../../lib/recipes/references";
import { relatedTo } from "../../lib/recipes/related";
import { RecipeCard } from "../../components/RecipeCard";
import { FavoriteButton } from "../../components/FavoriteButton";
import { AddToPlan } from "../plan/AddToPlan";
import { NotesSection } from "./NotesSection";

const fmt = (n: number) => (n >= 10 ? Math.round(n) : Math.round(n * 10) / 10);

export function RecipePage() {
  const { id } = useParams();
  const recipe = id ? recipeById.get(id) : undefined;
  const [servings, setServings] = useState(recipe?.servings ?? 1);

  if (!recipe) {
    return (
      <div className="mx-auto max-w-[720px] px-5 py-24 text-center text-body">
        Recipe not found. <Link to="/" className="underline">Back to the cookbook</Link>
      </div>
    );
  }

  const factor = servings / recipe.servings;
  const m = recipe.macros;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="mx-auto max-w-[760px] px-5 pb-24"
    >
      <Link to="/" className="mt-6 inline-flex items-center gap-1 text-[13px] text-body hover:text-ink">← All recipes</Link>

      {recipe.image && (
        <div className="mt-4 aspect-[16/10] w-full overflow-hidden rounded-2xl border border-hairline bg-surface-soft" style={{ backgroundImage: `url(${recipe.image.blurDataURL})`, backgroundSize: "cover" }}>
          <img src={imageUrl(recipe.image.src)} srcSet={recipe.image.srcset.split(", ").map(imageUrl).join(", ")} sizes="760px" alt={recipe.title} className="h-full w-full object-cover" />
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-500 uppercase tracking-wide text-mute">{recipe.category}</p>
          <h1 className="mt-1 font-display text-[32px] font-700 leading-tight tracking-tight">{recipe.title}</h1>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-body">
            {recipe.prepTimeMin != null && <span>Prep {recipe.prepTimeMin}m</span>}
            {recipe.cookTimeMin != null && <span>Cook {recipe.cookTimeMin}m</span>}
            <span>{recipe.servings} {recipe.servings === 1 ? "serving" : "servings"}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-full border border-hairline-strong"><FavoriteButton id={recipe.id} /></div>
          <AddToPlan recipeId={recipe.id} servings={servings} />
          <Link to={`/r/${recipe.id}/cook`} className="inline-flex h-9 items-center gap-2 rounded-full border border-hairline-strong px-4 text-[13px] font-500 text-ink hover:border-ink">
            Cook mode
          </Link>
          {recipe.videoUrl && (
            <a href={recipe.videoUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-full bg-ink px-4 text-[13px] font-500 text-canvas hover:bg-ink-deep">
              ▶ Watch video
            </a>
          )}
        </div>
      </div>

      {/* macros + scaler */}
      <div className="mt-6 rounded-2xl border border-hairline p-5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-500 uppercase tracking-wide text-mute">Per serving</span>
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-body">Scale</span>
            <div className="flex items-center gap-1 rounded-full bg-surface-soft p-1">
              <button onClick={() => setServings((s) => Math.max(1, s - 1))} className="h-7 w-7 rounded-full text-ink hover:bg-canvas">−</button>
              <span className="w-7 text-center font-500 tabular-nums">{servings}</span>
              <button onClick={() => setServings((s) => s + 1)} className="h-7 w-7 rounded-full text-ink hover:bg-canvas">+</button>
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-5 gap-2 text-center">
          {[
            { k: "Cal", v: m.calories },
            { k: "Protein", v: m.protein, s: "g" },
            { k: "Carbs", v: m.carbs, s: "g" },
            { k: "Net", v: m.netCarbs ?? 0, s: "g" },
            { k: "Fat", v: m.fat, s: "g" },
          ].map((x) => (
            <div key={x.k}>
              <div className="font-display text-[22px] font-700 tabular-nums">{x.v > 0 || x.k === "Cal" ? x.v : "-"}{x.v > 0 && x.s ? x.s : ""}</div>
              <div className="text-[12px] text-mute">{x.k}</div>
            </div>
          ))}
        </div>
        {servings !== recipe.servings && (
          <p className="mt-3 text-center text-[13px] text-body">
            Total for {servings}: <span className="font-500 text-ink"><AnimatedNumber value={m.calories * servings} /> cal</span> · <span className="font-500 text-ink"><AnimatedNumber value={m.protein * servings} suffix="g" /> protein</span>
          </p>
        )}
      </div>

      {/* ingredients */}
      <section className="mt-9">
        <h2 className="font-display text-[20px] font-600">Ingredients</h2>
        <div className="mt-3 space-y-5">
          {recipe.ingredientGroups.map((g) => (
            <div key={g.name} id={groupAnchor(g.name)} className="scroll-mt-20">
              {g.name !== "Ingredients" && <h3 className="text-[13px] font-600 uppercase tracking-wide text-mute">{g.name}</h3>}
              <ul className="mt-1.5 divide-y divide-hairline">
                {g.ingredients.map((ing, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-4 py-1.5 text-[15px]">
                    <span className="text-ink">{ing.item}{ing.note ? <span className="text-mute"> ({ing.note})</span> : null}</span>
                    {ing.amount != null && (
                      <span className="shrink-0 font-mono text-[13px] text-body tabular-nums">{fmt(ing.amount * factor)}{ing.unit ?? ""}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* directions */}
      <section className="mt-9">
        <h2 className="font-display text-[20px] font-600">Directions</h2>
        <ol className="mt-3 space-y-4">
          {recipe.steps.map((s) => (
            <li key={s.n} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-600 text-canvas">{s.n}</span>
              <p className="text-[15px] leading-relaxed text-charcoal">{renderStep(s.text, recipe)}</p>
            </li>
          ))}
        </ol>
      </section>

      {recipe.tips.length > 0 && (
        <section className="mt-8 rounded-2xl bg-surface-soft p-5">
          <h2 className="text-[13px] font-600 uppercase tracking-wide text-mute">Tips</h2>
          <ul className="mt-2 space-y-1.5">
            {recipe.tips.map((t, i) => <li key={i} className="text-[15px] leading-relaxed text-charcoal">{t}</li>)}
          </ul>
        </section>
      )}

      <NotesSection recipeId={recipe.id} />

      <section className="mt-12">
        <h2 className="font-display text-[20px] font-600">You might also like</h2>
        <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-4">
          {relatedTo(recipe).map((r) => <RecipeCard key={r.id} recipe={r} />)}
        </div>
      </section>
    </motion.div>
  );
}
