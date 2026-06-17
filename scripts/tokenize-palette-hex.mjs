#!/usr/bin/env node
/**
 * Tokenize duplicated palette hex literals in miniapp SCSS.
 *
 * Many app SCSS files hardcode hex colors that are byte-for-byte copies of a
 * canonical Neo Soft design token (`--ns-*`, defined in
 * apps/shared/styles/theme-base.scss). This codemod replaces each such literal
 * — only when it appears in a CSS *value* position — with
 *
 *   var(--ns-<token>, <ORIGINAL_HEX>)
 *
 * keeping the original hex as the CSS fallback so the resolved color is
 * byte-identical to before AND the literal is still present in source (so
 * existing substring tests keep passing).
 *
 * SAFETY by construction:
 *  - Only THEME-INVARIANT tokens are used. A token whose value differs between
 *    the light `:root` and the `.theme-dark` blocks (e.g. --ns-bg, --ns-ink,
 *    --ns-surface, --ns-text*) is EXCLUDED: wrapping a literal with such a token
 *    would make a previously-fixed color theme-responsive (the fallback only
 *    applies when the var is *undefined*, and these are always defined). Only
 *    tokens with one identical value across every theme block are eligible, so
 *    `var(--token, #hex)` always resolves to exactly `#hex`.
 *  - Hex is replaced ONLY in value position: after `:` in a declaration or
 *    inside a value list (gradients / rgba / box-shadow). Hex inside comments,
 *    selectors, url(), SCSS `$var` names, and existing `var(--x, #hex)`
 *    fallbacks is skipped.
 *  - Exact match only (#rgb expanded to #rrggbb, case-insensitive). Bespoke
 *    colors that don't equal a token are left untouched.
 *  - Idempotent: a hex already wrapped in `var(...)` is never re-wrapped.
 *
 * Usage:
 *   node scripts/tokenize-palette-hex.mjs            # apply
 *   node scripts/tokenize-palette-hex.mjs --dry-run  # report only, no writes
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const themeBase = path.join(repoRoot, "apps/shared/styles/theme-base.scss");
const DRY = process.argv.includes("--dry-run");

/* ----------------------------------------------------------------------------
 * 1. Build the theme-invariant token -> hex map from theme-base.scss.
 * Parse every `--ns-name: #hex;` declaration in every block. Group by token
 * name; a token is eligible only if EVERY occurrence has the same value
 * (case-insensitive, expanded). Tokens overridden to a different value in dark
 * mode are thereby excluded.
 * ------------------------------------------------------------------------- */
function expandHex(hex) {
  let h = hex.toLowerCase().replace(/^#/, "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  } else if (h.length === 4) {
    // #rgba -> #rrggbbaa
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return "#" + h;
}

function buildTokenMap() {
  const src = readFileSync(themeBase, "utf8");
  const decl = /--(ns-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g;
  const seen = new Map(); // token -> Set of expanded hex
  let m;
  while ((m = decl.exec(src))) {
    const token = m[1];
    const hex = expandHex(m[2]);
    if (!seen.has(token)) seen.set(token, new Set());
    seen.get(token).add(hex);
  }

  // Eligible: token defined with exactly one distinct value across all blocks.
  // hex(expanded) -> token name. If two tokens share the same value, prefer a
  // stable deterministic choice (the semantic-most / shortest, then alpha).
  const hexToToken = new Map();
  const tokenValue = new Map();
  for (const [token, vals] of seen) {
    if (vals.size !== 1) continue; // theme-variant -> exclude
    const hex = [...vals][0];
    tokenValue.set(token, hex);
  }
  // Deterministic hex->token: among eligible tokens sharing a hex, pick winner.
  const byHex = new Map();
  for (const [token, hex] of tokenValue) {
    if (!byHex.has(hex)) byHex.set(hex, []);
    byHex.get(hex).push(token);
  }
  // When several eligible tokens share one value, prefer the most canonical
  // semantic name so the output reads as the intended design token. The
  // resolved color is identical regardless of which alias is chosen, so this
  // is purely a readability choice and never affects rendering.
  const PREFER = [
    "ns-brand",
    "ns-brand-strong",
    "ns-brand-soft",
    "ns-danger",
    "ns-danger-soft",
    "ns-success",
    "ns-success-soft",
    "ns-info",
    "ns-info-soft",
    "ns-warning",
    "ns-warning-soft",
  ];
  const rank = (t) => {
    const i = PREFER.indexOf(t);
    return i === -1 ? PREFER.length : i;
  };
  for (const [hex, tokens] of byHex) {
    tokens.sort((a, b) => rank(a) - rank(b) || a.length - b.length || a.localeCompare(b));
    hexToToken.set(hex, tokens[0]);
  }
  return hexToToken;
}

const HEX_TO_TOKEN = buildTokenMap();

/* ----------------------------------------------------------------------------
 * 2. Collect target files: every .scss under apps/<app>/src, excluding the
 * shared token source itself (we never touch token definitions).
 * ------------------------------------------------------------------------- */
function listFiles() {
  const out = execSync(
    "find apps -path '*/src/*' -name '*.scss' -not -path '*/node_modules/*'",
    { cwd: repoRoot, encoding: "utf8" },
  );
  return out
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean)
    .map((f) => path.join(repoRoot, f))
    .filter((f) => path.resolve(f) !== path.resolve(themeBase));
}

/* ----------------------------------------------------------------------------
 * 3. Mask regions where a hex must NOT be treated as a value:
 *    - block comments  (slash-star ... star-slash)
 *    - line comments   // ...
 *    - strings         "..."  '...'
 *    - url(...) contents
 * Masking replaces those spans with same-length spaces so offsets are stable
 * and the hex-finder simply won't see hexes inside them.
 * ------------------------------------------------------------------------- */
function maskNonValue(src) {
  const chars = src.split("");
  const n = chars.length;
  let i = 0;
  const blank = (a, b) => {
    for (let k = a; k < b; k++) if (chars[k] !== "\n") chars[k] = " ";
  };
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    // block comment
    if (c === "/" && c2 === "*") {
      let j = src.indexOf("*/", i + 2);
      if (j === -1) j = n;
      else j += 2;
      blank(i, j);
      i = j;
      continue;
    }
    // line comment
    if (c === "/" && c2 === "/") {
      let j = src.indexOf("\n", i + 2);
      if (j === -1) j = n;
      blank(i, j);
      i = j;
      continue;
    }
    // string
    if (c === '"' || c === "'") {
      const q = c;
      let j = i + 1;
      while (j < n && src[j] !== q) {
        if (src[j] === "\\") j++;
        j++;
      }
      j = Math.min(j + 1, n);
      blank(i, j);
      i = j;
      continue;
    }
    // url( ... ) — mask its inner contents (may be unquoted)
    if ((c === "u" || c === "U") && /url\s*\(/i.test(src.slice(i, i + 6))) {
      const open = src.indexOf("(", i);
      if (open !== -1) {
        let depth = 1;
        let j = open + 1;
        while (j < n && depth > 0) {
          if (src[j] === "(") depth++;
          else if (src[j] === ")") depth--;
          j++;
        }
        blank(open + 1, j - 1);
        i = j;
        continue;
      }
    }
    i++;
  }
  return chars.join("");
}

/* ----------------------------------------------------------------------------
 * 4. Determine, for a hex occurrence at index `idx` in the MASKED source,
 * whether it is in CSS value position. A SCSS declaration value is the text
 * between a `:` and the terminating `;` or `{`/`}`. We require that, scanning
 * left from the hex on the same logical declaration, we encounter a `:` before
 * hitting `;`, `{`, or `}`. This is true for:
 *   color: #fff;            (direct value)
 *   background: linear-gradient(135deg, #fff 0%, ...);   (value list)
 *   box-shadow: 0 1px 2px #fff;
 *   border: 1px solid rgba(...)  / #fff
 * and false for selectors (`#id {`) and SCSS map/var names.
 * Also reject if the hex is immediately part of a `$name` or `--name` token
 * (preceded by `$`/`-`/`@` word char run) — i.e. it is a value, not an ident.
 * ------------------------------------------------------------------------- */
function isValuePosition(masked, idx) {
  // Walk left to find whether a ':' precedes any ';' '{' '}' on this decl.
  for (let k = idx - 1; k >= 0; k--) {
    const ch = masked[k];
    if (ch === ":") {
      // Could be a pseudo-selector (`:hover`) rather than a declaration.
      // A declaration colon is followed (eventually) by a value and a ';'.
      // Distinguish: if the char before ':' run is a property-ident char and
      // the next non-space after ':' is a value, treat as declaration. Pseudo
      // selectors are excluded because they terminate at '{' before any ';',
      // and we already stop at '{'. But `a:hover` then `{` — the hex would be
      // inside the block, not between this ':' and '{'. So reaching ':' here
      // without first hitting ; { } means we're in a value. Accept.
      return true;
    }
    if (ch === ";" || ch === "{" || ch === "}") return false;
  }
  return false;
}

/* ----------------------------------------------------------------------------
 * 5. Transform a single file.
 * ------------------------------------------------------------------------- */
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;

function transform(src) {
  const masked = maskNonValue(src);
  // Find candidate hex matches in the ORIGINAL (so we rewrite the real text),
  // but validate position using the masked copy (so comments/strings/urls are
  // invisible). Matches at indices that were blanked in `masked` won't appear
  // there, so we drive the scan off the masked copy to also get free comment
  // exclusion, then map 1:1 (same offsets).
  let count = 0;
  const replacements = []; // {start, end, text}
  let m;
  HEX_RE.lastIndex = 0;
  while ((m = HEX_RE.exec(masked))) {
    const hexRaw = m[0];
    const start = m.index;
    const end = start + hexRaw.length;

    // Skip if this hex is part of an identifier (preceded by ident char that
    // would make it a name, e.g. inside `--foo#bar` — not real CSS but guard).
    const prev = masked[start - 1];
    if (prev && /[A-Za-z0-9_]/.test(prev)) continue;

    // Length must be a real color form: 3,4,6,8 hex digits.
    const digits = hexRaw.length - 1;
    if (![3, 4, 6, 8].includes(digits)) continue;

    // Idempotency / already-wrapped check: if the hex is the fallback of an
    // existing var(--x, #hex), the char sequence to the left (after spaces)
    // ends with ',' AND somewhere this is inside var( — detect by scanning
    // left for `var(` before a closing ')'. Simpler robust check: if preceded
    // (ignoring ws) by ',' and the enclosing function is var(...), skip.
    if (insideVarFallback(masked, start)) continue;

    // Must be in value position.
    if (!isValuePosition(masked, start)) continue;

    // Exact token match.
    const token = HEX_TO_TOKEN.get(expandHex(hexRaw));
    if (!token) continue;

    replacements.push({
      start,
      end,
      text: `var(--${token}, ${hexRaw})`,
    });
    count++;
  }

  if (!replacements.length) return { out: src, count: 0 };

  // Apply right-to-left so indices stay valid.
  let out = src;
  for (let r = replacements.length - 1; r >= 0; r--) {
    const { start, end, text } = replacements[r];
    out = out.slice(0, start) + text + out.slice(end);
  }
  return { out, count };
}

/* Return true if the hex at `start` is the fallback argument of an enclosing
 * var(...) — i.e. we are already tokenized. Scan left counting parens; if we
 * reach an unmatched '(' that is preceded by `var`, it's a var() call. */
function insideVarFallback(masked, start) {
  let depth = 0;
  for (let k = start - 1; k >= 0; k--) {
    const ch = masked[k];
    if (ch === ")") depth++;
    else if (ch === "(") {
      if (depth === 0) {
        // unmatched open paren — check function name to the left
        let j = k - 1;
        while (j >= 0 && /\s/.test(masked[j])) j--;
        const namePart = masked.slice(Math.max(0, j - 2), j + 1);
        return /var$/.test(namePart);
      }
      depth--;
    } else if (ch === ";" || ch === "{" || ch === "}") {
      return false;
    }
  }
  return false;
}

/* ----------------------------------------------------------------------------
 * 6. Drive.
 * ------------------------------------------------------------------------- */
const files = listFiles();
let totalReplaced = 0;
let filesChanged = 0;
const perFile = [];

for (const file of files) {
  if (!existsSync(file)) continue;
  const src = readFileSync(file, "utf8");
  const { out, count } = transform(src);
  if (count > 0) {
    filesChanged++;
    totalReplaced += count;
    perFile.push([path.relative(repoRoot, file), count]);
    if (!DRY) writeFileSync(file, out, "utf8");
  }
}

perFile.sort((a, b) => b[1] - a[1]);
console.log("Theme-invariant token map (eligible hex -> token):");
for (const [hex, token] of [...HEX_TO_TOKEN.entries()].sort()) {
  console.log(`  ${hex} -> --${token}`);
}
console.log("");
console.log(`${DRY ? "[dry-run] " : ""}Replaced ${totalReplaced} hex literal(s) across ${filesChanged} file(s).`);
console.log("Top files:");
for (const [f, c] of perFile.slice(0, 25)) console.log(`  ${c.toString().padStart(4)}  ${f}`);
