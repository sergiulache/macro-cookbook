import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/auth";
import { nameFor } from "./people";
import { DEFAULT_SECTIONS, type ShopItem } from "../shopping/aggregate";

export interface SavedList { id: string; name: string; items: ShopItem[]; weekKey: string | null; savedAt: number }

/**
 * Joint shopping list (D15 Joint, D30 stable snapshot): one shared doc.
 * Supports MULTIPLE named lists, all inside this one doc. The ACTIVE list is the
 * top-level items/weekKey/id/name (unchanged shape, so existing data is never
 * disturbed - non-destructive); the others live in `archive`. The shared store
 * order (sections) applies to all lists.
 */
export function useShoppingList() {
  const { user } = useAuth();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [weekKey, setWeekKey] = useState<string | null>(null);
  const [sections, setSectionsState] = useState<string[]>(DEFAULT_SECTIONS);
  const [sectionsUpdatedAt, setSectionsAt] = useState(0);
  const [sectionsUpdatedBy, setSectionsBy] = useState("");
  const [listId, setListId] = useState("current");
  const [listName, setListName] = useState("Shopping list");
  const [archive, setArchive] = useState<SavedList[]>([]);

  const ref = doc(db, "joint", "shoppingList");

  useEffect(() => {
    if (!user) return;
    return onSnapshot(ref, (snap) => {
      const d = snap.data();
      setItems((d?.items as ShopItem[]) ?? []);
      setWeekKey((d?.weekKey as string) ?? null);
      const s = d?.sections as string[] | undefined;
      setSectionsState(s && s.length ? s : DEFAULT_SECTIONS);
      setSectionsAt((d?.sectionsUpdatedAt as number) ?? 0);
      setSectionsBy((d?.sectionsUpdatedBy as string) ?? "");
      setListId((d?.id as string) ?? "current");
      setListName((d?.name as string) ?? "Shopping list");
      setArchive((d?.archive as SavedList[]) ?? []);
    });
  }, [user]);

  const save = (next: ShopItem[], wk?: string | null) => {
    setItems(next);
    return setDoc(ref, { items: next, weekKey: wk ?? weekKey }, { merge: true });
  };
  const toggle = (id: string) => save(items.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
  const setAllChecked = (checked: boolean) => save(items.map((i) => ({ ...i, checked })));
  const addManual = (text: string) =>
    save([...items, { id: "m-" + crypto.randomUUID().slice(0, 8), item: text, unit: null, amount: null, category: "Other", checked: false, manual: true }]);
  const clearChecked = () => save(items.filter((i) => !i.checked));
  const generate = (fresh: ShopItem[], wk: string) => {
    const manual = items.filter((i) => i.manual);
    const prevChecked = new Set(items.filter((i) => i.checked).map((i) => i.id));
    save([...fresh.map((i) => ({ ...i, checked: prevChecked.has(i.id) })), ...manual], wk);
  };
  const applyTidy = (tidied: ShopItem[]) => {
    const wasChecked = new Set(items.filter((i) => i.checked).map((i) => i.item.toLowerCase().trim()));
    save(tidied.map((i) => ({ ...i, checked: wasChecked.has(i.item.toLowerCase().trim()) })));
  };
  const setSections = (next: string[]) => {
    setSectionsState(next);
    return setDoc(ref, { sections: next, sectionsUpdatedAt: Date.now(), sectionsUpdatedBy: user?.uid ?? "" }, { merge: true });
  };

  // ----- multiple lists (all in this one doc; switching archives the current) -----
  const snapshotActive = (): SavedList => ({ id: listId, name: listName, items, weekKey, savedAt: Date.now() });
  const createList = (name: string) => {
    const id = "L-" + crypto.randomUUID().slice(0, 8);
    return setDoc(ref, { id, name: name.trim() || "New list", items: [], weekKey: null, archive: [snapshotActive(), ...archive] }, { merge: true });
  };
  const switchList = (id: string) => {
    const target = archive.find((l) => l.id === id);
    if (!target) return Promise.resolve();
    return setDoc(ref, { id: target.id, name: target.name, items: target.items ?? [], weekKey: target.weekKey ?? null, archive: [snapshotActive(), ...archive.filter((l) => l.id !== id)] }, { merge: true });
  };
  const renameList = (id: string, name: string) => {
    if (id === listId) return setDoc(ref, { name: name.trim() }, { merge: true });
    return setDoc(ref, { archive: archive.map((l) => (l.id === id ? { ...l, name: name.trim() } : l)) }, { merge: true });
  };
  const deleteList = (id: string) => {
    if (id === listId) return Promise.resolve();
    return setDoc(ref, { archive: archive.filter((l) => l.id !== id) }, { merge: true });
  };

  return {
    items, weekKey, sections, sectionsUpdatedAt, sectionsUpdatedByName: sectionsUpdatedBy ? nameFor(sectionsUpdatedBy) : "",
    toggle, setAllChecked, addManual, clearChecked, generate, applyTidy, setSections,
    listId, listName, archive, createList, switchList, renameList, deleteList,
  };
}
