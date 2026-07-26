import assert from "node:assert/strict";
import test from "node:test";

import {
  ALLOWED_SECRET_VALUES,
  SECRET_RULES,
  redactSecret,
  scanTextForSecretMaterial,
} from "./secret_material_scan.mjs";

/**
 * Build WIF-shaped fixtures at runtime rather than writing them as literals.
 *
 * This file is itself scanned by the gate it tests, so a literal fixture would
 * either trip the gate or force a path allowlist — and a path allowlist is a
 * place a real key could later hide. Concatenation keeps the file free of any
 * WIF-shaped literal while still exercising the pattern.
 */
const syntheticWif = (lead = "L") => `${lead}${"1".repeat(51)}`;
const syntheticNep2 = () => `6P${"1".repeat(56)}`;
/** A 32-byte key is 64 hex characters; built at runtime for the same reason. */
const syntheticHexKey = (filler = "1") => filler.repeat(64);

test("detects a mainnet-form Neo WIF (K prefix)", () => {
  const findings = scanTextForSecretMaterial(`const key = '${syntheticWif("K")}';`);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, "neo-wif");
  assert.equal(findings[0].line, 1);
});

test("detects a compressed-key Neo WIF (L prefix)", () => {
  const findings = scanTextForSecretMaterial(`--wif ${syntheticWif("L")} \\`);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, "neo-wif");
});

test("detects a NEP-2 encrypted private key", () => {
  const findings = scanTextForSecretMaterial(`nep2: ${syntheticNep2()}`);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, "neo-nep2");
});

test("reports the line number of each finding", () => {
  const text = ["# heading", "", `--wif ${syntheticWif()}`, "tail"].join("\n");
  const findings = scanTextForSecretMaterial(text);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 3);
});

test("reports every occurrence, including repeats on separate lines", () => {
  const wif = syntheticWif();
  const findings = scanTextForSecretMaterial([`a ${wif}`, `b ${wif}`].join("\n"));
  assert.equal(findings.length, 2);
  assert.deepEqual(
    findings.map((f) => f.line),
    [1, 2],
  );
});

test("never echoes the secret back in a finding", () => {
  const wif = syntheticWif();
  const findings = scanTextForSecretMaterial(`--wif ${wif}`);
  const serialized = JSON.stringify(findings);
  assert.ok(
    !serialized.includes(wif),
    "a secret-scanning report that prints the secret has copied it to a new place",
  );
  assert.ok(findings[0].redacted.length > 0);
});

test("redaction keeps enough of the value to identify it without disclosing it", () => {
  const wif = syntheticWif();
  const redacted = redactSecret(wif);
  assert.ok(!redacted.includes(wif));
  assert.ok(redacted.startsWith(wif.slice(0, 4)));
  assert.ok(redacted.includes("…"));
  // Enough tail to distinguish two keys, not enough to reconstruct either.
  assert.ok(redacted.length < wif.length);
});

test("allows the published private-key-1 test vector", () => {
  // `neo-convert.production.test.ts` pins a deterministic conversion vector for
  // private key 0x00..01. It is published in the Neo/Bitcoin WIF documentation
  // and controls nothing, so it is allowed by VALUE rather than by path: a real
  // key added to that same test file still trips this gate.
  for (const allowed of ALLOWED_SECRET_VALUES) {
    assert.equal(scanTextForSecretMaterial(`const expectedWif = "${allowed}";`).length, 0);
  }
  assert.ok(ALLOWED_SECRET_VALUES.length > 0);
});

test("does not flag Neo N3 addresses, script hashes, or public keys", () => {
  const benign = [
    "address: NLtL2v28d7TyMEaXcPqtekunkFRksJ7wxu",
    "scriptHash: 0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5",
    "pubkey: 03cdb067d930fd5adaa6c68545016044aaddec64ba39e548250eaea551172e535c",
    "txid: 0x7da6ae7ff9d0b7af3d32f3a2feb2aa96c2a27ef8b651f9a132cfaad2ef17a121",
  ].join("\n");
  assert.deepEqual(scanTextForSecretMaterial(benign), []);
});

test("does not flag base64 payloads that fall outside the base58 alphabet", () => {
  // Base64 admits 0, O, I, l, +, / and =, all excluded from base58. A 52-char
  // base64 blob is the most likely innocent neighbour of a WIF, so it is worth
  // pinning that the alphabet alone separates them.
  const base64ish = "Kj0OIl+/8aBcDeFgHiJkLmNoPqRsTuVwXyZ012345678aBcDeFgH=";
  assert.deepEqual(scanTextForSecretMaterial(base64ish), []);
});

test("does not flag a longer base58 run that merely contains a WIF-length window", () => {
  // Anchored on word boundaries: a 70-character hash-like token is not a WIF,
  // and matching a window inside it would make the gate cry wolf on every
  // manifest digest in the repo.
  const longToken = `L${"1".repeat(69)}`;
  assert.deepEqual(scanTextForSecretMaterial(longToken), []);
});

test("detects a raw hex private key introduced by a keyword", () => {
  const findings = scanTextForSecretMaterial(`PRIVATE_KEY=${syntheticHexKey()}`);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, "raw-hex-privkey");
});

test("detects a raw hex private key regardless of keyword or digit casing", () => {
  // The first sweep of this repository used a case-sensitive pattern and
  // under-reported: `privateKey`, `PrivKey` and upper-case hex digits all went
  // unseen. Every spelling below appeared in real leaked material.
  //
  // Fillers are chosen to be valid secp256r1 scalars, since an out-of-range
  // value is not a key at all and is rejected on that ground (see the curve-order
  // tests below). Upper-case coverage therefore uses `A` and a mixed `1F` run
  // rather than all-`F`, which exceeds the group order.
  const spellings = [
    `privateKey: "0x${syntheticHexKey("a")}"`,
    `PrivKey = ${syntheticHexKey("A")}`,
    `NEO_SIGNER_PRIVATE_KEY='${syntheticHexKey("e")}'`,
    `--priv-key ${"1F".repeat(32)}`,
    `"secretKey":"${syntheticHexKey("b")}"`,
    `WIF_HEX=${syntheticHexKey("C")}`,
  ];
  for (const line of spellings) {
    const findings = scanTextForSecretMaterial(line);
    assert.equal(findings.length, 1, `missed: ${line.slice(0, 24)}…`);
    assert.equal(findings[0].ruleId, "raw-hex-privkey");
  }
});

test("does not flag an all-zero hex value beside a key keyword", () => {
  // A secp256r1 private key is a scalar in [1, n-1]. Zero is outside that range,
  // so an all-zero value cannot sign for any account and is not a credential —
  // it is the placeholder Go tests pass to `t.Setenv` to prove a signer rejects
  // an unset key. 29 of these sit in this repository's history.
  const zeros = "0".repeat(64);
  const lines = [
    `t.Setenv("NEOFEEDS_SIGNING_KEY", "${zeros}")`,
    `privateKey: 0x${zeros}`,
    `PRIV_KEY=${zeros}`,
  ].join("\n");
  assert.deepEqual(scanTextForSecretMaterial(lines), []);
});

test("does not flag a hex value at or above the secp256r1 group order", () => {
  // Scalars are reduced mod n, so a value >= n is never a generated key. The
  // all-`F` word is the most common 32-byte placeholder in test fixtures, and
  // flagging it costs the gate credibility for no security gain.
  const order = "ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551";
  const lines = [
    `privateKey: ${"f".repeat(64)}`,
    `privateKey: ${"F".repeat(64)}`,
    `signingKey = ${order}`,
    `signingKey = ${order.toUpperCase()}`,
  ].join("\n");
  assert.deepEqual(scanTextForSecretMaterial(lines), []);
});

test("still flags the largest valid scalar, one below the group order", () => {
  // The range check must exclude only what is provably unusable. n-1 is a
  // perfectly good private key, and a bounds error that let it through would
  // silence a real leak at the top of the range.
  const orderMinusOne = "ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632550";
  const findings = scanTextForSecretMaterial(`privateKey: ${orderMinusOne}`);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, "raw-hex-privkey");
});

test("allows the hex encoding of the published private-key-1 vector", () => {
  // The WIF for private key 1 is already allowed by value. The same 32 bytes
  // written as hex are the same published material and must be treated the same
  // way; four such occurrences sit in this repository's Go test history. The
  // allowlist is still by VALUE — a real key in those same files still trips.
  const keyOneHex = "1".padStart(64, "0");
  assert.ok(ALLOWED_SECRET_VALUES.includes(keyOneHex));
  assert.deepEqual(scanTextForSecretMaterial(`AccountFromPrivateKey("${keyOneHex}")`), []);
});

test("suppresses non-credentials in the line scanner, never in the pre-filter", () => {
  // `history_secret_scan.mjs` pre-filters blobs with regex-only mirrors of these
  // rules, so the mirrors must stay a superset of what the scanner reports. A
  // value rejected for being out of range therefore still matches the mirror and
  // still costs a line-by-line pass. That asymmetry is deliberate: the pre-filter
  // erring wide only wastes time, while erring narrow loses a leak silently.
  const zeros = `privateKey: ${"0".repeat(64)}`;
  const mirrors = SECRET_RULES.map(
    (rule) => new RegExp(rule.regex.source, rule.regex.flags.replace("g", "")),
  );

  assert.deepEqual(scanTextForSecretMaterial(zeros), []);
  assert.ok(
    mirrors.some((mirror) => mirror.test(zeros)),
    "the pre-filter must stay a superset of the line scanner",
  );
});

test("does not flag 64-hex digests that no key keyword introduces", () => {
  // SHA-256 digests, contract hashes and lock-file integrity fields are 64 hex
  // characters too. An unanchored rule would fire on hundreds of them, and a
  // gate that cries wolf that often gets switched off.
  const benign = [
    `sha256: ${syntheticHexKey("d")}`,
    `integrity = ${syntheticHexKey("e")}`,
    `txid 0x${syntheticHexKey("9")}`,
    `blockHash: ${syntheticHexKey("7")}`,
  ].join("\n");
  assert.deepEqual(scanTextForSecretMaterial(benign), []);
});

test("does not flag hex runs of the wrong length beside a key keyword", () => {
  // 40 hex is a script hash, 66 is a compressed public key with prefix. Only a
  // 32-byte value can be a Neo private key.
  const wrongLengths = [
    `privateKey: ${"1".repeat(40)}`,
    `privateKey: ${"1".repeat(63)}`,
    `privateKey: ${"1".repeat(65)}`,
    `privateKey: ${"1".repeat(66)}`,
  ].join("\n");
  assert.deepEqual(scanTextForSecretMaterial(wrongLengths), []);
});

test("does not join a key keyword on one line to a hex value on the next", () => {
  // The history scanner pre-filters whole blobs with these same patterns before
  // scanning line by line. A rule that spans newlines would make the two
  // disagree, so the keyword and the value must share a line.
  const split = `privateKey:\n${syntheticHexKey()}\n`;
  assert.deepEqual(scanTextForSecretMaterial(split), []);
});

test("keeps every rule line-local so the history pre-filter stays a superset", () => {
  // `history_secret_scan.mjs` derives non-global mirrors of these patterns and
  // tests them against an entire blob before scanning it line by line. If a rule
  // could match across a newline the two would disagree: the blob passes the
  // pre-filter, the line scanner reports nothing, and the leak is silently lost.
  const crossLine = [`privateKey:`, syntheticHexKey(), `wif =`, syntheticHexKey("c"), ""].join(
    "\n",
  );
  const mirrors = SECRET_RULES.map(
    (rule) => new RegExp(rule.regex.source, rule.regex.flags.replace("g", "")),
  );

  for (const [index, mirror] of mirrors.entries()) {
    assert.ok(!mirror.test("\n\n\n\n"), `rule ${SECRET_RULES[index].id} matches bare newlines`);
  }

  assert.deepEqual(scanTextForSecretMaterial(crossLine), []);
  assert.equal(
    mirrors.some((mirror) => mirror.test(crossLine)),
    false,
    "a pre-filter that admits text no line matches turns a leak into a silent pass",
  );
});

test("exposes each rule with an id and a human-readable description", () => {
  assert.ok(SECRET_RULES.length >= 2);
  for (const rule of SECRET_RULES) {
    assert.match(rule.id, /^[a-z0-9-]+$/);
    assert.ok(rule.description.length > 10, `rule ${rule.id} needs a description`);
    assert.ok(rule.regex instanceof RegExp);
    assert.ok(rule.regex.flags.includes("g"), `rule ${rule.id} must be global to find repeats`);
  }
});
