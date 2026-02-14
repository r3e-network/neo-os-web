import { ref } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import type { Tile } from "./useMapTiles";

const APP_ID = "miniapp-millionpiecemap";

export function useMapInteractions(
  tiles: { value: Tile[] },
  selectedTile: { value: number },
  ensureContractAddress: () => Promise<string>,
  loadTiles: () => Promise<void>,
) {
  const { address, connect } = useWallet() as WalletSDK;
  const { processPayment } = usePaymentFlow(APP_ID);

  const isPurchasing = ref(false);
  const zoomLevel = ref(1);
  const { status, setStatus } = useStatusMessage();

  const zoomIn = () => {
    if (zoomLevel.value < 2) zoomLevel.value += 0.25;
  };

  const zoomOut = () => {
    if (zoomLevel.value > 0.5) zoomLevel.value -= 0.25;
  };

  const isPendingEventError = (error: unknown, eventName: string) =>
    error instanceof Error && error.message.includes(`Event "${eventName}" not found`);

  const purchaseTile = async (tilePrice: number) => {
    if (isPurchasing.value) return;
    if (tiles.value[selectedTile.value].owned) {
      setStatus("Tile already owned", "error");
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
      const { receiptId, invoke, waitForEvent } = await processPayment(tilePrice.toString(), `map:claim:${tile.x}:${tile.y}`);
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
      const txid = tx.txid;
      if (txid) {
        try {
          await waitForEvent(txid, "PieceClaimed");
        } catch (e: unknown) {
          if (isPendingEventError(e, "PieceClaimed")) {
            throw new Error("Claim pending");
          }
          throw e;
        }
      } else {
        throw new Error("Claim pending");
      }
      await loadTiles();
      setStatus("Tile purchased", "success");
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, "Error"), "error");
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
