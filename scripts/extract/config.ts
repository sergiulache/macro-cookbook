/** Extraction config. The source PDF lives outside the repo and is never committed. */
export const SOURCE_PDF =
  process.env.SOURCE_PDF ??
  "/home/sergiu/Documents/Text/retete/Diet Cheat Codes Recipe Book (Nick Kenney) (z-library.sk, 1lib.sk, z-lib.sk).pdf";

export const OUT_DIR = "out/sample";
export const PAGES_DIR = `${OUT_DIR}/pages`;
export const PHOTOS_DIR = `${OUT_DIR}/photos`;
export const ASSETS_OUT = "public/recipes";
export const DATA_OUT = "src/data/generated";
