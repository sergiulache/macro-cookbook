import { useEffect, useState } from "react";
import { useRecipeNotes } from "../../lib/data/useRecipeNotes";

/** Per-person notes on a recipe (D32): your own, editable; your partner's, read-only. */
export function NotesSection({ recipeId }: { recipeId: string }) {
  const { myNote, partnerNote, partnerName, setMyNote } = useRecipeNotes(recipeId);
  const [draft, setDraft] = useState(myNote);
  useEffect(() => setDraft(myNote), [myNote]);

  return (
    <section className="mt-8">
      <h2 className="font-display text-[20px] font-600">Notes</h2>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== myNote && setMyNote(draft)}
        placeholder="Your note (your partner can see it)…"
        rows={3}
        className="mt-3 w-full resize-y rounded-xl border border-hairline bg-surface-soft p-3 text-[15px] leading-relaxed outline-none focus:border-ink"
      />
      {partnerNote && (
        <div className="mt-3 rounded-xl bg-surface-soft p-3">
          <p className="text-[12px] font-600 uppercase tracking-wide text-mute">{partnerName}'s note</p>
          <p className="mt-1 text-[15px] leading-relaxed text-charcoal">{partnerNote}</p>
        </div>
      )}
    </section>
  );
}
