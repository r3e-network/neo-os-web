import { createObservable } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import { ownerMatchesAddress } from "@shared/utils/neo";
import {
  DEFAULT_SIGNING_DOMAIN,
  MAX_FILE_BYTES,
  MAX_HISTORY_ITEMS,
  createSignatureProof,
  historyItemFromProof,
  normalizeNetworkId,
  normalizeSignerAddress,
  normalizeWalletSignature,
  prepareExactPayloadPreview,
  prepareSigningPayload,
  sanitizeSignatureHistory,
  serializeSignatureProof,
  type FileDigestInfo,
  type PreparedSigningPayload,
  type SignatureHistoryItem,
  type SignatureProofArtifact,
  type SigningMode,
} from "../signing-artifact";

const HISTORY_STORAGE_KEY = "signature-history-v1";
const SIGN_COUNT_STORAGE_KEY = "signature-count-v1";

type PayloadStatus = "empty" | "preparing" | "waiting-wallet" | "ready" | "error";
type OperationStatus = "idle" | "connecting" | "wallet" | "complete" | "error" | "stale";

export interface UseSignAnythingOptions {
  app: MiniAppFramework;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function errorText(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return raw.trim() || fallback;
}

function localizedError(
  error: unknown,
  t: UseSignAnythingOptions["t"],
  fallbackKey: string,
): string {
  const raw = errorText(error, t(fallbackKey));
  if (/domain must/i.test(raw)) return t("domainInvalid");
  if (/payload exceeds/i.test(raw)) return t("payloadTooLarge");
  if (/invalid Neo N3 address/i.test(raw)) return t("walletAddressInvalid");
  if (/confirmed Neo N3/i.test(raw)) return t("networkRequired");
  if (/SHA-256 is unavailable/i.test(raw)) return t("shaUnavailable");
  if (/returned no signature|signature (?:format|length)/i.test(raw)) return t("signatureFormatInvalid");
  if (/public key format/i.test(raw)) return t("publicKeyInvalid");
  if (/enter a message|load a file digest/i.test(raw)) return t("messageRequired");
  if (
    raw === t("networkChangedReview") ||
    raw === t("signingContextChanged") ||
    raw === t("walletSignerMismatch")
  ) return raw;
  if (fallbackKey === "signFailed" && /reject|cancel|declin/i.test(raw)) return t("signCancelled");
  if (fallbackKey === "signFailed" && /does not support|not supported/i.test(raw)) return t("signUnsupported");
  return t(fallbackKey);
}

function contextFingerprint(input: {
  domain: string;
  file: FileDigestInfo | null;
  message: string;
  mode: SigningMode;
}): string {
  return JSON.stringify([
    input.mode,
    input.domain,
    input.message,
    input.file?.digest ?? "",
    input.file?.name ?? "",
    input.file?.size ?? 0,
  ]);
}

function hashBuffer(buffer: ArrayBuffer): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return Promise.reject(new Error("SHA-256 is unavailable in this browser context"));
  return subtle.digest("SHA-256", buffer).then((digest) =>
    Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""),
  );
}

export function useSignAnything({ app, t }: UseSignAnythingOptions) {
  const message = createObservable("");
  const signingMode = createObservable<SigningMode>("bound");
  const signingDomain = createObservable(DEFAULT_SIGNING_DOMAIN);
  const network = createObservable("");
  const fileInfo = createObservable<FileDigestInfo | null>(null);

  const payloadText = createObservable("");
  const payloadHash = createObservable("");
  const payloadBytes = createObservable(0);
  const payloadStatus = createObservable<PayloadStatus>("empty");
  const payloadError = createObservable("");

  const signature = createObservable("");
  const signatureEncoding = createObservable("");
  const publicKey = createObservable("");
  const artifact = createObservable<SignatureProofArtifact | null>(null);
  const proofBundle = createObservable("");

  const isConnecting = createObservable(false);
  const isHashing = createObservable(false);
  const isSigning = createObservable(false);
  const operationStatus = createObservable<OperationStatus>("idle");
  const lastError = createObservable("");

  const signCount = createObservable(0);
  const history = createObservable<SignatureHistoryItem[]>([]);
  const historyStorageHealthy = createObservable(true);

  let disposed = false;
  let fileGeneration = 0;
  let previewGeneration = 0;
  let walletGeneration = 0;

  const clearProof = () => {
    signature.set("");
    signatureEncoding.set("");
    publicKey.set("");
    artifact.set(null);
    proofBundle.set("");
  };

  const persistHistory = (items: SignatureHistoryItem[]) => {
    try {
      app.storage.local.set(HISTORY_STORAGE_KEY, items);
      const readback = sanitizeSignatureHistory(
        app.storage.local.get<unknown>(HISTORY_STORAGE_KEY, []),
      );
      historyStorageHealthy.set(JSON.stringify(readback) === JSON.stringify(items));
    } catch {
      historyStorageHealthy.set(false);
    }
  };

  const persistCount = (value: number) => {
    try {
      app.storage.local.set(SIGN_COUNT_STORAGE_KEY, value);
      const readback = Number(app.storage.local.get<number>(SIGN_COUNT_STORAGE_KEY, -1));
      if (readback !== value) historyStorageHealthy.set(false);
    } catch {
      historyStorageHealthy.set(false);
    }
  };

  const applyPreparedPayload = (prepared: PreparedSigningPayload) => {
    payloadText.set(prepared.signedText);
    payloadHash.set(prepared.signedSha256);
    payloadBytes.set(prepared.signedBytes);
    payloadError.set("");
    payloadStatus.set("ready");
  };

  const refreshPayloadPreview = async () => {
    const generation = ++previewGeneration;
    const content = message.get();
    if (!content.trim()) {
      payloadText.set("");
      payloadHash.set("");
      payloadBytes.set(0);
      payloadError.set("");
      payloadStatus.set("empty");
      return;
    }

    payloadStatus.set("preparing");
    try {
      if (signingMode.get() === "exact") {
        const preview = await prepareExactPayloadPreview(content);
        if (disposed || generation !== previewGeneration) return;
        payloadText.set(preview.exactText);
        payloadHash.set(preview.sha256);
        payloadBytes.set(preview.bytes);
        payloadError.set("");
        payloadStatus.set("ready");
        return;
      }

      const account = text(app.chain.address.get());
      const activeNetwork = network.get();
      if (!account || !activeNetwork) {
        payloadText.set("");
        payloadHash.set("");
        payloadBytes.set(0);
        payloadError.set("");
        payloadStatus.set("waiting-wallet");
        return;
      }

      const prepared = await prepareSigningPayload({
        account,
        content,
        domain: signingDomain.get(),
        file: fileInfo.get(),
        mode: signingMode.get(),
        network: activeNetwork,
      });
      if (disposed || generation !== previewGeneration) return;
      applyPreparedPayload(prepared);
    } catch (error) {
      if (disposed || generation !== previewGeneration) return;
      payloadText.set("");
      payloadHash.set("");
      payloadBytes.set(0);
      payloadError.set(localizedError(error, t, "payloadPrepareFailed"));
      payloadStatus.set("error");
    }
  };

  const refreshNetwork = async (): Promise<string> => {
    try {
      const detected = normalizeNetworkId(await app.chain.detectNetwork());
      network.set(detected);
      return detected;
    } catch (error) {
      network.set("");
      throw error;
    }
  };

  const setMessage = (value: string) => {
    message.set(String(value ?? ""));
  };

  const setSigningMode = (value: string) => {
    if (value !== "bound" && value !== "exact") return;
    signingMode.set(value);
  };

  const setSigningDomain = (value: string) => {
    signingDomain.set(String(value ?? ""));
  };

  const connectWallet = async (): Promise<string> => {
    if (isConnecting.get()) return text(app.chain.address.get());
    isConnecting.set(true);
    operationStatus.set("connecting");
    lastError.set("");
    try {
      const connected = text(await app.chain.ensureWallet());
      const current = text(app.chain.address.get()) || connected;
      if (!current) throw new Error(t("connectWallet"));
      normalizeSignerAddress(current);
      await refreshNetwork();
      operationStatus.set("idle");
      await refreshPayloadPreview();
      return current;
    } catch (error) {
      const friendly = localizedError(error, t, "connectWallet");
      network.set("");
      lastError.set(friendly);
      operationStatus.set("error");
      await refreshPayloadPreview();
      throw new Error(friendly);
    } finally {
      isConnecting.set(false);
    }
  };

  const signMessage = async (nextMessage?: string): Promise<SignatureProofArtifact | null> => {
    if (isSigning.get()) return null;
    if (typeof nextMessage === "string" && nextMessage !== message.get()) setMessage(nextMessage);
    if (!message.get().trim()) throw new Error(t("messageRequired"));

    isSigning.set(true);
    lastError.set("");
    clearProof();
    try {
      const ensured = text(app.chain.address.get()) || text(await app.chain.ensureWallet());
      const rawAccount = text(app.chain.address.get()) || ensured;
      if (!rawAccount) throw new Error(t("connectWallet"));
      const account = normalizeSignerAddress(rawAccount);
      const displayedNetwork = network.get();
      const activeNetwork = await refreshNetwork();
      const requestWalletGeneration = walletGeneration;
      const snapshot = {
        domain: signingDomain.get(),
        file: fileInfo.get(),
        message: message.get(),
        mode: signingMode.get(),
      };
      const requestFingerprint = contextFingerprint(snapshot);
      const prepared = await prepareSigningPayload({
        account,
        content: snapshot.message,
        domain: snapshot.domain,
        file: snapshot.file,
        mode: snapshot.mode,
        network: activeNetwork,
      });
      applyPreparedPayload(prepared);
      if (displayedNetwork && displayedNetwork !== activeNetwork) {
        operationStatus.set("stale");
        throw new Error(t("networkChangedReview"));
      }

      operationStatus.set("wallet");
      const result = await app.chain.signMessage(prepared.signedText);
      const finalNetwork = await refreshNetwork();
      const finalAccount = text(app.chain.address.get());
      const finalFingerprint = contextFingerprint({
        domain: signingDomain.get(),
        file: fileInfo.get(),
        message: message.get(),
        mode: signingMode.get(),
      });
      if (
        requestWalletGeneration !== walletGeneration ||
        !ownerMatchesAddress(finalAccount, account) ||
        finalNetwork !== activeNetwork ||
        finalFingerprint !== requestFingerprint
      ) {
        operationStatus.set("stale");
        throw new Error(t("signingContextChanged"));
      }

      const reportedAccount = text(result.account);
      if (reportedAccount && !ownerMatchesAddress(reportedAccount, account)) {
        operationStatus.set("stale");
        throw new Error(t("walletSignerMismatch"));
      }

      const normalized = normalizeWalletSignature(result);
      const proof = createSignatureProof({ payload: prepared, signature: normalized });
      signature.set(normalized.value);
      signatureEncoding.set(normalized.encoding);
      publicKey.set(normalized.publicKey ?? "");
      artifact.set(proof);
      proofBundle.set(serializeSignatureProof(proof));

      const nextHistory = [historyItemFromProof(proof), ...history.get()]
        .filter((item, index, items) => items.findIndex((other) => other.id === item.id) === index)
        .slice(0, MAX_HISTORY_ITEMS);
      history.set(nextHistory);
      persistHistory(nextHistory);
      signCount.set(Math.min(Number.MAX_SAFE_INTEGER, signCount.get() + 1));
      persistCount(signCount.get());
      operationStatus.set("complete");
      lastError.set("");
      app.notify.success("signSuccess");
      return proof;
    } catch (error) {
      clearProof();
      const friendly = localizedError(error, t, "signFailed");
      lastError.set(friendly);
      if (operationStatus.get() !== "stale") operationStatus.set("error");
      await refreshPayloadPreview();
      throw new Error(friendly);
    } finally {
      isSigning.set(false);
    }
  };

  const loadFileDigest = async (file: File): Promise<string> => {
    if (!file) return "";
    const generation = ++fileGeneration;
    isHashing.set(false);
    clearProof();
    const previousFile = fileInfo.get();
    if (previousFile) {
      fileInfo.set(null);
      if (message.get() === previousFile.payload) message.set("");
    }
    if (file.size > MAX_FILE_BYTES) {
      const error = t("fileTooLarge");
      lastError.set(error);
      operationStatus.set("error");
      throw new Error(error);
    }
    isHashing.set(true);
    lastError.set("");
    try {
      const buffer = typeof file.arrayBuffer === "function"
        ? await file.arrayBuffer()
        : await new Response(file).arrayBuffer();
      const digest = await hashBuffer(buffer);
      if (disposed || generation !== fileGeneration) return "";
      const payload = `sha256:${digest}`;
      fileInfo.set({
        name: file.name || t("unnamedFile"),
        size: file.size,
        type: file.type || "application/octet-stream",
        digest,
        payload,
      });
      message.set(payload);
      return payload;
    } catch (error) {
      if (disposed || generation !== fileGeneration) return "";
      const friendly = localizedError(error, t, "fileHashFailed");
      lastError.set(friendly);
      operationStatus.set("error");
      throw new Error(friendly);
    } finally {
      if (generation === fileGeneration) isHashing.set(false);
    }
  };

  const copyToClipboard = async (value: string) => {
    if (!value) return;
    await app.clipboard.copy(value, { successKey: "copySuccess" });
  };

  const clearHistory = () => {
    history.set([]);
    persistHistory([]);
  };

  const loadData = async () => {
    try {
      const storedHistory = app.storage.local.get<unknown>(HISTORY_STORAGE_KEY, []);
      const savedHistory = sanitizeSignatureHistory(storedHistory);
      history.set(savedHistory);
      if (Array.isArray(storedHistory) && storedHistory.length !== savedHistory.length) {
        historyStorageHealthy.set(false);
      }
      const savedCount = Number(app.storage.local.get<number>(SIGN_COUNT_STORAGE_KEY, 0));
      if (Number.isSafeInteger(savedCount) && savedCount >= 0) {
        signCount.set(savedCount);
      } else {
        signCount.set(0);
        historyStorageHealthy.set(false);
      }
    } catch {
      historyStorageHealthy.set(false);
    }

    const connectedAddress = text(app.chain.address.get());
    if (connectedAddress) {
      try {
        normalizeSignerAddress(connectedAddress);
        await refreshNetwork();
      } catch (error) {
        network.set("");
        lastError.set(localizedError(error, t, "connectWallet"));
        operationStatus.set("error");
      }
    }
    await refreshPayloadPreview();
  };

  const messageUnsubscribe = message.subscribe(() => {
    const currentFile = fileInfo.get();
    if (currentFile && currentFile.payload !== message.get()) fileInfo.set(null);
    clearProof();
    if (!isSigning.get()) operationStatus.set("idle");
    lastError.set("");
    void refreshPayloadPreview();
  });
  const modeUnsubscribe = signingMode.subscribe(() => {
    clearProof();
    if (!isSigning.get()) operationStatus.set("idle");
    void refreshPayloadPreview();
  });
  const domainUnsubscribe = signingDomain.subscribe(() => {
    clearProof();
    if (!isSigning.get()) operationStatus.set("idle");
    void refreshPayloadPreview();
  });
  const addressUnsubscribe = app.wallet.onAccountChanged(({ previous, current }) => {
    const nextAddress = current ?? "";
    const hadBoundResult = Boolean(artifact.get() || (isSigning.get() && previous));
    walletGeneration += 1;
    network.set("");
    clearProof();
    if (hadBoundResult) {
      operationStatus.set("stale");
      lastError.set(t("walletChanged"));
    } else if (!isConnecting.get()) {
      operationStatus.set("idle");
    }
    if (nextAddress) {
      try {
        normalizeSignerAddress(nextAddress);
      } catch (error) {
        network.set("");
        if (!hadBoundResult) {
          operationStatus.set("error");
          lastError.set(localizedError(error, t, "connectWallet"));
        }
        void refreshPayloadPreview();
        return;
      }
      void refreshNetwork()
        .then(() => refreshPayloadPreview())
        .catch((error) => {
          network.set("");
          if (!hadBoundResult) {
            operationStatus.set("error");
            lastError.set(localizedError(error, t, "connectWallet"));
          }
          void refreshPayloadPreview();
        });
    } else {
      void refreshPayloadPreview();
    }
  });

  const cleanup = () => {
    disposed = true;
    fileGeneration += 1;
    previewGeneration += 1;
    messageUnsubscribe();
    modeUnsubscribe();
    domainUnsubscribe();
    addressUnsubscribe();
  };

  return {
    address: app.chain.address,
    network,
    message,
    signingMode,
    signingDomain,
    fileInfo,
    payloadText,
    payloadHash,
    payloadBytes,
    payloadStatus,
    payloadError,
    signature,
    signatureEncoding,
    publicKey,
    artifact,
    proofBundle,
    isConnecting,
    isHashing,
    isSigning,
    operationStatus,
    lastError,
    signCount,
    history,
    historyStorageHealthy,
    setMessage,
    setSigningMode,
    setSigningDomain,
    connectWallet,
    signMessage,
    loadFileDigest,
    copyToClipboard,
    clearHistory,
    loadData,
    cleanup,
  };
}
