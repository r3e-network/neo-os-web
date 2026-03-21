import { ref } from "vue";
import { toFixed8, toFixedDecimals } from "@shared/utils/format";
import { addressToScriptHash, parseStackItem } from "@shared/utils/neo";
import { createUseI18n } from "@shared/composables/useI18n";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { messages } from "@/locale/messages";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { waitForEventByTransaction } from "@shared/utils/transaction";
import { useEvents } from "@shared/utils/wallet-sdk";

const APP_ID = "miniapp-gasbox";

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
  const { address, ensureContractAddress, invokeDirectly, read } = useContractInteraction({ appId: APP_ID, t });
  const { list: listEvents } = useEvents();

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

  const waitForAppEvent = async (txid: string, eventName: string, timeoutMs = 30000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const result = await listEvents({
        app_id: APP_ID,
        event_name: eventName,
        limit: 20,
        tx_hash: txid,
      });
      if (result.events.length > 0) {
        return result.events[0] as unknown as Record<string, unknown>;
      }
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
    throw new Error(`${eventName} pending`);
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
      const createResult = await invokeDirectly("CreateMachine", [
        { type: "Hash160", value: address.value as string },
        { type: "String", value: machineData.name },
        { type: "String", value: machineData.description || "" },
        { type: "String", value: machineData.category || "" },
        { type: "String", value: machineData.tags || "" },
        { type: "Integer", value: priceRaw },
      ]);

      const createdEvent = await waitForEventByTransaction(createResult.tx, "MachineCreated", waitForAppEvent);
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
            decimals = numberFrom(await read("Decimals", [], assetHash));
          } catch (_e: unknown) {
            /* Token decimals read failed — default to 8 */
            decimals = 8;
          }
          amountRaw = toRawAmount(item.amount, decimals);
        }
        const tokenId = assetTypeValue === 2 ? item.tokenId : "";

        const itemResult = await invokeDirectly("AddMachineItem", [
          { type: "Hash160", value: address.value as string },
          { type: "Integer", value: machineId },
          { type: "String", value: item.name },
          { type: "Integer", value: String(item.probability) },
          { type: "String", value: item.rarity },
          { type: "Integer", value: String(assetTypeValue) },
          { type: "Hash160", value: assetHash },
          { type: "Integer", value: amountRaw },
          { type: "String", value: tokenId },
        ]);

        await waitForEventByTransaction(itemResult.tx, "MachineItemAdded", waitForAppEvent);
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
