import type { MiniAppFramework } from "@shared/react";
import { eventStateValue } from "@shared/utils/chain-events";
import { addressToScriptHash, ownerMatchesAddress, parseHash160 } from "@shared/utils/neo";
import { parseBigInt, parseBool } from "@shared/utils/parsers";

export type QuadraticPendingKind =
  | "create-round"
  | "add-matching"
  | "register-project"
  | "contribute"
  | "finalize-round"
  | "claim-project"
  | "claim-unused"
  | "cancel-round";

export interface QuadraticPendingOperation {
  version: 1;
  phase: "prepared" | "deposit" | "action";
  reservationId: string;
  kind: QuadraticPendingKind;
  eventName: string;
  txid: string;
  depositTxid?: string;
  network: string;
  contract: string;
  wallet: string;
  roundId?: string;
  projectId?: string;
  projectIds?: string[];
  matchedAmounts?: string[];
  asset?: "NEO" | "GAS";
  assetHash?: string;
  amount?: string;
  expectedAfter?: string;
  expectedPool?: string;
  expectedAllocated?: string;
  name?: string;
  description?: string;
  link?: string;
  startTime?: string;
  endTime?: string;
  createdAt: number;
}

export type QuadraticPendingDraft = Omit<
  QuadraticPendingOperation,
  "version" | "phase" | "reservationId" | "txid" | "depositTxid" | "network" | "contract" | "createdAt"
>;

const clean = (value: unknown) => String(value ?? "").trim().toLowerCase();
const positiveId = (value: unknown) => /^[1-9]\d*$/.test(String(value ?? ""));
const unsigned = (value: unknown) => /^\d+$/.test(String(value ?? ""));
const hash160 = (value: unknown) => /^0x[0-9a-f]{40}$/i.test(String(value ?? ""));

const EVENT_BY_KIND: Record<QuadraticPendingKind, string> = {
  "create-round": "RoundCreated",
  "add-matching": "MatchingPoolAdded",
  "register-project": "ProjectRegistered",
  contribute: "ContributionMade",
  "finalize-round": "RoundFinalized",
  "claim-project": "ProjectClaimed",
  "claim-unused": "MatchingWithdrawn",
  "cancel-round": "RoundCancelled",
};

function isKind(value: unknown): value is QuadraticPendingKind {
  return [
    "create-round",
    "add-matching",
    "register-project",
    "contribute",
    "finalize-round",
    "claim-project",
    "claim-unused",
    "cancel-round",
  ].includes(String(value));
}

export function isQuadraticPendingOperation(
  value: unknown,
): value is QuadraticPendingOperation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const raw = value as Partial<QuadraticPendingOperation>;
  if (
    raw.version !== 1
    || !["prepared", "deposit", "action"].includes(String(raw.phase ?? ""))
    || !String(raw.reservationId ?? "").trim()
    || !isKind(raw.kind)
    || raw.eventName !== EVENT_BY_KIND[raw.kind]
    || (raw.phase === "prepared"
      ? String(raw.txid ?? "") !== ""
      : !/^0x[0-9a-f]{64}$/i.test(String(raw.txid ?? "")))
    || !String(raw.network ?? "").trim()
    || !hash160(raw.contract)
    || !(hash160(raw.wallet) || Boolean(addressToScriptHash(String(raw.wallet ?? ""))))
    || !Number.isFinite(Number(raw.createdAt))
    || Number(raw.createdAt) <= 0
  ) return false;
  if (raw.depositTxid !== undefined && !/^0x[0-9a-f]{64}$/i.test(raw.depositTxid)) return false;
  if (raw.phase === "deposit") {
    if (!raw.depositTxid || clean(raw.depositTxid) !== clean(raw.txid)) return false;
    if (!["create-round", "add-matching", "contribute"].includes(raw.kind)) return false;
  }
  if (raw.roundId !== undefined && !positiveId(raw.roundId)) return false;
  if (raw.projectId !== undefined && !positiveId(raw.projectId)) return false;
  for (const key of ["amount", "expectedAfter", "expectedPool", "expectedAllocated", "startTime", "endTime"] as const) {
    if (raw[key] !== undefined && !unsigned(raw[key])) return false;
  }
  switch (raw.kind) {
    case "create-round":
      return (raw.asset === "NEO" || raw.asset === "GAS")
        && hash160(raw.assetHash)
        && unsigned(raw.amount)
        && unsigned(raw.startTime)
        && unsigned(raw.endTime)
        && Boolean(String(raw.name ?? "").trim());
    case "add-matching":
      return positiveId(raw.roundId)
        && unsigned(raw.amount)
        && unsigned(raw.expectedPool);
    case "register-project":
      return positiveId(raw.roundId) && Boolean(String(raw.name ?? "").trim());
    case "contribute":
      return positiveId(raw.roundId)
        && positiveId(raw.projectId)
        && (raw.asset === "NEO" || raw.asset === "GAS")
        && hash160(raw.assetHash)
        && unsigned(raw.amount)
        && unsigned(raw.expectedAfter);
    case "finalize-round":
      return positiveId(raw.roundId)
        && unsigned(raw.expectedAllocated)
        && Array.isArray(raw.projectIds)
        && Array.isArray(raw.matchedAmounts)
        && raw.projectIds.length > 0
        && raw.projectIds.length === raw.matchedAmounts.length
        && raw.projectIds.every(positiveId)
        && new Set(raw.projectIds).size === raw.projectIds.length
        && raw.matchedAmounts.every(unsigned);
    case "claim-project":
      return positiveId(raw.roundId)
        && positiveId(raw.projectId)
        && unsigned(raw.amount);
    case "claim-unused":
      return positiveId(raw.roundId) && unsigned(raw.amount);
    case "cancel-round":
      return positiveId(raw.roundId);
  }
}

function eventTxid(event: unknown): string {
  if (!event || typeof event !== "object") return "";
  const raw = event as Record<string, unknown>;
  return clean(raw.tx_hash ?? raw.txid ?? raw.transaction_hash);
}

function eventInteger(event: unknown, index: number): bigint | null {
  const text = String(eventStateValue(event, index) ?? "").trim();
  if (!/^-?\d+$/.test(text)) return null;
  try {
    return BigInt(text);
  } catch {
    return null;
  }
}

export function matchesQuadraticPendingEvent(
  pending: QuadraticPendingOperation,
  event: unknown,
): boolean {
  if (pending.phase !== "action") return false;
  if (eventTxid(event) !== clean(pending.txid)) return false;
  const roundId = pending.roundId ? BigInt(pending.roundId) : null;
  const projectId = pending.projectId ? BigInt(pending.projectId) : null;
  const amount = pending.amount ? BigInt(pending.amount) : null;
  switch (pending.kind) {
    case "create-round":
      return eventInteger(event, 0) !== null
        && eventInteger(event, 0)! > 0n
        && ownerMatchesAddress(eventStateValue(event, 1), pending.wallet)
        && ownerMatchesAddress(eventStateValue(event, 2), pending.assetHash)
        && eventInteger(event, 3) === amount;
    case "add-matching":
      return eventInteger(event, 0) === roundId
        && ownerMatchesAddress(eventStateValue(event, 1), pending.wallet)
        && eventInteger(event, 2) === amount;
    case "register-project":
      return eventInteger(event, 0) !== null
        && eventInteger(event, 0)! > 0n
        && eventInteger(event, 1) === roundId
        && ownerMatchesAddress(eventStateValue(event, 2), pending.wallet);
    case "contribute":
      return eventInteger(event, 0) === roundId
        && eventInteger(event, 1) === projectId
        && ownerMatchesAddress(eventStateValue(event, 2), pending.wallet)
        && eventInteger(event, 3) === amount;
    case "finalize-round":
      return eventInteger(event, 0) === roundId
        && eventInteger(event, 1) === BigInt(pending.expectedAllocated ?? "-1");
    case "claim-project":
      return eventInteger(event, 0) === projectId
        && ownerMatchesAddress(eventStateValue(event, 1), pending.wallet)
        && eventInteger(event, 2) === amount;
    case "claim-unused":
      return eventInteger(event, 0) === roundId
        && ownerMatchesAddress(eventStateValue(event, 1), pending.wallet)
        && eventInteger(event, 2) === amount;
    case "cancel-round":
      return eventInteger(event, 0) === roundId
        && ownerMatchesAddress(eventStateValue(event, 1), pending.wallet);
  }
}

export function useQuadraticPending(app: MiniAppFramework) {
  const pendingOperation = app.state.persisted<QuadraticPendingOperation | null>(
    "pendingOperation",
    null,
  );
  if (pendingOperation.get() && !isQuadraticPendingOperation(pendingOperation.get())) {
    pendingOperation.set(null);
  }

  let reservationSequence = 0;
  let activeReservation: string | null = null;

  const reserve = (): string | null => {
    if (pendingOperation.get() || activeReservation) return null;
    reservationSequence += 1;
    activeReservation = `${Date.now()}:${reservationSequence}`;
    return activeReservation;
  };

  const release = (reservation: string) => {
    if (activeReservation !== reservation) return;
    const current = pendingOperation.get();
    if (current?.phase === "prepared" && current.reservationId === reservation) {
      pendingOperation.set(null);
    }
    activeReservation = null;
  };

  const prepare = async (reservation: string, draft: QuadraticPendingDraft) => {
    if (activeReservation !== reservation || pendingOperation.get()) {
      throw new Error("pending operation reservation lost");
    }
    const contract = clean(app.chain.contractAddress.get());
    const network = clean(await app.chain.detectNetwork());
    if (!contract || !network || !draft.wallet) {
      throw new Error("pending operation scope unavailable");
    }
    const prepared: QuadraticPendingOperation = {
      ...draft,
      version: 1 as const,
      phase: "prepared",
      reservationId: reservation,
      txid: "",
      network,
      contract,
      wallet: String(draft.wallet).trim(),
      createdAt: Date.now(),
    };
    pendingOperation.set(prepared);
    return prepared;
  };

  const persistBroadcast = (
    reservation: string,
    draft: QuadraticPendingOperation,
    txid: string,
  ) => {
    const current = pendingOperation.get();
    if (
      activeReservation !== reservation
      || current?.reservationId !== reservation
      || !/^0x[0-9a-f]{64}$/i.test(txid)
    ) return false;
    pendingOperation.set({
      ...draft,
      phase: "action",
      txid,
      ...(current.depositTxid ? { depositTxid: current.depositTxid } : {}),
    });
    return true;
  };

  const persistDeposit = (
    reservation: string,
    draft: QuadraticPendingOperation,
    txid: string,
  ) => {
    const current = pendingOperation.get();
    if (
      activeReservation !== reservation
      || current?.reservationId !== reservation
      || !["create-round", "add-matching", "contribute"].includes(draft.kind)
      || !/^0x[0-9a-f]{64}$/i.test(txid)
    ) return false;
    pendingOperation.set({ ...draft, phase: "deposit", txid, depositTxid: txid });
    return true;
  };

  const clear = (expectedTxid?: string) => {
    const current = pendingOperation.get();
    if (expectedTxid && clean(current?.txid) !== clean(expectedTxid)) return false;
    pendingOperation.set(null);
    if (!expectedTxid) activeReservation = null;
    return true;
  };

  const complete = (reservation: string, txid: string) => {
    if (activeReservation !== reservation) return false;
    const current = pendingOperation.get();
    let cleared: boolean;
    if (current?.reservationId === reservation && current.phase === "prepared") {
      pendingOperation.set(null);
      cleared = true;
    } else {
      cleared = clear(txid);
    }
    activeReservation = null;
    return cleared;
  };

  const assertNoPendingWrite = (message = "pendingBlocksWrites") => {
    if (pendingOperation.get()) throw new Error(message);
  };

  const recover = async (): Promise<
    | "none"
    | "pending"
    | "recovered"
    | "scope-mismatch"
    | "readback-mismatch"
    | "uncertain"
    | "deposit-only"
  > => {
    const pending = pendingOperation.get();
    if (!pending) return "none";
    const contract = clean(app.chain.contractAddress.get());
    const network = clean(await app.chain.detectNetwork());
    const connectedWallet = app.chain.address.get();
    if (
      contract !== pending.contract
      || network !== pending.network
      || (connectedWallet && !ownerMatchesAddress(pending.wallet, connectedWallet))
    ) return "scope-mismatch";
    if (pending.phase === "prepared") return "uncertain";
    if (pending.phase === "deposit") return "deposit-only";

    // Query by the exact txid instead of walking a recent-event window. A
    // pending operation must remain recoverable even after a high-volume event
    // stream has moved it beyond the newest pages.
    const candidate = await app.events.waitFor(pending.txid, pending.eventName, 1);
    const event = candidate && matchesQuadraticPendingEvent(pending, candidate)
      ? candidate
      : null;
    if (!event) return "pending";

    let readbackMatches = false;
    if (pending.kind === "create-round" || pending.kind === "register-project") {
      const id = eventInteger(event, 0)?.toString() ?? "";
      const raw = await app.chain.readRaw(
        pending.kind === "create-round" ? "getRoundDetails" : "getProjectDetails",
        [app.chain.arg.integer(id)],
      );
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const row = raw as Record<string, unknown>;
        readbackMatches = pending.kind === "create-round"
          ? ownerMatchesAddress(parseHash160(row.creator) || row.creator, pending.wallet)
            && String(row.assetSymbol ?? "") === pending.asset
            && parseBigInt(row.matchingPool) === BigInt(pending.amount ?? "-1")
            && String(row.startTime ?? "") === pending.startTime
            && String(row.endTime ?? "") === pending.endTime
            && String(row.title ?? "") === pending.name
            && String(row.description ?? "") === String(pending.description ?? "")
          : ownerMatchesAddress(parseHash160(row.owner) || row.owner, pending.wallet)
            && String(row.roundId ?? "") === pending.roundId
            && String(row.name ?? "") === pending.name
            && String(row.description ?? "") === String(pending.description ?? "")
            && String(row.link ?? "") === String(pending.link ?? "");
      }
    } else if (pending.kind === "contribute") {
      const raw = await app.chain.readRaw("getContribution", [
        app.chain.arg.hash160(pending.wallet),
        app.chain.arg.integer(pending.roundId ?? "0"),
        app.chain.arg.integer(pending.projectId ?? "0"),
      ]);
      readbackMatches = raw !== null
        && raw !== undefined
        && parseBigInt(raw) >= BigInt(pending.expectedAfter ?? "-1");
    } else if (pending.kind === "add-matching") {
      const raw = await app.chain.readRaw("getRoundDetails", [
        app.chain.arg.integer(pending.roundId ?? "0"),
      ]);
      const eventPool = eventInteger(event, 3);
      readbackMatches = Boolean(raw && typeof raw === "object" && !Array.isArray(raw)
        && eventPool !== null
        && eventPool >= BigInt(pending.expectedPool ?? "-1")
        && parseBigInt((raw as Record<string, unknown>).matchingPool) >= eventPool);
    } else if (pending.kind === "finalize-round") {
      const raw = await app.chain.readRaw("getRoundDetails", [app.chain.arg.integer(pending.roundId ?? "0")]);
      const row = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
      const allocations = await Promise.all(pending.projectIds!.map(async (projectId, index) => {
        const projectRaw = await app.chain.readRaw("getProjectDetails", [app.chain.arg.integer(projectId)]);
        const project = projectRaw && typeof projectRaw === "object" && !Array.isArray(projectRaw)
          ? projectRaw as Record<string, unknown>
          : null;
        return Boolean(project
          && String(project.roundId ?? "") === pending.roundId
          && parseBigInt(project.matchedAmount) === BigInt(pending.matchedAmounts![index]!));
      }));
      readbackMatches = Boolean(row
        && String(row.status ?? "") === "finalized"
        && parseBigInt(row.matchingAllocated) === BigInt(pending.expectedAllocated ?? "-1")
        && allocations.every(Boolean));
    } else if (pending.kind === "claim-project") {
      const raw = await app.chain.readRaw("getProjectDetails", [app.chain.arg.integer(pending.projectId ?? "0")]);
      readbackMatches = Boolean(raw && typeof raw === "object" && !Array.isArray(raw)
        && parseBool((raw as Record<string, unknown>).claimed));
    } else {
      const raw = await app.chain.readRaw("getRoundDetails", [app.chain.arg.integer(pending.roundId ?? "0")]);
      const row = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
      readbackMatches = pending.kind === "claim-unused"
        ? Boolean(row && parseBigInt(row.matchingRemaining) === 0n)
        : Boolean(row && String(row.status ?? "") === "cancelled");
    }

    if (!readbackMatches) return "readback-mismatch";
    clear(pending.txid);
    return "recovered";
  };

  return {
    pendingOperation,
    reserve,
    release,
    prepare,
    persistBroadcast,
    persistDeposit,
    complete,
    clear,
    assertNoPendingWrite,
    recover,
  };
}

export type QuadraticPendingTracker = ReturnType<typeof useQuadraticPending>;
