/**
 * useAARelayConsole -- Domain logic for AA Relay Console
 *
 * Uses createObservable instead of Vue ref/computed.
 * Called once during setup, returns observables that React components subscribe to.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { AAService, EventBus } from "@shared/services";
import type { SponsorshipStatus, RelayResult } from "@shared/services";
import { getExternalIntegrationConfig } from "@shared/constants/rpc";
import { formatErrorMessage } from "@shared/utils/errorHandling";

export interface UseAARelayConsoleOptions {
  aa: AAService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

type SponsorResult = SponsorshipStatus | RelayResult | null;

export function useAARelayConsole({ aa, eventBus, t }: UseAARelayConsoleOptions) {
  const integration = getExternalIntegrationConfig("testnet");

  const aaAddress = createObservable("");
  const dappId = createObservable("");
  const payloadJson = createObservable('{\n  "metaInvocation": {\n    "scriptHash": "0xe24d2980d17d2580ff4ee8dc5dddaa20e3caec38"\n  }\n}');
  const sponsorResult = createObservable<SponsorResult>(null);
  const lastRelayResult = createObservable<RelayResult | null>(null);

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
    get: () => "testnet",
    set: () => {},
    subscribe: () => () => {},
  };

  const isCheckingSponsorship: Observable<boolean> = {
    get: () => aa.isCheckingSponsorship,
    set: () => {},
    subscribe: () => () => {},
  };

  const isRelaying: Observable<boolean> = {
    get: () => aa.isRelaying,
    set: () => {},
    subscribe: () => () => {},
  };

  // Actions
  async function checkSponsor() {
    try {
      sponsorResult.set(await aa.checkSponsorship());
      eventBus.emit("sponsor:checked", {});
    } catch (e) {
      eventBus.emit("sponsor:error", { message: formatErrorMessage(e, t("sponsorCheckError")) });
      throw e;
    }
  }

  async function requestSponsor() {
    try {
      sponsorResult.set(await aa.requestSponsorship("0.1"));
      eventBus.emit("sponsor:requested", {});
    } catch (e) {
      eventBus.emit("sponsor:error", { message: formatErrorMessage(e, t("sponsorRequestError")) });
      throw e;
    }
  }

  async function submitRelay() {
    try {
      const payload = JSON.parse(payloadJson.get());
      aa.setAddress(aaAddress.get() || null);
      const result = await aa.submitRelay(payload);
      lastRelayResult.set(result);
      sponsorResult.set(result);
      eventBus.emit("relay:submitted", {});
    } catch (e) {
      eventBus.emit("relay:error", { message: formatErrorMessage(e, t("relayError")) });
      throw e;
    }
  }

  const loadAll = async () => {};

  return {
    aaAddress,
    dappId,
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
