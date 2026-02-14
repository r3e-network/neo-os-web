import { ref } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { toFixed8, toFixedDecimals } from "@shared/utils/format";
import { parseInvokeResult, addressToScriptHash, parseStackItem } from "@shared/utils/neo";
import { createUseI18n } from "@shared/composables/useI18n";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { messages } from "@/locale/messages";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { waitForEventByTransaction } from "@shared/utils/transaction";

const APP_ID = "miniapp-neo-gacha";

interface MachineItemData {
  name: string;
  probability: number;
  icon: string;
  rarity: string;
  assetType: string;
  assetHash: string;
  amount: string;
  tokenId: string;
}

interface MachineData {
  name: string;
  description: string;
  category: string;
  tags: string;
  price: string;
  items: MachineItemData[];
}

export function useGachaPublish() {
  const { t } = createUseI18n(messages)();
  const { address, invokeContract, invokeRead } = useWallet() as WalletSDK;
  const { waitForEvent } = usePaymentFlow(APP_ID);
  const { ensure: ensureContractAddress } = useContractAddress(t);

  const isPublishing = ref(false);

  const numberFrom = (value: unknown) => {
    const num = Number(value ?? 0);
    return Number.isFinite(num) ? num : 0;
  };

  const toRawAmount = (value: string, decimals: number) => toFixedDecimals(value, decimals);

  const toHash160 = (value: string) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    if (/^(0x)?[0-9a-fA-F]{40}$/.test(trimmed)) {
      return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
    }
    const scriptHash = addressToScriptHash(trimmed);
    return scriptHash ? `0x${scriptHash}` : "";
  };

  const publishMachine = async (
    machineData: MachineData,
    options: {
      requireAddress: () => Promise<boolean>;
      setStatus: (msg: string, variant: "danger" | "success" | "warning") => void;
      onSuccess?: () => Promise<void>;
    }
  ) => {
    if (isPublishing.value) return;

    const hasAddress = await options.requireAddress();
    if (!hasAddress) return;

    try {
      const contract = await ensureContractAddress();
      if (!contract) return;

      isPublishing.value = true;
      options.setStatus(t("publishing"), "warning");

      const priceRaw = toFixed8(machineData.price);
      const createTx = await invokeContract({
        scriptHash: contract,
        operation: "CreateMachine",
        args: [
          { type: "Hash160", value: address.value as string },
          { type: "String", value: machineData.name },
          { type: "String", value: machineData.description || "" },
          { type: "String", value: machineData.category || "" },
          { type: "String", value: machineData.tags || "" },
          { type: "Integer", value: priceRaw },
        ],
      });

      const createdEvent = await waitForEventByTransaction(createTx, "MachineCreated", waitForEvent);
      if (!createdEvent) {
        throw new Error(t("createPending"));
      }

      const evtRecord = createdEvent as unknown as Record<string, unknown> | null;
      const createdValues = Array.isArray(evtRecord?.state) ? (evtRecord.state as unknown[]).map(parseStackItem) : [];
      const machineId = String(createdValues[1] ?? "");
      if (!machineId) {
        throw new Error(t("createPending"));
      }

      for (const item of machineData.items) {
        const assetTypeValue = item.assetType === "nep11" ? 2 : 1;
        const assetHash = toHash160(item.assetHash);
        if (!assetHash) {
          throw new Error(t("invalidAsset"));
        }

        let amountRaw = "0";
        if (assetTypeValue === 1) {
          let decimals = 8;
          try {
            const decimalsRes = await invokeRead({
              scriptHash: assetHash,
              operation: "Decimals",
            });
            decimals = numberFrom(parseInvokeResult(decimalsRes));
          } catch {
            /* Token decimals read failed — default to 8 */
            decimals = 8;
          }
          amountRaw = toRawAmount(item.amount, decimals);
        }
        const tokenId = assetTypeValue === 2 ? item.tokenId : "";

        const itemTx = await invokeContract({
          scriptHash: contract,
          operation: "AddMachineItem",
          args: [
            { type: "Hash160", value: address.value as string },
            { type: "Integer", value: machineId },
            { type: "String", value: item.name },
            { type: "Integer", value: String(item.probability) },
            { type: "String", value: item.rarity },
            { type: "Integer", value: String(assetTypeValue) },
            { type: "Hash160", value: assetHash },
            { type: "Integer", value: amountRaw },
            { type: "String", value: tokenId },
          ],
        });

        await waitForEventByTransaction(itemTx, "MachineItemAdded", waitForEvent);
      }

      options.setStatus(t("publishSuccess"), "success");
      if (options.onSuccess) await options.onSuccess();
    } catch (e: unknown) {
      options.setStatus(formatErrorMessage(e, t("error")), "danger");
      throw e;
    } finally {
      isPublishing.value = false;
    }
  };

  return {
    isPublishing,
    publishMachine,
    t,
  };
}
