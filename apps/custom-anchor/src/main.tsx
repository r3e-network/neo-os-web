import { defineMiniApp, createObservable } from "@shared/react/defineMiniApp";
import type { MiniAppSetupContext, MiniAppSetupResult } from "@shared/react/defineMiniApp";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import { getMiniAppContractHash } from "@shared/constants/rpc";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";

const appId = "miniapp-custom-anchor";

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

function targetAnchorId(value: unknown): string {
  const anchorAppId = String(value ?? "").trim();
  if (!/^custom-anchor:[a-z0-9-]{1,24}:[a-z0-9-]{1,24}$/.test(anchorAppId)) {
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
    const lastTxid = createObservable("");
    const workflowStatus = createObservable(ctx.t("workflowReady"));
    const lastError = createObservable("");
    const isLoading = createObservable(false);
    const anchorOptions = <T extends Record<string, unknown>>(options?: T) => {
      const scriptHash = getMiniAppContractHash(appId);
      return { ...(options ?? {}), ...(scriptHash ? { scriptHash } : {}) };
    };

    async function loadData() {
      const target = anchorAppId.get();
      if (!target) return;
      lastError.set("");
      isLoading.set(true);
      try {
        const [total, reserve, agents] = await Promise.all([
          ctx.services.chain.read("getTotalStaked", [{ type: "String", value: target }], anchorOptions({ cache: true, cacheTtlMs: 15_000 })),
          ctx.services.chain.read("getRewardReserve", [{ type: "String", value: target }], anchorOptions({ cache: true, cacheTtlMs: 15_000 })),
          ctx.services.chain.read("getAgentCount", [{ type: "String", value: target }], anchorOptions({ cache: true, cacheTtlMs: 15_000 })),
        ]);
        totalStaked.set(fromFixed8(total));
        rewardReserve.set(fromFixed8(reserve));
        agentCount.set(stackNumber(agents));

        const address = ctx.services.chain.address.get();
        if (address) {
          const [stake, rewards] = await Promise.all([
            ctx.services.chain.read("getUserStake", [
              { type: "String", value: target },
              { type: "Hash160", value: address },
            ], anchorOptions({ cache: true, cacheTtlMs: 15_000 })),
            ctx.services.chain.read("getPendingRewards", [
              { type: "String", value: target },
              { type: "Hash160", value: address },
            ], anchorOptions({ cache: true, cacheTtlMs: 15_000 })),
          ]);
          userStake.set(fromFixed8(stake));
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
        waitForEvent: "AnchorStakeChanged",
        waitTimeoutMs: 1_500,
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
      ], anchorOptions({ waitForEvent: "AnchorStakeChanged", waitTimeoutMs: 1_500 }));
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
      ], anchorOptions({ waitForEvent: "AnchorRewardsClaimed", waitTimeoutMs: 1_500 }));
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

    return {
      state: {
        anchorAppId,
        totalStaked,
        rewardReserve,
        userStake,
        pendingRewards,
        agentCount,
        lastTxid,
        workflowStatus,
        lastError,
        isLoading,
      },
      loadData,
    };
  },
});
