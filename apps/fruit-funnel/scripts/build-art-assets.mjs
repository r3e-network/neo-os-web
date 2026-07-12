import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const generatedDir = process.env.FRUIT_FUNNEL_GENERATED_DIR;
if (!generatedDir) {
  throw new Error("Set FRUIT_FUNNEL_GENERATED_DIR to the ImageGen output directory.");
}

const appRoot = resolve(import.meta.dirname, "..");
const artDir = resolve(appRoot, "public/art");

const sources = {
  stage: "exec-7aa1aa19-a077-4d48-a06d-60dcdaddc329.png",
  funnel: "exec-07abf6fb-2112-4215-a0c0-55fe523ede6a.png",
  rack: "exec-4323eed5-7b39-493d-86ae-64bb6186183c.png",
  apple: "exec-a5a63363-3633-4305-add1-10e116dc8756.png",
  orange: "exec-7bfbb51d-387a-46b7-b74c-f97c8326bbdb.png",
  lemon: "exec-18107239-db06-476a-9954-ffa7dc964dcf.png",
  grape: "exec-23783de8-fd1f-4301-9bea-424e6548107b.png",
  berry: "exec-b7000d41-61db-4595-b58b-0529731e08fa.png",
  peach: "exec-e1c7ecb7-a8b0-4151-9f59-82b1fe45131c.png",
  logo: "exec-f73b3437-9762-45c9-9284-b51edefc460a.png",
  banner: "exec-1e877f18-0d1d-4d45-baf0-6ed0c8509785.png",
};

async function blackToAlpha(input, output, width, height) {
  const { data, info } = await sharp(input)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
    const source = pixel * 3;
    const target = pixel * 4;
    const red = data[source];
    const green = data[source + 1];
    const blue = data[source + 2];
    const brightness = Math.max(red, green, blue);
    const alpha = Math.max(0, Math.min(1, (brightness - 3) / 24));
    rgba[target] = red;
    rgba[target + 1] = green;
    rgba[target + 2] = blue;
    rgba[target + 3] = Math.round(alpha * 255);
  }

  await sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 2 })
    .resize(width, height, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      withoutEnlargement: false,
    })
    .webp({ quality: 91, alphaQuality: 100, effort: 6 })
    .toFile(output);
}

await mkdir(artDir, { recursive: true });

await sharp(resolve(generatedDir, sources.stage))
  .resize(780, 1688, { fit: "cover", position: "centre" })
  .webp({ quality: 86, effort: 6 })
  .toFile(resolve(artDir, "orchard-stage.webp"));

await blackToAlpha(resolve(generatedDir, sources.funnel), resolve(artDir, "funnel-basket.webp"), 760, 420);
await blackToAlpha(resolve(generatedDir, sources.rack), resolve(artDir, "vine-rack.webp"), 760, 250);

for (const fruit of ["apple", "orange", "lemon", "grape", "berry", "peach"]) {
  await blackToAlpha(
    resolve(generatedDir, sources[fruit]),
    resolve(artDir, `fruit-${fruit}.webp`),
    256,
    256,
  );
}

await blackToAlpha(resolve(generatedDir, sources.logo), resolve(appRoot, "public/logo.webp"), 512, 512);
await sharp(resolve(appRoot, "public/logo.webp"))
  .avif({ quality: 80, effort: 6 })
  .toFile(resolve(appRoot, "public/logo.avif"));

await sharp(resolve(generatedDir, sources.banner))
  .resize(1280, 720, { fit: "cover", position: "centre" })
  .webp({ quality: 86, effort: 6 })
  .toFile(resolve(appRoot, "public/banner.webp"));
await sharp(resolve(appRoot, "public/banner.webp"))
  .avif({ quality: 72, effort: 6 })
  .toFile(resolve(appRoot, "public/banner.avif"));
