import { useCallback, useState } from "react";
import type { PlayAreaProps } from "@shared/react/defineMiniApp";
import {
  buildConfidentialTransferPackage,
  encryptJsonWithOraclePublicKey,
} from "@shared/utils/morpheus-confidential-envelope";
import "./PlayArea.scss";

type SubmitState =
  | { status: "idle"; message: string }
  | { status: "sealing"; message: string }
  | {
      status: "stored";
      message: string;
      secretRef: string;
      noteCommitment: string;
      nullifier: string;
    }
  | { status: "error"; message: string };

function setObservable(state: PlayAreaProps["state"], key: string, value: unknown) {
  const observable = state[key];
  if (observable && typeof observable.set === "function") {
    observable.set(value);
  }
}

export default function PlayArea({ state, setStatus }: PlayAreaProps) {
  const [recipient, setRecipient] = useState("");
  const [asset, setAsset] = useState("GAS");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [network, setNetwork] = useState("testnet");
  const [submitState, setSubmitState] = useState<SubmitState>({
    status: "idle",
    message: "Ready to seal private transfer details locally.",
  });

  const sealTransfer = useCallback(async () => {
    setSubmitState({
      status: "sealing",
      message: "Fetching Morpheus key, encrypting locally, and storing ciphertext.",
    });
    setStatus("Sealing private transfer", "info");

    try {
      const keyResponse = await fetch(`/api/morpheus/oracle/public-key?network=${encodeURIComponent(network)}`);
      const keyMeta = await keyResponse.json().catch(() => ({}));
      if (!keyResponse.ok || !keyMeta?.public_key) {
        throw new Error(keyMeta?.error || "Morpheus oracle public key is unavailable");
      }

      const transferPackage = await buildConfidentialTransferPackage({
        appId: "miniapp-private-transfer",
        network,
        recipient,
        asset,
        amount,
        memo,
      });
      const ciphertext = await encryptJsonWithOraclePublicKey(
        String(keyMeta.public_key),
        transferPackage.confidentialPayload,
      );

      const storeResponse = await fetch("/api/morpheus/confidential/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          network,
          target_chain: "neo_n3",
          app_id: "miniapp-private-transfer",
          name: `private-transfer:${transferPackage.publicEnvelope.note_commitment}`,
          ciphertext,
          public_envelope: transferPackage.publicEnvelope,
        }),
      });
      const stored = await storeResponse.json().catch(() => ({}));
      if (!storeResponse.ok) {
        throw new Error(stored?.error || stored?.message || "Morpheus confidential store is unavailable");
      }
      const secretRef = String(stored.secret_ref || stored.id || stored.ref || "").trim();
      if (!secretRef) {
        throw new Error("Morpheus confidential store did not return a secret reference");
      }

      const requestCount = Number(state.requestCount?.get?.() ?? 0) + 1;
      setObservable(state, "requestCount", requestCount);
      setObservable(state, "lastStatus", "Sealed");
      setObservable(state, "lastDigest", transferPackage.publicEnvelope.note_commitment);
      setStatus("Private transfer sealed", "success");
      setSubmitState({
        status: "stored",
        message: "Ciphertext stored. Morpheus confidential compute can now decrypt and validate the private transfer payload inside the TEE.",
        secretRef,
        noteCommitment: transferPackage.publicEnvelope.note_commitment,
        nullifier: transferPackage.publicEnvelope.nullifier_hash,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(message, "error");
      setSubmitState({ status: "error", message });
    }
  }, [amount, asset, memo, network, recipient, setStatus, state]);

  return (
    <div className="private-transfer">
      <section className="private-transfer__hero">
        <div>
          <span>Neo N3 private payments</span>
          <h2>Confidential transfer desk</h2>
          <p>
            Seal recipient, amount, memo, and note secret before anything leaves
            the browser. Morpheus handles the private compute path.
          </p>
        </div>
        <div className="private-transfer__badge">No on-chain zk curve dependency</div>
      </section>

      <section className="private-transfer__grid">
        <div className="private-transfer__panel">
          <div className="private-transfer__form-grid">
            <label>
              <span>Network</span>
              <select value={network} onChange={(event) => setNetwork(event.target.value)}>
                <option value="testnet">Testnet</option>
                <option value="mainnet">Mainnet</option>
              </select>
            </label>
            <label>
              <span>Asset</span>
              <select value={asset} onChange={(event) => setAsset(event.target.value)}>
                <option>GAS</option>
                <option>NEO</option>
              </select>
            </label>
            <label>
              <span>Recipient</span>
              <input value={recipient} onChange={(event) => setRecipient(event.target.value)} />
            </label>
            <label>
              <span>Amount</span>
              <input type="number" min="0" step="0.00000001" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </label>
            <label className="private-transfer__wide">
              <span>Private memo</span>
              <input value={memo} onChange={(event) => setMemo(event.target.value)} />
            </label>
          </div>
          <button type="button" onClick={sealTransfer} disabled={submitState.status === "sealing"}>
            {submitState.status === "sealing" ? "Sealing..." : "Seal private transfer"}
          </button>
        </div>

        <aside className={`private-transfer__status private-transfer__status--${submitState.status}`}>
          <span>Morpheus confidential compute</span>
          <strong>{submitState.message}</strong>
          {submitState.status === "stored" && (
            <dl>
              <div>
                <dt>Secret ref</dt>
                <dd>{submitState.secretRef}</dd>
              </div>
              <div>
                <dt>Commitment</dt>
                <dd>{submitState.noteCommitment}</dd>
              </div>
              <div>
                <dt>Nullifier</dt>
                <dd>{submitState.nullifier}</dd>
              </div>
            </dl>
          )}
        </aside>
      </section>

      <section className="private-transfer__steps">
        {[
          ["1", "Deposit or wallet intent", "The public side only needs an asset lock or signed payment intent."],
          ["2", "Local encryption", "The private fields are sealed with X25519-HKDF-SHA256-AES-256-GCM."],
          ["3", "TEE validation", "Morpheus decrypts, checks nullifier reuse, and signs the settlement envelope."],
          ["4", "Release or refund", "The user submits the returned settlement intent through the wallet."],
        ].map(([index, title, body]) => (
          <article key={title}>
            <span>{index}</span>
            <strong>{title}</strong>
            <p>{body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
