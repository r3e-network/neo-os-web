import { ref, computed } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { requireNeoChain } from "@shared/utils/chain";
import { addressToScriptHash, normalizeScriptHash, parseInvokeResult } from "@shared/utils/neo";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { formatNumber } from "@shared/utils/format";

const APP_ID = "miniapp-millionpiecemap";
const GRID_SIZE = 64;
const GRID_WIDTH = 8;
const TILE_PRICE = 0.1;

const TERRITORY_COLORS = [
  "var(--map-territory-1)",
  "var(--map-territory-2)",
  "var(--map-territory-3)",
  "var(--map-territory-4)",
  "var(--map-territory-5)",
  "var(--map-territory-6)",
  "var(--map-territory-7)",
  "var(--map-territory-8)",
];

export type Tile = {
  owned: boolean;
  owner: string;
  isYours: boolean;
  selected: boolean;
  x: number;
  y: number;
};

export function useMapTiles() {
  const { address, invokeRead, chainType, getContractAddress } = useWallet() as WalletSDK;

  const tiles = ref<Tile[]>(
    Array.from({ length: GRID_SIZE }, (_, i) => ({
      owned: false,
      owner: "",
      isYours: false,
      selected: false,
      x: i % GRID_WIDTH,
      y: Math.floor(i / GRID_WIDTH),
    }))
  );

  const selectedTile = ref(0);
  const contractAddress = ref<string | null>(null);

  const selectedX = computed(() => selectedTile.value % GRID_WIDTH);
  const selectedY = computed(() => Math.floor(selectedTile.value / GRID_WIDTH));
  const ownedTiles = computed(() => tiles.value.filter((tile) => tile.isYours).length);
  const totalSpent = computed(() => ownedTiles.value * TILE_PRICE);
  const coverage = computed(() => Math.round((ownedTiles.value / GRID_SIZE) * 100));
  const formatNum = (n: number) => formatNumber(n, 2);

  const ensureContractAddress = async () => {
    if (!contractAddress.value) {
      contractAddress.value = await getContractAddress();
    }
    if (!contractAddress.value) {
      throw new Error("Contract unavailable");
    }
    return contractAddress.value as string;
  };

  const getOwnerColorIndex = (owner: string) => {
    if (!owner) return 0;
    let hash = 0;
    for (let i = 0; i < owner.length; i += 1) {
      hash = (hash + owner.charCodeAt(i)) % TERRITORY_COLORS.length;
    }
    return hash;
  };

  const getTileColor = (tile: Tile) => {
    if (tile.selected) return "var(--neo-purple)";
    if (tile.isYours) return "var(--neo-green)";
    if (tile.owned) return TERRITORY_COLORS[getOwnerColorIndex(tile.owner)] || "var(--neo-orange)";
    return "var(--bg-card)";
  };

  const selectTile = (index: number) => {
    tiles.value.forEach((t, i) => (t.selected = i === index));
    selectedTile.value = index;
  };

  const parsePiece = (data: unknown) => {
    if (!data) return null;
    if (Array.isArray(data)) {
      return {
        owner: String(data[0] ?? ""),
        x: Number(data[1] ?? 0),
        y: Number(data[2] ?? 0),
        purchaseTime: Number(data[3] ?? 0),
        price: Number(data[4] ?? 0),
      };
    }
    if (typeof data === "object") {
      const rec = data as Record<string, unknown>;
      return {
        owner: String(rec.owner ?? ""),
        x: Number(rec.x ?? 0),
        y: Number(rec.y ?? 0),
        purchaseTime: Number(rec.purchaseTime ?? 0),
        price: Number(rec.price ?? 0),
      };
    }
    return null;
  };

  const loadTiles = async () => {
    const contract = await ensureContractAddress();
    const userHash = address.value ? normalizeScriptHash(addressToScriptHash(address.value)) : "";

    const updates = await Promise.all(
      tiles.value.map(async (tile) => {
        const res = await invokeRead({
          scriptHash: contract,
          operation: "GetPiece",
          args: [
            { type: "Integer", value: String(tile.x) },
            { type: "Integer", value: String(tile.y) },
          ],
        });
        const parsed = parsePiece(parseInvokeResult(res));
        const ownerHash = normalizeScriptHash(parsed?.owner || "");
        const owned = Boolean(ownerHash);
        const isYours = Boolean(userHash && ownerHash && ownerHash === userHash);
        return {
          ...tile,
          owned,
          owner: parsed?.owner || "",
          isYours,
        };
      })
    );
    tiles.value = updates;
  };

  return {
    tiles,
    selectedTile,
    selectedX,
    selectedY,
    ownedTiles,
    totalSpent,
    coverage,
    formatNum,
    getTileColor,
    selectTile,
    loadTiles,
    ensureContractAddress,
    GRID_SIZE,
    GRID_WIDTH,
    TILE_PRICE,
  };
}
