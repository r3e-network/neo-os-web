/**
 * Neo key-material detection across reachable git history.
 *
 * Problem this solves:
 *   The working-tree gate (`audit_secret_material.mjs`) answers "can I commit a
 *   key today". It cannot answer "is a key already in here", and that is the
 *   question audit finding C-6 turned out to hinge on: the key was squashed out
 *   of the published line but survived on an unmerged local branch for weeks,
 *   invisible to every tree-scoped check, while `git ls-remote` showed nothing
 *   and the working tree scanned clean.
 *
 *   That gap is why this module exists. It scans every blob, commit and tag
 *   object reachable from any ref — branches, tags, remotes, HEAD — so a key
 *   that no longer exists in any checkout is still found.
 *
 * Why reachable-only:
 *   Unreachable objects are already gone as far as clone, fetch and checkout
 *   are concerned, and no commit can remove them — only `gc` can. A gate that
 *   failed on loose garbage would report a failure the author cannot fix, and a
 *   gate like that gets disabled. Pruning is an operator action, not a build
 *   gate; `scanHistoryForSecretMaterial` deliberately stops at the ref graph.
 *
 * Cost:
 *   Two streaming passes over the object graph, chunked so peak memory stays
 *   bounded regardless of repository size.
 */

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SECRET_RULES,
  redactSecret,
  scanTextForSecretMaterial,
} from "./secret_material_scan.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** A pasted key is ~52 bytes; no plausible carrier is a 4 MB text blob. */
const MAX_BLOB_BYTES = 4 * 1024 * 1024;

/**
 * Bytes of blob content held in memory at once. `git cat-file --batch` streams
 * as much as it is asked for, so the chunk budget — not the repository size —
 * sets peak memory.
 */
const CHUNK_BYTE_BUDGET = 32 * 1024 * 1024;

/** Guard against a single pathological object list exhausting the pipe buffer. */
const MAX_STDIO_BYTES = 512 * 1024 * 1024;

/**
 * Non-global mirrors of the shared rules, for a whole-buffer pre-filter.
 *
 * Derived from `SECRET_RULES` rather than restated, so the fast path cannot
 * drift from the authoritative patterns. Every rule matches base58 runs only,
 * and its boundaries are explicit character classes that exclude newline, so a
 * whole-text hit implies a within-line hit: the pre-filter can never skip a
 * blob that the line-accurate scanner would have flagged.
 */
const CANDIDATE_PATTERNS = SECRET_RULES.map(
  (rule) => new RegExp(rule.regex.source, rule.regex.flags.replace("g", "")),
);

/**
 * @param {string} text
 * @returns {boolean} True when `text` is worth scanning line by line.
 */
function hasCandidate(text) {
  return CANDIDATE_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * @param {string} root
 * @param {string[]} args
 * @param {string} [input]
 * @returns {Buffer}
 */
function gitBuffer(root, args, input) {
  return execFileSync("git", args, {
    cwd: root,
    input,
    maxBuffer: MAX_STDIO_BYTES,
    stdio: input === undefined ? ["ignore", "pipe", "pipe"] : ["pipe", "pipe", "pipe"],
  });
}

/**
 * @param {string} root
 * @param {string[]} args
 * @param {string} [input]
 * @returns {string}
 */
function gitText(root, args, input) {
  return gitBuffer(root, args, input).toString("utf8");
}

/**
 * @param {string} text
 * @returns {string[]} Non-empty trimmed lines.
 */
function lines(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Every object reachable from any ref, with the path each blob was seen at.
 *
 * `--objects` emits `<sha> [path]`; the path is the one git recorded in a tree,
 * which is what an operator needs in order to find the leak. One blob can sit
 * at several paths, so paths accumulate per sha.
 *
 * @param {string} root
 * @returns {{blobPaths: Map<string, Set<string>>, objectIds: string[]}}
 */
function reachableObjects(root) {
  const objectIds = [];
  /** @type {Map<string, Set<string>>} */
  const blobPaths = new Map();

  for (const line of lines(gitText(root, ["rev-list", "--objects", "--all"]))) {
    const separator = line.indexOf(" ");
    if (separator === -1) {
      objectIds.push(line);
      continue;
    }
    const sha = line.slice(0, separator);
    const objectPath = line.slice(separator + 1).trim();
    objectIds.push(sha);
    if (objectPath.length === 0) continue;
    const existing = blobPaths.get(sha);
    if (existing) existing.add(objectPath);
    else blobPaths.set(sha, new Set([objectPath]));
  }

  return { blobPaths, objectIds };
}

/**
 * @typedef {object} ObjectMeta
 * @property {string} sha
 * @property {string} type
 * @property {number} size
 */

/**
 * Resolve type and size for each object id in one `cat-file` pass.
 *
 * @param {string} root
 * @param {string[]} objectIds
 * @returns {ObjectMeta[]}
 */
function describeObjects(root, objectIds) {
  if (objectIds.length === 0) return [];
  const stdout = gitText(
    root,
    ["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"],
    `${objectIds.join("\n")}\n`,
  );

  /** @type {ObjectMeta[]} */
  const described = [];
  for (const line of lines(stdout)) {
    const [sha, type, size] = line.split(" ");
    // `<sha> missing` for anything the graph named but the store lacks.
    if (!type || type === "missing" || size === undefined) continue;
    described.push({ sha, type, size: Number.parseInt(size, 10) });
  }
  return described;
}

/**
 * Group objects so each group's total content stays inside the byte budget.
 *
 * @param {ObjectMeta[]} objects
 * @returns {ObjectMeta[][]}
 */
function chunkByBytes(objects) {
  /** @type {ObjectMeta[][]} */
  const chunks = [];
  /** @type {ObjectMeta[]} */
  let current = [];
  let currentBytes = 0;

  for (const object of objects) {
    if (current.length > 0 && currentBytes + object.size > CHUNK_BYTE_BUDGET) {
      chunks.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(object);
    currentBytes += object.size;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/**
 * Reject buffers whose leading bytes contain NUL. Decoding a binary as UTF-8
 * yields replacement characters, which can only manufacture false positives.
 *
 * @param {Buffer} buffer
 * @returns {boolean}
 */
function looksBinary(buffer) {
  return buffer.subarray(0, 4096).includes(0);
}

/**
 * Read a chunk of objects and hand each one's bytes to `visit`.
 *
 * Uses `--batch` rather than `--batch=`: the `<sha> <type> <size>` info line
 * makes each record self-delimiting and lets the reader assert that the bytes
 * it is about to scan belong to the object it thinks they do. A format that
 * suppressed the header would leave record boundaries to positional arithmetic,
 * and a one-byte error there splices neighbouring blobs together — which
 * silently changes what the gate scans instead of failing.
 *
 * @param {string} root
 * @param {ObjectMeta[]} chunk
 * @param {(object: ObjectMeta, contents: Buffer) => void} visit
 */
function readChunk(root, chunk, visit) {
  const stdout = gitBuffer(
    root,
    ["cat-file", "--batch"],
    `${chunk.map((object) => object.sha).join("\n")}\n`,
  );

  let offset = 0;
  for (const object of chunk) {
    const headerEnd = stdout.indexOf(0x0a, offset);
    if (headerEnd === -1) {
      throw new Error(`git cat-file ended before object ${object.sha}`);
    }
    const [sha, , size] = stdout.subarray(offset, headerEnd).toString("utf8").split(" ");
    const length = Number.parseInt(size ?? "", 10);
    if (sha !== object.sha || !Number.isFinite(length)) {
      throw new Error(
        `git cat-file stream desynchronised: expected ${object.sha}, read "${sha ?? ""}"`,
      );
    }
    const start = headerEnd + 1;
    visit(object, stdout.subarray(start, start + length));
    // Content is followed by a single newline that git adds as a separator.
    offset = start + length + 1;
  }
}

/**
 * @typedef {object} HistoryViolation
 * @property {"blob"|"commit-message"|"tag-message"} kind What object carried it.
 * @property {string} ruleId Which rule matched.
 * @property {string} description What the matched shape grants.
 * @property {string} redacted Identifiable-but-not-usable form of the match.
 * @property {string} object The object the key sits in.
 * @property {string|null} path Repo-relative path, for blobs.
 * @property {string|null} ref Ref name, for tags.
 * @property {string[]} commits Commits that carry the object.
 */

/**
 * @typedef {object} HistoryReport
 * @property {number} scannedBlobs Blobs read as text.
 * @property {number} skippedBlobs Blobs excluded as binary or oversized.
 * @property {number} scannedCommits Commit objects read.
 * @property {number} scannedTags Annotated tag objects read.
 * @property {HistoryViolation[]} violations
 */

/**
 * Undo git's path quoting. `core.quotePath=false` covers non-ASCII; git still
 * quotes paths containing a quote, backslash or control character, and those
 * are emitted in C style, which JSON string syntax is close enough to parse.
 *
 * @param {string} raw
 * @returns {string}
 */
function unquotePath(raw) {
  if (!raw.startsWith('"')) return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/**
 * Every (path, commit) pair at which each wanted blob appears.
 *
 * `rev-list --objects` names each object once, so identical content committed
 * to two paths — a copied deploy script, a duplicated env file — is reported at
 * whichever path git happened to walk first. Locating the leak needs all of
 * them, so this walks the raw diff of every reachable commit instead.
 *
 * Runs once, only when a blob already matched, so a clean repository never pays
 * for it.
 *
 * `--root` is required: without it the initial commit shows no diff, which
 * hides any key added in the very first commit. `-m` expands merges, so a blob
 * that only ever entered through a merge resolution is still attributed.
 *
 * @param {string} root
 * @param {Set<string>} wanted Blob object ids to locate.
 * @returns {Map<string, Map<string, string[]>>} blob -> path -> commits
 */
function locateBlobs(root, wanted) {
  /** @type {Map<string, Map<string, Set<string>>>} */
  const located = new Map();
  if (wanted.size === 0) return new Map();

  const stdout = gitText(root, [
    "-c",
    "core.quotePath=false",
    "log",
    "--all",
    "--root",
    "-m",
    "--raw",
    "--no-abbrev",
    "--no-renames",
    "--format=commit %H",
  ]);

  let commit = null;
  for (const line of stdout.split("\n")) {
    if (line.startsWith("commit ")) {
      commit = line.slice("commit ".length).trim();
      continue;
    }
    // :<srcmode> <dstmode> <srcsha> <dstsha> <status>\t<path>
    if (!line.startsWith(":") || commit === null) continue;
    const tab = line.indexOf("\t");
    if (tab === -1) continue;
    const fields = line.slice(0, tab).split(" ").filter((field) => field.length > 0);
    const destination = fields[3];
    if (destination === undefined || !wanted.has(destination)) continue;

    const blobPath = unquotePath(line.slice(tab + 1).trim());
    const paths = located.get(destination) ?? new Map();
    const commits = paths.get(blobPath) ?? new Set();
    commits.add(commit);
    paths.set(blobPath, commits);
    located.set(destination, paths);
  }

  return new Map(
    [...located].map(([blob, paths]) => [
      blob,
      new Map([...paths].map(([blobPath, commits]) => [blobPath, [...commits]])),
    ]),
  );
}

/**
 * Annotated-tag object id to the ref that names it.
 *
 * @param {string} root
 * @returns {Map<string, string>}
 */
function tagRefsByObject(root) {
  /** @type {Map<string, string>} */
  const byObject = new Map();
  for (const line of lines(gitText(root, ["for-each-ref", "--format=%(objectname) %(refname)"]))) {
    const separator = line.indexOf(" ");
    if (separator === -1) continue;
    byObject.set(line.slice(0, separator), line.slice(separator + 1).trim());
  }
  return byObject;
}

/**
 * Scan every blob, commit and annotated tag reachable from any ref.
 *
 * @param {string} [root] Repository to scan.
 * @returns {HistoryReport}
 */
export function scanHistoryForSecretMaterial(root = ROOT) {
  const { blobPaths, objectIds } = reachableObjects(root);
  if (objectIds.length === 0) {
    return {
      scannedBlobs: 0,
      skippedBlobs: 0,
      scannedCommits: 0,
      scannedTags: 0,
      violations: [],
    };
  }

  const described = describeObjects(root, objectIds);
  const tagRefs = tagRefsByObject(root);

  const blobs = described.filter(
    (object) => object.type === "blob" && object.size > 0 && object.size <= MAX_BLOB_BYTES,
  );
  const messages = described.filter(
    (object) => object.type === "commit" || object.type === "tag",
  );

  let scannedBlobs = 0;
  let skippedBlobs = described.filter(
    (object) => object.type === "blob" && (object.size === 0 || object.size > MAX_BLOB_BYTES),
  ).length;
  let scannedCommits = 0;
  let scannedTags = 0;

  /** @type {HistoryViolation[]} */
  const violations = [];
  /** Collapse one key seen many times in one object into a single row. */
  const seen = new Set();

  /**
   * @param {Omit<HistoryViolation, "commits">} violation
   * @param {string[]} commits
   */
  const record = (violation, commits) => {
    const key = `${violation.kind} ${violation.object} ${violation.path ?? ""} ${violation.redacted}`;
    if (seen.has(key)) return;
    seen.add(key);
    violations.push({ ...violation, commits });
  };

  /** @type {Map<string, ReturnType<typeof scanTextForSecretMaterial>>} */
  const leakingBlobs = new Map();

  for (const chunk of chunkByBytes(blobs)) {
    readChunk(root, chunk, (object, contents) => {
      if (looksBinary(contents)) {
        skippedBlobs += 1;
        return;
      }
      scannedBlobs += 1;
      const text = contents.toString("utf8");
      if (!hasCandidate(text)) return;

      const findings = scanTextForSecretMaterial(text);
      if (findings.length > 0) leakingBlobs.set(object.sha, findings);
    });
  }

  const blobLocations = locateBlobs(root, new Set(leakingBlobs.keys()));
  for (const [blob, findings] of leakingBlobs) {
    // Fall back to the walk's own path so a blob is never reported without one,
    // even if the diff walk cannot attribute it to a commit.
    const locations =
      blobLocations.get(blob) ??
      new Map([...(blobPaths.get(blob) ?? new Set([""]))].map((known) => [known, []]));

    for (const finding of findings) {
      for (const [blobPath, commits] of locations) {
        record(
          {
            kind: "blob",
            ruleId: finding.ruleId,
            description: finding.description,
            redacted: finding.redacted,
            object: blob,
            path: blobPath.length > 0 ? blobPath : null,
            ref: null,
          },
          commits,
        );
      }
    }
  }

  for (const chunk of chunkByBytes(messages)) {
    readChunk(root, chunk, (object, contents) => {
      if (object.type === "commit") scannedCommits += 1;
      else scannedTags += 1;
      if (looksBinary(contents)) return;
      const text = contents.toString("utf8");
      if (!hasCandidate(text)) return;

      for (const finding of scanTextForSecretMaterial(text)) {
        record(
          {
            kind: object.type === "commit" ? "commit-message" : "tag-message",
            ruleId: finding.ruleId,
            description: finding.description,
            redacted: finding.redacted,
            object: object.sha,
            path: null,
            ref: object.type === "tag" ? (tagRefs.get(object.sha) ?? null) : null,
          },
          object.type === "commit" ? [object.sha] : [],
        );
      }
    });
  }

  return { scannedBlobs, skippedBlobs, scannedCommits, scannedTags, violations };
}

export { MAX_BLOB_BYTES, redactSecret };
