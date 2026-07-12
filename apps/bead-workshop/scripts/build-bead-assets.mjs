import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const input = resolve(root, "public/art/bead-highlight.png");
const outputDir = resolve(root, "public/art/beads");
const colors = [
  ["coral", "#ff6255"],
  ["sunflower", "#ffc532"],
  ["mint", "#37bd83"],
  ["sky", "#38a9df"],
  ["tangerine", "#ff8b38"],
  ["cocoa", "#754225"],
  ["raspberry", "#f36593"],
];

function rgb(hex) {
  return [1, 3, 5].map((index) =>
    Number.parseInt(hex.slice(index, index + 2), 16),
  );
}

await mkdir(outputDir, { recursive: true });
const { data, info } = await sharp(input)
  .resize(96, 96, { fit: "fill" })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

for (const [name, hex] of colors) {
  const base = rgb(hex);
  const output = Buffer.alloc(info.width * info.height * 4);
  for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
    const source = pixel * 3;
    const target = pixel * 4;
    const light =
      (data[source] + data[source + 1] + data[source + 2]) / (3 * 255);
    const alpha = Math.max(0, Math.min(1, (light - 0.025) / 0.76));
    const shade = 0.56 + light * 0.32;
    const specular = Math.max(0, Math.min(0.5, (light - 0.72) * 1.7));
    output[target] = Math.round(
      base[0] * shade * (1 - specular) + 255 * specular,
    );
    output[target + 1] = Math.round(
      base[1] * shade * (1 - specular) + 255 * specular,
    );
    output[target + 2] = Math.round(
      base[2] * shade * (1 - specular) + 255 * specular,
    );
    output[target + 3] = Math.round(alpha * 255);
  }
  await sharp(output, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .webp({ quality: 92, alphaQuality: 100 })
    .toFile(resolve(outputDir, `${name}.webp`));
}
