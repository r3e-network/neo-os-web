import { useState } from "react";
import { ClientConfig, postBusCompute, postBusData, postBusEvent } from "../api";

type Props = {
  config: ClientConfig;
  onNotify: (type: "success" | "error", message: string) => void;
};

type Example = { label: string; payload: string };

const eventExamples: Record<string, Example> = {
  observation: {
    label: "Pricefeed observation",
    payload: JSON.stringify({ account_id: "acct-1", feed_id: "feed-1", price: "123.45", source: "dashboard" }, null, 2),
  },
  update: {
    label: "Datafeed update",
    payload: JSON.stringify({ account_id: "acct-1", feed_id: "feed-1", price: "123.45", round_id: 1 }, null, 2),
  },
  request: {
    label: "Oracle request",
    payload: JSON.stringify({ account_id: "acct-1", source_id: "src-1", payload: { hello: "world" } }, null, 2),
  },
  delivery: {
    label: "Datalink delivery",
    payload: JSON.stringify(
      { account_id: "acct-1", channel_id: "channel-1", payload: { hello: "world" }, metadata: { trace: "demo" } },
      null,
      2,
    ),
  },
};

const dataExample = JSON.stringify({ price: 123.45, ts: new Date().toISOString() }, null, 2);
const computeExample = JSON.stringify({ function_id: "fn-1", account_id: "acct-1", input: { foo: "bar" } }, null, 2);

export function BusConsole({ config, onNotify }: Props) {
  const [mode, setMode] = useState<"events" | "data" | "compute">("events");
  const [event, setEvent] = useState("observation");
  const [topic, setTopic] = useState("");
  const [payload, setPayload] = useState<string>('{"account_id":"","feed_id":"","price":"123.45"}');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult("");
    try {
      const trimmedPayload = payload.trim();
      const parsed = trimmedPayload ? JSON.parse(trimmedPayload) : undefined;
      if (mode === "events" && !event.trim()) {
        throw new Error("event is required");
      }
      if (mode === "data" && !topic.trim()) {
        throw new Error("topic is required");
      }
      let res: any;
      if (mode === "events") {
        res = await postBusEvent(config, event.trim(), parsed);
      } else if (mode === "data") {
        res = await postBusData(config, topic.trim(), parsed);
      } else {
        res = await postBusCompute(config, parsed);
      }
      setResult(JSON.stringify(res, null, 2));
      onNotify("success", "Bus request sent");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onNotify("error", msg);
      setResult(`Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="row between" style={{ alignItems: "center" }}>
        <h3>Engine Bus Console</h3>
        <div className="row" style={{ gap: "8px" }}>
          <label className="input-label">
            Mode
            <select value={mode} onChange={(e) => setMode(e.target.value as any)}>
              <option value="events">Events</option>
              <option value="data">Data</option>
              <option value="compute">Compute</option>
            </select>
          </label>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="stack" style={{ gap: "8px" }}>
        {mode === "events" && (
          <label className="input-label">
            Event name
            <input type="text" value={event} onChange={(e) => setEvent(e.target.value)} placeholder="observation|update|request|delivery" />
            {eventExamples[event]?.label && (
              <small className="muted">
                {eventExamples[event].label} —{" "}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => setPayload(eventExamples[event].payload)}
                  disabled={loading}
                >
                  Load example
                </button>
              </small>
            )}
          </label>
        )}
        {mode === "data" && (
          <label className="input-label">
            Topic
            <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="stream-id" />
            <small className="muted">
              <button
                type="button"
                className="link-button"
                onClick={() => setPayload(dataExample)}
                disabled={loading}
              >
                Load stream frame example
              </button>
            </small>
          </label>
        )}
        {mode === "compute" && (
          <div className="muted">
            <button
              type="button"
              className="link-button"
              onClick={() => setPayload(computeExample)}
              disabled={loading}
            >
              Load compute example
            </button>
          </div>
        )}
        <label className="input-label">
          Payload (JSON)
          <textarea value={payload} onChange={(e) => setPayload(e.target.value)} rows={5} spellCheck={false} />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send to bus"}
        </button>
      </form>
      {result && (
        <details open>
          <summary>Response</summary>
          <pre className="code" style={{ maxHeight: 240, overflow: "auto" }}>
            {result}
          </pre>
        </details>
      )}
    </div>
  );
}
