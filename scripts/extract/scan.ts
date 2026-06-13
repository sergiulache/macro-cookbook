/**
 * Classify every page of the book to drive recipe page-grouping for the full
 * extraction: which pages are recipe content pages (INGREDIENTS+DIRECTIONS),
 * their footer category + title caption, plus corrupt (unparseable) pages.
 */
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { SOURCE_PDF, OUT_DIR } from "./config.js";

const deLetter = (s: string) =>
  s.split(/\s{2,}/).map((w) => { const t = w.split(" "); return t.length > 1 && t.filter((x) => x.length === 1).length / t.length >= 0.6 ? t.join("") : w; }).join(" ").trim();
const norm = (s: string) => deLetter(s).replace(/\s+/g, " ").trim();

interface PageInfo { n: number; isContent: boolean; hasMacros: boolean; category: string; caption: string | null; corrupt?: boolean; }

const data = new Uint8Array(readFileSync(SOURCE_PDF));
const doc = await getDocument({ data, useSystemFonts: true }).promise;
const pages: PageInfo[] = [];
for (let n = 1; n <= doc.numPages; n++) {
  try {
    const page = await doc.getPage(n);
    const vp = page.getViewport({ scale: 1 });
    const items = (await page.getTextContent()).items
      .filter((i: any) => i.str?.trim())
      .map((i: any) => ({ str: i.str, x: i.transform[4], y: vp.height - i.transform[5] }));
    const labels = new Set(items.map((i) => norm(i.str).toUpperCase()));
    const footer = items.filter((i) => i.y > vp.height - 22 && !/^\d+$/.test(i.str.trim())).sort((a, b) => a.x - b.x)[0];
    const cap = items.filter((i) => i.y > 478 && i.y < 520)
      .map((i) => norm(i.str)).find((t) => /^[A-Z][a-z]/.test(t) && t.split(" ").length <= 6 && !/\.$/.test(t));
    pages.push({
      n, isContent: labels.has("INGREDIENTS") && labels.has("DIRECTIONS"),
      hasMacros: labels.has("MACROS"), category: footer ? norm(footer.str) : "", caption: cap ?? null,
    });
  } catch { pages.push({ n, isContent: false, hasMacros: false, category: "", caption: null, corrupt: true }); }
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(`${OUT_DIR}/scan.json`, JSON.stringify(pages, null, 2));
const content = pages.filter((p) => p.isContent);
const corrupt = pages.filter((p) => p.corrupt);
const cats = [...new Set(content.map((p) => p.category))].filter(Boolean);
console.log(`pages: ${pages.length}  recipe-content: ${content.length}  corrupt: ${corrupt.length}`);
console.log(`categories (${cats.length}):`, cats.join(" | "));
if (corrupt.length) console.log(`corrupt pages:`, corrupt.map((p) => p.n).join(", "));
console.log(`content pages w/o macros on same page (macros likely on photo page):`, content.filter((p) => !p.hasMacros).length);
