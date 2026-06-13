import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/auth";
import type { ShopItem } from "../shopping/aggregate";

/** Joint shopping list (D15 Joint, D30 stable snapshot): one shared doc, live-synced. */
export function useShoppingList() {
  const { user } = useAuth();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [weekKey, setWeekKey] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "joint", "shoppingList"), (snap) => {
      const d = snap.data();
      setItems((d?.items as ShopItem[]) ?? []);
      setWeekKey((d?.weekKey as string) ?? null);
    });
  }, [user]);

  const save = (next: ShopItem[], wk?: string | null) => {
    setItems(next);
    return setDoc(doc(db, "joint", "shoppingList"), { items: next, weekKey: wk ?? weekKey }, { merge: true });
  };
  const toggle = (id: string) => save(items.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
  const addManual = (text: string) =>
    save([...items, { id: "m-" + crypto.randomUUID().slice(0, 8), item: text, unit: null, amount: null, category: "Other", checked: false, manual: true }]);
  const clearChecked = () => save(items.filter((i) => !i.checked));
  const generate = (fresh: ShopItem[], wk: string) => {
    // keep manual items + checked state for items that persist
    const manual = items.filter((i) => i.manual);
    const prevChecked = new Set(items.filter((i) => i.checked).map((i) => i.id));
    save([...fresh.map((i) => ({ ...i, checked: prevChecked.has(i.id) })), ...manual], wk);
  };

  return { items, weekKey, toggle, addManual, clearChecked, generate };
}
