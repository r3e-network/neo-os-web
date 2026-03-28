/**
 * EventBus - Cross-component pub/sub event system for the MiniApp platform.
 *
 * Provides a lightweight, typed event bus for communication between
 * platform services and miniapp components. Supports one-shot listeners,
 * automatic unsubscription, and a set of well-known platform lifecycle events.
 *
 * @example
 * ```ts
 * const events = new EventBus();
 * const unsub = events.on(EventBus.TRANSACTION_CONFIRMED, (payload) => {
 *   console.log("tx confirmed:", payload);
 * });
 * events.emit(EventBus.TRANSACTION_CONFIRMED, { txid: "0xabc..." });
 * unsub(); // clean up
 * ```
 */

type EventHandler = (payload: unknown) => void;

export class EventBus {
  // -- Well-known platform lifecycle events ----------------------------------

  /** Emitted when a wallet is connected. Payload: { address: string } */
  static readonly WALLET_CONNECTED = "platform:wallet:connected";

  /** Emitted when the wallet is disconnected. */
  static readonly WALLET_DISCONNECTED = "platform:wallet:disconnected";

  /** Emitted when a transaction is broadcast. Payload: { txid: string, operation: string } */
  static readonly TRANSACTION_SENT = "platform:tx:sent";

  /** Emitted when a transaction is confirmed on-chain. Payload: { txid: string, event?: unknown } */
  static readonly TRANSACTION_CONFIRMED = "platform:tx:confirmed";

  /** Emitted when a token balance changes. Payload: { asset: string, balance: number } */
  static readonly BALANCE_CHANGED = "platform:balance:changed";

  /** Emitted when the miniapp component mounts. Payload: { appId: string } */
  static readonly APP_MOUNTED = "platform:app:mounted";

  /** Emitted when the miniapp component unmounts. Payload: { appId: string } */
  static readonly APP_UNMOUNTED = "platform:app:unmounted";

  /** Emitted on any platform-level error. Payload: { error: Error, context?: string } */
  static readonly ERROR = "platform:error";

  // -- Internal state --------------------------------------------------------

  private handlers: Map<string, Set<EventHandler>>;

  constructor() {
    this.handlers = new Map();
  }

  /**
   * Subscribe to an event. Returns an unsubscribe function.
   */
  on(event: string, handler: EventHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    return () => {
      this.off(event, handler);
    };
  }

  /**
   * Subscribe to an event for a single firing, then auto-unsubscribe.
   * Returns an unsubscribe function for early removal.
   */
  once(event: string, handler: EventHandler): () => void {
    const wrapper: EventHandler = (payload) => {
      this.off(event, wrapper);
      handler(payload);
    };
    return this.on(event, wrapper);
  }

  /**
   * Emit an event to all registered handlers.
   */
  emit(event: string, payload?: unknown): void {
    const set = this.handlers.get(event);
    if (!set || set.size === 0) return;
    // Iterate over a snapshot so that handlers can safely remove themselves
    for (const handler of [...set]) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[EventBus] Handler error for "${event}":`, err);
      }
    }
  }

  /**
   * Remove a specific handler for an event, or all handlers if none specified.
   */
  off(event: string, handler?: EventHandler): void {
    if (!handler) {
      this.handlers.delete(event);
      return;
    }
    const set = this.handlers.get(event);
    if (set) {
      set.delete(handler);
      if (set.size === 0) {
        this.handlers.delete(event);
      }
    }
  }

  /**
   * Remove all handlers for all events. Called during service teardown.
   */
  destroy(): void {
    this.handlers.clear();
  }
}
