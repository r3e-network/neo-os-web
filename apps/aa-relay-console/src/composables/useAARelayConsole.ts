/**
 * useAARelayConsole -- Domain logic for AA Relay Console
 *
 * Uses createObservable instead of Vue ref/computed.
 * Called once during setup, returns observables that React components subscribe to.
 *
 * All account-abstraction traffic goes through the framework surface
 * (app.aa.sponsorship.check/request + app.aa.relay); the busy flags are
 * tracked locally around each call so the PlayArea spinners behave exactly
 * as they did against the raw AAService observables.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import type {
  FrameworkAaSponsorshipStatus,
  FrameworkAaSponsorshipResult,
  FrameworkAaRelayResult,
} from "@framework/aa";
import {
  getExternalIntegrationConfig,
  getNetwork,
} from "@shared/constants/rpc";
import { getDefaultRelayPayload } from "../launch";

export interface UseAARelayConsoleOptions {
  app: MiniAppFramework;
  t: (key: string, params?: Record<string, string | number>) => string;
}

type SponsorResult =
  | FrameworkAaSponsorshipStatus
  | FrameworkAaSponsorshipResult
  | FrameworkAaRelayResult
  | null;

export function useAARelayConsole({ app, t }: UseAARelayConsoleOptions) {
  const network = getNetwork();
  const integration = getExternalIntegrationConfig(network);

  const aaAddress = createObservable("");
  const dappId = createObservable("");
  const sponsorAmount = createObservable("0.1");
  const payloadJson = createObservable(getDefaultRelayPayload(network));
  const sponsorResult = createObservable<SponsorResult>(null);
  const lastRelayResult = createObservable<FrameworkAaRelayResult | null>(null);

  // Busy flags for the PlayArea spinners. The sponsorship lane shares one flag
  // for check AND request (the retired AAService used a single observable for
  // both), the relay lane has its own.
  const isCheckingSponsorship = createObservable(false);
  const isRelaying = createObservable(false);

  // Display values
  const aaAddressDisplay: Observable<string> = {
    get: () => aaAddress.get() || t("notAvailable"),
    set: () => {},
    subscribe: (fn) => aaAddress.subscribe(fn),
  };

  const paymasterDisplay: Observable<string> = {
    get: () => dappId.get() || t("unset"),
    set: () => {},
    subscribe: (fn) => dappId.subscribe(fn),
  };

  const sponsorState: Observable<string> = {
    get: () => JSON.stringify(sponsorResult.get() ?? {}, null, 2),
    set: () => {},
    subscribe: (fn) => sponsorResult.subscribe(fn),
  };

  const relayResponse: Observable<string> = {
    get: () => JSON.stringify(lastRelayResult.get() ?? {}, null, 2),
    set: () => {},
    subscribe: (fn) => lastRelayResult.subscribe(fn),
  };

  const aaCoreDisplay: Observable<string> = {
    get: () => integration.contracts.aaCore,
    set: () => {},
    subscribe: () => () => {},
  };

  const relayUrlDisplay: Observable<string> = {
    get: () => "/api/aa/relay",
    set: () => {},
    subscribe: () => () => {},
  };

  const networkDisplay: Observable<string> = {
    get: () => network,
    set: () => {},
    subscribe: () => () => {},
  };

  // Actions
  function sponsorScope() {
    return {
      aaAddress: aaAddress.get(),
      dappId: dappId.get(),
    };
  }

  async function checkSponsor() {
    isCheckingSponsorship.set(true);
    try {
      // Clear any prior relay result so the inline card reflects this fresh
      // sponsor action instead of a stale relay payload (relay takes precedence).
      lastRelayResult.set(null);
      sponsorResult.set(await app.aa.sponsorship.check(sponsorScope()));
    } finally {
      isCheckingSponsorship.set(false);
    }
  }

  async function requestSponsor() {
    isCheckingSponsorship.set(true);
    try {
      // Clear any prior relay result so the inline card reflects this fresh
      // sponsor action instead of a stale relay payload (relay takes precedence).
      lastRelayResult.set(null);
      sponsorResult.set(
        await app.aa.sponsorship.request(sponsorAmount.get() || "0.1", sponsorScope()),
      );
    } finally {
      isCheckingSponsorship.set(false);
    }
  }

  async function submitRelay() {
    const payload = JSON.parse(payloadJson.get());
    isRelaying.set(true);
    try {
      const scopedPayload = {
        aaAddress: aaAddress.get(),
        ...payload,
        ...(dappId.get() && !payload.paymaster
          ? { paymaster: { dapp_id: dappId.get(), network } }
          : {}),
      };
      const result = await app.aa.relay(scopedPayload);
      lastRelayResult.set(result);
      sponsorResult.set(result);
    } finally {
      isRelaying.set(false);
    }
  }

  const loadAll = async () => {};

  return {
    aaAddress,
    dappId,
    sponsorAmount,
    payloadJson,
    aaAddressDisplay,
    paymasterDisplay,
    sponsorState,
    relayResponse,
    aaCoreDisplay,
    relayUrlDisplay,
    networkDisplay,
    isCheckingSponsorship,
    isRelaying,
    checkSponsor,
    requestSponsor,
    submitRelay,
    loadAll,
  };
}

export type UseAARelayConsoleReturn = ReturnType<typeof useAARelayConsole>;
