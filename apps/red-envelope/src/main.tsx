/**
 * Red Envelope — React Entry Point
 */

import { defineMiniApp, createObservable, createDerived } from "@shared/react/defineMiniApp";
import PhaserPlayArea from "./PhaserPlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useRedEnvelope } from "./composables/useRedEnvelope";
import { createGuestEngine, type GuestBoardRow } from "./logic/guest-engine";

defineMiniApp({
  appId: "miniapp-redenvelope",
  playArea: PhaserPlayArea,
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
    const app = ctx.framework;
    const envelope = useRedEnvelope({
      app,
      t: ctx.t,
    });

    envelope.setAddress(app.chain.address.get() ?? null);

    // ── Guest (free / local) mode ─────────────────────────────────────────────
    // GUEST reuses the SAME dispatch actions + scene observables, driven by a
    // purely local packet engine — no chain/oracle/reward calls. `appMode` is
    // surfaced to the PlayArea so its copy branches to local framing; the guest
    // stat observables feed the local score panel + off-chain board.
    const appMode = createObservable<string>(app.mode.get());
    const guestBest = createObservable(0);
    const guestTotal = createObservable(0);
    const guestOpened = createObservable(0);
    const guestBoard = createObservable<GuestBoardRow[]>([]);

    const guest = createGuestEngine({
      envelopes: envelope.envelopes,
      pools: envelope.pools,
      claims: envelope.claims,
      isLoading: envelope.isLoading,
      luckyMessage: envelope.luckyMessage,
      openingId: envelope.openingId,
      prepaidCredit: envelope.prepaidCredit,
      lastCreatedEnvelopeId: envelope.lastCreatedEnvelopeId,
      guestBest,
      guestTotal,
      guestOpened,
      guestBoard,
      guestLeaderboard: app.mode.guestLeaderboard,
      t: ctx.t,
      setStatus: ctx.setStatus,
    });
    // Switching to guest at the launcher resets to a clean local lobby and loads
    // the off-chain guest board (replacing the on-chain read done on mount).
    app.mode.onChange((mode) => {
      appMode.set(mode);
      if (mode === "guest") void guest.enter();
    });

    ctx.framework.actions.register("createEnvelope", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as {
        amount?: string;
        count?: string;
        expiryHours?: string;
        memo?: string;
      };
      if (app.mode.isGuest()) {
        guest.createEnvelope({
          amount: String(form.amount ?? ""),
          count: String(form.count ?? "1"),
          expiryHours: String(form.expiryHours ?? "24"),
        });
        return;
      }
      await ctx.framework.notify.guard(
        () =>
          envelope.create({
            amount: String(form.amount ?? ""),
            count: String(form.count ?? "1"),
            expiryHours: String(form.expiryHours ?? "24"),
          }),
        { successKey: "envelopeCreated" },
      );
    });

    ctx.framework.actions.register("claimEnvelope", async (...args: unknown[]) => {
      const first = args[0];
      const form = (first && typeof first === "object") ? (first as Record<string, unknown>) : null;
      const id = String(form?.envelopeId ?? form?.poolId ?? first ?? "");
      if (app.mode.isGuest()) { guest.claimEnvelope(id); return; }
      if (!id.trim()) throw new Error(ctx.t("envelopeIdRequired"));
      await ctx.framework.notify.guard(
        () => envelope.handleClaimFromPool(id),
        { successKey: "envelopeClaimed" },
      );
    });

    ctx.framework.actions.register("reclaimEnvelope", async (...args: unknown[]) => {
      const first = args[0];
      const form = (first && typeof first === "object") ? (first as Record<string, unknown>) : null;
      const id = String(form?.envelopeId ?? form?.poolId ?? first ?? "");
      if (app.mode.isGuest()) { guest.reclaimEnvelope(id); return; }
      if (!id.trim()) throw new Error(ctx.t("envelopeIdRequired"));
      await ctx.framework.notify.guard(async () => {
        const { amount } = await envelope.reclaimEnvelope(id);
        if (amount > 0) {
          ctx.framework.notify.success("reclaimSuccess", {
            amount: Number(amount.toFixed(4)),
            tokenGas: ctx.t("tokenGas"),
          });
        }
      });
    });

    ctx.framework.actions.register("withdrawCredit", async () => {
      if (app.mode.isGuest()) { guest.withdrawCredit(); return; }
      await ctx.framework.notify.guard(async () => {
        const { amount } = await envelope.withdrawCredit();
        if (amount > 0) {
          ctx.framework.notify.success("creditWithdrawn", {
            amount: Number(amount.toFixed(4)),
            tokenGas: ctx.t("tokenGas"),
          });
        }
      });
    });

    ctx.framework.actions.register("dismissOverlay", async () => {
      envelope.luckyMessage.set(null);
    });

    // Copy a OneGate-claimable deep link for the freshly created envelope —
    // the distribution step the product is named for. The recipient opens the
    // link and the envelope id prefills their claim field (see PlayArea launch
    // params: envelopeId/poolId/id/packet).
    ctx.framework.actions.register("shareEnvelope", async (...args: unknown[]) => {
      const first = args[0];
      const form = first && typeof first === "object" ? (first as Record<string, unknown>) : null;
      const id = String(form?.envelopeId ?? first ?? envelope.lastCreatedEnvelopeId.get() ?? "").trim();
      if (app.mode.isGuest()) { guest.shareEnvelope(id); return; }
      if (!id) return;
      const deeplink = `neomainapp://red-envelope?envelopeId=${id}`;
      await ctx.services.clipboard.copy(deeplink, "shareLinkCopied");
    });

    ctx.framework.actions.register("dismissShare", async () => {
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
        appMode,
        guestBest,
        guestTotal,
        guestOpened,
        guestBoard,
      },
      // loadData runs on mount (default "gamefi") and again on a guest switch. In
      // guest we skip every on-chain read and (re)initialize the local lobby so a
      // mount-time gamefi read never overwrites the guest surface.
      loadData: hasLaunchEnvelopeId
        ? async () => {
            if (app.mode.isGuest()) { await guest.enter(); return; }
            envelope.setAddress(app.chain.address.get() ?? null);
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
            if (app.mode.isGuest()) { await guest.enter(); return; }
            envelope.setAddress(app.chain.address.get() ?? null);
            await envelope.loadAll();
          },
    };
  },
});
