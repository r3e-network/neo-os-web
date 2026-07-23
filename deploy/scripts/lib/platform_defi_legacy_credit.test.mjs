import test from "node:test";
import assert from "node:assert/strict";

import {
  auditPlatformDeFiLegacyCredits,
  decodeLegacyCreditRows,
  decodeVmInteger,
  renderPlatformDeFiLegacyCreditsMarkdown,
} from "../audit_platform_defi_legacy_credits.mjs";

test("PlatformDeFi legacy credit decoding preserves UInt160 and VM integer semantics", () => {
  assert.equal(decodeVmInteger("gMPJAQ=="), 30000000n);
  assert.deepEqual(
    decodeLegacyCreditRows(0x15, [
      {
        key: "FQqoslASt8XqqUhGo/lzKTacUe8T",
        value: "gMPJAQ==",
      },
    ]),
    [
      {
        key_base64: "FQqoslASt8XqqUhGo/lzKTacUe8T",
        stored_account_bytes: "0aa8b25012b7c5eaa94846a3f97329369c51ef13",
        script_hash: "0x13ef519c362973f9a34648a9eac5b71250b2a80a",
        amount_datoshi: "30000000",
      },
    ],
  );
});

test("PlatformDeFi legacy credit audit blocks non-empty underbacked storage", async () => {
  const rpcCall = async (_rpcUrl, method, params) => {
    if (method === "getversion") {
      return { protocol: { network: 894710606 }, useragent: "test" };
    }
    if (method === "getblockcount") return 123;
    if (method === "findstorage") {
      return params[1] === "FQ=="
        ? {
            truncated: false,
            next: 1,
            results: [
              {
                key: "FQqoslASt8XqqUhGo/lzKTacUe8T",
                value: "gMPJAQ==",
              },
            ],
          }
        : { truncated: false, next: 0, results: [] };
    }
    if (method === "invokefunction") {
      const token = params[0];
      return {
        state: "HALT",
        stack: [
          {
            type: "Integer",
            value:
              token === "0xd2a4cff31913016155e38e474a2c06d08be276cf"
                ? "20000000"
                : "0",
          },
        ],
      };
    }
    throw new Error(`unexpected method ${method}`);
  };
  const report = await auditPlatformDeFiLegacyCredits({
    rpcCandidates: ["testnet"],
    rpcCall,
    targets: [
      {
        name: "PlatformDeFi",
        hash: "0x39d4584ddb0731e48e611647931993ee033bf373",
      },
    ],
    now: () => new Date("2026-07-23T00:00:00.000Z"),
  });

  assert.equal(report.summary.legacy_credit_rows, 1);
  assert.equal(report.summary.underbacked, true);
  assert.equal(report.summary.migration_status, "blocked-nonempty-and-underbacked");
  assert.equal(
    report.legacy_credit_prefixes.gas.backing_gap_datoshi,
    "-10000000",
  );
  assert.match(
    renderPlatformDeFiLegacyCreditsMarkdown(report),
    /reported deficit top-up \(GAS 10000000 datoshi\)/,
  );
});
