import { defineMiniApp, createObservable } from "@shared/react/defineMiniApp";
import type { MiniAppSetupContext, MiniAppSetupResult } from "@shared/react/defineMiniApp";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import { getMiniAppContractHash } from "@shared/constants/rpc";
import { eventValue } from "@shared/utils/chain-events";
import { parseBigInt } from "@shared/utils/parsers";
import { waitForDepositConfirmation } from "@shared/composables/useContractInteraction";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";

const appId = "miniapp-custom-anchor";

/** Self-service anchor registration fee: 1 GAS prepaid credit (PlatformAnchor.cs). */
const REGISTRATION_FEE_BASE = "100000000";
/** Anchor modes: 1 = trust (voting), 2 = profit (yield). */
const MODE_TRUST = 1;
/** How many AnchorAppRegistered events to scan for the discovery list. */
const REGISTERED_EVENTS_LIMIT = 100;

/**
 * The strict shape used to MINT a new anchor id (slug:nonce, lowercase). The
 * contract itself accepts any 1-64 char appId (ValidateAppId), so reads/redeems
 * use the looser {@link isContractAnchorId} gate — a script-registered anchor
 * with a different shape must stay reachable for redeeming already-staked NEO.
 */
function isStrictAnchorId(value: string): boolean {
  return /^custom-anchor:[a-z0-9-]{1,24}:[a-z0-9-]{1,24}$/.test(value.trim());
}

/** The contract's own appId rule (ValidateAppId): any 1-64 char id. */
function isContractAnchorId(value: string): boolean {
  const v = value.trim();
  return v.length >= 1 && v.length <= 64;
}

function firstParam(ctx: MiniAppSetupContext, keys: string[]): string {
  for (const key of keys) {
    const value = String(ctx.launchContext.params?.[key] ?? "").trim();
    if (value) return value;
  }
  return "";
}

function wholeNeo(value: unknown): string {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
    throw new Error("NEO amount must be a positive whole number.");
  }
  return String(amount);
}

/**
 * Resolve an anchor id for a READ / redeem / claim action. Uses the contract's
 * own 1-64 char rule so a script-registered anchor (uppercase, longer segments,
 * different prefix) stays reachable for redeeming already-staked NEO — the
 * strict slug:nonce shape is only required to MINT a new stake/anchor.
 */
function targetAnchorId(value: unknown): string {
  const anchorAppId = String(value ?? "").trim();
  if (!isContractAnchorId(anchorAppId)) {
    throw new Error("Anchor appId is required (1-64 characters).");
  }
  return anchorAppId;
}

/** Resolve an anchor id for a NEW stake / registration (strict slug:nonce shape). */
function strictAnchorId(value: unknown): string {
  const anchorAppId = String(value ?? "").trim();
  if (!isStrictAnchorId(anchorAppId)) {
    throw new Error("Anchor appId must look like custom-anchor:slug:nonce.");
  }
  return anchorAppId;
}

function stackNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return stackNumber(record.value ?? record.integer ?? record.result);
  }
  return 0;
}

function fromFixed8(value: unknown): string {
  const amount = stackNumber(value) / 100_000_000;
  if (!Number.isFinite(amount)) return "0";
  return amount.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

function fromWholeNeo(value: unknown): string {
  const amount = stackNumber(value);
  if (!Number.isFinite(amount)) return "0";
  return Math.trunc(amount).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

/**
 * The getRewardPerNeo accumulator is GAS-datoshi * REWARD_SCALE(1e8) per NEO,
 * i.e. cumulative GAS-per-NEO * 1e16, so one distributed GAS per NEO would read
 * as 1e16. Divide by 1e16 so it renders as a legible GAS/NEO figure.
 */
const REWARD_PER_NEO_SCALE = 100_000_000 * 100_000_000;
function fromRewardPerNeo(value: unknown): string {
  const amount = stackNumber(value) / REWARD_PER_NEO_SCALE;
  if (!Number.isFinite(amount)) return "0";
  return amount.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

defineMiniApp({
  appId,
  playArea: PlayArea,
  manifest,
  messages,
  setup(ctx): MiniAppSetupResult {
    const anchorAppId = createObservable(
      firstParam(ctx, ["anchorAppId", "anchor", "targetAnchor", "app"]),
    );
    const totalStaked = createObservable("0");
    const rewardReserve = createObservable("0");
    const userStake = createObservable("0");
    const pendingRewards = createObservable("0");
    const agentCount = createObservable(0);
    // Cumulative GAS distributed per NEO since launch (getRewardPerNeo). The
    // on-chain accumulator is GAS-datoshi * REWARD_SCALE(1e8) per NEO, i.e.
    // GAS/NEO * 1e16; divide before display. "0" when the anchor is unfunded.
    const rewardPerNeo = createObservable("0");
    const lastTxid = createObservable("");
    const workflowStatus = createObservable(ctx.t("workflowReady"));
    const lastError = createObservable("");
    const isLoading = createObservable(false);
    // Registration state of the resolved anchor (getAppMode): 0 = not registered,
    // 1 = trust, 2 = profit. -1 = unknown (not yet read / no anchor).
    const anchorMode = createObservable(-1);
    // Reclaimable contract credit under the wallet (over/failed deposits + the
    // registration-fee credit), in whole NEO and GAS (display).
    const neoCredit = createObservable("0");
    const gasCredit = createObservable("0");
    const neoCreditRaw = createObservable("0");
    const gasCreditRaw = createObservable("0");
    // Recently registered anchors (from AnchorAppRegistered events) for discovery.
    const discoveredAnchors = createObservable<Array<{ appId: string; mode: number }>>([]);
    const anchorOptions = <T extends Record<string, unknown>>(options?: T) => {
      const scriptHash = getMiniAppContractHash(appId);
      return { ...(options ?? {}), ...(scriptHash ? { scriptHash } : {}) };
    };

    async function loadCredits() {
      const address = ctx.services.chain.address.get();
      if (!address) {
        neoCredit.set("0"); gasCredit.set("0");
        neoCreditRaw.set("0"); gasCreditRaw.set("0");
        return;
      }
      try {
        const [neo, gas] = await Promise.all([
          ctx.services.chain.read("getCredit", [
            { type: "Hash160", value: address },
            { type: "String", value: "NEO" },
          ], anchorOptions()),
          ctx.services.chain.read("getCredit", [
            { type: "Hash160", value: address },
            { type: "String", value: "GAS" },
          ], anchorOptions()),
        ]);
        const neoBase = parseBigInt(neo);
        const gasBase = parseBigInt(gas);
        neoCreditRaw.set(neoBase.toString());
        gasCreditRaw.set(gasBase.toString());
        // NEO credit is whole NEO; GAS credit is fixed8.
        neoCredit.set(neoBase > 0n ? fromWholeNeo(neoBase.toString()) : "0");
        gasCredit.set(gasBase > 0n ? fromFixed8(gasBase.toString()) : "0");
      } catch {
        // Credit recovery is an exit affordance — never block the main UI on it.
        neoCredit.set("0"); gasCredit.set("0");
        neoCreditRaw.set("0"); gasCreditRaw.set("0");
      }
    }

    async function loadData() {
      const target = anchorAppId.get();
      // Credits are wallet-scoped, independent of any anchor — load them even
      // before an anchor is linked so stranded funds are always recoverable.
      await loadCredits();
      if (!target) {
        anchorMode.set(-1);
        return;
      }
      lastError.set("");
      isLoading.set(true);
      try {
        // Existence check FIRST: getAppMode == 0 means the anchor is not
        // registered, so the all-zero reads below would otherwise show a
        // plausible-but-fake anchor. Surface an explicit "not registered" state
        // and skip the money reads.
        const mode = stackNumber(
          await ctx.services.chain.read("getAppMode", [{ type: "String", value: target }], anchorOptions()),
        );
        anchorMode.set(mode);
        if (mode <= 0) {
          totalStaked.set("0"); rewardReserve.set("0"); agentCount.set(0);
          userStake.set("0"); pendingRewards.set("0"); rewardPerNeo.set("0");
          workflowStatus.set(ctx.t("anchorNotRegistered"));
          return;
        }

        const [total, reserve, agents, rps] = await Promise.all([
          ctx.services.chain.read("getTotalStaked", [{ type: "String", value: target }], anchorOptions()),
          ctx.services.chain.read("getRewardReserve", [{ type: "String", value: target }], anchorOptions()),
          ctx.services.chain.read("getAgentCount", [{ type: "String", value: target }], anchorOptions()),
          ctx.services.chain.read("getRewardPerNeo", [{ type: "String", value: target }], anchorOptions()),
        ]);
        totalStaked.set(fromWholeNeo(total));
        rewardReserve.set(fromFixed8(reserve));
        agentCount.set(stackNumber(agents));
        rewardPerNeo.set(fromRewardPerNeo(rps));

        const address = ctx.services.chain.address.get();
        if (address) {
          const [stake, rewards] = await Promise.all([
            ctx.services.chain.read("getUserStake", [
              { type: "String", value: target },
              { type: "Hash160", value: address },
            ], anchorOptions()),
            ctx.services.chain.read("getPendingRewards", [
              { type: "String", value: target },
              { type: "Hash160", value: address },
            ], anchorOptions()),
          ]);
          userStake.set(fromWholeNeo(stake));
          pendingRewards.set(fromFixed8(rewards));
        }
        workflowStatus.set(ctx.t("statusLoaded"));
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        lastError.set(message);
        workflowStatus.set(ctx.t("workflowFailed"));
        throw e;
      } finally {
        isLoading.set(false);
      }
    }

    /** Build the discovery list from AnchorAppRegistered events (newest first). */
    async function loadDiscovered() {
      try {
        const events = await ctx.services.chain.listEvents("AnchorAppRegistered", {
          limit: REGISTERED_EVENTS_LIMIT,
        });
        const seen = new Set<string>();
        const out: Array<{ appId: string; mode: number }> = [];
        // AnchorAppRegistered(appId, mode, appAdmin) — appId in slot 0, mode in 1.
        for (const event of events) {
          const id = String(eventValue(event, 0) ?? "").trim();
          if (!id || seen.has(id)) continue;
          seen.add(id);
          out.push({ appId: id, mode: stackNumber(eventValue(event, 1)) });
        }
        out.reverse();
        discoveredAnchors.set(out.slice(0, 12));
      } catch {
        discoveredAnchors.set([]);
      }
    }

    ctx.registerAction("stake", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as Record<string, unknown>;
      const target = targetAnchorId(form.anchorAppId || anchorAppId.get());
      const contract = getMiniAppContractHash(appId);
      if (!contract) throw new Error("PlatformAnchor contract is not configured.");
      const user = await ctx.services.chain.ensureWallet();
      const amount = wholeNeo(form.amount);
      workflowStatus.set(ctx.t("stakeSubmitting"));
      lastError.set("");
      const result = await ctx.services.chain.invoke("transfer", [
        { type: "Hash160", value: user },
        { type: "Hash160", value: contract },
        { type: "Integer", value: amount },
        { type: "String", value: `stake:${target}` },
      ], {
        scriptHash: BLOCKCHAIN_CONSTANTS.NEO_HASH,
        // Wait on the contract's stake event so the post-write refresh reads the
        // settled stake. The prior 1.5s override expired before the event landed
        // (the "stale refresh" friction) — use the service default (45s).
        waitForEvent: "AnchorStakeChanged",
      });
      anchorAppId.set(target);
      lastTxid.set(result.txid);
      workflowStatus.set(ctx.t("stakeSubmitted"));
      await loadData();
      return result;
    });

    ctx.registerAction("withdraw", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as Record<string, unknown>;
      const target = targetAnchorId(form.anchorAppId || anchorAppId.get());
      const user = await ctx.services.chain.ensureWallet();
      workflowStatus.set(ctx.t("withdrawSubmitting"));
      lastError.set("");
      const result = await ctx.services.chain.invoke("withdraw", [
        { type: "String", value: target },
        { type: "Hash160", value: user },
        { type: "Integer", value: wholeNeo(form.amount) },
      ], anchorOptions({ waitForEvent: "AnchorStakeChanged" }));
      anchorAppId.set(target);
      lastTxid.set(result.txid);
      workflowStatus.set(ctx.t("withdrawSubmitted"));
      await loadData();
      return result;
    });

    ctx.registerAction("claimRewards", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as Record<string, unknown>;
      const target = targetAnchorId(form.anchorAppId || anchorAppId.get());
      const user = await ctx.services.chain.ensureWallet();
      workflowStatus.set(ctx.t("claimSubmitting"));
      lastError.set("");
      const result = await ctx.services.chain.invoke("claimRewards", [
        { type: "String", value: target },
        { type: "Hash160", value: user },
      ], anchorOptions({ waitForEvent: "AnchorRewardsClaimed" }));
      anchorAppId.set(target);
      lastTxid.set(result.txid);
      workflowStatus.set(ctx.t("claimSubmitted"));
      await loadData();
      return result;
    });

    ctx.registerAction("refreshAnchor", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as Record<string, unknown>;
      const target = String(form.anchorAppId || anchorAppId.get() || "").trim();
      if (target) anchorAppId.set(targetAnchorId(target));
      workflowStatus.set(ctx.t("refreshingStatus"));
      await loadData();
    });

    // Register a NEW custom anchor: deposit the 1-GAS registration-fee credit
    // (a bare GAS transfer credits the wallet via OnNEP17Payment), then call
    // registerCustomAnchorApp(appId, mode, appAdmin) which consumes it. The
    // appAdmin witness is the connected wallet.
    ctx.registerAction("register", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as Record<string, unknown>;
      const target = strictAnchorId(form.anchorAppId);
      const contract = getMiniAppContractHash(appId);
      if (!contract) throw new Error("PlatformAnchor contract is not configured.");
      const user = await ctx.services.chain.ensureWallet();
      const mode = stackNumber(form.mode) === 2 ? 2 : MODE_TRUST;

      // Reject re-registering an already-registered anchor before spending the fee.
      const existing = stackNumber(
        await ctx.services.chain.read("getAppMode", [{ type: "String", value: target }], anchorOptions()),
      );
      if (existing > 0) throw new Error(ctx.t("anchorAlreadyRegistered"));

      workflowStatus.set(ctx.t("registerSubmitting"));
      lastError.set("");
      // Step 1: top up the 1-GAS prepaid credit (only if the wallet lacks it).
      // The contract credits the deposit in OnNEP17Payment but emits no event,
      // so wait on the GAS transfer's on-chain confirmation (not a contract
      // event) before the register call consumes the credit.
      const haveGas = parseBigInt(gasCreditRaw.get());
      if (haveGas < BigInt(REGISTRATION_FEE_BASE)) {
        const deposit = await ctx.services.chain.invoke("transfer", [
          { type: "Hash160", value: user },
          { type: "Hash160", value: contract },
          { type: "Integer", value: REGISTRATION_FEE_BASE },
          { type: "String", value: "" },
        ], {
          scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
        });
        await waitForDepositConfirmation(deposit.txid, {
          contractHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
        });
      }
      // Step 2: register, consuming the prepaid credit.
      const result = await ctx.services.chain.invoke("registerCustomAnchorApp", [
        { type: "String", value: target },
        { type: "Integer", value: String(mode) },
        { type: "Hash160", value: user },
      ], anchorOptions({ waitForEvent: "AnchorAppRegistered" }));

      anchorAppId.set(target);
      lastTxid.set(result.txid);
      workflowStatus.set(ctx.t("registerSubmitted"));
      await loadData();
      await loadDiscovered();
      return result;
    });

    // Reclaim stranded contract credit (NEO or GAS) via withdrawCredit.
    ctx.registerAction("recoverCredit", async (...args: unknown[]) => {
      const asset = String((args[0] ?? "") as string) === "NEO" ? "NEO" : "GAS";
      const user = await ctx.services.chain.ensureWallet();
      const raw = asset === "NEO" ? parseBigInt(neoCreditRaw.get()) : parseBigInt(gasCreditRaw.get());
      if (raw <= 0n) throw new Error(ctx.t("noCreditToRecover"));
      workflowStatus.set(ctx.t("recoverSubmitting"));
      lastError.set("");
      // withdrawCredit transfers the asset back but emits no contract event, so
      // there is nothing app-scoped to wait on; the post-call loadCredits read
      // reflects the new (zeroed) balance.
      const result = await ctx.services.chain.invoke("withdrawCredit", [
        { type: "Hash160", value: user },
        { type: "String", value: asset },
        { type: "Integer", value: raw.toString() },
      ], anchorOptions());
      lastTxid.set(result.txid);
      workflowStatus.set(ctx.t("recoverSubmitted"));
      await loadCredits();
      return result;
    });

    ctx.registerAction("discoverAnchors", async () => {
      await loadDiscovered();
    });

    ctx.registerAction("selectAnchor", async (...args: unknown[]) => {
      const target = String((args[0] ?? "") as string).trim();
      if (!target) return;
      anchorAppId.set(targetAnchorId(target));
      await loadData();
    });

    return {
      state: {
        anchorAppId,
        anchorMode,
        totalStaked,
        rewardReserve,
        userStake,
        pendingRewards,
        agentCount,
        rewardPerNeo,
        lastTxid,
        workflowStatus,
        lastError,
        isLoading,
        neoCredit,
        gasCredit,
        discoveredAnchors,
      },
      loadData: async () => {
        await loadData();
        await loadDiscovered();
      },
    };
  },
});
