import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
const libPath = path.join(here, "dotnet_tools.sh");
const libRelative = path.relative(repoRoot, libPath);

const read = (relative) => fs.readFileSync(path.join(repoRoot, relative), "utf8");

const git = (args) =>
  execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });

const trackedShellFiles = () =>
  git(["ls-files", "-z", "--", "*.sh"])
    .split("\0")
    .filter((entry) => entry.length > 0);

// Callers that resolve dotnet-tool binaries and must delegate to the shared helper.
const RESOLVER_CALLERS = [
  "deploy/scripts/setup_neoexpress.sh",
  "deploy/scripts/deploy/deploy-factory.sh",
  "deploy/scripts/sync_deployed_contracts.sh",
  "deploy/scripts/build_tarot_vrf.sh",
  "contracts/build.sh",
];

// --- tracking: a clean clone has to be able to source the helper -------------

test("the shared dotnet helper is tracked in git", () => {
  const tracked = git(["ls-files", "--", libRelative]).trim();
  assert.equal(
    tracked,
    libRelative,
    `${libRelative} is sourced by build scripts, so it must exist in a fresh clone`,
  );
});

test("no tracked shell script sources an untracked file", () => {
  const trackedSet = new Set(git(["ls-files"]).split("\n").filter(Boolean));
  const offenders = [];

  for (const file of trackedShellFiles()) {
    const body = read(file);
    const dir = path.dirname(file);
    const sourceRe = /^[ \t]*(?:\.|source)[ \t]+"?\$\{?(?:SCRIPT_DIR|script_dir)\}?"?(\/[^"'\s;]+)/gm;
    let match;
    while ((match = sourceRe.exec(body)) !== null) {
      const resolved = path.normalize(path.join(dir, match[1]));
      if (!trackedSet.has(resolved)) offenders.push(`${file} -> ${resolved}`);
    }
  }

  assert.deepEqual(offenders, [], "sourcing an untracked file breaks a fresh clone");
});

// --- de-duplication: one resolver, one bootstrap -----------------------------

test("the shared helper is the only place that defines a dotnet tool resolver", () => {
  const definers = trackedShellFiles().filter(
    (file) => file !== libRelative && /^[ \t]*(?:resolve_tool|resolve_neoxp)\(\)/m.test(read(file)),
  );

  assert.deepEqual(definers, [], `tool resolution must be delegated to ${libRelative}`);
});

test("the shared helper is the only place that hardcodes the dotnet tools directory", () => {
  const offenders = trackedShellFiles().filter(
    (file) => file !== libRelative && /\.dotnet\/tools/.test(read(file)),
  );

  assert.deepEqual(offenders, [], `the ~/.dotnet/tools fallback belongs in ${libRelative} only`);
});

test("the shared helper is the only place that exports DOTNET_ROOT", () => {
  const offenders = trackedShellFiles().filter(
    (file) => file !== libRelative && /^[ \t]*export[ \t]+DOTNET_ROOT/m.test(read(file)),
  );

  assert.deepEqual(offenders, [], `DOTNET_ROOT bootstrap belongs in ${libRelative} only`);
});

test("every dotnet tool caller sources the shared helper and uses its api", () => {
  for (const entry of RESOLVER_CALLERS) {
    const body = read(entry);
    assert.match(body, /dotnet_tools\.sh/, `${entry} must source the shared helper`);
    assert.match(
      body,
      /resolve_dotnet_tool/,
      `${entry} must resolve binaries through resolve_dotnet_tool`,
    );
  }
});

test("each caller declares a shellcheck source path for the helper", () => {
  for (const entry of RESOLVER_CALLERS) {
    assert.match(
      read(entry),
      /#[ \t]*shellcheck[ \t]+source=deploy\/scripts\/lib\/dotnet_tools\.sh/,
      `${entry} needs a shellcheck source directive so -x can follow the include`,
    );
  }
});

// --- behaviour that must survive the refactor -------------------------------

test("build_tarot_vrf keeps its NCCS override and its 3.9.1 compiler pin", () => {
  const body = read("deploy/scripts/build_tarot_vrf.sh");
  assert.match(body, /NCCS/, "the NCCS override must keep working");
  assert.match(body, /3\.9\.1/, "MiniAppTarotVrf must stay pinned to Neo.Compiler.CSharp 3.9.1");
});

test("contracts/build.sh keeps the legacy clone boundary the duplication audit asserts", () => {
  const body = read("contracts/build.sh");
  for (const token of ["BUILD_LEGACY_CLONES", "is_legacy_clone_project", "continue"]) {
    assert.match(body, new RegExp(token), `contracts/build.sh must keep ${token}`);
  }
});

// --- behaviour, exercised against stubbed layouts ---------------------------

function callHelper(fn, args, { env = {}, cwd } = {}) {
  return execFileSync(
    "bash",
    ["-c", `set -euo pipefail; . "$1"; shift; ${fn} "$@"`, "bash", libPath, ...args],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      cwd: cwd ?? repoRoot,
      env: { ...process.env, ...env },
    },
  );
}

function stubBinary(dir, name, body = "#!/bin/bash\nexit 0\n") {
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, name);
  fs.writeFileSync(target, body, { mode: 0o755 });
  return target;
}

function makeHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "dotnet-tools-"));
}

test("resolver requires a name and an install hint", () => {
  assert.throws(() => callHelper("resolve_dotnet_tool", []), /usage/i);
  assert.throws(() => callHelper("resolve_dotnet_tool", ["nccs"]), /usage/i);
});

test("resolver returns an absolute path for a tool found on PATH", () => {
  const home = makeHome();
  const binDir = path.join(home, "bin");
  const stub = stubBinary(binDir, "nccs");

  const out = callHelper("resolve_dotnet_tool", ["nccs", "install hint"], {
    env: { HOME: home, PATH: `${binDir}:/usr/bin:/bin` },
  }).trim();

  assert.equal(out, stub, "a PATH hit must resolve to an absolute path, not a bare name");
});

test("resolver falls back to the dotnet global tools directory", () => {
  const home = makeHome();
  const stub = stubBinary(path.join(home, ".dotnet", "tools"), "neoxp");

  const out = callHelper("resolve_dotnet_tool", ["neoxp", "install hint"], {
    env: { HOME: home, PATH: "/usr/bin:/bin" },
  }).trim();

  assert.equal(out, stub);
});

test("resolver honours an uppercase environment override", () => {
  const home = makeHome();
  const overrideDir = path.join(home, "custom");
  const override = stubBinary(overrideDir, "my-nccs");
  stubBinary(path.join(home, ".dotnet", "tools"), "nccs");

  const out = callHelper("resolve_dotnet_tool", ["nccs", "install hint"], {
    env: { HOME: home, PATH: "/usr/bin:/bin", NCCS: override },
  }).trim();

  assert.equal(out, override, "an explicit NCCS override must win over discovery");
});

test("resolver reports the install hint and the PATH advice when the tool is missing", () => {
  const home = makeHome();
  try {
    callHelper("resolve_dotnet_tool", ["nccs", "dotnet tool install -g Neo.Compiler.CSharp"], {
      env: { HOME: home, PATH: "/usr/bin:/bin" },
    });
    assert.fail("a missing tool must abort the caller");
  } catch (error) {
    assert.notEqual(error.status, 0, "a missing tool must exit non-zero");
    const stderr = String(error.stderr);
    assert.match(stderr, /nccs/, "the missing tool must be named");
    assert.match(stderr, /dotnet tool install -g Neo\.Compiler\.CSharp/, "the hint must be shown");
    assert.match(stderr, /\.dotnet\/tools/, "the PATH advice must be shown");
  }
});

test("resolver never prints anything on stdout when it fails", () => {
  const home = makeHome();
  const result = execFileSync(
    "bash",
    [
      "-c",
      'set -uo pipefail; . "$1"; resolve_dotnet_tool nccs "hint" 2>/dev/null || true',
      "bash",
      libPath,
    ],
    { encoding: "utf8", env: { ...process.env, HOME: home, PATH: "/usr/bin:/bin" } },
  );
  assert.equal(result.trim(), "", "a failed resolution must not emit a usable-looking path");
});

test("bootstrap sets DOTNET_ROOT from a user-local dotnet install", () => {
  const home = makeHome();
  stubBinary(path.join(home, ".dotnet"), "dotnet");

  const out = callHelper("ensure_dotnet_root", [], {
    env: { HOME: home, PATH: "/usr/bin:/bin", DOTNET_ROOT: "" },
  });
  const printed = callHelper("ensure_dotnet_root", [], {
    env: { HOME: home, PATH: "/usr/bin:/bin", DOTNET_ROOT: "" },
  });
  assert.equal(out, printed, "the bootstrap must be deterministic");

  const dumped = execFileSync(
    "bash",
    [
      "-c",
      'set -euo pipefail; . "$1"; ensure_dotnet_root; printf "%s\\n%s\\n" "${DOTNET_ROOT:-}" "$PATH"',
      "bash",
      libPath,
    ],
    { encoding: "utf8", env: { ...process.env, HOME: home, PATH: "/usr/bin:/bin", DOTNET_ROOT: "" } },
  ).split("\n");

  assert.equal(dumped[0], path.join(home, ".dotnet"));
  assert.match(dumped[1], new RegExp(`^${path.join(home, ".dotnet")}:`));
  assert.match(dumped[1], new RegExp(path.join(home, ".dotnet", "tools").replace(/\//g, "\\/")));
});

test("bootstrap ignores a user-local directory that holds no dotnet executable", () => {
  const home = makeHome();
  fs.mkdirSync(path.join(home, ".dotnet", "tools"), { recursive: true });
  const absent = path.join(home, "absent");

  const dumped = execFileSync(
    "bash",
    ["-c", 'set -euo pipefail; . "$1"; ensure_dotnet_root; printf "%s\\n" "${DOTNET_ROOT:-}"', "bash", libPath],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        HOME: home,
        PATH: "/usr/bin:/bin",
        DOTNET_ROOT: "",
        // Neutralised so the assertion is about $HOME/.dotnet/tools only and not
        // about whatever dotnet the machine running the suite happens to have.
        DOTNET_SYSTEM_ROOTS: absent,
        DOTNET_CELLAR_ROOTS: absent,
      },
    },
  ).trim();

  assert.equal(dumped, "", "a tools-only install must not shadow a system dotnet");
});

test("bootstrap falls back to a system dotnet install", () => {
  const home = makeHome();
  const systemRoot = path.join(home, "usr-share-dotnet");
  stubBinary(systemRoot, "dotnet");
  const absent = path.join(home, "absent");

  const dumped = execFileSync(
    "bash",
    ["-c", 'set -euo pipefail; . "$1"; ensure_dotnet_root; printf "%s\\n" "${DOTNET_ROOT:-}"', "bash", libPath],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        HOME: home,
        PATH: "/usr/bin:/bin",
        DOTNET_ROOT: "",
        DOTNET_SYSTEM_ROOTS: `${absent}:${systemRoot}`,
        DOTNET_CELLAR_ROOTS: absent,
      },
    },
  ).trim();

  assert.equal(dumped, systemRoot, "the first system root holding a dotnet executable must win");
});

test("bootstrap respects a DOTNET_ROOT that the caller already set", () => {
  const home = makeHome();
  stubBinary(path.join(home, ".dotnet"), "dotnet");
  const preset = path.join(home, "preset");
  fs.mkdirSync(preset, { recursive: true });

  const dumped = execFileSync(
    "bash",
    ["-c", 'set -euo pipefail; . "$1"; ensure_dotnet_root; printf "%s\\n" "${DOTNET_ROOT:-}"', "bash", libPath],
    { encoding: "utf8", env: { ...process.env, HOME: home, PATH: "/usr/bin:/bin", DOTNET_ROOT: preset } },
  ).trim();

  assert.equal(dumped, preset, "an explicit DOTNET_ROOT must never be overwritten");
});

test("bootstrap falls back to a homebrew cellar install", () => {
  const home = makeHome();
  const cellar = path.join(home, "cellar");
  for (const version of ["8.0.1", "10.0.2", "9.0.0"]) {
    fs.mkdirSync(path.join(cellar, version, "libexec"), { recursive: true });
    stubBinary(path.join(cellar, version, "libexec"), "dotnet");
  }

  const dumped = execFileSync(
    "bash",
    ["-c", 'set -euo pipefail; . "$1"; ensure_dotnet_root; printf "%s\\n" "${DOTNET_ROOT:-}"', "bash", libPath],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        HOME: home,
        PATH: "/usr/bin:/bin",
        DOTNET_ROOT: "",
        // Neutralised so the cellar tier is what the assertion exercises.
        DOTNET_SYSTEM_ROOTS: path.join(home, "absent"),
        DOTNET_CELLAR_ROOTS: cellar,
      },
    },
  ).trim();

  assert.equal(
    dumped,
    path.join(cellar, "10.0.2", "libexec"),
    "the newest cellar version must win, compared by version and not by string order",
  );
});

test("bootstrap is idempotent and does not stack PATH entries", () => {
  const home = makeHome();
  stubBinary(path.join(home, ".dotnet"), "dotnet");

  const dumped = execFileSync(
    "bash",
    [
      "-c",
      'set -euo pipefail; . "$1"; ensure_dotnet_root; ensure_dotnet_root; ensure_dotnet_root; printf "%s\\n" "$PATH"',
      "bash",
      libPath,
    ],
    { encoding: "utf8", env: { ...process.env, HOME: home, PATH: "/usr/bin:/bin", DOTNET_ROOT: "" } },
  ).trim();

  const root = path.join(home, ".dotnet");
  const occurrences = dumped.split(":").filter((entry) => entry === root).length;
  assert.equal(occurrences, 1, "repeated sourcing must not grow PATH");
});
