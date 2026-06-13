import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/auth";

/**
 * Per-person favorites (D15: per-person, mutually viewable). Stored at
 * users/{uid}.favorites as a recipe-id array, live-synced via onSnapshot.
 * Mutual viewing of a partner's favorites comes once both UIDs are registered.
 */
export function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "users", user.uid), (snap) => {
      setFavorites(new Set((snap.data()?.favorites as string[]) ?? []));
    });
  }, [user]);

  const toggle = async (id: string) => {
    if (!user) return;
    const next = new Set(favorites);
    next.has(id) ? next.delete(id) : next.add(id);
    setFavorites(next); // optimistic
    await setDoc(doc(db, "users", user.uid), { favorites: [...next] }, { merge: true });
  };

  return { favorites, toggle, isFavorite: (id: string) => favorites.has(id) };
}
