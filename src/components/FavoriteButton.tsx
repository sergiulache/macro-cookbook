import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { useFavorites } from "../lib/data/useFavorites";

export function FavoriteButton({ id, size = 18 }: { id: string; size?: number }) {
  const { isFavorite, toggle } = useFavorites();
  const fav = isFavorite(id);
  return (
    <motion.button
      whileTap={{ scale: 0.8 }}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(id); }}
      aria-label={fav ? "Remove favorite" : "Add favorite"}
      className="grid h-8 w-8 place-items-center rounded-full bg-canvas/80 text-ink backdrop-blur transition-colors hover:bg-canvas"
    >
      <Heart size={size} strokeWidth={1.8} fill={fav ? "currentColor" : "none"} />
    </motion.button>
  );
}
