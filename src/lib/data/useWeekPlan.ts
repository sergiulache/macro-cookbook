import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/auth";

export interface PlanEntry { id: string; day: number; recipeId: string; servings: number }

/** ISO-week key like "2026-W24". */
export function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (t.getUTCDay() + 6) % 7; // Mon=0
  t.setUTCDate(t.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((t.getTime() - firstThu.getTime()) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
/** Format an ISO week key ("2026-W25") as a "DD.MM - DD.MM" Monday-Sunday range. */
export function weekKeyRange(weekKey: string): string {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!m) return weekKey;
  const year = Number(m[1]), week = Number(m[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const dd = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${dd(monday)} - ${dd(sunday)}`;
}

/** Monday-anchored dates for the week containing `d`. */
export function weekDates(d: Date): Date[] {
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(monday); x.setDate(monday.getDate() + i); return x; });
}
export const shiftWeek = (base: Date, deltaWeeks: number) => { const x = new Date(base); x.setDate(x.getDate() + deltaWeeks * 7); return x; };
export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Joint weekly meal plan (D15 Joint, D29 navigable weeks): one shared doc per ISO week. */
export function useWeekPlan(weekKey: string) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<PlanEntry[]>([]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "joint", `week_${weekKey}`), (snap) => {
      setEntries((snap.data()?.entries as PlanEntry[]) ?? []);
    });
  }, [user, weekKey]);

  const save = (next: PlanEntry[]) => {
    setEntries(next); // optimistic
    return setDoc(doc(db, "joint", `week_${weekKey}`), { entries: next }, { merge: true });
  };
  const add = (day: number, recipeId: string, servings: number) =>
    save([...entries, { id: crypto.randomUUID(), day, recipeId, servings }]);
  const remove = (id: string) => save(entries.filter((e) => e.id !== id));
  const setServings = (id: string, servings: number) =>
    save(entries.map((e) => (e.id === id ? { ...e, servings } : e)));

  return { entries, add, remove, setServings };
}
