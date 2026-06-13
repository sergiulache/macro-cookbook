/**
 * Decode the recipe's QR code (which encodes its YouTube URL) off a page render,
 * so we can render a clean "Watch video" button and drop the QR image (D3).
 * Returns the decoded URL, or null if no QR is found on the page.
 */
import sharp from "sharp";
import jsQR from "jsqr";

export async function decodeQrFromPage(pagePng: string): Promise<string | null> {
  const { data, info } = await sharp(pagePng)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const result = jsQR(new Uint8ClampedArray(data), info.width, info.height);
  return result?.data ?? null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const png = process.argv[2];
  decodeQrFromPage(png).then((u) => console.log(u ?? "(no QR found)"));
}
