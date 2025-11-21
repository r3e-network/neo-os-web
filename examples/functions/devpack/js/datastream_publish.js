// Publish a single data stream frame via Devpack runtime.
// Expects params.streamId (string), params.sequence (number), params.payload (object).
export default function (params = {}) {
  const streamId = String(params.streamId || "");
  const sequence = Number(params.sequence || 0);
  if (!streamId) throw new Error("streamId is required");
  if (!Number.isFinite(sequence) || sequence <= 0) throw new Error("sequence must be positive");

  const frame = Devpack.dataStreams.publishFrame({
    streamId,
    sequence,
    payload: params.payload || {},
    latencyMs: params.latencyMs || 0,
    status: params.status || "delivered",
    metadata: params.metadata,
  });

  return Devpack.respond.success({
    streamId,
    sequence,
    action: frame.asResult({ label: "datastream_frame" }),
  });
}
