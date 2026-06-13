import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/auth";
import { MEMBER_UIDS, nameFor } from "./people";

interface Note { text: string; at: number }

/**
 * Per-recipe personal notes (D32): each person owns their own note, both can
 * view the other's (Mutually-Viewable, D15). Stored at users/{uid} as
 * notes[recipeId] (text) + notesAt[recipeId] (last-updated ms).
 */
export function useRecipeNotes(recipeId: string) {
  const { user } = useAuth();
  const [byUid, setByUid] = useState<Record<string, Note>>({});

  useEffect(() => {
    if (!user) return;
    const unsubs = MEMBER_UIDS.map((uid) =>
      onSnapshot(doc(db, "users", uid), (snap) => {
        const d = snap.data();
        const text = ((d?.notes as Record<string, string>) ?? {})[recipeId] ?? "";
        const at = ((d?.notesAt as Record<string, number>) ?? {})[recipeId] ?? 0;
        setByUid((prev) => ({ ...prev, [uid]: { text, at } }));
      }),
    );
    return () => unsubs.forEach((u) => u());
  }, [user, recipeId]);

  const partnerUid = MEMBER_UIDS.find((u) => u !== user?.uid);
  const me = user ? byUid[user.uid] : undefined;
  const partner = partnerUid ? byUid[partnerUid] : undefined;

  const setMyNote = (text: string) =>
    user && setDoc(doc(db, "users", user.uid), { notes: { [recipeId]: text }, notesAt: { [recipeId]: Date.now() } }, { merge: true });

  return {
    myNote: me?.text ?? "",
    myNoteAt: me?.at ?? 0,
    partnerNote: partner?.text ?? "",
    partnerNoteAt: partner?.at ?? 0,
    partnerName: partnerUid ? nameFor(partnerUid) : "",
    setMyNote,
  };
}
