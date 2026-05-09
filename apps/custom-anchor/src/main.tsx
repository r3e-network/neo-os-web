import { defineMiniApp, createObservable } from "@shared/react/defineMiniApp";
import type { MiniAppSetupContext, MiniAppSetupResult } from "@shared/react/defineMiniApp";
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

function fixed8(value: unknown): string {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Enter a positive NEO amount.");
  }
  return String(Math.round(amount * 100_000_000));
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
    const isLoading = createObservable(false);

    async function loadData() {
      const target = anchorAppId.get();
      if (!target) return;
      isLoading.set(true);
      try {
        const [total, reserve, agents] = await Promise.all([
          ctx.services.chain.read("getTotalStaked", [{ type: "String", value: target }], { cache: true, cacheTtlMs: 15_000 }),
          ctx.services.chain.read("getRewardReserve", [{ type: "String", value: target }], { cache: true, cacheTtlMs: 15_000 }),
          ctx.services.chain.read("getAgentCount", [{ type: "String", value: target }], { cache: true, cacheTtlMs: 15_000 }),
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
            ], { cache: true, cacheTtlMs: 15_000 }),
            ctx.services.chain.read("getPendingRewards", [
              { type: "String", value: target },
              { type: "Hash160", value: address },
            ], { cache: true, cacheTtlMs: 15_000 }),
          ]);
          userStake.set(fromFixed8(stake));
          pendingRewards.set(fromFixed8(rewards));
        }
      } finally {
        isLoading.set(false);
      }
    }

    ctx.registerAction("stake", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as Record<string, unknown>;
      const target = targetAnchorId(form.anchorAppId || anchorAppId.get());
      const user = await ctx.services.chain.ensureWallet();
      const result = await ctx.services.chain.invoke("stake", [
        { type: "String", value: target },
        { type: "Hash160", value: user },
        { type: "Integer", value: fixed8(form.amount) },
      ], { waitForEvent: "AnchorStakeChanged" });
      anchorAppId.set(target);
      lastTxid.set(result.txid);
      await loadData();
    });

    ctx.registerAction("withdraw", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as Record<string, unknown>;
      const target = targetAnchorId(form.anchorAppId || anchorAppId.get());
      const user = await ctx.services.chain.ensureWallet();
      const result = await ctx.services.chain.invoke("withdraw", [
        { type: "String", value: target },
        { type: "Hash160", value: user },
        { type: "Integer", value: fixed8(form.amount) },
      ], { waitForEvent: "AnchorStakeChanged" });
      anchorAppId.set(target);
      lastTxid.set(result.txid);
      await loadData();
    });

    ctx.registerAction("claimRewards", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as Record<string, unknown>;
      const target = targetAnchorId(form.anchorAppId || anchorAppId.get());
      const user = await ctx.services.chain.ensureWallet();
      const result = await ctx.services.chain.invoke("claimRewards", [
        { type: "String", value: target },
        { type: "Hash160", value: user },
      ], { waitForEvent: "AnchorRewardsClaimed" });
      anchorAppId.set(target);
      lastTxid.set(result.txid);
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
        isLoading,
      },
      loadData,
    };
  },
});
