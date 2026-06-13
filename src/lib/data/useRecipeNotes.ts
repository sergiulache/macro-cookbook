import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/auth";
import { MEMBER_UIDS, nameFor } from "./people";

/**
 * Per-recipe personal notes (D32): each person owns their own note, both can
 * view the other's (Mutually-Viewable, D15). Stored at users/{uid}.notes[recipeId].
 */
export function useRecipeNotes(recipeId: string) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    const unsubs = MEMBER_UIDS.map((uid) =>
      onSnapshot(doc(db, "users", uid), (snap) => {
        const n = ((snap.data()?.notes as Record<string, string>) ?? {})[recipeId] ?? "";
        setNotes((prev) => ({ ...prev, [uid]: n }));
      }),
    );
    return () => unsubs.forEach((u) => u());
  }, [user, recipeId]);

  const partnerUid = MEMBER_UIDS.find((u) => u !== user?.uid);
  const setMyNote = (text: string) =>
    user && setDoc(doc(db, "users", user.uid), { notes: { [recipeId]: text } }, { merge: true });

  return {
    myNote: user ? notes[user.uid] ?? "" : "",
    partnerNote: partnerUid ? notes[partnerUid] ?? "" : "",
    partnerName: partnerUid ? nameFor(partnerUid) : "",
    setMyNote,
  };
}
