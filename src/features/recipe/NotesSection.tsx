import { useEffect, useState } from "react";
import { useRecipeNotes } from "../../lib/data/useRecipeNotes";

function timeAgo(ms: number): string {
  if (!ms) return "";
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : new Date(ms).toLocaleDateString();
}

/** Per-person notes on a recipe (D32): your own (explicit save + status), partner's read-only. */
export function NotesSection({ recipeId }: { recipeId: string }) {
  const { myNote, myNoteAt, partnerNote, partnerNoteAt, partnerName, setMyNote } = useRecipeNotes(recipeId);
  const [draft, setDraft] = useState(myNote);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(myNote), [myNote]);

  const dirty = draft !== myNote;
  const status = saving ? "Saving…" : dirty ? "Unsaved changes" : myNoteAt ? `Saved · ${timeAgo(myNoteAt)}` : "";

  const save = async () => { setSaving(true); try { await setMyNote(draft); } finally { setSaving(false); } };

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-[20px] font-600">Notes</h2>
        <span className={`text-[12px] ${dirty ? "text-ink" : "text-mute"}`}>{status}</span>
      </div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={`Your note${partnerName ? ` (${partnerName} can see it)` : ""}…`}
        rows={3}
        className="mt-3 w-full resize-y rounded-xl border border-hairline bg-surface-soft p-3 text-[15px] leading-relaxed outline-none focus:border-ink"
      />
      <div className="mt-2 flex justify-end">
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="h-9 rounded-full bg-ink px-5 text-[13px] font-500 text-canvas transition-opacity hover:bg-ink-deep disabled:opacity-30"
        >
          Save note
        </button>
      </div>
      {partnerNote && (
        <div className="mt-2 rounded-xl bg-surface-soft p-3">
          <p className="text-[12px] font-600 uppercase tracking-wide text-mute">
            {partnerName}'s note{partnerNoteAt ? ` · ${timeAgo(partnerNoteAt)}` : ""}
          </p>
          <p className="mt-1 text-[15px] leading-relaxed text-charcoal">{partnerNote}</p>
        </div>
      )}
    </section>
  );
}
