/**
 * useAARelayConsole — Domain logic for AA Relay Console
 *
 * Encapsulates AA relay, sponsorship check, and sponsorship request logic.
 * Receives ChainService + EventBus from PlatformServices.
 */

import { ref, computed, watch } from "vue";
import type { ChainService, EventBus } from "@shared/services";
import { useAbstractAccount } from "@shared/composables/useAbstractAccount";
import type { GasSponsorCheckResponse, GasSponsorRequestResponse, AARelayResponse } from "@shared/composables/useAbstractAccount";
import { formatErrorMessage } from "@shared/utils/errorHandling";

export interface UseAARelayConsoleOptions {
  chain: ChainService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

type SponsorResult = GasSponsorCheckResponse | GasSponsorRequestResponse | AARelayResponse | null;

export function useAARelayConsole({ chain, eventBus, t }: UseAARelayConsoleOptions) {
  const aaAddress = ref("");
  const dappId = ref("");
  const payloadJson = ref("{\n  \"metaInvocation\": {\n    \"scriptHash\": \"0xe24d2980d17d2580ff4ee8dc5dddaa20e3caec38\"\n  }\n}");
  const sponsorResult = ref<SponsorResult>(null);

  const aa = useAbstractAccount({
    network: "testnet",
    aaAddress: aaAddress.value,
    paymasterDappId: dappId.value || undefined,
  });

  const stopAddressWatch = watch(aaAddress, (next) => aa.setAAAddress(next));

  // -- Display values --
  const aaAddressDisplay = computed(() => aaAddress.value || t("notAvailable"));
  const paymasterDisplay = computed(() => dappId.value || t("unset"));
  const sponsorState = computed(() => JSON.stringify(sponsorResult.value ?? {}, null, 2));
  const relayResponse = computed(() => JSON.stringify(aa.lastRelayResponse.value ?? {}, null, 2));
  const aaCoreDisplay = computed(() => aa.AA_MASTER_CONTRACT_TESTNET);
  const relayUrlDisplay = computed(() => aa.relayUrl);
  const networkDisplay = computed(() => aa.network);

  // -- Actions --
  async function checkSponsor() {
    try {
      sponsorResult.value = await aa.checkGasSponsorship();
      eventBus.emit("sponsor:checked", {});
    } catch (e: unknown) {
      eventBus.emit("sponsor:error", { message: formatErrorMessage(e, t("sponsorCheckError")) });
      throw e;
    }
  }

  async function requestSponsor() {
    try {
      sponsorResult.value = await aa.requestGasSponsorship("0.1");
      eventBus.emit("sponsor:requested", {});
    } catch (e: unknown) {
      eventBus.emit("sponsor:error", { message: formatErrorMessage(e, t("sponsorRequestError")) });
      throw e;
    }
  }

  async function submitRelay() {
    try {
      const payload = JSON.parse(payloadJson.value);
      const response = await aa.submitRelayTransaction(payload);
      sponsorResult.value = response;
      eventBus.emit("relay:submitted", {});
    } catch (e: unknown) {
      eventBus.emit("relay:error", { message: formatErrorMessage(e, t("relayError")) });
      throw e;
    }
  }

  const loadAll = async () => {
    // No initial data to load — relay is user-triggered
  };

  const cleanup = () => {
    stopAddressWatch();
  };

  return {
    // -- Form state --
    aaAddress,
    dappId,
    payloadJson,

    // -- AA instance --
    aa,

    // -- Display values --
    aaAddressDisplay,
    paymasterDisplay,
    sponsorState,
    relayResponse,
    aaCoreDisplay,
    relayUrlDisplay,
    networkDisplay,

    // -- Actions --
    checkSponsor,
    requestSponsor,
    submitRelay,
    loadAll,
    cleanup,
  };
}

export type UseAARelayConsoleReturn = ReturnType<typeof useAARelayConsole>;
