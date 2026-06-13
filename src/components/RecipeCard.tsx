import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import type { Recipe } from "../lib/schema/recipe";
import { imageUrl } from "../lib/recipes/loadRecipes";
import { FavoriteButton } from "./FavoriteButton";

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const { image, macros } = recipe;
  return (
    <motion.div layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <Link to={`/r/${recipe.id}`} className="group block">
        <div
          className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-hairline bg-surface-soft bg-cover bg-center"
          style={image ? { backgroundImage: `url(${image.blurDataURL})` } : undefined}
        >
          <div className="absolute right-2 top-2 z-10"><FavoriteButton id={recipe.id} /></div>
          {image && (
            <img
              src={imageUrl(image.src)}
              srcSet={image.srcset.split(", ").map((s) => imageUrl(s)).join(", ")}
              sizes="(max-width: 640px) 50vw, 320px"
              alt={recipe.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            />
          )}
        </div>
        <h3 className="mt-3 font-display text-[17px] font-600 leading-tight text-ink">{recipe.title}</h3>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] text-body">
          {macros.calories > 0 && <span>{macros.calories} cal</span>}
          <span>{macros.protein}g protein</span>
          <span className="text-mute">·</span>
          <span className="text-mute">{recipe.category}</span>
        </div>
      </Link>
    </motion.div>
  );
}
