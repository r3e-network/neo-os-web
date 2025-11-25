import { useEffect, useState } from "react";
import {
  NeoBlock,
  NeoBlockDetail,
  NeoSnapshot,
  NeoStorage,
  NeoStorageDiff,
  NeoStorageSummary,
  fetchNeoBlockDetail,
  fetchNeoBlocks,
  fetchNeoSnapshots,
  fetchNeoStorage,
  fetchNeoStorageDiff,
  fetchNeoStorageSummary,
  normaliseUrl,
} from "../api";

declare global {
  interface Window {
    neoAuthToken?: string;
  }
}

const VERIFY_STORAGE_KEY = "neoVerifyResults";

type Props = {
  baseUrl: string;
  token: string;
  onNotify?: (type: "success" | "error", message: string) => void;
};

function truncate(value?: string, length = 14) {
  if (!value) return "";
  if (value.length <= length) return value;
  return `${value.slice(0, length)}…`;
}

function formatBytes(bytes?: number) {
  if (bytes === undefined || bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let val = bytes / 1024;
  let idx = 0;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val.toFixed(1)} ${units[idx]}`;
}

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyResource(url: string, sha: string) {
  const resp = await fetch(url, {
    headers: {
      // Allow hitting protected endpoints with the configured token.
      Authorization: window.neoAuthToken ? `Bearer ${window.neoAuthToken}` : "",
    },
  });
  if (!resp.ok) {
    throw new Error(`${resp.status} ${resp.statusText}`);
  }
  const buf = await resp.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const hex = bufferToHex(digest);
  if (hex.toLowerCase() !== sha.toLowerCase()) {
    throw new Error(`hash mismatch expected ${truncate(sha, 24)} got ${truncate(hex, 24)}`);
  }
}

function decodeKey(value: string): Uint8Array {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("empty key");
  const maybeHex = trimmed.toLowerCase().match(/^[0-9a-f]+$/);
  if (maybeHex) {
    if (trimmed.length % 2 !== 0) {
      throw new Error("hex key must have even length");
    }
    const out = new Uint8Array(trimmed.length / 2);
    for (let i = 0; i < trimmed.length; i += 2) {
      out[i / 2] = parseInt(trimmed.slice(i, i + 2), 16);
    }
    return out;
  }
  try {
    const bin = atob(trimmed);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      out[i] = bin.charCodeAt(i);
    }
    return out;
  } catch {
    throw new Error("key must be hex or base64");
  }
}

async function verifySignature(snapshot: NeoSnapshot) {
  if (!snapshot.signature || !snapshot.signing_public_key) {
    throw new Error("missing signature or public key");
  }
  if (!window.crypto?.subtle) {
    throw new Error("WebCrypto not available for signature verification");
  }
  const pub = decodeKey(snapshot.signing_public_key);
  const sig = decodeKey(snapshot.signature);
  const payload = `${snapshot.network}|${snapshot.height}|${snapshot.state_root}|${snapshot.kv_sha256 || ""}|${snapshot.kv_diff_sha256 || ""}`;
  const pubBuf = pub.buffer as ArrayBuffer;
  const sigBuf = sig.buffer as ArrayBuffer;
  const key = await crypto.subtle.importKey("raw", pubBuf, { name: "Ed25519" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("Ed25519", key, sigBuf, new TextEncoder().encode(payload));
  if (!ok) {
    throw new Error("signature verification failed");
  }
}

export function NeoPanel({ baseUrl, token, onNotify }: Props) {
  const [loading, setLoading] = useState(false);
  const [blocks, setBlocks] = useState<NeoBlock[]>([]);
  const [snaps, setSnaps] = useState<NeoSnapshot[]>([]);
  const [selected, setSelected] = useState<NeoBlockDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [verifying, setVerifying] = useState<number | null>(null);
  const [verifyResults, setVerifyResults] = useState<Record<number, { ok: boolean; message: string }>>({});
  const [storage, setStorage] = useState<NeoStorage[]>([]);
  const [storageDiff, setStorageDiff] = useState<NeoStorageDiff[]>([]);
  const [storageSummary, setStorageSummary] = useState<NeoStorageSummary[]>([]);
  const [storageSummaryLoading, setStorageSummaryLoading] = useState(false);
  const [storageLoading, setStorageLoading] = useState(false);
  const [storageDiffLoading, setStorageDiffLoading] = useState(false);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [bulkVerifying, setBulkVerifying] = useState(false);

  const canQuery = baseUrl.trim().length > 0 && token.trim().length > 0;
  // Keep the auth token reachable for helper functions.
  (window as any).neoAuthToken = token.trim();

  function loadVerifyResults(api: string): Record<number, { ok: boolean; message: string }> {
    try {
      const raw = localStorage.getItem(VERIFY_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, Record<number, { ok: boolean; message: string }>>;
      return parsed[api] || {};
    } catch {
      return {};
    }
  }

  function persistVerifyResults(api: string, results: Record<number, { ok: boolean; message: string }>) {
    try {
      const raw = localStorage.getItem(VERIFY_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Record<string, Record<number, { ok: boolean; message: string }>>) : {};
      parsed[api] = results;
      localStorage.setItem(VERIFY_STORAGE_KEY, JSON.stringify(parsed));
    } catch {
      // ignore storage errors
    }
  }

  const updateVerifyResults = (api: string, updater: (prev: Record<number, { ok: boolean; message: string }>) => Record<number, { ok: boolean; message: string }>) => {
    setVerifyResults((prev) => {
      const next = updater(prev);
      persistVerifyResults(api, next);
      return next;
    });
  };

  const resolveLink = (maybeRelative?: string) => {
    if (!maybeRelative) return "";
    if (maybeRelative.startsWith("http://") || maybeRelative.startsWith("https://")) {
      return maybeRelative;
    }
    const base = normaliseUrl(baseUrl);
    return `${base}${maybeRelative.startsWith("/") ? "" : "/"}${maybeRelative}`;
  };

  async function downloadResource(url: string, filename: string) {
    const resp = await fetch(url, {
      headers: { Authorization: token.trim() ? `Bearer ${token.trim()}` : "" },
    });
    if (!resp.ok) {
      throw new Error(`${resp.status} ${resp.statusText}`);
    }
    const blob = await resp.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      a.remove();
    }, 0);
  }

  async function load() {
    if (!canQuery) {
      setBlocks([]);
      setSnaps([]);
      return;
    }
    setLoading(true);
    try {
      const config = { baseUrl: normaliseUrl(baseUrl), token: token.trim() };
      const [b, s] = await Promise.all([fetchNeoBlocks(config, 5), fetchNeoSnapshots(config, 5)]);
      setBlocks(b);
      setSnaps(s);
      // load persisted verification results for this API
      const saved = loadVerifyResults(config.baseUrl);
      setVerifyResults(saved);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onNotify?.("error", `NEO refresh failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, token]);

  async function loadDetail(height: number) {
    if (!canQuery) return;
    setLoadingDetail(true);
    setStorage([]);
    setStorageDiff([]);
    setStorageSummary([]);
    setStorageLoaded(false);
    try {
      const config = { baseUrl: normaliseUrl(baseUrl), token: token.trim() };
      setStorageSummaryLoading(true);
      const [detailResult, summaryResult] = await Promise.allSettled([fetchNeoBlockDetail(config, height), fetchNeoStorageSummary(config, height)]);
      if (detailResult.status === "fulfilled") {
        setSelected(detailResult.value);
      } else {
        const msg = detailResult.reason instanceof Error ? detailResult.reason.message : String(detailResult.reason);
        onNotify?.("error", `Failed to load block ${height}: ${msg}`);
      }
      if (summaryResult.status === "fulfilled") {
        setStorageSummary(summaryResult.value || []);
      } else {
        // Fallback to legacy full storage fetch when summary isn't available.
        await loadStorageBlobs(config, height, true, true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onNotify?.("error", `Failed to load block ${height}: ${msg}`);
    } finally {
      setLoadingDetail(false);
      setStorageSummaryLoading(false);
    }
  }

  function buildSummaryFromBlobs(kv: NeoStorage[], diffs: NeoStorageDiff[]): NeoStorageSummary[] {
    const byContract = new Map<string, { kv: number; diff: number }>();
    kv.forEach((item) => byContract.set(item.contract, { kv: Array.isArray(item.kv) ? item.kv.length : 0, diff: 0 }));
    diffs.forEach((item) => {
      const existing = byContract.get(item.contract) || { kv: 0, diff: 0 };
      existing.diff = Array.isArray(item.kv_diff) ? item.kv_diff.length : 0;
      byContract.set(item.contract, existing);
    });
    return Array.from(byContract.entries())
      .map(([contract, counts]) => ({ contract, kv_entries: counts.kv, diff_entries: counts.diff }))
      .sort((a, b) => a.contract.localeCompare(b.contract));
  }

  async function loadStorageBlobs(
    config: { baseUrl: string; token: string },
    height: number,
    silent = false,
    deriveSummary = false,
  ) {
    setStorageLoading(true);
    setStorageDiffLoading(true);
    try {
      const [kv, diffs] = await Promise.all([fetchNeoStorage(config, height), fetchNeoStorageDiff(config, height)]);
      setStorage(kv);
      setStorageDiff(diffs);
      setStorageLoaded(true);
      if (deriveSummary) {
        setStorageSummary(buildSummaryFromBlobs(kv, diffs));
      }
    } catch (err) {
      if (!silent) {
        const msg = err instanceof Error ? err.message : String(err);
        onNotify?.("error", `Storage fetch failed: ${msg}`);
      }
      setStorage([]);
      setStorageDiff([]);
    } finally {
      setStorageLoading(false);
      setStorageDiffLoading(false);
    }
  }

  async function verifySnapshot(s: NeoSnapshot) {
    const kvURL = resolveLink(s.kv_url);
    if (!kvURL || !s.kv_sha256) {
      onNotify?.("error", "Snapshot is missing download URL or hash");
      return;
    }
    setVerifying(s.height);
    const diffURL = resolveLink(s.kv_diff_url);
    try {
      await verifyResource(kvURL, s.kv_sha256);
      if (diffURL && s.kv_diff_sha256) {
        await verifyResource(diffURL, s.kv_diff_sha256);
      }
      if (s.signature && s.signing_public_key) {
        await verifySignature(s);
      }
      const msg = `Snapshot #${s.height} verified${s.signature ? " (hash + signature)" : ""}${diffURL && s.kv_diff_sha256 ? " (+ diff)" : ""}`;
      updateVerifyResults(normaliseUrl(baseUrl), (prev) => ({ ...prev, [s.height]: { ok: true, message: msg } }));
      onNotify?.("success", msg);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      updateVerifyResults(normaliseUrl(baseUrl), (prev) => ({ ...prev, [s.height]: { ok: false, message: msg } }));
      onNotify?.("error", `Verify failed: ${msg}`);
    } finally {
      setVerifying(null);
    }
  }

  return (
    <div className="card inner">
      <div className="row">
        <h3>NEO (indexer + snapshots)</h3>
        <button onClick={load} disabled={loading} className="btn small">
          {loading ? "Loading…" : "Refresh"}
        </button>
        {snaps.length > 0 && (
          <button
            className="btn small"
            disabled={bulkVerifying}
            onClick={async () => {
              setBulkVerifying(true);
              updateVerifyResults(normaliseUrl(baseUrl), () => ({}));
              for (const snap of snaps) {
                try {
                  await verifySnapshot(snap);
                } catch {
                  // per-snapshot notifier already fired
                }
              }
              setBulkVerifying(false);
            }}
          >
            {bulkVerifying ? "Verifying snapshots…" : "Verify all"}
          </button>
        )}
      </div>
      {!canQuery && <p className="muted">Set API URL and token to view NEO data.</p>}
      {canQuery && blocks.length === 0 && snaps.length === 0 && <p className="muted">No blocks or snapshots available yet.</p>}
      {blocks.length > 0 && (
        <>
          <p className="muted">Latest blocks</p>
          <ul className="list">
            {blocks.map((b) => (
              <li key={b.height} onClick={() => void loadDetail(b.height)} style={{ cursor: "pointer" }}>
                <div className="row">
                  <span className="tag subdued">#{b.height}</span>
                  <span className="mono">{truncate(b.hash)}</span>
                  {b.state_root && <span className="tag subdued mono">root {truncate(b.state_root)}</span>}
                </div>
                <div className="muted mono">
                  txs {b.tx_count ?? 0} {b.block_time && `• ${b.block_time}`}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {snaps.length > 0 && (
        <>
          <p className="muted">Snapshots</p>
          <ul className="list">
            {snaps.map((s) => (
              <li key={s.height}>
                <div className="row">
                  <span className="tag subdued">#{s.height}</span>
                  <span className="tag">{s.network}</span>
                  <span className="mono">{truncate(s.state_root)}</span>
                  {s.signing_public_key && s.signature && <span className="tag success">signed</span>}
                  {verifying === s.height && <span className="tag subdued">verifying…</span>}
                  {verifyResults[s.height] && (
                    <span className={`tag ${verifyResults[s.height].ok ? "success" : "error"}`}>
                      {verifyResults[s.height].ok ? "verified" : "failed"}
                    </span>
                  )}
                </div>
                {verifyResults[s.height] && (
                  <div className={`notice ${verifyResults[s.height].ok ? "success" : "error"}`}>
                    {verifyResults[s.height].message}
                  </div>
                )}
                <div className="muted mono row" style={{ gap: "6px", alignItems: "center" }}>
                  <a href={resolveLink(`/neo/snapshots/${s.height}`)} target="_blank" rel="noreferrer">
                    manifest (unauth)
                  </a>
                  <button
                    className="btn tiny"
                    onClick={async (e) => {
                      e.preventDefault();
                      try {
                        await downloadResource(resolveLink(`/neo/snapshots/${s.height}`), `block-${s.height}.json`);
                        onNotify?.("success", "Manifest downloaded");
                      } catch (err) {
                        const msg = err instanceof Error ? err.message : String(err);
                        onNotify?.("error", `Download failed: ${msg}`);
                      }
                    }}
                  >
                    manifest (auth)
                  </button>
                </div>
                <div className="muted mono">
                  {s.kv_url ? (
                    <div className="row" style={{ gap: "6px", alignItems: "center" }}>
                      <a href={resolveLink(s.kv_url)} target="_blank" rel="noreferrer">
                        download (unauth)
                      </a>
                      <button
                        className="btn tiny"
                        onClick={async (e) => {
                          e.preventDefault();
                          try {
                            await downloadResource(resolveLink(s.kv_url), `block-${s.height}-kv.tar.gz`);
                            onNotify?.("success", "KV downloaded");
                          } catch (err) {
                            const msg = err instanceof Error ? err.message : String(err);
                            onNotify?.("error", `Download failed: ${msg}`);
                          }
                        }}
                      >
                        download (auth)
                      </button>
                    </div>
                  ) : (
                    s.kv_path || "kv bundle unavailable"
                  )}
                  {s.kv_bytes !== undefined && ` • ${formatBytes(s.kv_bytes)}`}
                  {s.kv_sha256 && (
                    <>
                      {" "}
                      • sha: {truncate(s.kv_sha256, 20)}{" "}
                      <button
                        className="btn tiny"
                        onClick={(e) => {
                          e.preventDefault();
                          void navigator.clipboard.writeText(s.kv_sha256 || "");
                          onNotify?.("success", "KV hash copied");
                        }}
                      >
                        copy
                      </button>
                      {s.kv_url && (
                        <button
                        className="btn tiny"
                        disabled={verifying === s.height}
                        onClick={(e) => {
                          e.preventDefault();
                          void verifySnapshot(s);
                        }}
                      >
                        {verifying === s.height ? "Verifying..." : "Verify"}
                      </button>
                      )}
                      {s.kv_diff_url && s.kv_diff_sha256 && (
                        <div className="muted mono row" style={{ gap: "8px", alignItems: "center" }}>
                          <span>
                            Diff: {formatBytes(s.kv_diff_bytes)} • sha {truncate(s.kv_diff_sha256, 20)}
                          </span>
                          <a href={resolveLink(s.kv_diff_url)} target="_blank" rel="noreferrer" className="btn tiny">
                            download diff
                          </a>
                          <button
                            className="btn tiny"
                            onClick={async (e) => {
                              e.preventDefault();
                              try {
                                await downloadResource(resolveLink(s.kv_diff_url), `block-${s.height}-kv-diff.tar.gz`);
                                onNotify?.("success", "Diff downloaded");
                              } catch (err) {
                                const msg = err instanceof Error ? err.message : String(err);
                                onNotify?.("error", `Download failed: ${msg}`);
                              }
                            }}
                          >
                            download (auth)
                          </button>
                          <button
                            className="btn tiny"
                            onClick={(e) => {
                              e.preventDefault();
                              void navigator.clipboard.writeText(s.kv_diff_sha256 || "");
                              onNotify?.("success", "Diff hash copied");
                            }}
                          >
                            copy hash
                          </button>
                        </div>
                      )}
                      {s.signature && s.signing_public_key && (
                        <div className="muted mono">
                          signed by {truncate(s.signing_public_key, 18)}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {selected && (
        <div className="panel">
          <div className="row">
            <h4>Block #{selected.block.height}</h4>
            {loadingDetail && <span className="tag subdued">Loading…</span>}
          </div>
          <p className="muted mono">Hash {truncate(selected.block.hash, 24)} • Root {truncate(selected.block.state_root, 24)}</p>
          <p className="muted mono">Transactions: {selected.transactions.length}</p>
          {selected.transactions.length > 0 && (
            <ul className="list">
              {selected.transactions.slice(0, 5).map((tx) => (
                <li key={tx.hash}>
                  <div className="row">
                    <span className="tag subdued">{tx.ordinal}</span>
                    <span className="mono">{truncate(tx.hash, 28)}</span>
                    {tx.vm_state && <span className={`tag ${tx.vm_state === "HALT" ? "subdued" : "error"}`}>{tx.vm_state}</span>}
                  </div>
                  {tx.exception && <div className="muted mono">{tx.exception}</div>}
                </li>
              ))}
              {selected.transactions.length > 5 && <li className="muted">(+{selected.transactions.length - 5} more)</li>}
            </ul>
          )}
          <p className="muted mono">Storage captured for block (if any contracts were touched)</p>
          {storageSummaryLoading && <p className="muted">Loading storage summary…</p>}
          {!storageSummaryLoading && storageSummary.length === 0 && <p className="muted">No storage captured for this height.</p>}
          {storageSummary.length > 0 && (
            <>
              <div className="row" style={{ gap: "8px", alignItems: "center" }}>
                <span className="muted mono">{storageSummary.length} contract(s) touched</span>
                <button
                  className="btn tiny"
                  disabled={storageLoading || storageDiffLoading}
                  onClick={() => {
                    const config = { baseUrl: normaliseUrl(baseUrl), token: token.trim() };
                    void loadStorageBlobs(config, selected.block.height);
                  }}
                >
                  {storageLoading || storageDiffLoading ? "Loading blobs…" : "Load storage blobs"}
                </button>
                {storageLoaded && <span className="tag success">Blobs loaded</span>}
              </div>
              <ul className="list">
                {storageSummary.map((s) => (
                  <li key={s.contract}>
                    <div className="row">
                      <span className="tag subdued">{s.contract}</span>
                      <span className="muted mono">
                        KV {s.kv_entries} {typeof s.diff_entries === "number" ? `• Diff ${s.diff_entries}` : ""}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
          {storageLoading && <p className="muted">Loading storage blobs…</p>}
          {storageLoaded && storage.length === 0 && <p className="muted">No storage blobs returned for this height.</p>}
          {storageLoaded && storage.length > 0 && (
            <ul className="list">
              {storage.slice(0, 5).map((s) => (
                <li key={s.contract}>
                  <div className="row">
                    <span className="tag subdued">{s.contract}</span>
                    <button
                      className="btn tiny"
                      onClick={() => {
                        void navigator.clipboard.writeText(JSON.stringify(s.kv, null, 2));
                        onNotify?.("success", "Storage copied");
                      }}
                    >
                      Copy JSON
                    </button>
                  </div>
                  <div className="muted mono">{Array.isArray(s.kv) ? `${s.kv.length} entries` : "kv blob"}</div>
                </li>
              ))}
              {storage.length > 5 && <li className="muted">(+{storage.length - 5} more)</li>}
            </ul>
          )}
          <p className="muted mono">Storage diffs (changes vs previous height)</p>
          {storageDiffLoading && <p className="muted">Loading storage diff…</p>}
          {storageLoaded && storageDiff.length === 0 && !storageDiffLoading && <p className="muted">No diffs captured for this height.</p>}
          {storageDiff.length > 0 && (
            <ul className="list">
              {storageDiff.slice(0, 5).map((s) => (
                <li key={s.contract}>
                  <div className="row">
                    <span className="tag subdued">{s.contract}</span>
                    <button
                      className="btn tiny"
                      onClick={() => {
                        void navigator.clipboard.writeText(JSON.stringify(s.kv_diff, null, 2));
                        onNotify?.("success", "Storage diff copied");
                      }}
                    >
                      Copy diff JSON
                    </button>
                  </div>
                  <div className="muted mono">{Array.isArray(s.kv_diff) ? `${s.kv_diff.length} changed keys` : "kv diff"}</div>
                </li>
              ))}
              {storageDiff.length > 5 && <li className="muted">(+{storageDiff.length - 5} more)</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
