/**
 * operation-busy.ts — busyIds / isLoading / isSending wiring on app.operations.
 *
 * Neo Message tracked in-flight work with hand-rolled flags (isLoading,
 * isSending) and a busyIds string array (addBusy/removeBusy). The framework
 * operations surface owns that lifecycle now: every flow runs inside a
 * framework operation and the flags/ids the PlayArea binds to derive from the
 * live operation states — same observable contracts, no bespoke bookkeeping.
 */

import { createObservable, type Observable } from "@shared/react";

/** The slice of a framework operation this wiring needs (structural). */
export interface OperationLike {
  state: {
    get(): { status: string };
    subscribe(listener: () => void): () => void;
  };
}

/**
 * Read-only boolean observable that is true while the operation is running.
 * Drop-in replacement for the old hand-rolled isLoading/isSending flags
 * (`set` is a no-op — the operation state is the single source of truth).
 */
export function operationBusyFlag(op: OperationLike): Observable<boolean> {
  return {
    get: () => op.state.get().status === "running",
    set: () => {},
    subscribe: (listener) => op.state.subscribe(listener),
  };
}

/**
 * Per-row reveal operations: one framework operation per message id
 * (`reveal:<id>`) so one slow relayer poll does not disable every other
 * reveal button. `busyIds` derives from the live operation states and keeps
 * the PlayArea's existing `string[]` contract (ids currently in flight).
 */
export function createRevealOperations<Op extends OperationLike>(
  create: (key: string) => Op,
): { busyIds: Observable<string[]>; opFor(id: string): Op; cleanup(): void } {
  const ops = new Map<string, Op>();
  const subscriptions: Array<() => void> = [];
  const busyIds = createObservable<string[]>([]);
  const sync = () => {
    const running: string[] = [];
    ops.forEach((op, id) => {
      if (op.state.get().status === "running") running.push(id);
    });
    busyIds.set(running);
  };
  return {
    busyIds,
    opFor(id: string): Op {
      const existing = ops.get(id);
      if (existing) return existing;
      const op = create(`reveal:${id}`);
      ops.set(id, op);
      subscriptions.push(op.state.subscribe(sync));
      return op;
    },
    cleanup(): void {
      subscriptions.splice(0).forEach((unsubscribe) => unsubscribe());
      ops.clear();
      busyIds.set([]);
    },
  };
}
