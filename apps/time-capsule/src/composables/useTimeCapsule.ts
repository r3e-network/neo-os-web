import { createObservable, type Observable } from "@shared/react/context";
import { FrameworkPrepaidActionError, type MiniAppFramework } from "@shared/react";
import { GAS_DECIMALS_MULTIPLIER } from "@shared/utils/amounts";
import { eventValue } from "@shared/utils/chain-events";
import { sha256Hex } from "@shared/utils/hash";
import { hexToBytes } from "@shared/utils/format";
import { parseBigInt } from "@shared/utils/parsers";
import { GAS_HASH } from "@shared/constants";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import {
  TIME_CAPSULE_EVENT_WAIT_MS,
  isPendingTimeCapsuleOperation,
  normalizeTimeCapsuleHash,
  readTimeCapsulePaymentOutcome,
  readTimeCapsuleTransactionOutcome,
  requireCanonicalTimeCapsuleContext,
  timeCapsuleAccountMatches,
  type PendingTimeCapsuleOperation,
  type TimeCapsuleChainContext,
  type TimeCapsulePendingKind,
} from "../time-capsule-safety";

const MIN_LOCK_DAYS = 1;
const MAX_LOCK_DAYS = 3650;
const CONTENT_STORE_KEY = "content";
const META_STORE_KEY = "meta";
const PENDING_STORE_KEY = "pendingOperation";
const PENDING_DURABLE_STORE_KEY = `state/${PENDING_STORE_KEY}`;
const RECOVERY_STORAGE_PROBE_KEY = "recovery-storage-probe-v1";
const BURY_MEMO = "miniapp-timecapsule:bury";
const FISH_MEMO_PREFIX = "miniapp-timecapsule:fish:";
const CAPSULE_CREATE_AMOUNT = "0.2";
const FISH_FEE_AMOUNT = "0.05";
const MAX_SCAN = 200;
const OWNER_PAGE_LIMIT = 100;
const MAX_OWNER_CAPSULES = 5_000;
const CAPSULE_READ_BATCH = 20;

export type CapsuleDataSource = "none" | "loading" | "chain" | "failed";

export interface Capsule {
  id: string;
  title: string;
  contentHash: string;
  unlockDate: string;
  unlockTime: number;
  locked: boolean;
  revealed: boolean;
  isPublic: boolean;
  content: string;
  amount: string;
  fished: boolean;
  category: number;
  owner: string;
}

export interface CapsuleFormData {
  title: string;
  content: string;
  days: string;
  isPublic: boolean;
  category: number;
}

export interface UseTimeCapsuleOptions {
  app: MiniAppFramework;
  t: (key: string, params?: Record<string, string | number>) => string;
}

interface CapsuleMeta {
  title: string;
  category: number;
  contentHash: string;
}

type PendingDraft = Omit<PendingTimeCapsuleOperation, "stage" | "txid" | "paymentTxid">;

const fromBaseUnits = (base: bigint): string => {
  if (base <= 0n) return "0";
  const whole = base / GAS_DECIMALS_MULTIPLIER;
  const fraction = base % GAS_DECIMALS_MULTIPLIER;
  if (fraction === 0n) return whole.toString();
  return `${whole}.${fraction.toString().padStart(8, "0").replace(/0+$/, "")}`;
};

const hexToBase64 = (hex: string): string => {
  const bytes = hexToBytes(hex);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const toIdString = (value: unknown): string => {
  try {
    const id = parseBigInt(value);
    return id > 0n ? id.toString() : "";
  } catch {
    return "";
  }
};

const strictBoolean = (value: unknown): boolean => {
  if (value === true || value === 1 || value === "1") return true;
  if (value === false || value === 0 || value === "0") return false;
  if (String(value).toLowerCase() === "true") return true;
  if (String(value).toLowerCase() === "false") return false;
  throw new Error("invalid boolean stack value");
};

export function useTimeCapsule({ app, t }: UseTimeCapsuleOptions) {
  const capsules = createObservable<Capsule[]>([]);
  const fishCandidates = createObservable<Capsule[]>([]);
  const reusableCredit = createObservable("0");
  const capsulesSource = createObservable<CapsuleDataSource>("none");
  const candidatesSource = createObservable<CapsuleDataSource>("none");
  const creditSource = createObservable<CapsuleDataSource>("none");
  const transactionNotice = createObservable("");
  const isLoading = createObservable(false);
  const isLoadingCandidates = createObservable(false);
  const isCreating = createObservable(false);
  const isProcessing = createObservable(false);
  const isRecovering = createObservable(false);
  const storageHealthy = createObservable(true);
  const pendingOperation = app.state.persisted<PendingTimeCapsuleOperation | null>(PENDING_STORE_KEY, null);

  const newCapsule = createObservable<CapsuleFormData>({
    title: "",
    content: "",
    days: "30",
    isPublic: false,
    category: 1,
  });

  const assertRecoveryStorage = () => {
    const probe = { version: 1, token: `${Date.now()}-${Math.random().toString(36).slice(2)}` };
    try {
      app.storage.local.set(RECOVERY_STORAGE_PROBE_KEY, probe);
      const restored = app.storage.local.get<typeof probe | null>(RECOVERY_STORAGE_PROBE_KEY, null);
      if (restored?.token !== probe.token || restored.version !== probe.version) {
        throw new Error("recovery storage readback mismatch");
      }
      app.storage.local.delete(RECOVERY_STORAGE_PROBE_KEY);
      if (app.storage.local.get<unknown>(RECOVERY_STORAGE_PROBE_KEY, null) !== null) {
        throw new Error("recovery storage delete mismatch");
      }
      storageHealthy.set(true);
    } catch {
      try { app.storage.local.delete(RECOVERY_STORAGE_PROBE_KEY); } catch { /* best-effort cleanup */ }
      storageHealthy.set(false);
      throw new Error(t("recoveryStorageUnavailable"));
    }
  };

  const persistPendingOperation = (record: PendingTimeCapsuleOperation) => {
    try {
      pendingOperation.set(record);
      const restored = app.storage.local.get<unknown>(PENDING_DURABLE_STORE_KEY, null);
      if (!isPendingTimeCapsuleOperation(restored) || JSON.stringify(restored) !== JSON.stringify(record)) {
        throw new Error("pending operation readback mismatch");
      }
      storageHealthy.set(true);
    } catch {
      storageHealthy.set(false);
      const txid = record.txid || record.paymentTxid || "";
      const message = t("recoveryStorageUnavailableAfterBroadcast", { txid });
      transactionNotice.set(message);
      throw new Error(message);
    }
  };

  const clearPendingOperation = () => {
    const previous = pendingOperation.get();
    try {
      pendingOperation.set(null);
      const restored = app.storage.local.get<unknown>(PENDING_DURABLE_STORE_KEY, null);
      if (restored !== null) throw new Error("pending operation clear mismatch");
      storageHealthy.set(true);
    } catch {
      if (previous && isPendingTimeCapsuleOperation(previous)) {
        try { pendingOperation.set(previous); } catch { /* keep the valid record in memory even if storage is still unavailable */ }
      }
      storageHealthy.set(false);
      throw new Error(t("recoveryStorageUnavailable"));
    }
  };

  try {
    if (pendingOperation.get() && !isPendingTimeCapsuleOperation(pendingOperation.get())) {
      clearPendingOperation();
    }
    assertRecoveryStorage();
  } catch {
    // The observable keeps writes disabled while read-only capsule browsing
    // remains available. Every write repeats the probe immediately beforehand.
  }

  const loadLocalContent = (): Record<string, string> => {
    try {
      const parsed = app.storage.local.get<Record<string, string | { hash?: string; content?: string }>>(CONTENT_STORE_KEY);
      if (!parsed || typeof parsed !== "object") return {};
      const normalized: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "string") normalized[key] = value;
        else if (value?.content) normalized[String(value.hash || key)] = String(value.content);
      }
      return normalized;
    } catch {
      storageHealthy.set(false);
      return {};
    }
  };
  const localContent = createObservable<Record<string, string>>(loadLocalContent());

  const saveLocalContent = (hash: string, content: string) => {
    try {
      const store = app.storage.local.get<Record<string, string>>(CONTENT_STORE_KEY) ?? {};
      const next = { ...store, [hash]: content };
      app.storage.local.set(CONTENT_STORE_KEY, next);
      const restored = app.storage.local.get<Record<string, string> | null>(CONTENT_STORE_KEY, null);
      if (restored?.[hash] !== content) throw new Error("content readback mismatch");
      localContent.set(next);
      storageHealthy.set(true);
    } catch {
      storageHealthy.set(false);
      throw new Error(t("recoveryStorageUnavailable"));
    }
  };
  const loadLocalMeta = (): Record<string, CapsuleMeta> => {
    try {
      const parsed = app.storage.local.get<Record<string, unknown>>(META_STORE_KEY);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      const normalized: Record<string, CapsuleMeta> = {};
      for (const [id, value] of Object.entries(parsed)) {
        if (!value || typeof value !== "object" || Array.isArray(value)) continue;
        const candidate = value as Partial<CapsuleMeta>;
        const title = String(candidate.title ?? "").trim().slice(0, 100);
        const contentHash = String(candidate.contentHash ?? "").replace(/^0x/i, "").toLowerCase();
        const category = Number(candidate.category);
        if (!title || !/^[0-9a-f]{64}$/.test(contentHash) || !Number.isInteger(category) || category < 1 || category > 5) continue;
        normalized[id] = { title, contentHash, category };
      }
      return normalized;
    } catch {
      storageHealthy.set(false);
      return {};
    }
  };
  const localMeta = createObservable<Record<string, CapsuleMeta>>(loadLocalMeta());
  const saveLocalMeta = (id: string, meta: CapsuleMeta) => {
    try {
      const store = localMeta.get();
      const next = { ...store, [id]: meta };
      app.storage.local.set(META_STORE_KEY, next);
      const restored = app.storage.local.get<Record<string, CapsuleMeta> | null>(META_STORE_KEY, null);
      if (JSON.stringify(restored?.[id]) !== JSON.stringify(meta)) throw new Error("metadata readback mismatch");
      localMeta.set(next);
      storageHealthy.set(true);
    } catch {
      storageHealthy.set(false);
      throw new Error(t("recoveryStorageUnavailable"));
    }
  };

  const totalCapsules: Observable = {
    get: () => capsules.get().length,
    set: () => {},
    subscribe: (listener) => capsules.subscribe(listener),
  };
  const lockedCount: Observable = {
    get: () => capsules.get().filter((item) => item.locked).length,
    set: () => {},
    subscribe: (listener) => capsules.subscribe(listener),
  };
  const revealedCount: Observable = {
    get: () => capsules.get().filter((item) => item.revealed).length,
    set: () => {},
    subscribe: (listener) => capsules.subscribe(listener),
  };
  const isBusy: Observable = {
    get: () => isCreating.get() || isProcessing.get() || isRecovering.get(),
    set: () => {},
    subscribe: (listener) => {
      const stopCreating = isCreating.subscribe(listener);
      const stopProcessing = isProcessing.subscribe(listener);
      const stopRecovering = isRecovering.subscribe(listener);
      return () => {
        stopCreating();
        stopProcessing();
        stopRecovering();
      };
    },
  };
  const hasCredit: Observable = {
    get: () => creditSource.get() === "chain" && Number(reusableCredit.get()) > 0,
    set: () => {},
    subscribe: (listener) => {
      const stopCredit = reusableCredit.subscribe(listener);
      const stopSource = creditSource.subscribe(listener);
      return () => {
        stopCredit();
        stopSource();
      };
    },
  };
  const canCreate: Observable = {
    get: () => {
      const form = newCapsule.get();
      const days = Number.parseInt(form.days, 10);
      return storageHealthy.get() && !pendingOperation.get() && form.title.trim().length > 0 && form.content.trim().length > 0 &&
        Number.isInteger(days) && days >= MIN_LOCK_DAYS && days <= MAX_LOCK_DAYS;
    },
    set: () => {},
    subscribe: (listener) => {
      const stopForm = newCapsule.subscribe(listener);
      const stopPending = pendingOperation.subscribe(listener);
      const stopStorage = storageHealthy.subscribe(listener);
      return () => {
        stopForm();
        stopPending();
        stopStorage();
      };
    },
  };

  const mapCapsule = (raw: unknown, expectedId: string): Capsule => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("malformed capsule record");
    const value = raw as Record<string, unknown>;
    const id = toIdString(value.id ?? expectedId);
    const owner = normalizeTimeCapsuleHash(value.owner);
    const contentHash = String(value.contentHash ?? "").replace(/^0x/i, "").toLowerCase();
    const unlockTime = Number(value.unlockTime);
    const category = Number(value.category);
    const amountBase = parseBigInt(value.amount);
    if (
      id !== expectedId || !owner || !/^[0-9a-f]{64}$/.test(contentHash) ||
      !Number.isSafeInteger(unlockTime) || unlockTime <= 0 ||
      !Number.isInteger(category) || category < 1 || category > 5 || amountBase < 0n
    ) throw new Error("malformed capsule record");
    const revealed = strictBoolean(value.revealed);
    const candidateMeta = localMeta.get()[id];
    const meta = candidateMeta?.contentHash === contentHash ? candidateMeta : undefined;
    return {
      id,
      title: meta?.title?.trim() || t("untitledCapsule"),
      contentHash,
      unlockDate: new Date(unlockTime).toISOString().slice(0, 10),
      unlockTime,
      locked: !revealed && Date.now() < unlockTime,
      revealed,
      isPublic: strictBoolean(value.isPublic),
      content: localContent.get()[contentHash] ?? "",
      amount: fromBaseUnits(amountBase),
      fished: strictBoolean(value.fished),
      category,
      owner,
    };
  };

  const readCapsule = async (id: string, context: TimeCapsuleChainContext): Promise<Capsule> => {
    const raw = await app.chain.readRaw("getCapsule", [app.chain.arg.integer(id)], { scriptHash: context.contractHash });
    return mapCapsule(raw, id);
  };

  const loadCapsules = async (): Promise<Capsule[]> => {
    const wallet = app.chain.address.get();
    if (!wallet) {
      capsules.set([]);
      capsulesSource.set("none");
      return [];
    }
    capsulesSource.set("loading");
    try {
      const context = await requireCanonicalTimeCapsuleContext(app, t("chainContextMismatch"));
      const ownerArg = app.chain.arg.hash160(wallet);
      const countBig = parseBigInt(await app.chain.readRaw("ownerCapsuleCount", [ownerArg], { scriptHash: context.contractHash }));
      if (countBig < 0n || countBig > BigInt(MAX_OWNER_CAPSULES)) throw new Error("malformed capsule count");
      const count = Number(countBig);
      const ids: string[] = [];
      for (let offset = 0; offset < count; offset += OWNER_PAGE_LIMIT) {
        const expected = Math.min(OWNER_PAGE_LIMIT, count - offset);
        const idsRaw = await app.chain.readArray("getOwnerCapsules", [
          ownerArg,
          app.chain.arg.integer(offset),
          app.chain.arg.integer(OWNER_PAGE_LIMIT),
        ], { scriptHash: context.contractHash });
        if (!Array.isArray(idsRaw) || idsRaw.length !== expected) throw new Error("malformed capsule index");
        const page = idsRaw.map(toIdString);
        if (page.some((id) => !id)) throw new Error("malformed capsule id");
        ids.push(...page);
      }
      if (new Set(ids).size !== ids.length) throw new Error("duplicate capsule id");
      const list: Capsule[] = [];
      for (let offset = 0; offset < ids.length; offset += CAPSULE_READ_BATCH) {
        list.push(...await Promise.all(ids.slice(offset, offset + CAPSULE_READ_BATCH).map((id) => readCapsule(id, context))));
      }
      list.sort((a, b) => Number(b.id) - Number(a.id));
      capsules.set(list);
      capsulesSource.set("chain");
      return list;
    } catch (error) {
      capsulesSource.set("failed");
      console.warn("[time-capsule] owner read failed:", formatErrorMessage(error, t("error")));
      return capsules.get();
    }
  };

  const loadPublicCandidates = async (): Promise<Capsule[]> => {
    const context = await requireCanonicalTimeCapsuleContext(app, t("chainContextMismatch"));
    const last = Number(await app.chain.readRaw("lastCapsuleId", [], { scriptHash: context.contractHash }));
    if (!Number.isSafeInteger(last) || last < 0) throw new Error("malformed capsule counter");
    if (last === 0) return [];
    const wallet = app.chain.address.get();
    const start = Math.max(1, last - MAX_SCAN + 1);
    const ids = Array.from({ length: last - start + 1 }, (_, index) => String(last - index));
    const list: Capsule[] = [];
    // Avoid a 200-request burst against the public indexer while keeping the
    // newest-first catalog responsive.
    for (let offset = 0; offset < ids.length; offset += CAPSULE_READ_BATCH) {
      list.push(...await Promise.all(ids.slice(offset, offset + CAPSULE_READ_BATCH).map((id) => readCapsule(id, context))));
    }
    return list.filter((item) => item.isPublic && !item.revealed && !item.fished &&
      (!wallet || !timeCapsuleAccountMatches(item.owner, wallet)));
  };

  const loadFishCandidates = async (): Promise<Capsule[]> => {
    if (isLoadingCandidates.get()) return fishCandidates.get();
    isLoadingCandidates.set(true);
    candidatesSource.set("loading");
    try {
      const list = await loadPublicCandidates();
      fishCandidates.set(list);
      candidatesSource.set("chain");
      return list;
    } catch (error) {
      candidatesSource.set("failed");
      console.warn("[time-capsule] public read failed:", formatErrorMessage(error, t("error")));
      return fishCandidates.get();
    } finally {
      isLoadingCandidates.set(false);
    }
  };

  const loadCredit = async () => {
    const wallet = app.chain.address.get();
    if (!wallet) {
      reusableCredit.set("0");
      creditSource.set("none");
      return;
    }
    creditSource.set("loading");
    try {
      const context = await requireCanonicalTimeCapsuleContext(app, t("chainContextMismatch"));
      const raw = await app.chain.readRaw("creditOf", [app.chain.arg.hash160(wallet)], { scriptHash: context.contractHash });
      reusableCredit.set(fromBaseUnits(parseBigInt(raw)));
      creditSource.set("chain");
    } catch (error) {
      creditSource.set("failed");
      console.warn("[time-capsule] credit read failed:", formatErrorMessage(error, t("error")));
    }
  };

  const prepare = (
    kind: TimeCapsulePendingKind,
    context: TimeCapsuleChainContext,
    actor: string,
    details: Omit<Partial<PendingTimeCapsuleOperation>, "version" | "kind" | "stage" | "eventName" | "network" | "contractHash" | "actorHash" | "createdAt" | "txid" | "paymentTxid">,
  ): PendingDraft => {
    const actorHash = normalizeTimeCapsuleHash(actor);
    if (!actorHash) throw new Error(t("walletRequired"));
    const eventName = kind === "create" ? "Buried" : kind === "reveal" ? "Revealed" : kind === "fish" ? "Fished" : "CreditWithdrawn";
    return { version: 1, kind, eventName, network: context.network, contractHash: context.contractHash, actorHash, createdAt: Date.now(), amountFixed8: String(details.amountFixed8 ?? "0"), ...details } as PendingDraft;
  };
  const persistPayment = (draft: PendingDraft, txid: string) => {
    persistPendingOperation({ ...draft, stage: "payment", paymentTxid: txid });
  };
  const persistAction = (draft: PendingDraft, txid: string) => {
    const paymentTxid = pendingOperation.get()?.paymentTxid;
    persistPendingOperation({
      ...draft,
      stage: "action",
      txid,
      ...(paymentTxid ? { paymentTxid } : {}),
    });
  };
  const assertNoPending = () => {
    if (pendingOperation.get()) throw new Error(t("pendingBlocksWrites"));
  };

  const pendingArgs = (pending: PendingTimeCapsuleOperation) => {
    if (pending.kind !== "create") return [];
    return [
      app.chain.arg.hash160Raw(pending.actorHash),
      app.chain.arg.byteArray(hexToBase64(pending.contentHash ?? "")),
      app.chain.arg.integer(pending.durationSeconds ?? 0),
      app.chain.arg.boolean(Boolean(pending.isPublic)),
      app.chain.arg.integer(pending.category ?? 0),
      app.chain.arg.integer(pending.amountFixed8),
    ];
  };

  const finalizePending = async (pending: PendingTimeCapsuleOperation, event: unknown) => {
    const value = (index: number) => eventValue(event, index);
    const context = { network: pending.network, contractHash: pending.contractHash } satisfies TimeCapsuleChainContext;
    if (pending.kind === "create") {
      const id = toIdString(value(0));
      const eventUnlock = Number(value(3));
      if (!id || !timeCapsuleAccountMatches(value(1), pending.actorHash) ||
        parseBigInt(value(2)) !== BigInt(pending.amountFixed8) ||
        !Number.isSafeInteger(eventUnlock) || strictBoolean(value(4)) !== pending.isPublic) {
        throw new Error(t("transactionEventMismatch"));
      }
      const cap = await readCapsule(id, context);
      if (!timeCapsuleAccountMatches(cap.owner, pending.actorHash) || cap.contentHash !== pending.contentHash ||
        cap.category !== pending.category || cap.isPublic !== pending.isPublic ||
        app.amount.gasToFixed8(cap.amount) !== BigInt(pending.amountFixed8) || cap.unlockTime !== eventUnlock) {
        throw new Error(t("transactionReadbackMismatch"));
      }
      saveLocalMeta(id, { title: pending.title ?? t("untitledCapsule"), category: pending.category ?? 1, contentHash: pending.contentHash ?? "" });
    } else if (pending.kind === "reveal") {
      if (toIdString(value(0)) !== pending.capsuleId || !timeCapsuleAccountMatches(value(1), pending.actorHash) || parseBigInt(value(2)) !== BigInt(pending.amountFixed8)) {
        throw new Error(t("transactionEventMismatch"));
      }
      const cap = await readCapsule(pending.capsuleId!, context);
      if (!cap.revealed || !timeCapsuleAccountMatches(cap.owner, pending.actorHash)) throw new Error(t("transactionReadbackMismatch"));
    } else if (pending.kind === "fish") {
      if (toIdString(value(0)) !== pending.capsuleId || !timeCapsuleAccountMatches(value(1), pending.actorHash) ||
        !timeCapsuleAccountMatches(value(2), pending.targetOwnerHash ?? "") || parseBigInt(value(3)) !== BigInt(pending.amountFixed8)) {
        throw new Error(t("transactionEventMismatch"));
      }
      const cap = await readCapsule(pending.capsuleId!, context);
      if (!cap.fished || !timeCapsuleAccountMatches(cap.owner, pending.targetOwnerHash ?? "")) throw new Error(t("transactionReadbackMismatch"));
    } else {
      if (!timeCapsuleAccountMatches(value(0), pending.actorHash) || parseBigInt(value(1)) !== BigInt(pending.beforeCredit ?? "0")) {
        throw new Error(t("transactionEventMismatch"));
      }
      const left = parseBigInt(await app.chain.readRaw("creditOf", [app.chain.arg.hash160Raw(pending.actorHash)], { scriptHash: pending.contractHash }));
      if (left !== 0n) throw new Error(t("transactionReadbackMismatch"));
    }
    clearPendingOperation();
    transactionNotice.set("");
    await Promise.all([loadCapsules(), loadCredit()]);
  };

  const markPending = () => {
    transactionNotice.set(t("transactionPending"));
    app.notify.info("transactionPending");
  };

  const createCapsule = async (): Promise<{ status: "confirmed" | "pending" } | undefined> => {
    if (isBusy.get()) return undefined;
    assertNoPending();
    const form = newCapsule.get();
    const days = Number.parseInt(form.days, 10);
    if (!Number.isInteger(days) || days < MIN_LOCK_DAYS || days > MAX_LOCK_DAYS) throw new Error(t("invalidLockDuration"));
    const title = form.title.trim().slice(0, 100);
    const content = form.content.trim();
    if (!title || !content) throw new Error(t("messageRequired"));
    assertRecoveryStorage();
    isCreating.set(true);
    try {
      const owner = app.chain.address.get() || await app.chain.ensureWallet();
      const context = await requireCanonicalTimeCapsuleContext(app, t("chainContextMismatch"));
      const contentHash = await sha256Hex(content);
      saveLocalContent(contentHash, content);
      const amountFixed8 = app.amount.gasToFixed8(CAPSULE_CREATE_AMOUNT).toString();
      const draft = prepare("create", context, owner, {
        amountFixed8,
        contentHash,
        durationSeconds: days * 86_400,
        isPublic: form.isPublic,
        category: form.category,
        title,
      });
      let result;
      try {
        result = await app.funds.prepayAndCall({
          operation: "bury",
          args: pendingArgs({ ...draft, stage: "action", txid: "0x0000000000000000" }),
          amountGas: CAPSULE_CREATE_AMOUNT,
          memo: BURY_MEMO,
          scriptHash: context.contractHash,
          waitForEvent: "Buried",
          waitTimeoutMs: TIME_CAPSULE_EVENT_WAIT_MS,
          onPaymentSent: (txid) => persistPayment(draft, txid),
          onTransactionSent: (txid) => persistAction(draft, txid),
          notify: "silent",
        });
      } catch (error) {
        if (error instanceof FrameworkPrepaidActionError) {
          await loadCredit();
          if (pendingOperation.get()?.stage === "action") {
            markPending();
            return { status: "pending" };
          }
          transactionNotice.set(t("depositPrepaidNoCapsule"));
          throw new Error(t("depositPrepaidNoCapsule"));
        }
        throw error;
      }
      // A conforming host calls onTransactionSent, but the returned action txid
      // is also authoritative. Upgrade a payment-stage journal here so a missed
      // callback can never make recovery submit bury a second time.
      if (result.txid && pendingOperation.get()?.stage !== "action") persistAction(draft, result.txid);
      const pending = pendingOperation.get();
      if (result.verified === true && result.event && pending) {
        await finalizePending(pending, result.event);
        newCapsule.set({ title: "", content: "", days: "30", isPublic: false, category: 1 });
        app.notify.success("capsuleCreated");
        return { status: "confirmed" };
      }
      markPending();
      return { status: "pending" };
    } finally {
      isCreating.set(false);
    }
  };

  const revealMessage = (cap: Capsule) => {
    const content = localContent.get()[cap.contentHash] ?? "";
    if (content) app.notify.info("message", { content });
    else app.notify.info("contentUnavailable", { hash: cap.contentHash });
  };

  const openCapsule = async (cap: Capsule) => {
    if (cap.revealed) {
      revealMessage(cap);
      return;
    }
    if (Date.now() < cap.unlockTime) {
      app.notify.error(t("notUnlocked"));
      return;
    }
    if (isBusy.get()) return;
    assertNoPending();
    isProcessing.set(true);
    try {
      const owner = app.chain.address.get() || await app.chain.ensureWallet();
      const context = await requireCanonicalTimeCapsuleContext(app, t("chainContextMismatch"));
      const fresh = await readCapsule(cap.id, context);
      if (!timeCapsuleAccountMatches(fresh.owner, owner) || fresh.revealed || Date.now() < fresh.unlockTime) throw new Error(t("notUnlocked"));
      assertRecoveryStorage();
      const draft = prepare("reveal", context, owner, { capsuleId: cap.id, amountFixed8: app.amount.gasToFixed8(fresh.amount).toString() });
      const result = await app.chain.invoke("reveal", [app.chain.arg.hash160(owner), app.chain.arg.integer(cap.id)], {
        scriptHash: context.contractHash,
        waitForEvent: "Revealed",
        waitTimeoutMs: TIME_CAPSULE_EVENT_WAIT_MS,
        onTransactionSent: (txid) => persistAction(draft, txid),
      });
      if (!pendingOperation.get() && result.txid) persistAction(draft, result.txid);
      const pending = pendingOperation.get();
      if (result.verified === true && result.event && pending) {
        await finalizePending(pending, result.event);
        app.notify.success("capsuleRevealed");
        revealMessage(fresh);
      } else markPending();
    } catch (error) {
      app.notify.error(formatErrorMessage(error, t("error")));
      throw error;
    } finally {
      isProcessing.set(false);
    }
  };

  const fishCapsule = async (targetId?: string) => {
    if (isBusy.get()) return;
    assertNoPending();
    isProcessing.set(true);
    try {
      let candidates: Capsule[];
      try {
        candidates = await loadPublicCandidates();
      } catch (error) {
        candidatesSource.set("failed");
        throw error;
      }
      fishCandidates.set(candidates);
      candidatesSource.set("chain");
      const candidate = targetId ? candidates.find((item) => item.id === String(targetId)) : candidates[0];
      if (!candidate) {
        app.notify.info("fishNone");
        return;
      }
      assertRecoveryStorage();
      const fisher = app.chain.address.get() || await app.chain.ensureWallet();
      const context = await requireCanonicalTimeCapsuleContext(app, t("chainContextMismatch"));
      const amountFixed8 = app.amount.gasToFixed8(FISH_FEE_AMOUNT).toString();
      const draft = prepare("fish", context, fisher, { capsuleId: candidate.id, targetOwnerHash: candidate.owner, amountFixed8 });
      const result = await app.chain.invoke("transfer", [
        app.chain.arg.hash160(fisher),
        app.chain.arg.hash160(context.contractHash),
        app.chain.arg.integer(amountFixed8),
        app.chain.arg.string(`${FISH_MEMO_PREFIX}${candidate.id}`),
      ], {
        scriptHash: GAS_HASH,
        waitForEvent: "Fished",
        waitTimeoutMs: TIME_CAPSULE_EVENT_WAIT_MS,
        onTransactionSent: (txid) => persistAction(draft, txid),
      });
      if (!pendingOperation.get() && result.txid) persistAction(draft, result.txid);
      const pending = pendingOperation.get();
      if (result.verified === true && result.event && pending) {
        await finalizePending(pending, result.event);
        fishCandidates.set(await loadPublicCandidates());
        app.notify.success("fishResult", { id: candidate.id });
      } else markPending();
    } catch (error) {
      app.notify.error(formatErrorMessage(error, t("error")));
      throw error;
    } finally {
      isProcessing.set(false);
    }
  };

  const withdrawCredit = async (): Promise<{ amount: string }> => {
    if (isBusy.get()) return { amount: "0" };
    assertNoPending();
    isProcessing.set(true);
    try {
      const owner = app.chain.address.get() || await app.chain.ensureWallet();
      const context = await requireCanonicalTimeCapsuleContext(app, t("chainContextMismatch"));
      const ownerArg = app.chain.arg.hash160(owner);
      const creditBase = parseBigInt(await app.chain.readRaw("creditOf", [ownerArg], { scriptHash: context.contractHash }));
      creditSource.set("chain");
      reusableCredit.set(fromBaseUnits(creditBase));
      if (creditBase <= 0n) {
        app.notify.info("noCreditToWithdraw");
        return { amount: "0" };
      }
      assertRecoveryStorage();
      const draft = prepare("withdraw-credit", context, owner, { amountFixed8: creditBase.toString(), beforeCredit: creditBase.toString() });
      const result = await app.chain.invoke("withdraw", [ownerArg], {
        scriptHash: context.contractHash,
        waitForEvent: "CreditWithdrawn",
        waitTimeoutMs: TIME_CAPSULE_EVENT_WAIT_MS,
        onTransactionSent: (txid) => persistAction(draft, txid),
      });
      if (!pendingOperation.get() && result.txid) persistAction(draft, result.txid);
      const pending = pendingOperation.get();
      if (result.verified === true && result.event && pending) {
        await finalizePending(pending, result.event);
        const amount = fromBaseUnits(creditBase);
        app.notify.success("creditWithdrawn", { amount });
        return { amount };
      }
      markPending();
      return { amount: "0" };
    } catch (error) {
      creditSource.set("failed");
      app.notify.error(formatErrorMessage(error, t("error")));
      throw error;
    } finally {
      isProcessing.set(false);
    }
  };

  const recoverPending = async (): Promise<"none" | "pending" | "confirmed" | "fault"> => {
    const stored = pendingOperation.get();
    if (!stored) return "none";
    if (!isPendingTimeCapsuleOperation(stored)) {
      clearPendingOperation();
      throw new Error(t("pendingInvalid"));
    }
    if (isRecovering.get()) return "pending";
    isRecovering.set(true);
    try {
      const wallet = app.chain.address.get() || await app.chain.ensureWallet();
      const context = await requireCanonicalTimeCapsuleContext(app, t("chainContextMismatch"));
      if (context.network !== stored.network || context.contractHash !== stored.contractHash || !timeCapsuleAccountMatches(wallet, stored.actorHash)) {
        throw new Error(t("pendingContextMismatch"));
      }
      if (stored.stage === "payment") {
        const payment = await readTimeCapsulePaymentOutcome(stored);
        if (payment.state === "fault") {
          clearPendingOperation();
          transactionNotice.set(t("transactionFault"));
          return "fault";
        }
        if (payment.state !== "halt") return "pending";
        if (!payment.event) {
          transactionNotice.set(t("transactionEventMismatch"));
          return "pending";
        }
        assertRecoveryStorage();
        const { stage: _stage, paymentTxid: _paymentTxid, txid: _txid, ...draft } = stored;
        const result = await app.chain.invoke("bury", pendingArgs(stored), {
          scriptHash: stored.contractHash,
          waitForEvent: "Buried",
          waitTimeoutMs: TIME_CAPSULE_EVENT_WAIT_MS,
          onTransactionSent: (txid) => persistAction(draft, txid),
        });
        if (result.txid && pendingOperation.get()?.stage !== "action") persistAction(draft, result.txid);
        const current = pendingOperation.get();
        if (result.verified === true && result.event && current) {
          await finalizePending(current, result.event);
          newCapsule.set({ title: "", content: "", days: "30", isPublic: false, category: 1 });
          app.notify.success("capsuleCreated");
          return "confirmed";
        }
        return "pending";
      }
      let event = await app.events.waitFor(stored.txid!, stored.eventName, TIME_CAPSULE_EVENT_WAIT_MS);
      if (!event) {
        const outcome = await readTimeCapsuleTransactionOutcome(stored.network, stored.txid!, stored.eventName, stored.contractHash);
        if (outcome.state === "fault") {
          clearPendingOperation();
          if (stored.kind === "create") await loadCredit();
          transactionNotice.set(stored.kind === "create" ? t("depositPrepaidNoCapsule") : t("transactionFault"));
          return "fault";
        }
        if (outcome.state === "halt" && !outcome.event) transactionNotice.set(t("transactionEventMismatch"));
        event = outcome.event;
      }
      if (!event) return "pending";
      await finalizePending(stored, event);
      if (stored.kind === "create") app.notify.success("capsuleCreated");
      else if (stored.kind === "reveal") app.notify.success("capsuleRevealed");
      else if (stored.kind === "fish") app.notify.success("fishResult", { id: stored.capsuleId ?? "" });
      else app.notify.success("creditWithdrawn", { amount: fromBaseUnits(BigInt(stored.beforeCredit ?? "0")) });
      return "confirmed";
    } finally {
      isRecovering.set(false);
    }
  };

  const loadAll = async () => {
    isLoading.set(true);
    try {
      await Promise.all([loadCapsules(), loadCredit()]);
    } finally {
      isLoading.set(false);
    }
  };

  return {
    capsules,
    fishCandidates,
    reusableCredit,
    capsulesSource,
    candidatesSource,
    creditSource,
    transactionNotice,
    pendingOperation,
    isRecovering,
    storageHealthy,
    isLoading,
    isLoadingCandidates,
    isCreating,
    isProcessing,
    isBusy,
    newCapsule,
    localContent,
    totalCapsules,
    lockedCount,
    revealedCount,
    canCreate,
    hasCredit,
    createCapsule,
    openCapsule,
    fishCapsule,
    loadFishCandidates,
    withdrawCredit,
    recoverPending,
    loadCredit,
    loadAll,
  };
}

export type UseTimeCapsuleReturn = ReturnType<typeof useTimeCapsule>;
export type { PendingTimeCapsuleOperation } from "../time-capsule-safety";
