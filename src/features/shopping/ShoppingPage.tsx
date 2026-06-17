import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChefHat, ChevronDown } from "lucide-react";
import { useShoppingList } from "../../lib/data/useShoppingList";
import { useWeekPlan, isoWeekKey, weekKeyRange } from "../../lib/data/useWeekPlan";
import { aggregate } from "../../lib/shopping/aggregate";
import { useRecipeIndex } from "../../lib/recipes/RecipeIndex";
import { useAISettings } from "../../lib/data/useAISettings";
import { tidyShoppingList } from "../../lib/ai/shopping";
import { AiError } from "../../lib/ai/ai";
import { timeAgo } from "../../lib/timeAgo";

export function ShoppingPage() {
  const weekKey = isoWeekKey(new Date());
  const { byId, all } = useRecipeIndex();
  const titleToId = useMemo(() => {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    return new Map(all.map((r) => [norm(r.title), r.id]));
  }, [all]);
  const recipeId = (title: string) => titleToId.get(title.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const { entries } = useWeekPlan(weekKey);
  const { items, weekKey: listWeek, sections, sectionsUpdatedAt, sectionsUpdatedByName, toggle, setAllChecked, addManual, clearChecked, generate, applyTidy, setSections,
    listId, listName, archive, createList, switchList, renameList, deleteList } = useShoppingList();
  const { addUsage } = useAISettings();
  const [manual, setManual] = useState("");
  const [tidying, setTidying] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const [lastUsage, setLastUsage] = useState<{ i: number; o: number } | null>(null);
  const [storeOpen, setStoreOpen] = useState(false);
  const [sectionsDraft, setSectionsDraft] = useState("");
  const [lang, setLang] = useState<"en" | "ro">(() => (typeof localStorage !== "undefined" && localStorage.getItem("mc.shop.lang") === "ro" ? "ro" : "en"));
  useEffect(() => { try { localStorage.setItem("mc.shop.lang", lang); } catch { /* ignore */ } }, [lang]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shown, setShown] = useState<Set<string>>(new Set());
  const toggleShown = (id: string) => setShown((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const onGenerate = () => {
    const fresh = aggregate(entries, byId);
    if (!fresh.length) return;
    if (items.length && !confirm("Replace the shopping list with this week's plan? (your manual items are kept)")) return;
    generate(fresh, weekKey);
  };

  const onTidy = async () => {
    if (!items.length) return;
    setTidying(true); setAiErr(null);
    try {
      const { items: tidied, usage } = await tidyShoppingList(items, sections);
      applyTidy(tidied);
      addUsage(usage);
      setLastUsage({ i: usage.promptTokenCount ?? 0, o: usage.candidatesTokenCount ?? 0 });
    } catch (e) {
      setAiErr(e instanceof AiError ? e.message : "Tidy failed. Try again.");
    } finally {
      setTidying(false);
    }
  };

  const present = [...new Set(items.map((i) => i.category))];
  const cats = [...sections.filter((s) => present.includes(s)), ...present.filter((p) => !sections.includes(p)).sort()];
  const remaining = items.filter((i) => !i.checked).length;
  const allChecked = items.length > 0 && items.every((i) => i.checked);

  return (
    <div className="mx-auto max-w-[720px] px-5 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3 pt-10 pb-4">
        <div>
          <div className="relative">
            <button onClick={() => setMenuOpen((v) => !v)} className="flex items-center gap-1.5 font-display text-[30px] font-700 tracking-tight">
              <span className="truncate max-w-[260px]">{listName}</span>
              <ChevronDown size={18} className="mt-1 shrink-0 text-mute" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute left-0 z-20 mt-1 w-72 rounded-xl border border-hairline bg-canvas py-1 shadow-sm">
                  {[{ id: listId, name: listName, active: true }, ...archive.map((l) => ({ id: l.id, name: l.name, active: false }))].map((l) => (
                    <div key={l.id} className="flex items-center gap-1 px-2 py-0.5">
                      <button onClick={() => { if (!l.active) switchList(l.id); setMenuOpen(false); }} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[14px] hover:bg-surface-soft">
                        <span className="w-3 shrink-0 text-ink">{l.active ? "✓" : ""}</span>
                        <span className="truncate">{l.name}</span>
                      </button>
                      <button onClick={() => { const n = prompt("Rename list", l.name); if (n != null && n.trim()) renameList(l.id, n); }} title="Rename" className="shrink-0 px-1.5 text-[13px] text-mute hover:text-ink">✎</button>
                      {!l.active && <button onClick={() => { if (confirm(`Delete “${l.name}”?`)) deleteList(l.id); }} title="Delete" className="shrink-0 px-1.5 text-[13px] text-mute hover:text-ink">✕</button>}
                    </div>
                  ))}
                  <div className="mt-1 border-t border-hairline px-2 pt-1">
                    <button onClick={() => { const n = prompt("New list name", "Shopping list"); if (n != null) { createList(n || "New list"); setMenuOpen(false); } }} className="w-full rounded-lg px-2 py-1.5 text-left text-[14px] font-500 text-ink hover:bg-surface-soft">+ New list</button>
                  </div>
                </div>
              </>
            )}
          </div>
          {listWeek && <p className="mt-1 text-[13px] text-mute">From plan {weekKeyRange(listWeek)} · {remaining} left</p>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full border border-hairline-strong p-0.5 text-[12px] font-600">
            <button onClick={() => setLang("en")} className={`h-8 rounded-full px-3 ${lang === "en" ? "bg-ink text-canvas" : "text-charcoal hover:text-ink"}`}>EN</button>
            <button onClick={() => setLang("ro")} className={`h-8 rounded-full px-3 ${lang === "ro" ? "bg-ink text-canvas" : "text-charcoal hover:text-ink"}`}>RO</button>
          </div>
          <button onClick={onTidy} disabled={tidying || !items.length}
            className="inline-flex h-9 items-center rounded-full border border-hairline-strong px-4 text-[13px] font-500 text-ink hover:border-ink disabled:opacity-30">
            {tidying ? "Tidying…" : "✦ Tidy with AI"}
          </button>
          <button onClick={onGenerate} className="inline-flex h-9 items-center rounded-full bg-ink px-4 text-[13px] font-500 text-canvas hover:bg-ink-deep">
            Generate from week
          </button>
        </div>
      </header>

      {/* store section order (drives ordering + the AI tidy) */}
      <div className="mb-4">
        <button onClick={() => { setSectionsDraft(sections.join("\n")); setStoreOpen((v) => !v); }} className="text-[13px] text-body hover:text-ink">
          {storeOpen ? "Hide store order" : "Store order"}
        </button>
        <AnimatePresence>
          {storeOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <p className="mt-2 text-[12px] text-mute">
                One section per line, in the order you walk your store - shared between you, used by the list and the AI tidy.
                {sectionsUpdatedAt > 0 && <> Updated {timeAgo(sectionsUpdatedAt)}{sectionsUpdatedByName ? ` by ${sectionsUpdatedByName}` : ""}.</>}
              </p>
              <textarea value={sectionsDraft} onChange={(e) => setSectionsDraft(e.target.value)} rows={6}
                className="mt-2 w-full resize-y rounded-xl border border-hairline bg-surface-soft p-3 text-[14px] leading-relaxed outline-none focus:border-ink" />
              <button onClick={() => { setSections(sectionsDraft.split("\n").map((s) => s.trim()).filter(Boolean)); setStoreOpen(false); }}
                className="mt-2 h-8 rounded-full bg-ink px-4 text-[12px] font-500 text-canvas hover:bg-ink-deep">Save order</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {aiErr && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border-2 border-ink bg-surface-soft px-4 py-3">
          <span className="text-[15px]">⚠</span><span className="text-[14px] font-600 text-ink">{aiErr}</span>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-hairline p-8 text-center text-body">
          Plan some recipes this week, then generate your list.
        </div>
      ) : (
        <div className="space-y-6">
          {cats.map((cat) => (
            <section key={cat}>
              <h2 className="text-[13px] font-600 uppercase tracking-wide text-mute">{cat}</h2>
              <ul className="mt-1.5">
                <AnimatePresence>
                  {items.filter((i) => i.category === cat).map((i) => (
                    <motion.li key={i.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="border-b border-hairline">
                      <div className="flex items-center">
                        <button onClick={() => toggle(i.id)} className="flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left">
                          <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${i.checked ? "border-ink bg-ink text-canvas" : "border-hairline-strong"}`}>{i.checked ? "✓" : ""}</span>
                          <span className={`flex-1 truncate text-[15px] ${i.checked ? "text-mute line-through" : "text-ink"}`}>{lang === "ro" ? (i.name_ro || i.item) : i.item}</span>
                          {i.amount != null && (
                            <span className="flex shrink-0 items-center gap-1.5 font-mono text-[13px] text-body tabular-nums">
                              {i.approx ? "~" : ""}{i.amount}{i.unit ? " " + i.unit : ""}
                              {i.estimated && <span title="Quantity estimated by AI (recipe gave no number)" className="rounded-full border border-hairline-strong px-1 text-[9px] font-600 uppercase tracking-wide text-mute">est</span>}
                            </span>
                          )}
                        </button>
                        {i.recipes && i.recipes.length > 0 && (
                          <button onClick={() => toggleShown(i.id)} title="Which recipes use this" className={`shrink-0 px-2 ${shown.has(i.id) ? "text-ink" : "text-mute hover:text-ink"}`}>
                            <ChefHat size={15} strokeWidth={2} />
                          </button>
                        )}
                      </div>
                      <AnimatePresence initial={false}>
                        {shown.has(i.id) && i.recipes && i.recipes.length > 0 && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: "easeOut" }} className="overflow-hidden">
                            <p className="pb-2 pl-8 text-[12px] text-mute">
                              In{" "}
                              {i.recipes.map((name, k) => {
                                const rid = recipeId(name);
                                return (
                                  <span key={k}>
                                    {k > 0 ? ", " : ""}
                                    {rid ? <Link to={`/r/${rid}`} className="text-body underline decoration-mute underline-offset-2 hover:text-ink">{name}</Link> : name}
                                  </span>
                                );
                              })}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </section>
          ))}

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && manual.trim()) { addManual(manual.trim()); setManual(""); } }}
              placeholder="Add an item…"
              className="h-10 min-w-[140px] flex-1 rounded-full bg-surface-soft px-4 text-[15px] outline-none placeholder:text-mute"
            />
            <button onClick={() => { if (manual.trim()) { addManual(manual.trim()); setManual(""); } }} className="h-10 rounded-full border border-hairline-strong px-4 text-[13px] font-500 hover:border-ink">Add</button>
            <button onClick={() => setAllChecked(!allChecked)} className="h-10 rounded-full px-3 text-[13px] text-mute hover:text-ink">{allChecked ? "Deselect all" : "Select all"}</button>
            <button onClick={clearChecked} className="h-10 rounded-full px-3 text-[13px] text-mute hover:text-ink">Clear ✓</button>
          </div>
          {lastUsage && <p className="text-right text-[11px] text-mute tabular-nums">tidy: {lastUsage.i.toLocaleString()} in / {lastUsage.o.toLocaleString()} out tokens</p>}
        </div>
      )}
    </div>
  );
}
