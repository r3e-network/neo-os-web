import { defineMiniApp, createObservable } from "@shared/react/defineMiniApp";
import type { MiniAppSetupContext, MiniAppSetupResult } from "@shared/react/defineMiniApp";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import { EXTERNAL_INTEGRATIONS, getMiniAppContractHash, resolveNeoNetwork } from "@shared/constants/rpc";
// eventValue/parseBigInt/parseHash160 are the framework canonicals (S0 utils
// consolidation), consumed via the shared re-exports.
import { eventValue } from "@shared/utils/chain-events";
import { parseBigInt } from "@shared/utils/parsers";
import { parseHash160 } from "@shared/utils/neo";
import {
  buildAnchorRegistrationInvocations,
  parseAnchorCandidateKeys,
  type AnchorContractArg,
} from "@shared/utils/anchor-agents";
import type { ContractArg } from "@shared/services";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";

/**
 * The standalone chain service's static ContractArg type narrows `value` to
 * scalars; the runtime SDK tolerates nested Array values. Widen at the invoke
 * boundary (mirrors neo-multisig's toChainArgs).
 */
function toChainArgs(args: AnchorContractArg[]): ContractArg[] {
  return args as unknown as ContractArg[];
}

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
    // Write-action lock: every stake/withdraw/claim/register/recover action
    // checks this before invoking so a double-click can't fire two NEO
    // transfers or two registration sequences (mirrors profitanchor's
    // runAnchorAction). Reset in the finally so a wallet rejection never leaves
    // the surface stuck spinning.
    const submitting = createObservable(false);
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
      const address = ctx.framework.chain.address.get();
      if (!address) {
        neoCredit.set("0"); gasCredit.set("0");
        neoCreditRaw.set("0"); gasCreditRaw.set("0");
        return;
      }
      try {
        // address is non-empty here (guarded above); arg.hash160 THROWS on an
        // empty/invalid address, so it is only built inside this try after the
        // guard (a build failure would be caught and zero the credit like any
        // read failure — the existing behavior).
        const accountArg = ctx.framework.chain.arg.hash160(address);
        const [neo, gas] = await Promise.all([
          ctx.framework.chain.readRaw("getCredit", [
            accountArg,
            ctx.framework.chain.arg.string("NEO"),
          ], anchorOptions()),
          ctx.framework.chain.readRaw("getCredit", [
            accountArg,
            ctx.framework.chain.arg.string("GAS"),
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
          await ctx.framework.chain.readRaw("getAppMode", [ctx.framework.chain.arg.string(target)], anchorOptions()),
        );
        anchorMode.set(mode);
        if (mode <= 0) {
          totalStaked.set("0"); rewardReserve.set("0"); agentCount.set(0);
          userStake.set("0"); pendingRewards.set("0"); rewardPerNeo.set("0");
          workflowStatus.set(ctx.t("anchorNotRegistered"));
          return;
        }

        const targetArg = ctx.framework.chain.arg.string(target);
        const [total, reserve, agents, rps] = await Promise.all([
          ctx.framework.chain.readRaw("getTotalStaked", [targetArg], anchorOptions()),
          ctx.framework.chain.readRaw("getRewardReserve", [targetArg], anchorOptions()),
          ctx.framework.chain.readRaw("getAgentCount", [targetArg], anchorOptions()),
          ctx.framework.chain.readRaw("getRewardPerNeo", [targetArg], anchorOptions()),
        ]);
        totalStaked.set(fromWholeNeo(total));
        rewardReserve.set(fromFixed8(reserve));
        agentCount.set(stackNumber(agents));
        rewardPerNeo.set(fromRewardPerNeo(rps));

        const address = ctx.framework.chain.address.get();
        if (address) {
          const userArg = ctx.framework.chain.arg.hash160(address);
          const [stake, rewards] = await Promise.all([
            ctx.framework.chain.readRaw("getUserStake", [
              targetArg,
              userArg,
            ], anchorOptions()),
            ctx.framework.chain.readRaw("getPendingRewards", [
              targetArg,
              userArg,
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
        const events = await ctx.framework.chain.events("AnchorAppRegistered", {
          limit: REGISTERED_EVENTS_LIMIT,
        });
        const seen = new Set<string>();
        const out: Array<{ appId: string; mode: number }> = [];
        // AnchorAppRegistered(appId, mode, appAdmin) — appId in slot 0, mode in 1.
        // NOTE: kept on the strict eventValue decode (framework canonical via
        // the shared re-export) rather than app.chain.eventValue, whose
        // defensive eventStateValue fallback returns the raw slot item when
        // `value` is null — a subtle shape difference this decode must not
        // inherit (byte-identical discovery behavior).
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

    /**
     * Guard + error-recovery wrapper for every write action. Blocks
     * double-submits (the #1 regression this app had vs profitanchor), ensures
     * the busy flag is released in finally so a wallet rejection / RPC error
     * never leaves the surface stuck on "Submitting…", and surfaces a localized
     * error + failed status instead of an opaque throw.
     */
    async function runWrite<T>(
      fn: () => Promise<T>,
    ): Promise<T | undefined> {
      if (submitting.get()) return undefined; // double-submit guard
      submitting.set(true);
      lastError.set("");
      try {
        return await fn();
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        lastError.set(message);
        workflowStatus.set(ctx.t("workflowFailed"));
        throw e;
      } finally {
        submitting.set(false);
      }
    }

    ctx.framework.actions.register("stake", async (...args: unknown[]) => {
      return runWrite(async () => {
      const form = (args[0] ?? {}) as Record<string, unknown>;
      const target = targetAnchorId(form.anchorAppId || anchorAppId.get());
      const contract = getMiniAppContractHash(appId);
      if (!contract) throw new Error("PlatformAnchor contract is not configured.");
      const user = await ctx.framework.chain.ensureWallet();
      const amount = wholeNeo(form.amount);
      workflowStatus.set(ctx.t("stakeSubmitting"));
      const result = await ctx.framework.chain.invoke("transfer", [
        ctx.framework.chain.arg.hash160(user),
        ctx.framework.chain.arg.hash160(contract),
        ctx.framework.chain.arg.integer(amount),
        ctx.framework.chain.arg.string(`stake:${target}`),
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
    });

    ctx.framework.actions.register("withdraw", async (...args: unknown[]) => {
      return runWrite(async () => {
      const form = (args[0] ?? {}) as Record<string, unknown>;
      const target = targetAnchorId(form.anchorAppId || anchorAppId.get());
      const user = await ctx.framework.chain.ensureWallet();
      workflowStatus.set(ctx.t("withdrawSubmitting"));
      const result = await ctx.framework.chain.invoke("withdraw", [
        ctx.framework.chain.arg.string(target),
        ctx.framework.chain.arg.hash160(user),
        ctx.framework.chain.arg.integer(wholeNeo(form.amount)),
      ], anchorOptions({ waitForEvent: "AnchorStakeChanged" }));
      anchorAppId.set(target);
      lastTxid.set(result.txid);
      workflowStatus.set(ctx.t("withdrawSubmitted"));
      await loadData();
      return result;
      });
    });

    ctx.framework.actions.register("claimRewards", async (...args: unknown[]) => {
      return runWrite(async () => {
      const form = (args[0] ?? {}) as Record<string, unknown>;
      const target = targetAnchorId(form.anchorAppId || anchorAppId.get());
      const user = await ctx.framework.chain.ensureWallet();
      workflowStatus.set(ctx.t("claimSubmitting"));
      const result = await ctx.framework.chain.invoke("claimRewards", [
        ctx.framework.chain.arg.string(target),
        ctx.framework.chain.arg.hash160(user),
      ], anchorOptions({ waitForEvent: "AnchorRewardsClaimed" }));
      anchorAppId.set(target);
      lastTxid.set(result.txid);
      workflowStatus.set(ctx.t("claimSubmitted"));
      await loadData();
      return result;
      });
    });

    ctx.framework.actions.register("refreshAnchor", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as Record<string, unknown>;
      const target = String(form.anchorAppId || anchorAppId.get() || "").trim();
      if (target) anchorAppId.set(targetAnchorId(target));
      workflowStatus.set(ctx.t("refreshingStatus"));
      await loadData();
    });

    // Register a NEW custom anchor AND provision its 21 AA agents so it earns
    // immediately. The host detail page does this atomically via the wallet's
    // invokeMultiple; the standalone chain service has no batch invoke, so we
    // submit the calls as SEQUENTIAL transactions. This 4-step BUSINESS
    // sequencing stays app-side by design (framework-extraction plan Wave 4);
    // each step runs on the framework invoke surface (which never toasts —
    // this flow owns its own workflowStatus copy), and the un-evented steps
    // are gated by app.chain.waitForState confirmation polls:
    //   1. deposit the 1-GAS registration-fee credit (OnNEP17Payment, no event)
    //   2. registerCustomAnchorApp(appId, mode, appAdmin)   — mint the anchor
    //   3. aaCore.registerAccounts(...)                     — register AA agents
    //   4. anchor.registerAgents(appId, accounts, candidates, scriptHashes)
    // Without steps 3-4 the anchor is born at agentCount = 0 (inert): staked
    // NEO neither votes nor earns. The appAdmin witness is the connected wallet.
    ctx.framework.actions.register("register", async (...args: unknown[]) => {
      return runWrite(async () => {
      const form = (args[0] ?? {}) as Record<string, unknown>;
      const target = strictAnchorId(form.anchorAppId);
      const contract = getMiniAppContractHash(appId);
      if (!contract) throw new Error("PlatformAnchor contract is not configured.");
      const user = await ctx.framework.chain.ensureWallet();
      const mode = stackNumber(form.mode) === 2 ? 2 : MODE_TRUST;
      // Exactly 21 valid compressed council candidate public keys (duplicates
      // allowed — RegisterAgents accepts repeats; mirrors the deploy default).
      const candidateKeys = parseAnchorCandidateKeys(
        Array.isArray(form.candidates)
          ? (form.candidates as unknown[]).map((key) => String(key)).join("\n")
          : String(form.candidates ?? ""),
      );

      // Source the AA core contract for the wallet's active network so the
      // agent accounts register against the right deployment. (An earlier
      // comment here claimed detectNetwork had no framework surface — stale:
      // app.chain.detectNetwork exists and falls back to the launch-context
      // network on hosts without the capability.)
      const network = resolveNeoNetwork(await ctx.framework.chain.detectNetwork());
      const aaCoreHash = EXTERNAL_INTEGRATIONS[network].contracts.aaCore;
      if (!/^0x[0-9a-fA-F]{40}$/.test(aaCoreHash)) {
        throw new Error("AA core contract is not configured for this network.");
      }

      // Build the provisioning plan up front so a bad input fails before any
      // money/credit is spent. The derived agent accounts + invocation args are
      // byte-identical to the host detail page.
      const plan = buildAnchorRegistrationInvocations({
        appId: target,
        mode,
        ownerAddress: user,
        candidateKeys,
      });
      const registerAccountsCall = plan.invocations.find((i) => i.operation === "registerAccounts");
      const registerAgentsCall = plan.invocations.find((i) => i.operation === "registerAgents");
      if (!registerAccountsCall || !registerAgentsCall) {
        throw new Error("Failed to build anchor agent provisioning plan.");
      }

      // Reject re-registering an already-registered anchor before spending the fee.
      const existing = stackNumber(
        await ctx.framework.chain.readRaw("getAppMode", [ctx.framework.chain.arg.string(target)], anchorOptions()),
      );
      if (existing > 0) throw new Error(ctx.t("anchorAlreadyRegistered"));

      workflowStatus.set(ctx.t("registerSubmitting"));
      // Step 1: top up the 1-GAS prepaid credit (only if the wallet lacks it).
      // The contract credits the deposit in OnNEP17Payment but emits no event,
      // so poll the wallet's on-contract GAS credit — the exact precondition
      // the register call consumes — until it covers the fee. On timeout the
      // flow proceeds exactly like the retired N3Index wait did: a premature
      // register call faults, and the credited deposit stays reclaimable via
      // the stranded-credit recovery lane (recoverCredit).
      const haveGas = parseBigInt(gasCreditRaw.get());
      if (haveGas < BigInt(REGISTRATION_FEE_BASE)) {
        await ctx.framework.chain.invoke("transfer", [
          ctx.framework.chain.arg.hash160(user),
          ctx.framework.chain.arg.hash160(contract),
          ctx.framework.chain.arg.integer(REGISTRATION_FEE_BASE),
          ctx.framework.chain.arg.string(""),
        ], {
          scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
        });
        await ctx.framework.chain.waitForState(
          async () => parseBigInt(await ctx.framework.chain.readRaw("getCredit", [
            ctx.framework.chain.arg.hash160(user),
            ctx.framework.chain.arg.string("GAS"),
          ], anchorOptions())),
          (credit) => credit >= BigInt(REGISTRATION_FEE_BASE),
        );
      }
      // Step 2: register the anchor app, consuming the prepaid credit.
      const result = await ctx.framework.chain.invoke("registerCustomAnchorApp", [
        ctx.framework.chain.arg.string(target),
        ctx.framework.chain.arg.integer(mode),
        ctx.framework.chain.arg.hash160(user),
      ], anchorOptions({ waitForEvent: "AnchorAppRegistered" }));
      anchorAppId.set(target);
      lastTxid.set(result.txid);

      // Step 3: register the 21 AA agent accounts with the AA core. No anchor
      // event fires here, so poll the AA core until the first derived agent
      // account exists (its backup owner reads non-zero) — the precondition
      // step 4 needs before binding agents. On timeout the flow proceeds like
      // the retired N3Index tx wait did and step 4 surfaces any fault.
      workflowStatus.set(ctx.t("registerProvisioningAccounts"));
      const accountsTx = await ctx.framework.chain.invoke(
        registerAccountsCall.operation,
        toChainArgs(registerAccountsCall.args),
        { scriptHash: aaCoreHash },
      );
      lastTxid.set(accountsTx.txid);
      const firstAgentId = plan.agents[0]?.accountId ?? "";
      await ctx.framework.chain.waitForState(
        () => ctx.framework.chain.readRaw("getBackupOwner", [
          ctx.framework.chain.arg.hash160(firstAgentId),
        ], { scriptHash: aaCoreHash }),
        (owner) => {
          const hash = parseHash160(owner);
          return Boolean(hash) && !/^0x0{40}$/i.test(hash);
        },
      );

      // Step 4: bind the 21 agents (account, candidate, script hash) to the
      // anchor. AnchorAgentRegistered fires per agent — wait on it so the
      // post-write refresh reads the settled agentCount.
      workflowStatus.set(ctx.t("registerProvisioningAgents"));
      const agentsTx = await ctx.framework.chain.invoke(
        registerAgentsCall.operation,
        toChainArgs(registerAgentsCall.args),
        anchorOptions({ waitForEvent: "AnchorAgentRegistered" }),
      );
      lastTxid.set(agentsTx.txid);

      workflowStatus.set(ctx.t("registerSubmitted"));
      await loadData();
      await loadDiscovered();
      return agentsTx;
      });
    });

    // Reclaim stranded contract credit (NEO or GAS) via withdrawCredit.
    ctx.framework.actions.register("recoverCredit", async (...args: unknown[]) => {
      return runWrite(async () => {
      const asset = String((args[0] ?? "") as string) === "NEO" ? "NEO" : "GAS";
      const user = await ctx.framework.chain.ensureWallet();
      const raw = asset === "NEO" ? parseBigInt(neoCreditRaw.get()) : parseBigInt(gasCreditRaw.get());
      if (raw <= 0n) throw new Error(ctx.t("noCreditToRecover"));
      workflowStatus.set(ctx.t("recoverSubmitting"));
      // withdrawCredit transfers the asset back but emits no contract event, so
      // there is nothing app-scoped to wait on; the post-call loadCredits read
      // reflects the new (zeroed) balance.
      const result = await ctx.framework.chain.invoke("withdrawCredit", [
        ctx.framework.chain.arg.hash160(user),
        ctx.framework.chain.arg.string(asset),
        ctx.framework.chain.arg.integer(raw),
      ], anchorOptions());
      lastTxid.set(result.txid);
      workflowStatus.set(ctx.t("recoverSubmitted"));
      await loadCredits();
      return result;
      });
    });

    ctx.framework.actions.register("discoverAnchors", async () => {
      await loadDiscovered();
    });

    ctx.framework.actions.register("selectAnchor", async (...args: unknown[]) => {
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
        submitting,
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
