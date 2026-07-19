import { assert, assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  CREDITS_PER_GAS,
  extractCreditsChainEvents,
  GAS_BASE_UNITS_PER_CREDIT,
  getCreditsContractHash,
  parseCreditsNetwork,
  parseHash160StackItem,
  parseIntegerStackItem,
  requireCronAuth,
} from "./credits.ts";
import { addressToScriptHash, scriptHashToAddress } from "./neo.ts";

const CONTRACT = "0x" + "ab".repeat(20);
const OTHER_CONTRACT = "0x" + "cd".repeat(20);

// Display hash "0x" + big-endian hex; app logs carry base64 little-endian bytes.
function hashToBase64LE(displayHash: string): string {
  const hex = displayHash.replace(/^0x/, "");
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) bytes.push(Number.parseInt(hex.slice(i, i + 2), 16));
  bytes.reverse();
  return btoa(String.fromCharCode(...bytes));
}

const USER_HASH = "0x" + "11".repeat(19) + "22";

function purchaseNotification(contract = CONTRACT) {
  return {
    contract,
    eventname: "CreditsPurchased",
    state: {
      type: "Array",
      value: [
        { type: "ByteString", value: hashToBase64LE(USER_HASH) },
        { type: "Integer", value: "100000000" },
        { type: "Integer", value: "50" },
      ],
    },
  };
}

function exitNotification() {
  return {
    contract: CONTRACT,
    eventname: "CreditsExited",
    state: {
      type: "Array",
      value: [
        { type: "ByteString", value: hashToBase64LE(USER_HASH) },
        { type: "Integer", value: "50" },
        { type: "Integer", value: "100000000" },
      ],
    },
  };
}

Deno.test("credits: rate constants are consistent (1 GAS = 50 credits)", () => {
  assertEquals(CREDITS_PER_GAS * GAS_BASE_UNITS_PER_CREDIT, 100_000_000n);
});

Deno.test("credits: parseCreditsNetwork accepts only mainnet/testnet", () => {
  assertEquals(parseCreditsNetwork("mainnet"), "mainnet");
  assertEquals(parseCreditsNetwork(" TestNet "), "testnet");
  assertEquals(parseCreditsNetwork("devnet"), null);
  assertEquals(parseCreditsNetwork(""), null);
  assertEquals(parseCreditsNetwork(undefined), null);
});

Deno.test("credits: getCreditsContractHash resolves env with network precedence", () => {
  try {
    Deno.env.delete("CONTRACT_MINIAPP_CREDITS_HASH");
    Deno.env.delete("CONTRACT_MINIAPP_CREDITS_HASH_TESTNET");
    assertEquals(getCreditsContractHash("testnet"), "");

    Deno.env.set("CONTRACT_MINIAPP_CREDITS_HASH", CONTRACT.replace(/^0x/, "").toUpperCase());
    assertEquals(getCreditsContractHash("testnet"), CONTRACT);

    Deno.env.set("CONTRACT_MINIAPP_CREDITS_HASH_TESTNET", OTHER_CONTRACT);
    assertEquals(getCreditsContractHash("testnet"), OTHER_CONTRACT);
    assertEquals(getCreditsContractHash("mainnet"), CONTRACT);

    Deno.env.set("CONTRACT_MINIAPP_CREDITS_HASH", "not-a-hash");
    assertEquals(getCreditsContractHash("mainnet"), "");
  } finally {
    Deno.env.delete("CONTRACT_MINIAPP_CREDITS_HASH");
    Deno.env.delete("CONTRACT_MINIAPP_CREDITS_HASH_TESTNET");
  }
});

Deno.test("credits: requireCronAuth fails closed when unconfigured", async () => {
  Deno.env.delete("CREDITS_CRON_SECRET");
  const res = await requireCronAuth(new Request("http://localhost/x", { method: "POST" }));
  assert(res instanceof Response);
  assertEquals(res.status, 503);
});

Deno.test("credits: requireCronAuth rejects missing and wrong secrets", async () => {
  try {
    // >= 32 chars so the test exercises the 401 path under the fail-closed
    // isProductionEnv default (production rejects short secrets with 503).
    Deno.env.set("CREDITS_CRON_SECRET", "test-secret-value-padded-to-32-chars");
    const missing = await requireCronAuth(new Request("http://localhost/x", { method: "POST" }));
    assert(missing instanceof Response);
    assertEquals(missing.status, 401);

    const wrong = await requireCronAuth(
      new Request("http://localhost/x", { method: "POST", headers: { "X-Cron-Secret": "nope" } }),
    );
    assert(wrong instanceof Response);
    assertEquals(wrong.status, 401);

    const ok = await requireCronAuth(
      new Request("http://localhost/x", { method: "POST", headers: { "X-Cron-Secret": "test-secret-value-padded-to-32-chars" } }),
    );
    assertEquals(ok, null);
  } finally {
    Deno.env.delete("CREDITS_CRON_SECRET");
  }
});

Deno.test("credits: parseHash160StackItem decodes base64 little-endian bytes", () => {
  assertEquals(
    parseHash160StackItem({ type: "ByteString", value: hashToBase64LE(USER_HASH) }),
    USER_HASH,
  );
  assertEquals(parseHash160StackItem({ type: "Hash160", value: USER_HASH }), USER_HASH);
  assertEquals(parseHash160StackItem({ type: "ByteString", value: btoa("short") }), null);
  assertEquals(parseHash160StackItem({ type: "Integer", value: "5" }), null);
  assertEquals(parseHash160StackItem(null), null);
});

Deno.test("credits: parseIntegerStackItem parses decimal strings only", () => {
  assertEquals(parseIntegerStackItem({ type: "Integer", value: "100000000" }), 100000000n);
  assertEquals(parseIntegerStackItem({ type: "Integer", value: "-3" }), -3n);
  assertEquals(parseIntegerStackItem({ type: "Integer", value: "abc" }), null);
  assertEquals(parseIntegerStackItem({ type: "ByteString", value: "MTA=" }), null);
  assertEquals(parseIntegerStackItem(undefined), null);
});

Deno.test("credits: scriptHashToAddress round-trips with addressToScriptHash", () => {
  const address = scriptHashToAddress(USER_HASH);
  assert(address.startsWith("N"), `expected N-address, got ${address}`);
  assertEquals(addressToScriptHash(address), USER_HASH);
});

Deno.test("credits: extractCreditsChainEvents parses purchases and exits", () => {
  const txHash = "0x" + "aa".repeat(32);
  const appLog = {
    txid: txHash,
    executions: [
      {
        vmstate: "HALT",
        notifications: [
          { contract: OTHER_CONTRACT, eventname: "Transfer", state: { type: "Array", value: [] } },
          purchaseNotification(),
          exitNotification(),
        ],
      },
    ],
  };

  const events = extractCreditsChainEvents(txHash, appLog, CONTRACT);
  assertEquals(events.length, 2);

  assertEquals(events[0].eventName, "CreditsPurchased");
  assertEquals(events[0].eventIndex, 1);
  assertEquals(events[0].userHash, USER_HASH);
  assertEquals(events[0].gasAmount, 100000000n);
  assertEquals(events[0].credits, 50n);

  assertEquals(events[1].eventName, "CreditsExited");
  assertEquals(events[1].eventIndex, 2);
  assertEquals(events[1].credits, 50n);
  assertEquals(events[1].gasAmount, 100000000n);
});

Deno.test("credits: extractCreditsChainEvents ignores FAULT executions and foreign contracts", () => {
  const txHash = "0x" + "bb".repeat(32);
  const faulted = {
    executions: [{ vmstate: "FAULT", notifications: [purchaseNotification()] }],
  };
  assertEquals(extractCreditsChainEvents(txHash, faulted, CONTRACT).length, 0);

  const foreign = {
    executions: [{ vmstate: "HALT", notifications: [purchaseNotification(OTHER_CONTRACT)] }],
  };
  assertEquals(extractCreditsChainEvents(txHash, foreign, CONTRACT).length, 0);

  assertEquals(extractCreditsChainEvents(txHash, null, CONTRACT).length, 0);
  assertEquals(extractCreditsChainEvents(txHash, { executions: "nope" }, CONTRACT).length, 0);
});

Deno.test("credits: extractCreditsChainEvents skips malformed notification state", () => {
  const txHash = "0x" + "cc".repeat(32);
  const appLog = {
    executions: [
      {
        vmstate: "HALT",
        notifications: [
          { contract: CONTRACT, eventname: "CreditsPurchased", state: { type: "Array", value: [] } },
          {
            contract: CONTRACT,
            eventname: "CreditsPurchased",
            state: {
              type: "Array",
              value: [
                { type: "ByteString", value: hashToBase64LE(USER_HASH) },
                { type: "Integer", value: "100000000" },
                { type: "Integer", value: "0" }, // zero credits rejected
              ],
            },
          },
          purchaseNotification(),
        ],
      },
    ],
  };

  const events = extractCreditsChainEvents(txHash, appLog, CONTRACT);
  assertEquals(events.length, 1);
  // Index counts every notification in the flattened list, including skipped
  // ones, so dedupe anchors stay stable across parser versions.
  assertEquals(events[0].eventIndex, 2);
});
