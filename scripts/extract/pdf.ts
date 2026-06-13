/**
 * Low-level PDF access via pdfjs: exact text items (with positions) and link
 * annotations (URL + rect) per page. The text layer is the source of truth for
 * all text/numbers (NOT visual reading); links capture clickable titles (D3).
 */
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "node:fs";
import { SOURCE_PDF } from "./config.js";

export interface TextItem { str: string; x: number; y: number; w: number; h: number; }
export interface LinkRect { url: string; x0: number; y0: number; x1: number; y1: number; }
export interface PageData { width: number; height: number; items: TextItem[]; links: LinkRect[]; }

let docPromise: ReturnType<typeof getDocument>["promise"] | null = null;
async function doc() {
  if (!docPromise) {
    const data = new Uint8Array(readFileSync(SOURCE_PDF));
    docPromise = getDocument({ data, useSystemFonts: true }).promise;
  }
  return docPromise;
}

export async function getPage(pageNum: number): Promise<PageData> {
  const page = await (await doc()).getPage(pageNum);
  const vp = page.getViewport({ scale: 1 });
  const H = vp.height;
  const tc = await page.getTextContent();
  const items: TextItem[] = tc.items
    .filter((it: any) => typeof it.str === "string" && it.str.trim() !== "")
    .map((it: any) => ({
      str: it.str,
      x: it.transform[4],
      y: H - it.transform[5], // top-down
      w: it.width,
      h: it.height,
    }));
  const ann = await page.getAnnotations();
  const links: LinkRect[] = ann
    .filter((a: any) => a.subtype === "Link" && a.url)
    .map((a: any) => ({ url: a.url, x0: a.rect[0], y0: H - a.rect[3], x1: a.rect[2], y1: H - a.rect[1] }));
  return { width: vp.width, height: H, items, links };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = Number(process.argv[2] ?? 48);
  getPage(n).then((p) => {
    console.log(`page ${n}: ${p.width}x${Math.round(p.height)}  items=${p.items.length} links=${p.links.length}`);
    console.log("\nLINKS:"); p.links.forEach((l) => console.log(`  [${l.x0.toFixed(0)},${l.y0.toFixed(0)}-${l.x1.toFixed(0)},${l.y1.toFixed(0)}] ${l.url}`));
    console.log("\nITEMS (x,y,text):");
    p.items.slice(0, 80).forEach((i) => console.log(`  ${i.x.toFixed(0).padStart(4)},${i.y.toFixed(0).padStart(4)}  ${JSON.stringify(i.str)}`));
  });
}
