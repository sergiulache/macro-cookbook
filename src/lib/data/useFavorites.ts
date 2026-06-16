import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/auth";
import { MEMBER_UIDS, nameFor } from "./people";

const EMPTY: Set<string> = new Set();

/**
 * Per-person favorites (D15: per-person, Mutually-Viewable). Stored at
 * users/{uid}.favorites as a recipe-id array, live-synced. Each member owns and
 * writes only their own set, and can VIEW the other's (both UIDs are registered
 * in people.ts), so the browse view can show "what Ane starred".
 */
export function useFavorites() {
  const { user } = useAuth();
  const [byUid, setByUid] = useState<Record<string, Set<string>>>({});

  useEffect(() => {
    if (!user) return;
    const unsubs = MEMBER_UIDS.map((uid) =>
      onSnapshot(doc(db, "users", uid), (snap) => {
        setByUid((prev) => ({ ...prev, [uid]: new Set((snap.data()?.favorites as string[]) ?? []) }));
      }),
    );
    return () => unsubs.forEach((u) => u());
  }, [user]);

  const favorites = (user && byUid[user.uid]) || EMPTY;
  const partnerUid = MEMBER_UIDS.find((u) => u !== user?.uid);
  const partnerFavorites = (partnerUid && byUid[partnerUid]) || EMPTY;

  const toggle = async (id: string) => {
    if (!user) return;
    const next = new Set(favorites);
    next.has(id) ? next.delete(id) : next.add(id);
    setByUid((prev) => ({ ...prev, [user.uid]: next })); // optimistic
    await setDoc(doc(db, "users", user.uid), { favorites: [...next] }, { merge: true });
  };

  return {
    favorites,
    toggle,
    isFavorite: (id: string) => favorites.has(id),
    partnerFavorites,
    partnerHas: (id: string) => partnerFavorites.has(id),
    partnerName: partnerUid ? nameFor(partnerUid) : "",
  };
}
