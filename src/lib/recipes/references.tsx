import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Recipe } from "../schema/recipe";
import { recipes } from "./loadRecipes";

export const groupAnchor = (name: string) => "group-" + name.toLowerCase().replace(/[^\w]+/g, "-");

// title (normalized, ≥2 words) -> recipe id, for resolving ALLCAPS references (D22)
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
const titleToId = new Map<string, string>();
for (const r of recipes) if (r.title.split(/\s+/).length >= 2) titleToId.set(norm(r.title), r.id);

interface Span { start: number; end: number; node: (key: number) => ReactNode; }

/** Render a step with inline links: group jumps, recipe links, video timestamps (D21–D23). */
export function renderStep(text: string, recipe: Recipe): ReactNode {
  const spans: Span[] = [];
  const claim = (start: number, end: number, node: (k: number) => ReactNode) => {
    if (!spans.some((s) => start < s.end && end > s.start)) spans.push({ start, end, node });
  };

  // 1. video timestamps -> deep link
  if (recipe.videoUrl) {
    for (const m of text.matchAll(/timestamp\s+(\d+):(\d{2})/gi)) {
      const secs = Number(m[1]) * 60 + Number(m[2]);
      const url = recipe.videoUrl + (recipe.videoUrl.includes("?") ? "&" : "?") + "t=" + secs;
      const i = m.index!;
      claim(i, i + m[0].length, (k) => (
        <a key={k} href={url} target="_blank" rel="noreferrer" className="font-500 text-ink underline decoration-mute underline-offset-2 hover:decoration-ink">{m[0]}</a>
      ));
    }
  }

  // 2. this recipe's group names -> scroll to the group
  for (const g of recipe.ingredientGroups) {
    if (g.name.toLowerCase() === "ingredients") continue;
    const re = new RegExp(`\\b${g.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")}(\\s+Ingredients)?\\b`, "gi");
    for (const m of text.matchAll(re)) {
      const i = m.index!;
      claim(i, i + m[0].length, (k) => (
        <button key={k} onClick={() => document.getElementById(groupAnchor(g.name))?.scrollIntoView({ behavior: "smooth", block: "center" })} className="font-500 text-ink underline decoration-mute underline-offset-2 hover:decoration-ink">{m[0]}</button>
      ));
    }
  }

  // 3. ALLCAPS multi-word phrases -> another recipe (references are caps in the source)
  for (const m of text.matchAll(/\b[A-Z][A-Z'’&]+(?:\s+[A-Z'’&]+){1,5}\b/g)) {
    const id = titleToId.get(norm(m[0]));
    if (id && id !== recipe.id) {
      const i = m.index!;
      claim(i, i + m[0].length, (k) => (
        <Link key={k} to={`/r/${id}`} className="font-500 text-ink underline decoration-mute underline-offset-2 hover:decoration-ink">{m[0]}</Link>
      ));
    }
  }

  if (!spans.length) return text;
  spans.sort((a, b) => a.start - b.start);
  const out: ReactNode[] = [];
  let cursor = 0;
  spans.forEach((s, i) => {
    if (s.start > cursor) out.push(text.slice(cursor, s.start));
    out.push(s.node(i));
    cursor = s.end;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}
