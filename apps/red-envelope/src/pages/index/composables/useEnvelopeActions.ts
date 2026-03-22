import { ref } from "vue";
import { useEvents } from "@shared/utils/wallet-sdk";
import { createUseI18n } from "@shared/composables/useI18n";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { messages } from "@/locale/messages";
import { toFixed8, fromFixed8 } from "@shared/utils/format";
import { parseStackItem } from "@shared/utils/neo";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { waitForListedEventByTransaction } from "@shared/utils/transaction";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import type { EnvelopeItem, ClaimItem } from "@/composables/useRedEnvelopeOpen";

const APP_ID = "miniapp-redenvelope";

interface EnvelopeActionsDeps {
  status: ReturnType<(typeof import("vue"))["ref"]>;
  setStatus: (msg: string, type?: string) => void;
  clearStatus: () => void;
  isLoading: ReturnType<(typeof import("vue"))["ref"]>;
  ensureCreationContract: () => Promise<string>;
  loadEnvelopes: () => Promise<void>;
  claimEnvelope: (envelopeId: string) => Promise<{ txid: string }>;
  amount: ReturnType<(typeof import("vue"))["ref"]>;
  count: ReturnType<(typeof import("vue"))["ref"]>;
  expiryHours: ReturnType<(typeof import("vue"))["ref"]>;
}

interface EventRecord {
  tx_hash?: string;
  state?: unknown[];
}

export function useEnvelopeActions(deps: EnvelopeActionsDeps) {
  const { t } = createUseI18n(messages)();
  const { address, ensureWallet, invokeDirectly } = useContractInteraction({ appId: APP_ID, t });
  const { list: listEvents } = useEvents();

  const luckyMessage = ref<{ amount: number; from: string } | null>(null);
  const openingId = ref<string | null>(null);
  const showOpeningModal = ref(false);
  const openingEnvelope = ref<EnvelopeItem | null>(null);

  const waitForEvent = async (tx: unknown, eventName: string, pendingMessage: string) => {
    return waitForListedEventByTransaction<EventRecord>(tx, {
      listEvents: async () => {
        const result = await listEvents({ app_id: APP_ID, event_name: eventName, limit: 40 });
        return result.events || [];
      },
      timeoutMs: 45000,
      errorMessage: pendingMessage,
    });
  };

  const handleConnect = async () => {
    try {
      await ensureWallet();
    } catch (e: unknown) {
      // Wallet rejection or connection failure — user already declined or UX failure.
      // Intentionally silent: user feedback is handled by the wallet prompt itself.
      console.warn("[red-envelope] handleConnect wallet error:", e instanceof Error ? e.message : String(e));
    }
  };

  const create = async () => {
    if (deps.isLoading.value) return;

    try {
      deps.isLoading.value = true;
      deps.clearStatus();

      await ensureWallet();
      if (!address.value) throw new Error(t("connectWallet"));

      const contract = await deps.ensureCreationContract();
      const totalValue = Number(deps.amount.value);
      const packetCount = Number(deps.count.value);
      const expiryValue = Number(deps.expiryHours.value);

      if (!Number.isFinite(totalValue) || totalValue < 0.1) throw new Error(t("invalidAmount"));
      if (!Number.isFinite(packetCount) || packetCount < 1 || packetCount > 100) throw new Error(t("invalidPackets"));
      if (totalValue < packetCount * 0.01) throw new Error(t("invalidPerPacket"));
      if (!Number.isFinite(expiryValue) || expiryValue <= 0) throw new Error(t("invalidExpiry"));

      const transferTx = await invokeDirectly(
        "transfer",
        [
          { type: "Hash160", value: address.value },
          { type: "Hash160", value: contract },
          { type: "Integer", value: toFixed8(deps.amount.value) },
          { type: "String", value: `${APP_ID}:create` },
        ],
        BLOCKCHAIN_CONSTANTS.GAS_HASH
      );

      if (!transferTx.txid) {
        throw new Error(t("envelopePending"));
      }

      // Give the GAS credit transfer a short head start before consuming it in createEnvelope.
      await new Promise((resolve) => setTimeout(resolve, 4000));

      const createTx = await invokeDirectly(
        "createEnvelope",
        [
          { type: "Hash160", value: address.value },
          { type: "Integer", value: toFixed8(deps.amount.value) },
          { type: "Integer", value: String(packetCount) },
          { type: "Integer", value: String(Math.round(expiryValue * 3600)) },
        ],
        contract
      );

      const createdEvt = await waitForEvent(createTx.tx, "EnvelopeCreated", t("envelopePending"));
      if (!createdEvt) {
        throw new Error(t("envelopePending"));
      }

      deps.setStatus(t("envelopeSent"), "success");
      deps.amount.value = "";
      deps.count.value = "";
      deps.expiryHours.value = "24";
      await deps.loadEnvelopes();
    } catch (error: unknown) {
      deps.setStatus(formatErrorMessage(error, t("error")), "error");
    } finally {
      deps.isLoading.value = false;
    }
  };

  const openEnvelope = async (envelope: EnvelopeItem) => {
    if (openingId.value) return;

    try {
      await ensureWallet();
      if (!address.value) throw new Error(t("connectWallet"));

      openingId.value = envelope.id;
      deps.clearStatus();

      const result = await deps.claimEnvelope(envelope.id);
      const claimEvt = await waitForEvent(result, "EnvelopeClaimed", t("openPending"));
      if (!claimEvt) {
        throw new Error(t("openPending"));
      }

      const values = Array.isArray(claimEvt.state) ? claimEvt.state.map(parseStackItem) : [];
      luckyMessage.value = {
        amount: Number(fromFixed8(Number(values[2] ?? 0)).toFixed(4)),
        from: envelope.from,
      };

      showOpeningModal.value = false;
      openingEnvelope.value = null;
      deps.setStatus(t("openedFrom", { sender: envelope.from }), "success");
      await deps.loadEnvelopes();
    } catch (error: unknown) {
      deps.setStatus(formatErrorMessage(error, t("error")), "error");
    } finally {
      openingId.value = null;
    }
  };

  const openFromList = (envelope: EnvelopeItem) => {
    openingEnvelope.value = envelope;
    showOpeningModal.value = true;
  };

  const handleClaimFromPool = async (envelopeId: string) => {
    try {
      await ensureWallet();
      deps.clearStatus();
      const result = await deps.claimEnvelope(envelopeId);
      const claimEvt = await waitForEvent(result, "EnvelopeClaimed", t("openPending"));
      if (!claimEvt) {
        throw new Error(t("openPending"));
      }
      const values = Array.isArray(claimEvt.state) ? claimEvt.state.map(parseStackItem) : [];
      luckyMessage.value = {
        amount: Number(fromFixed8(Number(values[2] ?? 0)).toFixed(4)),
        from: `#${envelopeId}`,
      };
      deps.setStatus(t("claimSuccess"), "success");
      await deps.loadEnvelopes();
    } catch (error: unknown) {
      deps.setStatus(formatErrorMessage(error, t("error")), "error");
    }
  };

  return {
    luckyMessage,
    openingId,
    showOpeningModal,
    openingEnvelope,
    handleConnect,
    create,
    openEnvelope,
    openFromList,
    handleClaimFromPool,
    address,
  };
}
