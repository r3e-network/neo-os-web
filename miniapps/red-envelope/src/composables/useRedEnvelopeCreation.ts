import { ref, computed } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "./useI18n";
import { toFixed8 } from "@shared/utils/format";
import { requireNeoChain } from "@shared/utils/chain";

const APP_ID = "miniapp-redenvelope";

const MIN_AMOUNT = 10000000n; // 0.1 GAS in fixed8
const MAX_PACKETS = 100;
const MIN_PER_PACKET = 1000000n; // 0.01 GAS in fixed8
const BEST_LUCK_BONUS_RATE = 5n; // 5%

export function useRedEnvelopeCreation() {
  const { t } = useI18n();
  const { address, connect, chainType, getContractAddress } = useWallet() as WalletSDK;

  const name = ref("");
  const description = ref("");
  const amount = ref("");
  const count = ref("");
  const expiryHours = ref("24");
  const minNeoRequired = ref("100");
  const minHoldDays = ref("2");
  const status = ref<{ msg: string; type: "success" | "error" } | null>(null);
  const isLoading = ref(false);

  const defaultBlessing = computed(() => t("defaultBlessing"));

  const ensureContractAddress = async () => {
    if (!requireNeoChain(chainType, t)) {
      throw new Error(t("wrongChain"));
    }
    const contract = await getContractAddress();
    if (!contract) {
      throw new Error(t("contractUnavailable"));
    }
    return contract;
  };

  const generatePreviewSeed = (totalAmount: string, packetCount: string): Uint8Array => {
    const data = `preview:${totalAmount}:${packetCount}:${Date.now()}`;
    const encoder = new TextEncoder();
    const bytes = encoder.encode(data);
    const hash = new Uint8Array(32);
    for (let i = 0; i < bytes.length; i++) {
      hash[i % 32] ^= bytes[i];
    }
    return hash;
  };

  const getRandFromSeed = (seed: Uint8Array, index: number): bigint => {
    const combined = new Uint8Array(seed.length + 4);
    combined.set(seed);
    combined[seed.length] = index & 0xff;
    combined[seed.length + 1] = (index >> 8) & 0xff;
    combined[seed.length + 2] = (index >> 16) & 0xff;
    combined[seed.length + 3] = (index >> 24) & 0xff;

    let hash = 0n;
    for (let i = 0; i < combined.length; i++) {
      hash = (hash * 31n + BigInt(combined[i])) % 2n ** 256n;
    }
    return hash < 0n ? -hash : hash;
  };

  const previewDistribution = (totalAmountGas: number, packetCount: number): bigint[] => {
    if (packetCount <= 0 || packetCount > MAX_PACKETS) return [];

    const totalAmount = BigInt(toFixed8(totalAmountGas));
    if (totalAmount < BigInt(packetCount) * MIN_PER_PACKET) return [];

    const seed = generatePreviewSeed(totalAmountGas.toString(), packetCount.toString());
    const amounts: bigint[] = [];
    let remaining = totalAmount;

    for (let i = 0; i < packetCount - 1; i++) {
      const packetsLeft = BigInt(packetCount - i);
      const maxForThis = remaining - (packetsLeft - 1n) * MIN_PER_PACKET;

      const randValue = getRandFromSeed(seed, i);
      const range = maxForThis - MIN_PER_PACKET;
      let amount = MIN_PER_PACKET;

      if (range > 0n) {
        amount = MIN_PER_PACKET + (randValue % range);
      }

      amounts.push(amount);
      remaining -= amount;
    }

    amounts.push(remaining);
    return amounts;
  };

  const calculateBestLuckBonus = (bestLuckAmount: bigint): bigint => {
    return (bestLuckAmount * BEST_LUCK_BONUS_RATE) / 100n;
  };

  return {
    name,
    description,
    amount,
    count,
    expiryHours,
    minNeoRequired,
    minHoldDays,
    status,
    isLoading,
    defaultBlessing,
    ensureContractAddress,
    previewDistribution,
    MIN_AMOUNT,
    MAX_PACKETS,
    MIN_PER_PACKET,
    address,
    connect,
    APP_ID,
  };
}
