/** Live Neo N3 testnet lifecycle validation for MiniAppGasBox. */
import pkg from "@cityofzion/neon-js";
import { getManifestContractHash } from "./lib/miniapp_manifest_hash.js";
import { requireCredential } from "./lib/live_credentials.js";
import { createLiveRpc } from "./lib/live_rpc.mjs";

const { sc, wallet } = pkg;
const CONTRACT = getManifestContractHash("gasbox", { network: "testnet" });
const GAS = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const account = new wallet.Account(
  requireCredential("NEO_TESTNET_WIF", process.env.NEO_TESTNET_WIF),
);
const live = createLiveRpc({
  network: "testnet",
  neon: pkg,
  label: "live_validate_gasbox",
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const H = (value) => sc.ContractParam.hash160(value);
const I = (value) => sc.ContractParam.integer(value.toString());
const S = (value) => sc.ContractParam.string(value);
const B = (value) => sc.ContractParam.boolean(value);
const P_H = (value) => ({ type: "Hash160", value });
const P_I = (value) => ({ type: "Integer", value: value.toString() });

const invoke = (label, operation, args, systemFeeBuffer = 0) =>
  live.invokeAndConfirm({
    label,
    account,
    scriptHash: CONTRACT,
    operation,
    args,
    systemFeeBuffer,
  });
const transfer = (label, amount, memo) =>
  live.invokeAndConfirm({
    label,
    account,
    scriptHash: GAS,
    operation: "transfer",
    args: [H(account.scriptHash), H(CONTRACT), I(amount), S(memo)],
  });
const read = (method, params = []) => live.readStack(CONTRACT, method, params);
const unwrap = (value) => value?.value ?? value;
const integer = (stack) => BigInt(unwrap(stack?.[0]) ?? "0");

function event(log, name) {
  for (const notification of log?.executions?.[0]?.notifications ?? []) {
    if (notification.eventname === name) return notification.state?.value ?? [];
  }
  return null;
}

function decodeMapKey(raw) {
  if (typeof raw !== "string") return raw;
  try {
    const decoded = Buffer.from(raw, "base64").toString();
    return decoded || raw;
  } catch {
    return raw;
  }
}

function mapField(stack, key) {
  for (const entry of stack?.[0]?.value ?? []) {
    if (decodeMapKey(entry.key?.value) === key) return entry.value;
  }
  return null;
}

function hash160Value(value) {
  const raw = String(unwrap(value) ?? "").trim();
  if (!raw) return "";
  if (/^[0-9a-f]{40}$/i.test(raw.replace(/^0x/, ""))) {
    return raw.replace(/^0x/, "").toLowerCase();
  }
  const bytes = Buffer.from(raw, "base64");
  if (bytes.length !== 20) return "";
  return [...bytes]
    .reverse()
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function boolValue(value) {
  const raw = unwrap(value);
  return raw === true || raw === 1 || raw === "1";
}

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERT FAILED: ${message}`);
}

async function waitFor(readValue, predicate, label) {
  const deadline = Date.now() + 35_000;
  let value = await readValue();
  while (!predicate(value) && Date.now() < deadline) {
    await sleep(2_500);
    value = await readValue();
  }
  assert(predicate(value), `${label}: observed ${String(value)}`);
  return value;
}

async function machine(machineId) {
  const stack = await read("getMachine", [P_I(machineId)]);
  return {
    creator: hash160Value(mapField(stack, "creator")),
    name: String(unwrap(mapField(stack, "name")) ?? ""),
    prizeAsset: hash160Value(mapField(stack, "prizeAsset")),
    price: BigInt(unwrap(mapField(stack, "price")) ?? "0"),
    itemCount: BigInt(unwrap(mapField(stack, "itemCount")) ?? "0"),
    maxPrize: BigInt(unwrap(mapField(stack, "maxPrize")) ?? "0"),
    poolBalance: BigInt(unwrap(mapField(stack, "poolBalance")) ?? "0"),
    revenue: BigInt(unwrap(mapField(stack, "revenue")) ?? "0"),
    active: boolValue(mapField(stack, "active")),
  };
}

async function main() {
  const PRICE = 10_000_000n;
  const SMALL_PRIZE = 10_000_000n;
  const LARGE_PRIZE = 20_000_000n;
  const POOL = 40_000_000n;
  const machineName = `audit-${Date.now()}`;

  console.log("contract:", CONTRACT);
  console.log("creator/player:", account.address);

  const lastMachineId = integer(await read("lastMachineId"));
  const { log: createLog } = await invoke(
    "create-machine",
    "createMachine",
    [H(account.scriptHash), S(machineName), H(GAS), I(PRICE)],
  );
  const created = event(createLog, "MachineCreated");
  assert(created, "MachineCreated event missing");
  const machineId = BigInt(unwrap(created[0]));
  assert(machineId === lastMachineId + 1n, "machine id did not advance monotonically");
  assert(hash160Value(created[1]) === account.scriptHash.toLowerCase(), "creator event mismatch");
  assert(hash160Value(created[2]) === GAS.replace(/^0x/, "").toLowerCase(), "prize asset event mismatch");
  assert(BigInt(unwrap(created[3])) === PRICE, "price event mismatch");

  let current = await waitFor(
    () => machine(machineId),
    (value) => value.creator === account.scriptHash.toLowerCase() && value.itemCount === 0n,
    "created machine",
  );
  assert(current.name === machineName, "machine name mismatch");
  assert(current.prizeAsset === GAS.replace(/^0x/, "").toLowerCase(), "machine prize asset mismatch");
  assert(current.price === PRICE, "machine price mismatch");

  for (const [name, weight, amount] of [
    ["small", 1n, SMALL_PRIZE],
    ["large", 1n, LARGE_PRIZE],
  ]) {
    const { log } = await invoke(
      `add-item-${name}`,
      "addItem",
      [H(account.scriptHash), I(machineId), S(name), I(weight), I(amount)],
    );
    const added = event(log, "ItemAdded");
    assert(added, `${name} ItemAdded event missing`);
    assert(BigInt(unwrap(added[0])) === machineId, `${name} machine id mismatch`);
    assert(BigInt(unwrap(added[2])) === weight, `${name} weight mismatch`);
    assert(BigInt(unwrap(added[3])) === amount, `${name} prize mismatch`);
  }

  current = await waitFor(
    () => machine(machineId),
    (value) => value.itemCount === 2n && value.maxPrize === LARGE_PRIZE,
    "configured machine",
  );
  assert(!current.active, "machine became active before funding");

  const { log: poolLog } = await transfer(
    "fund-pool",
    POOL,
    `miniapp-gasbox-pool:${machineId}`,
  );
  const funded = event(poolLog, "PrizePoolFunded");
  assert(funded, "PrizePoolFunded event missing");
  assert(BigInt(unwrap(funded[0])) === machineId, "pool machine id mismatch");
  assert(BigInt(unwrap(funded[2])) === POOL, "pool amount mismatch");

  const { log: activateLog } = await invoke(
    "activate-machine",
    "setActive",
    [H(account.scriptHash), I(machineId), B(true)],
  );
  assert(event(activateLog, "MachineActiveChanged"), "activation event missing");
  current = await waitFor(
    () => machine(machineId),
    (value) => value.poolBalance === POOL && value.active,
    "funded active machine",
  );

  const { log: creditLog } = await transfer(
    "prepay-play",
    PRICE,
    "miniapp-gasbox:play",
  );
  assert(event(creditLog, "PlayCredited"), "PlayCredited event missing");
  await waitFor(
    () => read("playCreditOf", [P_H(account.scriptHash)]).then(integer),
    (value) => value === PRICE,
    "play credit",
  );

  const { log: pullLog } = await invoke(
    "pull",
    "pull",
    [I(machineId), H(account.scriptHash)],
    100_000_000,
  );
  const pulled = event(pullLog, "Pulled");
  assert(pulled, "Pulled event missing");
  assert(BigInt(unwrap(pulled[1])) === machineId, "pull machine id mismatch");
  assert(hash160Value(pulled[2]) === account.scriptHash.toLowerCase(), "pull player mismatch");
  const prize = BigInt(unwrap(pulled[4]));
  assert(prize === SMALL_PRIZE || prize === LARGE_PRIZE, "pull prize is not configured");
  await waitFor(
    () => read("playCreditOf", [P_H(account.scriptHash)]).then(integer),
    (value) => value === 0n,
    "consumed play credit",
  );

  current = await waitFor(
    () => machine(machineId),
    (value) => value.poolBalance === POOL - prize && value.revenue === PRICE,
    "settled pull",
  );
  assert(current.active, "machine deactivated while pool still covered max prize");

  const { log: withdrawLog } = await invoke(
    "withdraw-revenue",
    "withdrawRevenue",
    [H(account.scriptHash), I(machineId), H(account.scriptHash)],
  );
  const withdrawn = event(withdrawLog, "RevenueWithdrawn");
  assert(withdrawn, "RevenueWithdrawn event missing");
  assert(BigInt(unwrap(withdrawn[0])) === machineId, "withdraw machine id mismatch");
  assert(hash160Value(withdrawn[1]) === account.scriptHash.toLowerCase(), "withdraw recipient mismatch");
  assert(BigInt(unwrap(withdrawn[2])) === PRICE, "withdraw amount mismatch");
  await waitFor(
    () => machine(machineId),
    (value) => value.revenue === 0n,
    "withdrawn revenue",
  );

  const { log: deactivateLog } = await invoke(
    "deactivate-machine",
    "setActive",
    [H(account.scriptHash), I(machineId), B(false)],
  );
  assert(event(deactivateLog, "MachineActiveChanged"), "deactivation event missing");
  current = await waitFor(
    () => machine(machineId),
    (value) => !value.active,
    "deactivated machine",
  );
  console.log(JSON.stringify({ machineId: machineId.toString(), prize: prize.toString(), poolBalance: current.poolBalance.toString() }));
  console.log("✅ GASBOX live lifecycle validation OK");
}

main().catch((error) => {
  console.error("ERR", String(error?.message || error).replace(/\b[KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/g, "***WIF***"));
  process.exit(1);
});
