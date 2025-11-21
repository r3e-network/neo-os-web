// Enqueue a DataLink delivery via Devpack runtime.
// Expects params.channelId (string), params.payload (object).
export default function (params = {}) {
  const channelId = String(params.channelId || "");
  if (!channelId) throw new Error("channelId is required");

  const delivery = Devpack.dataLink.createDelivery({
    channelId,
    payload: params.payload || {},
    metadata: params.metadata,
  });

  return Devpack.respond.success({
    channelId,
    action: delivery.asResult({ label: "datalink_delivery" }),
  });
}
