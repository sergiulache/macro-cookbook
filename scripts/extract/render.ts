/**
 * Render PDF pages to PNG (Poppler `pdftoppm`) so recipes can be read visually
 * and shown side-by-side with extracted JSON in the report (D6).
 *
 * Usage: tsx scripts/extract/render.ts <page> [page ...]
 */
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { SOURCE_PDF, PAGES_DIR } from "./config.js";

const DPI = 150; // 8x10in page -> ~1200x1500px, legible

export function renderPage(page: number): string {
  mkdirSync(PAGES_DIR, { recursive: true });
  const prefix = `${PAGES_DIR}/page-${String(page).padStart(3, "0")}`;
  execFileSync("pdftoppm", [
    "-png",
    "-r", String(DPI),
    "-f", String(page),
    "-l", String(page),
    "-singlefile",
    SOURCE_PDF,
    prefix,
  ]);
  return `${prefix}.png`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pages = process.argv.slice(2).map(Number).filter((n) => n > 0);
  if (!pages.length) {
    console.error("give page numbers, e.g. tsx render.ts 44 45 46");
    process.exit(1);
  }
  for (const p of pages) console.log("rendered", renderPage(p));
}
