/**
 * Optimize a source image (a full-bleed hero page render or a pdfimages export)
 * into responsive WebP + a tiny inline blur placeholder (D18 keeps images bundled
 * statically; we may compress/optimize freely).
 */
import sharp from "sharp";
import { mkdirSync, existsSync } from "node:fs";
import { ASSETS_OUT } from "./config.js";
import type { RecipeImage } from "../../src/lib/schema/recipe.js";

const WIDTHS = [400, 800, 1200];

export async function optimizeHero(sourcePath: string, id: string, force = false): Promise<RecipeImage> {
  mkdirSync(ASSETS_OUT, { recursive: true });
  // skip re-encoding if already generated (fast re-runs when only data changes)
  if (!force && existsSync(`${ASSETS_OUT}/${id}-800.webp`)) {
    const have = WIDTHS.filter((w) => existsSync(`${ASSETS_OUT}/${id}-${w}.webp`));
    const dims = await sharp(`${ASSETS_OUT}/${id}-800.webp`).metadata();
    const blur = await sharp(`${ASSETS_OUT}/${id}-400.webp`).resize({ width: 16 }).webp({ quality: 40 }).toBuffer();
    return {
      src: `recipes/${id}-800.webp`,
      srcset: have.map((w) => `recipes/${id}-${w}.webp ${w}w`).join(", "),
      width: dims.width ?? 800, height: dims.height ?? 0,
      blurDataURL: `data:image/webp;base64,${blur.toString("base64")}`,
    };
  }
  const meta = await sharp(sourcePath).metadata();
  const maxW = meta.width ?? 1200;

  const variants: { w: number; file: string }[] = [];
  for (const w of WIDTHS) {
    if (w > maxW && variants.length) break; // don't upscale past source
    const file = `${id}-${w}.webp`;
    await sharp(sourcePath).resize({ width: Math.min(w, maxW) }).webp({ quality: 78 }).toFile(`${ASSETS_OUT}/${file}`);
    variants.push({ w: Math.min(w, maxW), file });
  }

  const blur = await sharp(sourcePath).resize({ width: 16 }).webp({ quality: 40 }).toBuffer();
  const blurDataURL = `data:image/webp;base64,${blur.toString("base64")}`;

  const srcset = variants.map((v) => `recipes/${v.file} ${v.w}w`).join(", ");
  const primary = variants.find((v) => v.w === 800) ?? variants[variants.length - 1];
  const dims = await sharp(`${ASSETS_OUT}/${primary.file}`).metadata();

  return {
    src: `recipes/${primary.file}`,
    srcset,
    width: dims.width ?? primary.w,
    height: dims.height ?? 0,
    blurDataURL,
  };
}
