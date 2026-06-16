import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { collection, onSnapshot, doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/auth";
import { MEMBER_UIDS } from "../data/people";
import { recipes, recipeById } from "./loadRecipes";
import { CustomRecipe } from "../schema/custom";
import { customToRecipe } from "./custom";
import type { Recipe } from "../schema/recipe";

interface IndexValue {
  /** Book recipes plus every member's custom recipes, as uniform Recipe objects. */
  all: Recipe[];
  /** id -> Recipe for book + custom (book ids win; custom ids are prefixed "c-"). */
  byId: Map<string, Recipe>;
  /** Raw custom docs (both members), for ownership/edit. */
  custom: CustomRecipe[];
  /** Current user's custom recipes. */
  mine: CustomRecipe[];
  customById: Map<string, CustomRecipe>;
  saveCustom: (r: CustomRecipe) => Promise<void>;
  removeCustom: (id: string) => Promise<void>;
}

const Ctx = createContext<IndexValue | null>(null);

export function RecipeIndexProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // custom docs keyed by owner uid, each a list
  const [byOwner, setByOwner] = useState<Record<string, CustomRecipe[]>>({});

  useEffect(() => {
    if (!user) return;
    const unsubs = MEMBER_UIDS.map((uid) =>
      onSnapshot(collection(db, "users", uid, "customRecipes"), (snap) => {
        const list: CustomRecipe[] = [];
        snap.forEach((d) => {
          const res = CustomRecipe.safeParse({ ...d.data(), id: d.id, ownerUid: uid });
          if (res.success) list.push(res.data);
          else console.warn("skipping invalid custom recipe", d.id, res.error.issues);
        });
        setByOwner((prev) => ({ ...prev, [uid]: list }));
      }),
    );
    return () => unsubs.forEach((u) => u());
  }, [user]);

  const value = useMemo<IndexValue>(() => {
    const custom = MEMBER_UIDS.flatMap((uid) => byOwner[uid] ?? []);
    const customRecipes = custom.map(customToRecipe);
    const byId = new Map(recipeById);
    for (const r of customRecipes) byId.set(r.id, r);
    const customById = new Map(custom.map((c) => [c.id, c]));

    const saveCustom = async (r: CustomRecipe) => {
      if (!user) throw new Error("not signed in");
      const { id, ownerUid: _o, ...rest } = r;
      await setDoc(doc(db, "users", user.uid, "customRecipes", id), { ...rest, ownerUid: user.uid }, { merge: true });
    };
    const removeCustom = async (id: string) => {
      if (!user) throw new Error("not signed in");
      await deleteDoc(doc(db, "users", user.uid, "customRecipes", id));
    };

    return {
      all: [...recipes, ...customRecipes],
      byId,
      custom,
      mine: user ? custom.filter((c) => c.ownerUid === user.uid) : [],
      customById,
      saveCustom,
      removeCustom,
    };
  }, [byOwner, user]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRecipeIndex(): IndexValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRecipeIndex must be used within RecipeIndexProvider");
  return v;
}
