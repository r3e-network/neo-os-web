const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function run(bin, args, opts = {}) {
  const result = spawnSync(bin, args, {
    stdio: "inherit",
    ...opts,
  });
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    throw new Error(`Command failed: ${bin} ${args.join(" ")}`);
  }
}

function findBin(name) {
  const ext = process.platform === "win32" ? ".cmd" : "";
  const filename = `${name}${ext}`;
  let dir = process.cwd();
  while (true) {
    const candidate = path.join(dir, "node_modules", ".bin", filename);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`Unable to locate ${name} binary via node_modules/.bin`);
}

function exists(file) {
  try {
    fs.accessSync(file, fs.constants.R_OK);
    return true;
  } catch (_e) {
    return false;
  }
}

fs.rmSync(".next/types", { recursive: true, force: true });
fs.rmSync("tsconfig.tsbuildinfo", { force: true });
fs.mkdirSync(".next", { recursive: true });

const nextBin = findBin("next");
const tscBin = findBin("tsc");

run(nextBin, ["typegen"]);
if (!exists(".next/types/routes.d.ts") || !exists(".next/types/validator.ts")) {
  run(nextBin, ["typegen"]);
}

if (!exists(".next/types/routes.d.ts") || !exists(".next/types/validator.ts")) {
  throw new Error(
    "Next typegen did not generate expected files under .next/types (routes.d.ts, validator.ts)"
  );
}

run(tscBin, ["--noEmit", "--incremental", "false"]);
