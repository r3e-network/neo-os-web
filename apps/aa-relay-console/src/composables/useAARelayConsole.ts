/**
 * useAARelayConsole -- Domain logic for AA Relay Console
 *
 * Uses createObservable instead of Vue ref/computed.
 * Called once during setup, returns observables that React components subscribe to.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { AAService, EventBus } from "@shared/services";
import type {
  SponsorshipStatus,
  SponsorshipResult,
  RelayResult,
} from "@shared/services";
import {
  getExternalIntegrationConfig,
  getNetwork,
} from "@shared/constants/rpc";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { getDefaultRelayPayload } from "../launch";

export interface UseAARelayConsoleOptions {
  aa: AAService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

type SponsorResult = SponsorshipStatus | SponsorshipResult | RelayResult | null;

export function useAARelayConsole({
  aa,
  eventBus,
  t,
}: UseAARelayConsoleOptions) {
  const network = getNetwork();
  const integration = getExternalIntegrationConfig(network);

  const aaAddress = createObservable("");
  const dappId = createObservable("");
  const sponsorAmount = createObservable("0.1");
  const payloadJson = createObservable(getDefaultRelayPayload(network));
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
    get: () => network,
    set: () => {},
    subscribe: () => () => {},
  };

  const isCheckingSponsorship: Observable<boolean> = {
    get: () => aa.isCheckingSponsorship.get(),
    set: () => {},
    subscribe: (fn) => aa.isCheckingSponsorship.subscribe(fn),
  };

  const isRelaying: Observable<boolean> = {
    get: () => aa.isRelaying.get(),
    set: () => {},
    subscribe: (fn) => aa.isRelaying.subscribe(fn),
  };

  // Actions
  function sponsorScope() {
    return {
      aaAddress: aaAddress.get(),
      dappId: dappId.get(),
    };
  }

  async function checkSponsor() {
    try {
      // Clear any prior relay result so the inline card reflects this fresh
      // sponsor action instead of a stale relay payload (relay takes precedence).
      lastRelayResult.set(null);
      aa.setAddress(aaAddress.get() || null);
      sponsorResult.set(await aa.checkSponsorship(sponsorScope()));
      eventBus.emit("sponsor:checked", sponsorScope());
    } catch (e) {
      eventBus.emit("sponsor:error", {
        message: formatErrorMessage(e, t("sponsorCheckError")),
      });
      throw e;
    }
  }

  async function requestSponsor() {
    try {
      // Clear any prior relay result so the inline card reflects this fresh
      // sponsor action instead of a stale relay payload (relay takes precedence).
      lastRelayResult.set(null);
      aa.setAddress(aaAddress.get() || null);
      sponsorResult.set(
        await aa.requestSponsorship(sponsorAmount.get() || "0.1", sponsorScope()),
      );
      eventBus.emit("sponsor:requested", {
        ...sponsorScope(),
        amount: sponsorAmount.get() || "0.1",
      });
    } catch (e) {
      eventBus.emit("sponsor:error", {
        message: formatErrorMessage(e, t("sponsorRequestError")),
      });
      throw e;
    }
  }

  async function submitRelay() {
    try {
      const payload = JSON.parse(payloadJson.get());
      aa.setAddress(aaAddress.get() || null);
      const scopedPayload = {
        aaAddress: aaAddress.get(),
        ...payload,
        ...(dappId.get() && !payload.paymaster
          ? { paymaster: { dapp_id: dappId.get(), network } }
          : {}),
      };
      const result = await aa.submitRelay(scopedPayload);
      lastRelayResult.set(result);
      sponsorResult.set(result);
      eventBus.emit("relay:submitted", {});
    } catch (e) {
      eventBus.emit("relay:error", {
        message: formatErrorMessage(e, t("relayError")),
      });
      throw e;
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
