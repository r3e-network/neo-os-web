/**
 * GASBOX - item selection helper
 *
 * This script mirrors the frontend/off-chain deterministic selection path:
 * use the contract seed plus the current machine inventory snapshot to choose
 * exactly one available item by weight.
 */

function hexToBigInt(seed) {
  const normalized = String(seed || "").replace(/^0x/, "");
  if (!normalized) throw new Error("seed required");
  return BigInt(`0x${normalized}`);
}

function selectItem(input) {
  const seed = hexToBigInt(input.seed);
  const items = Array.isArray(input.items) ? input.items : [];
  const availableItems = items.filter((item) => {
    const assetType = Number(item.assetType || 0);
    if (assetType === 1) return Number(item.stock || 0) >= Number(item.amount || 0) && Number(item.amount || 0) > 0;
    if (assetType === 2) return Number(item.tokenCount || 0) > 0;
    return false;
  });

  if (availableItems.length === 0) {
    return { selectedIndex: 0 };
  }

  const totalWeight = availableItems.reduce((sum, item) => sum + Number(item.weight || 0), 0);
  if (totalWeight <= 0) {
    return { selectedIndex: 0 };
  }

  const roll = Number(seed % BigInt(totalWeight));
  let cumulative = 0;
  for (const item of availableItems) {
    cumulative += Number(item.weight || 0);
    if (roll < cumulative) {
      return { selectedIndex: Number(item.index || 0) };
    }
  }

  return { selectedIndex: Number(availableItems[availableItems.length - 1].index || 0) };
}

module.exports = { selectItem };
