/** Find true PDF page numbers containing given queries (pdfjs = reliable paging). */
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "node:fs";
import { SOURCE_PDF } from "./config.js";

const queries = process.argv.slice(2);
const data = new Uint8Array(readFileSync(SOURCE_PDF));
const doc = await getDocument({ data, useSystemFonts: true }).promise;
const bad: number[] = [];
for (let n = 1; n <= doc.numPages; n++) {
  try {
    const page = await doc.getPage(n);
    const text = (await page.getTextContent()).items.map((i: any) => i.str).join(" ").replace(/\s+/g, " ");
    for (const q of queries) {
      const idx = text.toLowerCase().indexOf(q.toLowerCase());
      if (idx >= 0) console.log(`p${n}\t${q}\t…${text.slice(Math.max(0, idx - 20), idx + q.length + 30)}…`);
    }
  } catch (e: any) {
    bad.push(n);
  }
}
if (bad.length) console.log(`\n⚠ ${bad.length} page(s) failed to parse (corrupt xref): ${bad.join(", ")}`);
