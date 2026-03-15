import { ref } from "vue";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { isTxEventPendingError, waitForEventByTransaction } from "@shared/utils/transaction";
import type { Tile } from "./useMapTiles";

const APP_ID = "miniapp-millionpiecemap";

export function useMapInteractions(
  tiles: { value: Tile[] },
  selectedTile: { value: number },
  ensureContractAddress: () => Promise<string>,
  loadTiles: () => Promise<void>
) {
  const t = (key: string) => key;
  const { address, ensureWallet, invoke } = useContractInteraction({ appId: APP_ID, t });

  const isPurchasing = ref(false);
  const zoomLevel = ref(1);
  const { status, setStatus } = useStatusMessage();

  const zoomIn = () => {
    if (zoomLevel.value < 2) zoomLevel.value += 0.25;
  };

  const zoomOut = () => {
    if (zoomLevel.value > 0.5) zoomLevel.value -= 0.25;
  };

  const purchaseTile = async (tilePrice: number) => {
    if (isPurchasing.value) return;
    if (tiles.value[selectedTile.value].owned) {
      setStatus("Tile already owned", "error");
      return;
    }

    isPurchasing.value = true;
    try {
      await ensureWallet();
      const tile = tiles.value[selectedTile.value];

      const { txid, waitForEvent } = await invoke(tilePrice.toString(), `map:claim:${tile.x}:${tile.y}`, "claimPiece", [
        { type: "Hash160", value: address.value as string },
        { type: "Integer", value: String(tile.x) },
        { type: "Integer", value: String(tile.y) },
      ]);

      let claimEvent: unknown = null;
      try {
        claimEvent = await waitForEvent(txid, "PieceClaimed");
      } catch (e: unknown) {
        if (isTxEventPendingError(e, "PieceClaimed")) {
          throw new Error("Claim pending");
        }
        throw e;
      }
      if (!claimEvent) {
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
