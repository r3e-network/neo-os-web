/**
 * Red Envelope — React Entry Point
 */

import { defineMiniApp, createObservable, createDerived } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useRedEnvelope } from "./composables/useRedEnvelope";

defineMiniApp({
  appId: "miniapp-redenvelope",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const launchParams = ctx.launchContext.params ?? {};
    const hasLaunchEnvelopeId = Boolean(
      launchParams.envelopeId ||
        launchParams.poolId ||
        launchParams.id ||
        launchParams.packet,
    );
    const envelope = useRedEnvelope({
      chain: ctx.services.chain,
      t: ctx.t,
    });

    envelope.setAddress(ctx.services.chain.address.get() ?? null);

    ctx.registerAction("createEnvelope", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as {
        amount?: string;
        count?: string;
        expiryHours?: string;
        memo?: string;
      };
      await ctx.services.notify.guard(
        () =>
          envelope.create({
            amount: String(form.amount ?? ""),
            count: String(form.count ?? "1"),
            expiryHours: String(form.expiryHours ?? "24"),
          }),
        "envelopeCreated",
      );
    });

    ctx.registerAction("claimEnvelope", async (...args: unknown[]) => {
      const first = args[0];
      const form = (first && typeof first === "object") ? (first as Record<string, unknown>) : null;
      const id = String(form?.envelopeId ?? form?.poolId ?? first ?? "");
      if (!id.trim()) throw new Error(ctx.t("envelopeIdRequired"));
      await ctx.services.notify.guard(
        () => envelope.handleClaimFromPool(id),
        "envelopeClaimed",
      );
    });

    ctx.registerAction("reclaimEnvelope", async (...args: unknown[]) => {
      const first = args[0];
      const form = (first && typeof first === "object") ? (first as Record<string, unknown>) : null;
      const id = String(form?.envelopeId ?? form?.poolId ?? first ?? "");
      if (!id.trim()) throw new Error(ctx.t("envelopeIdRequired"));
      await ctx.services.notify.guard(async () => {
        const { amount } = await envelope.reclaimEnvelope(id);
        if (amount > 0) {
          ctx.services.notify.success("reclaimSuccess", {
            amount: Number(amount.toFixed(4)),
            tokenGas: ctx.t("tokenGas"),
          });
        }
      });
    });

    ctx.registerAction("withdrawCredit", async () => {
      await ctx.services.notify.guard(async () => {
        const { amount } = await envelope.withdrawCredit();
        if (amount > 0) {
          ctx.services.notify.success("creditWithdrawn", {
            amount: Number(amount.toFixed(4)),
            tokenGas: ctx.t("tokenGas"),
          });
        }
      });
    });

    ctx.registerAction("dismissOverlay", async () => {
      envelope.luckyMessage.set(null);
    });

    // Copy a OneGate-claimable deep link for the freshly created envelope —
    // the distribution step the product is named for. The recipient opens the
    // link and the envelope id prefills their claim field (see PlayArea launch
    // params: envelopeId/poolId/id/packet).
    ctx.registerAction("shareEnvelope", async (...args: unknown[]) => {
      const first = args[0];
      const form = first && typeof first === "object" ? (first as Record<string, unknown>) : null;
      const id = String(form?.envelopeId ?? first ?? envelope.lastCreatedEnvelopeId.get() ?? "").trim();
      if (!id) return;
      const deeplink = `neomainapp://red-envelope?envelopeId=${id}`;
      await ctx.services.clipboard.copy(deeplink, "shareLinkCopied");
    });

    ctx.registerAction("dismissShare", async () => {
      envelope.lastCreatedEnvelopeId.set("");
    });

    // Synthetic stats (composable doesn't expose totalCreated/totalClaimed yet)
    const totalCreated = createDerived(
      () => envelope.envelopes.get().reduce((sum, e) => sum + (Number(e.totalAmount) || 0), 0),
      [envelope.envelopes],
    );
    const totalClaimed = createDerived(
      () => envelope.claims.get().reduce((sum, c) => sum + (Number((c as unknown as { amount?: number }).amount ?? 0)), 0),
      [envelope.claims],
    );
    const createAmount = createObservable("");
    const createCount = createObservable("");
    const createMemo = createObservable("");

    return {
      state: {
        envelopes: envelope.envelopes,
        claims: envelope.claims,
        pools: envelope.pools,
        isLoading: envelope.isLoading,
        // composable folds isCreating into isLoading
        isCreating: envelope.isLoading,
        luckyMessage: envelope.luckyMessage,
        openingId: envelope.openingId,
        envelopeCount: envelope.envelopeCount,
        claimCount: envelope.claimCount,
        poolCount: envelope.poolCount,
        prepaidCredit: envelope.prepaidCredit,
        lastCreatedEnvelopeId: envelope.lastCreatedEnvelopeId,
        totalCreated,
        totalClaimed,
        createAmount,
        createCount,
        createMemo,
      },
      loadData: hasLaunchEnvelopeId
        ? async () => {
            envelope.setAddress(ctx.services.chain.address.get() ?? null);
            // Deep-link / QR claim: hydrate the launched envelope so the recipient
            // sees its remaining-packets / pool-progress preview before claiming,
            // rather than landing on an empty list (it is not their own envelope,
            // so the paged loadEnvelopes would not surface it).
            const launchId = String(
              launchParams.envelopeId ??
                launchParams.poolId ??
                launchParams.id ??
                launchParams.packet ??
                "",
            );
            await envelope.hydrateEnvelope(launchId);
          }
        : async () => {
            envelope.setAddress(ctx.services.chain.address.get() ?? null);
            await envelope.loadAll();
          },
    };
  },
});
