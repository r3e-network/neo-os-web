/**
 * useAARelayConsole — Domain logic for AA Relay Console
 *
 * Encapsulates AA relay, sponsorship check, and sponsorship request logic.
 * Receives AAService + EventBus from PlatformServices instead of
 * using useAbstractAccount directly.
 */

import { ref, computed } from "vue";
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

  const aaAddress = ref("");
  const dappId = ref("");
  const payloadJson = ref("{\n  \"metaInvocation\": {\n    \"scriptHash\": \"0xe24d2980d17d2580ff4ee8dc5dddaa20e3caec38\"\n  }\n}");
  const sponsorResult = ref<SponsorResult>(null);
  const lastRelayResult = ref<RelayResult | null>(null);

  // -- Display values --
  const aaAddressDisplay = computed(() => aaAddress.value || t("notAvailable"));
  const paymasterDisplay = computed(() => dappId.value || t("unset"));
  const sponsorState = computed(() => JSON.stringify(sponsorResult.value ?? {}, null, 2));
  const relayResponse = computed(() => JSON.stringify(lastRelayResult.value ?? {}, null, 2));
  const aaCoreDisplay = computed(() => integration.contracts.aaCore);
  const relayUrlDisplay = computed(() => "/api/aa/relay");
  const networkDisplay = computed(() => "testnet");

  // -- Actions --
  async function checkSponsor() {
    try {
      sponsorResult.value = await aa.checkSponsorship();
      eventBus.emit("sponsor:checked", {});
    } catch (e) {
      eventBus.emit("sponsor:error", { message: formatErrorMessage(e, t("sponsorCheckError")) });
      throw e;
    }
  }

  async function requestSponsor() {
    try {
      sponsorResult.value = await aa.requestSponsorship("0.1");
      eventBus.emit("sponsor:requested", {});
    } catch (e) {
      eventBus.emit("sponsor:error", { message: formatErrorMessage(e, t("sponsorRequestError")) });
      throw e;
    }
  }

  async function submitRelay() {
    try {
      const payload = JSON.parse(payloadJson.value);
      aa.setAddress(aaAddress.value || null);
      const result = await aa.submitRelay(payload);
      lastRelayResult.value = result;
      sponsorResult.value = result;
      eventBus.emit("relay:submitted", {});
    } catch (e) {
      eventBus.emit("relay:error", { message: formatErrorMessage(e, t("relayError")) });
      throw e;
    }
  }

  const loadAll = async () => {
    // No initial data to load — relay is user-triggered
  };

  return {
    // -- Form state --
    aaAddress,
    dappId,
    payloadJson,

    // -- Display values --
    aaAddressDisplay,
    paymasterDisplay,
    sponsorState,
    relayResponse,
    aaCoreDisplay,
    relayUrlDisplay,
    networkDisplay,
    isCheckingSponsorship: aa.isCheckingSponsorship,
    isRelaying: aa.isRelaying,

    // -- Actions --
    checkSponsor,
    requestSponsor,
    submitRelay,
    loadAll,
  };
}

export type UseAARelayConsoleReturn = ReturnType<typeof useAARelayConsole>;
