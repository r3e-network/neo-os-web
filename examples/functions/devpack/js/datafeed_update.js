// Submit a data feed update via Devpack runtime.
// Expects params.feedId (string), params.roundId (number), params.price (string/number).
export default function (params = {}) {
  const feedId = String(params.feedId || "");
  const roundId = Number(params.roundId || 0);
  const price = params.price;

  if (!feedId) throw new Error("feedId is required");
  if (!Number.isFinite(roundId) || roundId <= 0) throw new Error("roundId must be positive");
  if (price === undefined || price === null) throw new Error("price is required");

  const action = Devpack.dataFeeds.submitUpdate({
    feedId,
    roundId,
    price: String(price),
    timestamp: params.timestamp,
    signer: params.signer,
    signature: params.signature,
    metadata: params.metadata,
  });

  return Devpack.respond.success({
    feedId,
    roundId,
    price: String(price),
    action: action.asResult({ label: "datafeed_update" }),
  });
}
