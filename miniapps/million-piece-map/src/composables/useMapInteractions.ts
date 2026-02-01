import { ref, computed } from "vue";
import { useWallet, useEvents } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import type { Tile } from "./useMapTiles";

const APP_ID = "miniapp-millionpiecemap";

export function useMapInteractions(
  tiles: { value: Tile[] },
  selectedTile: { value: number },
  ensureContractAddress: () => Promise<string>,
  loadTiles: () => Promise<void>,
) {
  const { address, connect, invokeContract, chainType } = useWallet() as WalletSDK;
  const { processPayment } = usePaymentFlow(APP_ID);
  const { list: listEvents } = useEvents();

  const isPurchasing = ref(false);
  const zoomLevel = ref(1);
  const status = ref<{ msg: string; type: string } | null>(null);

  const zoomIn = () => {
    if (zoomLevel.value < 2) zoomLevel.value += 0.25;
  };

  const zoomOut = () => {
    if (zoomLevel.value > 0.5) zoomLevel.value -= 0.25;
  };

  const waitForEvent = async (txid: string, eventName: string) => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const res = await listEvents({ app_id: APP_ID, event_name: eventName, limit: 25 });
      const match = res.events.find((evt) => evt.tx_hash === txid);
      if (match) return match;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    return null;
  };

  const purchaseTile = async (tilePrice: number) => {
    if (isPurchasing.value) return;
    if (tiles.value[selectedTile.value].owned) {
      status.value = { msg: "Tile already owned", type: "error" };
      return;
    }

    isPurchasing.value = true;
    try {
      if (!address.value) {
        await connect();
      }
      if (!address.value) {
        throw new Error("Please connect wallet");
      }
      const contract = await ensureContractAddress();
      const tile = tiles.value[selectedTile.value];
      const { receiptId, invoke } = await processPayment(tilePrice.toString(), `map:claim:${tile.x}:${tile.y}`);
      if (!receiptId) {
        throw new Error("Receipt missing");
      }
      const tx = await invoke(
        "claimPiece",
        [
          { type: "Hash160", value: address.value as string },
          { type: "Integer", value: String(tile.x) },
          { type: "Integer", value: String(tile.y) },
          { type: "Integer", value: String(receiptId) },
        ],
        contract,
      );
      const txid = String(
        (tx as { txid?: string; txHash?: string })?.txid || (tx as { txid?: string; txHash?: string })?.txHash || "",
      );
      const evt = txid ? await waitForEvent(txid, "PieceClaimed") : null;
      if (!evt) {
        throw new Error("Claim pending");
      }
      await loadTiles();
      status.value = { msg: "Tile purchased", type: "success" };
    } catch (e: any) {
      status.value = { msg: e.message || "Error", type: "error" };
    } finally {
      isPurchasing.value = false;
    }
  };

  return {
    isPurchasing,
    zoomLevel,
    status,
    zoomIn,
    zoomOut,
    purchaseTile,
  };
}
