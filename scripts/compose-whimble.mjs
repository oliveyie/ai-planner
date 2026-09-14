// Regenerates public/whimble/composed/ from public/whimble/base/.
//
// The base/ PNGs are full 2048x2048 exports, each part pre-positioned in the
// same canvas coordinate space (a paper-doll rig) but with a lot of empty
// transparent margin around the character — fine for editing, too small/
// off-center to use directly as a UI icon.
//
// There's a wrinkle: some parts are alternate BODY VARIANTS (currently
// "body" and "half-body", the latter cropped off partway down) that stand in
// for each other rather than stacking together — and they aren't the same
// height. A single shared crop sized for the tallest variant would leave
// empty space under the shorter one. So each body variant gets its own crop,
// computed from just that variant + the shared (non-body) parts, and is
// written to its own subfolder (public/whimble/composed/<variant>/) — every
// part inside one subfolder shares that subfolder's crop, so they stay
// aligned to each other; the crop itself is allowed to differ between
// subfolders since each is self-contained (WhimbleMascot only ever pulls a
// full set of layers from one subfolder at a time, never mixes them).
//
// Re-run this (`npm run compose-whimble`) whenever a base/ part is redrawn
// or a new part is added — it always recomputes crops from whatever files
// are actually in base/, rather than hardcoding today's bounding boxes.
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const BASE_DIR = "public/whimble/base";
const OUT_ROOT = "public/whimble/composed";
const OUTPUT_SIZE = 320; // enough resolution for the "xl" (~224px) mascot at high DPI
const PADDING_RATIO = 0.15; // breathing room around the character in the final square

async function findParts() {
  const files = await readdir(BASE_DIR);
  return files
    .filter((f) => f.startsWith("whimble-") && f.endsWith(".png"))
    .map((f) => f.slice("whimble-".length, -".png".length));
}

async function combinedBoundingBox(parts) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const part of parts) {
    const file = path.join(BASE_DIR, `whimble-${part}.png`);
    const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;

    for (let y = 0; y < height; y += 4) {
      for (let x = 0; x < width; x += 4) {
        const alpha = channels === 4 ? data[(y * width + x) * channels + 3] : 255;
        if (alpha > 10) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  }

  return { minX, minY, maxX, maxY };
}

function squareCropFor(bbox, canvasSize) {
  const bboxWidth = bbox.maxX - bbox.minX;
  const bboxHeight = bbox.maxY - bbox.minY;
  const centerX = (bbox.minX + bbox.maxX) / 2;
  const centerY = (bbox.minY + bbox.maxY) / 2;

  const side = Math.round(Math.max(bboxWidth, bboxHeight) * (1 + PADDING_RATIO));
  let left = Math.round(centerX - side / 2);
  let top = Math.round(centerY - side / 2);

  // Keep the crop on-canvas — shift inward rather than shrinking it, so
  // every part still gets the exact same rectangle.
  left = Math.max(0, Math.min(left, canvasSize - side));
  top = Math.max(0, Math.min(top, canvasSize - side));

  return { left, top, width: side, height: side };
}

const allParts = await findParts();
if (allParts.length === 0) {
  throw new Error(`No whimble-*.png files found in ${BASE_DIR}`);
}

// A "body variant" is "body" itself or anything named "<something>-body"
// (e.g. "half-body") — these stand in for each other, everything else
// (arms, face, hat, ...) is shared across every variant.
const bodyVariantParts = allParts.filter((p) => p === "body" || p.endsWith("-body"));
const sharedParts = allParts.filter((p) => !bodyVariantParts.includes(p));

if (bodyVariantParts.length === 0) {
  throw new Error(`No "body" or "*-body" part found among: ${allParts.join(", ")}`);
}

const canvasSize = (await sharp(path.join(BASE_DIR, `whimble-${allParts[0]}.png`)).metadata()).width;

for (const bodyPart of bodyVariantParts) {
  const variantName = bodyPart === "body" ? "full" : bodyPart.replace(/-body$/, "");
  const groupParts = [bodyPart, ...sharedParts];
  const bbox = await combinedBoundingBox(groupParts);
  const crop = squareCropFor(bbox, canvasSize);
  const outDir = path.join(OUT_ROOT, variantName);

  await mkdir(outDir, { recursive: true });
  await Promise.all(
    groupParts.map((part) =>
      sharp(path.join(BASE_DIR, `whimble-${part}.png`))
        .extract(crop)
        .resize(OUTPUT_SIZE, OUTPUT_SIZE)
        .png({ compressionLevel: 9 })
        .toFile(path.join(outDir, `whimble-${part}.png`)),
    ),
  );

  console.log(`variant "${variantName}": parts [${groupParts.join(", ")}], crop`, crop);
}
