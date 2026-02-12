import { ref } from "vue";
import { useWallet, useEvents } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "@/composables/useI18n";
import { toFixed8, fromFixed8 } from "@shared/utils/format";
import { parseInvokeResult, parseStackItem } from "@shared/utils/neo";
import { pollForEvent } from "@shared/utils/errorHandling";
import { formatErrorMessage } from "@shared/utils/errorHandling";
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
  status: ReturnType<typeof import("vue")["ref"]>;
  setStatus: (msg: string, type?: string) => void;
  clearStatus: () => void;
  isLoading: ReturnType<typeof import("vue")["ref"]>;
  defaultBlessing: ReturnType<typeof import("vue")["computed"]>;
  ensureCreationContract: () => Promise<string>;
  ensureOpenContract: () => Promise<string>;
  loadEnvelopes: () => Promise<void>;
  fetchEnvelopeDetails: (contract: string, id: string) => Promise<EnvelopeItem | null>;
  claimFromPool: (poolId: string) => Promise<{ txid: string }>;
  openClaim: (claimId: string) => Promise<{ txid: string }>;
  transferClaim: (claimId: string, to: string) => Promise<{ txid: string }>;
  reclaimPool: (poolId: string) => Promise<{ txid: string }>;
  checkEligibility: (contract: string, envelopeId: string) => Promise<boolean>;
  isEligible: ReturnType<typeof import("vue")["ref"]>;
  eligibilityReason: ReturnType<typeof import("vue")["ref"]>;
  // Form refs
  name: ReturnType<typeof import("vue")["ref"]>;
  description: ReturnType<typeof import("vue")["ref"]>;
  amount: ReturnType<typeof import("vue")["ref"]>;
  count: ReturnType<typeof import("vue")["ref"]>;
  expiryHours: ReturnType<typeof import("vue")["ref"]>;
  minNeoRequired: ReturnType<typeof import("vue")["ref"]>;
  minHoldDays: ReturnType<typeof import("vue")["ref"]>;
  envelopeType: ReturnType<typeof import("vue")["ref"]>;
}

export function useEnvelopeActions(deps: EnvelopeActionsDeps) {
  const { t } = useI18n();
  const { address, connect, invokeContract, invokeRead } = useWallet() as WalletSDK;
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
      await connect();
    } catch (_e: unknown) {
      // Wallet connection failure handled silently
    }
  };

  const create = async () => {
    if (deps.isLoading.value) return;
    try {
      deps.isLoading.value = true;
      deps.clearStatus();
      if (!address.value) {
        await connect();
      }
      if (!address.value) {
        throw new Error(t("connectWallet"));
      }

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

      const tx = await invokeContract({
        scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
        operation: "transfer",
        args: [
          { type: "Hash160", value: address.value },
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
      });

      const txid = String(
        (tx as { txid?: string; txHash?: string })?.txid || (tx as { txid?: string; txHash?: string })?.txHash || ""
      );
      const createdEvt = txid
        ? await pollForEvent(
            async () => {
              const result = await listEvents({ app_id: APP_ID, event_name: "EnvelopeCreated", limit: 40 });
              return result.events || [];
            },
            (evt: EventRecord) => evt.tx_hash === txid,
            { timeoutMs: 30000, errorMessage: t("envelopePending") }
          )
        : null;

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

    if (!address.value) {
      await connect();
      if (!address.value) return;
    }

    try {
      deps.clearStatus();
      const contract = await deps.ensureOpenContract();

      if (env.expired) throw new Error(t("envelopeExpired"));
      if (!env.active) throw new Error(t("envelopeNotReady"));
      if (env.depleted) throw new Error(t("envelopeEmpty"));

      const hasOpenedRes = await invokeRead({
        scriptHash: contract,
        operation: "HasOpened",
        args: [
          { type: "Integer", value: env.id },
          { type: "Hash160", value: address.value },
        ],
      });
      if (Boolean(parseInvokeResult(hasOpenedRes))) {
        throw new Error(t("alreadyOpened"));
      }

      await deps.checkEligibility(contract, env.id);
      if (!deps.isEligible.value) {
        throw new Error(
          deps.eligibilityReason.value === "insufficient NEO" ? t("insufficientNeo") : t("holdDurationNotMet")
        );
      }

      openingId.value = env.id;
      const tx = await invokeContract({
        scriptHash: contract,
        operation: "OpenEnvelope",
        args: [
          { type: "Integer", value: env.id },
          { type: "Hash160", value: address.value },
        ],
      });

      const txid = String(
        (tx as { txid?: string; txHash?: string })?.txid || (tx as { txid?: string; txHash?: string })?.txHash || ""
      );
      const openedEvt = txid
        ? await pollForEvent(
            async () => {
              const result = await listEvents({ app_id: APP_ID, event_name: "EnvelopeOpened", limit: 25 });
              return result.events || [];
            },
            (evt: EventRecord) => evt.tx_hash === txid,
            { timeoutMs: 30000, errorMessage: t("openPending") }
          )
        : null;

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
        await invokeContract({
          scriptHash: contract,
          operation: "transferEnvelope",
          args: [
            { type: "Integer", value: env.id },
            { type: "Hash160", value: address.value },
            { type: "Hash160", value: recipient },
            { type: "Any", value: null },
          ],
        });
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

      await invokeContract({
        scriptHash: contract,
        operation: "ReclaimEnvelope",
        args: [
          { type: "Integer", value: env.id },
          { type: "Hash160", value: address.value },
        ],
      });

      deps.setStatus(t("reclaimSuccess"), "success");
      await deps.loadEnvelopes();
    } catch (e: unknown) {
      deps.setStatus(formatErrorMessage(e, t("error")), "error");
    }
  };

  const handleClaimFromPool = async (poolId: string) => {
    if (!address.value) {
      await connect();
      if (!address.value) return;
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
