import { motion } from "framer-motion";
import { useFavorites } from "../lib/data/useFavorites";

export function FavoriteButton({ id, size = 18 }: { id: string; size?: number }) {
  const { isFavorite, toggle } = useFavorites();
  const fav = isFavorite(id);
  return (
    <motion.button
      whileTap={{ scale: 0.8 }}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(id); }}
      aria-label={fav ? "Remove favorite" : "Add favorite"}
      className="grid h-8 w-8 place-items-center rounded-full bg-canvas/80 backdrop-blur transition-colors hover:bg-canvas"
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill={fav ? "#000" : "none"} stroke="#000" strokeWidth="1.8">
        <path d="M12 21s-7-4.6-9.3-9C1 8.6 2.4 5 6 5c2 0 3.3 1.3 4 2.3C10.7 6.3 12 5 14 5c3.6 0 5 3.6 3.3 7-2.3 4.4-9.3 9-9.3 9z" />
      </svg>
    </motion.button>
  );
}
