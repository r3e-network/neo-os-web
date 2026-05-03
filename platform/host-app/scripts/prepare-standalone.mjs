import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standaloneRoot = path.join(
  appRoot,
  ".next",
  "standalone",
  "platform",
  "host-app",
);

const copies = [
  {
    from: path.join(appRoot, ".next", "static"),
    to: path.join(standaloneRoot, ".next", "static"),
  },
  {
    from: path.join(appRoot, "public"),
    to: path.join(standaloneRoot, "public"),
  },
];

if (!fs.existsSync(standaloneRoot)) {
  console.warn(
    `[prepare-standalone] skipped: standalone output not found at ${standaloneRoot}`,
  );
  process.exit(0);
}

for (const { from, to } of copies) {
  if (!fs.existsSync(from)) {
    console.warn(`[prepare-standalone] skipped missing source: ${from}`);
    continue;
  }

  fs.rmSync(to, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true, dereference: true });
  console.log(`[prepare-standalone] copied ${from} -> ${to}`);
}
