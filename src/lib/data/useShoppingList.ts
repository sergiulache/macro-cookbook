import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/auth";
import { nameFor } from "./people";
import { DEFAULT_SECTIONS, type ShopItem } from "../shopping/aggregate";

/** Joint shopping list (D15 Joint, D30 stable snapshot): one shared doc, live-synced. */
export function useShoppingList() {
  const { user } = useAuth();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [weekKey, setWeekKey] = useState<string | null>(null);
  const [sections, setSectionsState] = useState<string[]>(DEFAULT_SECTIONS);
  const [sectionsUpdatedAt, setSectionsAt] = useState(0);
  const [sectionsUpdatedBy, setSectionsBy] = useState("");

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "joint", "shoppingList"), (snap) => {
      const d = snap.data();
      setItems((d?.items as ShopItem[]) ?? []);
      setWeekKey((d?.weekKey as string) ?? null);
      const s = d?.sections as string[] | undefined;
      setSectionsState(s && s.length ? s : DEFAULT_SECTIONS);
      setSectionsAt((d?.sectionsUpdatedAt as number) ?? 0);
      setSectionsBy((d?.sectionsUpdatedBy as string) ?? "");
    });
  }, [user]);

  const save = (next: ShopItem[], wk?: string | null) => {
    setItems(next);
    return setDoc(doc(db, "joint", "shoppingList"), { items: next, weekKey: wk ?? weekKey }, { merge: true });
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
  /** Replace items with an AI-tidied list, preserving check-state by item name. */
  const applyTidy = (tidied: ShopItem[]) => {
    const wasChecked = new Set(items.filter((i) => i.checked).map((i) => i.item.toLowerCase().trim()));
    save(tidied.map((i) => ({ ...i, checked: wasChecked.has(i.item.toLowerCase().trim()) })));
  };
  const setSections = (next: string[]) => {
    setSectionsState(next);
    return setDoc(doc(db, "joint", "shoppingList"), { sections: next, sectionsUpdatedAt: Date.now(), sectionsUpdatedBy: user?.uid ?? "" }, { merge: true });
  };

  return {
    items, weekKey, sections, sectionsUpdatedAt, sectionsUpdatedByName: sectionsUpdatedBy ? nameFor(sectionsUpdatedBy) : "",
    toggle, setAllChecked, addManual, clearChecked, generate, applyTidy, setSections,
  };
}
