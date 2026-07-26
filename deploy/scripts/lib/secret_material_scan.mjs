/**
 * Neo key-material detection for the repo-hygiene gates.
 *
 * Problem this solves:
 *   The secret class this repo actually leaks is a bare Neo WIF — 52 base58
 *   characters with no surrounding keyword. Audit finding C-6 (2026-05-19)
 *   records one such key reaching git history, where it is now permanent.
 *   Keyword-anchored scanners cannot see this shape: a WIF carries no `key=`,
 *   `password`, `aws`, or `Bearer` token for them to anchor on, so a leak walks
 *   past every generic rule untouched.
 *
 *   This module is the detector for that shape. It is deliberately narrow —
 *   two rules, both for Neo private-key encodings — because a gate that cries
 *   wolf gets switched off, and a switched-off gate is how C-6 happened.
 *
 * Allowlisting is by VALUE, never by path. Published test vectors control no
 * funds and must not fail the build, but exempting the file that holds one
 * would create a place where a real key could later sit unnoticed.
 */

/**
 * Base58 as Neo/Bitcoin define it: no 0, O, I or l, since those are the
 * characters a human transcribing a key gets wrong.
 */
const BASE58 = "[1-9A-HJ-NP-Za-km-z]";

/** A Neo private key is 32 bytes, so exactly 64 hex characters — never 40, never 66. */
const HEX32 = "[0-9A-Fa-f]{64}";

/**
 * A raw hex key carries no self-identifying prefix, so unlike the two base58
 * encodings it has to be anchored on the name beside it. Without that anchor the
 * rule would fire on every SHA-256 digest, contract hash and lock-file integrity
 * field in the tree — hundreds of them — and a gate that noisy gets switched off.
 */
const KEY_KEYWORD =
  "(?:private[_-]?key|priv[_-]?key|privkey|secret[_-]?key|signing[_-]?key|wif(?:[_-]?hex)?|nep2|key[_-]?hex)";

/**
 * What may sit between the keyword and the value: assignment or JSON punctuation,
 * quotes, brackets, and horizontal whitespace for CLI forms like `--priv-key V`.
 *
 * `[^\S\n]` rather than `\s`, deliberately. The history scanner pre-filters whole
 * blobs with non-global mirrors of these patterns before scanning line by line;
 * a rule that could span a newline would let a blob pass the pre-filter and then
 * match nothing, turning a leak into a silent pass.
 */
const KEY_SEPARATOR = "(?:[^\\S\\n]|[\"'`:=,(\\[>])*";

/**
 * Order of the secp256r1 (P-256) group, the curve Neo signs with.
 *
 * A private key is a scalar in [1, n-1]. Both ends are exclusions the shape of a
 * value cannot express, which is why they are checked after the match rather than
 * folded into the regex.
 */
const SECP256R1_ORDER = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;

/**
 * Reject 64-hex values that are provably not keys.
 *
 * This is a correctness fix, not a relaxation. A scalar of 0, or one at or above
 * the group order, cannot be a generated key and cannot sign for any account —
 * `0x00..00` is what a test passes to prove a signer refuses an unset key, and
 * `0xff..ff` is the usual 32-byte filler. Reporting them costs the gate its
 * credibility while protecting nothing, and every real key in the range still
 * trips: n-1 is flagged, n is not.
 *
 * @param {string} value 64 hex digits, either case, without an `0x` prefix.
 * @returns {boolean}
 */
function isValidSecp256r1Scalar(value) {
  const scalar = BigInt(`0x${value}`);
  return scalar >= 1n && scalar < SECP256R1_ORDER;
}

/**
 * The base58 rules are anchored on non-base58 boundaries rather than `\b`. `\b`
 * sits between a letter and a digit-or-letter identically, so it cannot tell the
 * end of a 52-character key from the middle of a 70-character digest; an explicit
 * character-class boundary can. The hex rule anchors on its keyword instead, and
 * on a non-hex boundary after the 64th digit so a 65-hex digest cannot match.
 *
 * `isCredential` is an optional second stage for what a regex cannot decide. It
 * runs only in the per-line scanner, never in the history scanner's blob
 * pre-filter, so the pre-filter stays a superset of what gets reported: erring
 * wide there costs a line pass, erring narrow loses a leak silently.
 */
export const SECRET_RULES = Object.freeze([
  Object.freeze({
    id: "neo-wif",
    description:
      "Neo private key in Wallet Import Format (52 base58 chars, K or L prefix). Grants full control of the account.",
    regex: new RegExp(`(?<![0-9A-Za-z])([KL]${BASE58}{51})(?![0-9A-Za-z])`, "g"),
  }),
  Object.freeze({
    id: "neo-nep2",
    description:
      "NEP-2 passphrase-encrypted Neo private key (58 base58 chars, 6P prefix). One offline guess away from the plaintext key.",
    regex: new RegExp(`(?<![0-9A-Za-z])(6P${BASE58}{56})(?![0-9A-Za-z])`, "g"),
  }),
  Object.freeze({
    id: "raw-hex-privkey",
    description:
      "Raw 32-byte Neo private key in hex, introduced by a key keyword. Equivalent to a WIF: full control of the account.",
    regex: new RegExp(`${KEY_KEYWORD}${KEY_SEPARATOR}(?:0[xX])?(${HEX32})(?![0-9A-Fa-f])`, "gi"),
    isCredential: isValidSecp256r1Scalar,
  }),
]);

/**
 * Values that match a rule but are not credentials.
 *
 * Every entry needs a reason, and the reason has to be "this cannot control
 * anything" — not "this is only a test" or "this is only a doc".
 */
export const ALLOWED_SECRET_VALUES = Object.freeze([
  // WIF for private key 0x0000..0001, published in the WIF specification and
  // pinned by apps/shared/test/neo-convert.production.test.ts as a conversion
  // vector. Deriving it requires no secret; funding it would be a donation.
  "KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn",
  // The same 32 bytes written as hex — the encoding Go tests pass to
  // AccountFromPrivateKey. Built rather than written out so this file holds no
  // 64-hex-shaped literal of its own; the value is identical either way, and
  // allowing one encoding of published material while flagging the other would
  // report a difference that does not exist.
  `${"0".repeat(63)}1`,
]);

const PURE_HEX32 = /^[0-9A-Fa-f]{64}$/;

/**
 * Fold the one difference in spelling that does not change the value.
 *
 * For hex, case is presentation: `0x0A` and `0x0a` are the same 32 bytes, so an
 * allowlist matching only one spelling would be decided by whoever typed the
 * fixture. Base58 is returned verbatim — there case is part of the encoding, and
 * changing it changes the key.
 *
 * @param {string} value
 * @returns {string}
 */
function normalizeForAllowlist(value) {
  return PURE_HEX32.test(value) ? value.toLowerCase() : value;
}

const ALLOWED = new Set(ALLOWED_SECRET_VALUES.map(normalizeForAllowlist));

/**
 * Shorten a secret enough to tell two of them apart without republishing
 * either. A scanner that prints what it found has just leaked it again, into
 * CI logs this time.
 *
 * @param {string} value
 * @returns {string}
 */
export function redactSecret(value) {
  return `${value.slice(0, 4)}…${value.slice(-2)} (${value.length} chars)`;
}

/**
 * @typedef {object} SecretFinding
 * @property {string} ruleId Which rule matched.
 * @property {string} description What the matched shape grants.
 * @property {number} line 1-based line number of the match.
 * @property {number} column 1-based column of the match.
 * @property {string} redacted Identifiable-but-not-usable form of the match.
 */

/**
 * Scan text for Neo key material.
 *
 * @param {string} text
 * @returns {SecretFinding[]} One finding per occurrence, in document order.
 */
export function scanTextForSecretMaterial(text) {
  if (typeof text !== "string" || text.length === 0) return [];

  /** @type {SecretFinding[]} */
  const findings = [];
  const lines = text.split("\n");

  lines.forEach((line, index) => {
    for (const rule of SECRET_RULES) {
      // Rules are module-level and global, so reset lastIndex per line rather
      // than trusting whatever the previous line left behind.
      rule.regex.lastIndex = 0;
      let match;
      while ((match = rule.regex.exec(line)) !== null) {
        const value = match[1];
        if (ALLOWED.has(normalizeForAllowlist(value))) continue;
        if (rule.isCredential && !rule.isCredential(value)) continue;
        findings.push({
          ruleId: rule.id,
          description: rule.description,
          line: index + 1,
          column: match.index + 1,
          redacted: redactSecret(value),
        });
      }
    }
  });

  return findings.sort((a, b) => a.line - b.line || a.column - b.column);
}
