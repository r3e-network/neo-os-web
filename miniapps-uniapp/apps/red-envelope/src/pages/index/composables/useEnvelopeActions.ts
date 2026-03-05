import { ref } from "vue";
import { useEvents } from "@neo/uniapp-sdk";
import { createUseI18n } from "@shared/composables/useI18n";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { messages } from "@/locale/messages";
import { toFixed8, fromFixed8 } from "@shared/utils/format";
import { parseStackItem } from "@shared/utils/neo";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { waitForListedEventByTransaction } from "@shared/utils/transaction";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import type { EnvelopeType } from "@/composables/useRedEnvelopeOpen";

const APP_ID = "miniapp-redenvelope";

interface EnvelopeItem {
  id: string;
  from: string;
  expired?: boolean;
  active?: boolean;
  depleted?: boolean;
  poolId?: string;
  amount?: number;
}

interface ClaimItem {
  id: string;
  poolId?: string;
  amount?: number;
}

interface PoolItem {
  id: string;
}

interface EventRecord {
  tx_hash?: string;
  state?: unknown[];
}

interface EnvelopeActionsDeps {
  status: ReturnType<(typeof import("vue"))["ref"]>;
  setStatus: (msg: string, type?: string) => void;
  clearStatus: () => void;
  isLoading: ReturnType<(typeof import("vue"))["ref"]>;
  defaultBlessing: ReturnType<(typeof import("vue"))["computed"]>;
  ensureCreationContract: () => Promise<string>;
  ensureOpenContract: () => Promise<string>;
  loadEnvelopes: () => Promise<void>;
  loadEnvelopeDetails: (contract: string, id: string) => Promise<EnvelopeItem | null>;
  claimFromPool: (poolId: string) => Promise<{ txid: string }>;
  openClaim: (claimId: string) => Promise<{ txid: string }>;
  transferClaim: (claimId: string, to: string) => Promise<{ txid: string }>;
  reclaimPool: (poolId: string) => Promise<{ txid: string }>;
  checkEligibility: (contract: string, envelopeId: string) => Promise<boolean>;
  isEligible: ReturnType<(typeof import("vue"))["ref"]>;
  eligibilityReason: ReturnType<(typeof import("vue"))["ref"]>;
  // Form refs
  name: ReturnType<(typeof import("vue"))["ref"]>;
  description: ReturnType<(typeof import("vue"))["ref"]>;
  amount: ReturnType<(typeof import("vue"))["ref"]>;
  count: ReturnType<(typeof import("vue"))["ref"]>;
  expiryHours: ReturnType<(typeof import("vue"))["ref"]>;
  minNeoRequired: ReturnType<(typeof import("vue"))["ref"]>;
  minHoldDays: ReturnType<(typeof import("vue"))["ref"]>;
  envelopeType: ReturnType<(typeof import("vue"))["ref"]>;
}

export function useEnvelopeActions(deps: EnvelopeActionsDeps) {
  const { t } = createUseI18n(messages)();
  const { address, ensureWallet, invokeDirectly, read } = useContractInteraction({ appId: APP_ID, t });
  const { list: listEvents } = useEvents();

  const luckyMessage = ref<{ amount: number; from: string } | null>(null);
  const openingId = ref<string | null>(null);
  const showOpeningModal = ref(false);
  const openingEnvelope = ref<EnvelopeItem | null>(null);
  const showTransferModal = ref(false);
  const transferringEnvelope = ref<EnvelopeItem | ClaimItem | null>(null);
  const openingClaim = ref<ClaimItem | null>(null);

  const handleConnect = async () => {
    try {
      await ensureWallet();
    } catch (_e: unknown) {
      // Wallet connection failure handled silently
    }
  };

  const waitForEnvelopeEvent = async (
    tx: unknown,
    eventName: string,
    limit: number,
    pendingMessage: string
  ): Promise<EventRecord | null> => {
    return waitForListedEventByTransaction<EventRecord>(tx, {
      listEvents: async () => {
        const result = await listEvents({ app_id: APP_ID, event_name: eventName, limit });
        return result.events || [];
      },
      timeoutMs: 30000,
      errorMessage: pendingMessage,
    });
  };

  const create = async () => {
    if (deps.isLoading.value) return;
    try {
      deps.isLoading.value = true;
      deps.clearStatus();

      await ensureWallet();

      const contract = await deps.ensureCreationContract();

      const totalValue = Number(deps.amount.value);
      const packetCount = Number(deps.count.value);
      if (!Number.isFinite(totalValue) || totalValue < 0.1) throw new Error(t("invalidAmount"));
      if (!Number.isFinite(packetCount) || packetCount < 1 || packetCount > 100) throw new Error(t("invalidPackets"));
      if (totalValue < packetCount * 0.01) throw new Error(t("invalidPerPacket"));

      const expiryValue = Number(deps.expiryHours.value);
      if (!Number.isFinite(expiryValue) || expiryValue <= 0) throw new Error(t("invalidExpiry"));
      const expirySeconds = Math.round(expiryValue * 3600);

      const finalDescription = deps.description.value.trim() || deps.defaultBlessing.value;
      const minNeo = Number(deps.minNeoRequired.value) || 100;
      const holdSeconds = Math.round((Number(deps.minHoldDays.value) || 2) * 86400);
      const envelopeTypeValue = deps.envelopeType.value === "lucky" ? "1" : "0";

      const tx = await invokeDirectly(
        "transfer",
        [
          { type: "Hash160", value: address.value as string },
          { type: "Hash160", value: contract },
          { type: "Integer", value: toFixed8(deps.amount.value) },
          {
            type: "Array",
            value: [
              { type: "Integer", value: String(packetCount) },
              { type: "Integer", value: String(expirySeconds) },
              { type: "String", value: finalDescription },
              { type: "Integer", value: String(minNeo) },
              { type: "Integer", value: String(holdSeconds) },
              { type: "Integer", value: envelopeTypeValue },
            ],
          },
        ],
        BLOCKCHAIN_CONSTANTS.GAS_HASH
      );

      const createdEvt = await waitForEnvelopeEvent(tx.tx, "EnvelopeCreated", 40, t("envelopePending"));

      if (!createdEvt) {
        throw new Error(t("envelopePending"));
      }

      deps.setStatus(t("envelopeSent"), "success");
      deps.name.value = "";
      deps.description.value = "";
      deps.amount.value = "";
      deps.count.value = "";
      await deps.loadEnvelopes();
    } catch (e: unknown) {
      deps.setStatus(formatErrorMessage(e, t("error")), "error");
    } finally {
      deps.isLoading.value = false;
    }
  };

  const openEnvelope = async (env: EnvelopeItem) => {
    if (openingId.value) return;

    try {
      await ensureWallet();
    } catch {
      return;
    }

    try {
      deps.clearStatus();
      const contract = await deps.ensureOpenContract();

      if (env.expired) throw new Error(t("envelopeExpired"));
      if (!env.active) throw new Error(t("envelopeNotReady"));
      if (env.depleted) throw new Error(t("envelopeEmpty"));

      const hasOpened = await read(
        "HasOpened",
        [
          { type: "Integer", value: env.id },
          { type: "Hash160", value: address.value as string },
        ],
        contract
      );
      if (Boolean(hasOpened)) {
        throw new Error(t("alreadyOpened"));
      }

      await deps.checkEligibility(contract, env.id);
      if (!deps.isEligible.value) {
        throw new Error(
          deps.eligibilityReason.value === "insufficient NEO" ? t("insufficientNeo") : t("holdDurationNotMet")
        );
      }

      openingId.value = env.id;
      const result = await invokeDirectly(
        "OpenEnvelope",
        [
          { type: "Integer", value: env.id },
          { type: "Hash160", value: address.value as string },
        ],
        contract
      );

      const openedEvt = await waitForEnvelopeEvent(result.tx, "EnvelopeOpened", 25, t("openPending"));

      if (!openedEvt) {
        throw new Error(t("openPending"));
      }
      const evtRecord = openedEvt as EventRecord;
      const values = Array.isArray(evtRecord.state) ? evtRecord.state.map(parseStackItem) : [];
      const openedAmount = fromFixed8(Number(values[2] ?? 0));

      showOpeningModal.value = false;

      luckyMessage.value = {
        amount: Number(openedAmount.toFixed(2)),
        from: env.from,
      };

      deps.setStatus(t("openedFrom").replace("{0}", env.from), "success");
      await deps.loadEnvelopes();
    } catch (e: unknown) {
      deps.setStatus(formatErrorMessage(e, t("error")), "error");
      showOpeningModal.value = false;
    } finally {
      openingId.value = null;
    }
  };

  const openFromList = (env: EnvelopeItem) => {
    openingEnvelope.value = env;
    showOpeningModal.value = true;
  };

  const startTransfer = (env: EnvelopeItem) => {
    transferringEnvelope.value = env;
    showTransferModal.value = true;
  };

  const handleTransfer = async (recipient: string) => {
    if (!address.value || !transferringEnvelope.value) return;
    try {
      deps.clearStatus();
      const contract = await deps.ensureOpenContract();
      const env = transferringEnvelope.value;

      if (env.poolId) {
        await deps.transferClaim(env.id, recipient);
      } else {
        await invokeDirectly(
          "transferEnvelope",
          [
            { type: "Integer", value: env.id },
            { type: "Hash160", value: address.value },
            { type: "Hash160", value: recipient },
            { type: "Any", value: null },
          ],
          contract
        );
      }

      showTransferModal.value = false;
      transferringEnvelope.value = null;
      deps.setStatus(t("transferSuccess"), "success");
      await deps.loadEnvelopes();
    } catch (e: unknown) {
      deps.setStatus(formatErrorMessage(e, t("error")), "error");
    }
  };

  const reclaimEnvelope = async (env: EnvelopeItem) => {
    if (!address.value) return;
    try {
      deps.clearStatus();
      const contract = await deps.ensureOpenContract();

      await invokeDirectly(
        "ReclaimEnvelope",
        [
          { type: "Integer", value: env.id },
          { type: "Hash160", value: address.value },
        ],
        contract
      );

      deps.setStatus(t("reclaimSuccess"), "success");
      await deps.loadEnvelopes();
    } catch (e: unknown) {
      deps.setStatus(formatErrorMessage(e, t("error")), "error");
    }
  };

  const handleClaimFromPool = async (poolId: string) => {
    try {
      await ensureWallet();
    } catch {
      return;
    }
    try {
      deps.clearStatus();
      await deps.claimFromPool(poolId);
      deps.setStatus(t("claimSuccess"), "success");
      await deps.loadEnvelopes();
    } catch (e: unknown) {
      deps.setStatus(formatErrorMessage(e, t("error")), "error");
    }
  };

  const openClaimFromList = (claim: ClaimItem) => {
    openingClaim.value = claim;
    openingEnvelope.value = null;
    showOpeningModal.value = true;
  };

  const handleOpenClaim = async (claim: ClaimItem) => {
    if (!address.value || openingId.value) return;
    try {
      deps.clearStatus();
      openingId.value = claim.id;
      await deps.openClaim(claim.id);

      showOpeningModal.value = false;
      openingClaim.value = null;

      luckyMessage.value = {
        amount: Number(claim.amount?.toFixed?.(2) ?? claim.amount),
        from: `Pool #${claim.poolId}`,
      };

      deps.setStatus(t("claimSuccess"), "success");
      await deps.loadEnvelopes();
    } catch (e: unknown) {
      deps.setStatus(formatErrorMessage(e, t("error")), "error");
      showOpeningModal.value = false;
    } finally {
      openingId.value = null;
    }
  };

  const startTransferClaim = (claim: ClaimItem) => {
    transferringEnvelope.value = claim;
    showTransferModal.value = true;
  };

  const handleReclaimPool = async (pool: PoolItem) => {
    if (!address.value) return;
    try {
      deps.clearStatus();
      await deps.reclaimPool(pool.id);
      deps.setStatus(t("reclaimSuccess"), "success");
      await deps.loadEnvelopes();
    } catch (e: unknown) {
      deps.setStatus(formatErrorMessage(e, t("error")), "error");
    }
  };

  return {
    // Modal state
    luckyMessage,
    openingId,
    showOpeningModal,
    openingEnvelope,
    showTransferModal,
    transferringEnvelope,
    openingClaim,
    // Actions
    handleConnect,
    create,
    openEnvelope,
    openFromList,
    startTransfer,
    handleTransfer,
    reclaimEnvelope,
    handleClaimFromPool,
    openClaimFromList,
    handleOpenClaim,
    startTransferClaim,
    handleReclaimPool,
    // Wallet state (passthrough for template)
    address,
  };
}
