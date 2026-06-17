import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, AlertTriangle, X } from "lucide-react";
import { useAISettings } from "../../lib/data/useAISettings";
import { timeAgo } from "../../lib/timeAgo";
import { importRecipe, draftToLines, searchImage, AiError, type Source } from "../../lib/ai/ai";
import type { CustomLine } from "../../lib/schema/custom";

export interface AppliedDraft { title: string; servings: number; lines: CustomLine[]; steps: string; image?: string | null; category?: string; prepTimeMin?: number | null; cookTimeMin?: number | null }

const ytThumb = (url: string): string | null => {
  const m = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
};

const SOURCE_TYPES: { v: Source["type"]; label: string; placeholder: string }[] = [
  { v: "text", label: "Paste text", placeholder: "Paste a recipe in any language…" },
  { v: "youtube", label: "YouTube link", placeholder: "https://www.youtube.com/watch?v=…" },
  { v: "notes", label: "My notes", placeholder: "e.g. I only have Greek yogurt · make it 4 servings · less salt" },
];

interface Row { id: string; type: Source["type"]; content: string }

export function AiImportPanel({ onApply }: { onApply: (a: AppliedDraft) => void }) {
  const { systemPrompt, setSystemPrompt, resetSystemPrompt, isDefault, updatedAt, updatedByName, history, restoreVersion, tokens, addUsage } = useAISettings();
  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState<Row[]>([{ id: crypto.randomUUID(), type: "text", content: "" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTokens, setLastTokens] = useState<number | null>(null);
  const [ok, setOk] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptDraft, setPromptDraft] = useState(systemPrompt);

  const setType = (i: number, t: Source["type"]) => setSources((s) => s.map((x, j) => (j === i ? { ...x, type: t } : x)));
  const setContent = (i: number, c: string) => setSources((s) => s.map((x, j) => (j === i ? { ...x, content: c } : x)));
  const addSource = () => setSources((s) => [...s, { id: crypto.randomUUID(), type: "text", content: "" }]);
  const removeSource = (i: number) => setSources((s) => (s.length > 1 ? s.filter((_, j) => j !== i) : s));
  const hasContent = sources.some((s) => s.content.trim());

  const generate = async () => {
    setBusy(true); setError(null); setOk(false);
    try {
      const { draft, usage } = await importRecipe(sources.map(({ type, content }) => ({ type, content })), systemPrompt);
      const ytSrc = sources.find((s) => s.type === "youtube" && s.content.trim());
      const image = ytSrc ? ytThumb(ytSrc.content) : await searchImage(draft.title).catch(() => null);
      onApply({
        title: draft.title, servings: draft.servings, lines: draftToLines(draft), steps: draft.steps.join("\n"),
        image,
        category: draft.category, prepTimeMin: draft.prepTimeMin ?? null, cookTimeMin: draft.cookTimeMin ?? null,
      });
      addUsage(usage);
      setLastTokens(usage.totalTokenCount ?? null);
      setOk(true);
    } catch (e) {
      setError(e instanceof AiError ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const totalTokens = tokens.input + tokens.output;

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-hairline">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-surface-soft">
        <span className="inline-flex items-center gap-2 font-display text-[16px] font-600"><Sparkles size={16} /> Import with AI</span>
        <span className="text-[13px] text-mute">{open ? "Hide" : "Paste text, a YouTube link, or notes"}</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-3 border-t border-hairline px-5 py-4">
              <motion.div layout className="space-y-3">
                <AnimatePresence initial={false}>
                  {sources.map((s, i) => {
                    const meta = SOURCE_TYPES.find((t) => t.v === s.type)!;
                    return (
                      <motion.div key={s.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginTop: 0 }} transition={{ duration: 0.18 }} className="flex items-start gap-2">
                        <select value={s.type} onChange={(e) => setType(i, e.target.value as Source["type"])}
                          className="h-9 shrink-0 rounded-lg border border-hairline bg-canvas px-2 text-[13px] font-500 text-charcoal outline-none hover:border-ink">
                          {SOURCE_TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                        </select>
                        {s.type === "youtube" ? (
                          <input value={s.content} onChange={(e) => setContent(i, e.target.value)} placeholder={meta.placeholder}
                            className="h-9 flex-1 rounded-lg bg-surface-soft px-3 text-[14px] outline-none placeholder:text-mute" />
                        ) : (
                          <textarea value={s.content} onChange={(e) => setContent(i, e.target.value)} placeholder={meta.placeholder} rows={s.type === "notes" ? 2 : 4}
                            className="flex-1 resize-y rounded-lg bg-surface-soft p-3 text-[14px] leading-relaxed outline-none placeholder:text-mute" />
                        )}
                        <button onClick={() => removeSource(i)} disabled={sources.length === 1} className="mt-1 text-mute hover:text-ink disabled:opacity-30" aria-label="Remove source"><X size={16} /></button>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>

              <button onClick={addSource} className="text-[13px] text-body hover:text-ink">+ Add another source</button>

              {/* editable system prompt (personalization memory) */}
              <div className="border-t border-hairline pt-3">
                <button onClick={() => { setPromptDraft(systemPrompt); setPromptOpen((v) => !v); }} className="text-[13px] text-body hover:text-ink">
                  {promptOpen ? "Hide AI instructions" : "Edit AI instructions"} {!isDefault && <span className="text-mute">(customized)</span>}
                </button>
                <AnimatePresence>
                  {promptOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <p className="mt-2 text-[12px] text-mute">
                        Shared instructions used on every import - both of you see and edit these.
                        {updatedAt > 0 && <> Updated {timeAgo(updatedAt)}{updatedByName ? ` by ${updatedByName}` : ""}.</>}
                      </p>
                      <textarea value={promptDraft} onChange={(e) => setPromptDraft(e.target.value)} rows={8}
                        className="mt-2 w-full resize-y rounded-lg border border-hairline bg-surface-soft p-3 text-[13px] leading-relaxed outline-none focus:border-ink" />
                      <div className="mt-2 flex items-center gap-2">
                        <button onClick={() => { setSystemPrompt(promptDraft); setPromptOpen(false); }} className="h-8 rounded-full bg-ink px-4 text-[12px] font-500 text-canvas hover:bg-ink-deep">Save instructions</button>
                        <button onClick={() => { resetSystemPrompt(); setPromptOpen(false); }} className="h-8 rounded-full px-3 text-[12px] text-mute hover:text-ink">Reset to default</button>
                      </div>
                      {history.length > 0 && (
                        <div className="mt-3 border-t border-hairline pt-2">
                          <p className="text-[11px] font-600 uppercase tracking-wide text-mute">Previous versions</p>
                          <ul className="mt-1 space-y-1">
                            {history.map((v, i) => (
                              <li key={i} className="flex items-center gap-2">
                                <span className="min-w-0 flex-1 truncate text-[12px] text-body">{timeAgo(v.at) || "earlier"} · {v.prompt.replace(/\s+/g, " ").slice(0, 60)}…</span>
                                <button onClick={() => { restoreVersion(v.prompt); setPromptDraft(v.prompt); }} className="shrink-0 text-[12px] text-ink underline">Restore</button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* loud error */}
              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="flex items-start gap-2 rounded-xl border-2 border-ink bg-surface-soft px-4 py-3">
                    <AlertTriangle size={17} className="mt-0.5 shrink-0 text-ink" />
                    <span className="text-[14px] font-600 text-ink">{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex flex-wrap items-center gap-3">
                <button onClick={generate} disabled={busy || !hasContent}
                  className="inline-flex h-10 items-center rounded-full bg-ink px-5 text-[14px] font-500 text-canvas hover:bg-ink-deep disabled:opacity-30">
                  {busy ? (sources.some((s) => s.type === "youtube" && s.content.trim()) ? "Watching the video… (~30s)" : "Reading sources…") : "Generate recipe"}
                </button>
                {ok && !busy && <span className="text-[13px] text-body">Imported below ✓ review and save.</span>}
                {/* subtle token meter */}
                <span className="ml-auto text-[11px] text-mute tabular-nums">
                  {lastTokens != null && <>last {lastTokens.toLocaleString()} tok · </>}
                  {tokens.calls > 0 ? `${totalTokens.toLocaleString()} tok total (${tokens.input.toLocaleString()} in / ${tokens.output.toLocaleString()} out)` : "free tier"}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
