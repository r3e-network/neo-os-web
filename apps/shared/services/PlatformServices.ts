/**
 * PlatformServices - Central service registry for the MiniApp platform.
 *
 * This is the "Android OS services" layer that all miniapps consume.
 * It wires together CacheService, EventBus, ChainService, BalanceService,
 * TransferService, OracleService, AAService, and LifecycleService into
 * a single object available via direct exports.
 *
 * Usage:
 * ```ts
 * // Create and register a singleton:
 * const services = providePlatformServices("miniapp-fogplay", { t });
 *
 * // Retrieve in any module:
 * const services = usePlatformServices();
 * const gas = await services.balance.getGasBalance();
 * ```
 *
 * IMPORTANT: PlatformServices.create() must be called inside a
 * component's setup context (or within defineMiniApp's setup hook).
 * The underlying composables (useContractInteraction, useOracle, etc.)
 * register lifecycle hooks that only work within a setup context.
 * Calling PlatformServices.create() outside setup will cause timer
 * cleanup hooks to silently fail to register.
 */

import { CacheService } from "./CacheService";
import { EventBus } from "./EventBus";
import { ChainService } from "./ChainService";
import { BalanceService } from "./BalanceService";
import { TransferService } from "./TransferService";
import { OracleService } from "./OracleService";
import { AAService } from "./AAService";
import { LifecycleService } from "./LifecycleService";
import { NotificationService } from "./NotificationService";
import { ClipboardService } from "./ClipboardService";
import { FormattingService } from "./FormattingService";
import { EdgeClient } from "./os/EdgeClient";
import { StorageProxy } from "./os/StorageProxy";
import { PaymentProxy } from "./os/PaymentProxy";
import { GameProxy } from "./os/GameProxy";
import { VestingProxy } from "./os/VestingProxy";
import { EscrowProxy } from "./os/EscrowProxy";
import { BadgeProxy } from "./os/BadgeProxy";
import { LeaderboardProxy } from "./os/LeaderboardProxy";
import { CheckinProxy } from "./os/CheckinProxy";
import { NFTProxy } from "./os/NFTProxy";
import { ScriptProxy } from "./os/ScriptProxy";
import type { OSServices } from "./os/types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PlatformServicesOptions {
  /** Locale string for i18n. */
  locale?: string;
  /** Translation function. Falls back to identity function if not provided. */
  t?: (key: string, params?: Record<string, string | number>) => string;
  /** Permission flags for this miniapp (future capability gating). */
  permissions?: string[];
}

// ---------------------------------------------------------------------------
// Module-level singleton
// ---------------------------------------------------------------------------

let _instance: PlatformServices | null = null;

// ---------------------------------------------------------------------------
// Service registry
// ---------------------------------------------------------------------------

export class PlatformServices {
  readonly appId: string;
  readonly cache: CacheService;
  readonly events: EventBus;
  readonly chain: ChainService;
  readonly balance: BalanceService;
  readonly transfer: TransferService;
  readonly oracle: OracleService;
  readonly aa: AAService;
  readonly lifecycle: LifecycleService;
  readonly notify: NotificationService;
  readonly clipboard: ClipboardService;
  readonly fmt: FormattingService;
  readonly os: OSServices;

  private constructor(appId: string, options: PlatformServicesOptions) {
    this.appId = appId;

    // Default translation function returns the key itself
    const t = options.t ?? ((key: string) => key);

    // Core infrastructure services (no dependencies)
    this.cache = new CacheService(appId);
    this.events = new EventBus();

    // Chain service (depends on cache + events)
    this.chain = new ChainService(appId, t, this.cache, this.events);

    // Balance and transfer (depend on chain + cache + events)
    this.balance = new BalanceService(this.chain, this.cache, this.events);
    this.transfer = new TransferService(this.chain, this.events);

    // External integrations (depend on events)
    this.oracle = new OracleService(appId, this.events);
    this.aa = new AAService(appId, this.events);

    // Lifecycle (depends on events)
    this.lifecycle = new LifecycleService(appId, this.events);

    // Notification service (depends on events + t)
    this.notify = new NotificationService(this.events, t as (key: string, params?: Record<string, string | number>) => string);

    // Clipboard service (depends on events + t)
    this.clipboard = new ClipboardService(this.events, t);

    // Formatting service (stateless utility wrapper)
    this.fmt = new FormattingService();

    // OS service proxies (call system contracts through edge functions)
    const edge = new EdgeClient(appId);
    this.os = {
      storage: new StorageProxy(appId, edge),
      payment: new PaymentProxy(appId, edge),
      game: new GameProxy(appId, edge),
      vesting: new VestingProxy(appId, edge),
      escrow: new EscrowProxy(appId, edge),
      badge: new BadgeProxy(appId, edge),
      leaderboard: new LeaderboardProxy(appId, edge),
      checkin: new CheckinProxy(appId, edge),
      nft: new NFTProxy(appId, edge),
      script: new ScriptProxy(appId, edge),
    };
  }

  /**
   * Create a new PlatformServices instance.
   * This is the preferred factory method.
   */
  static create(appId: string, options?: PlatformServicesOptions): PlatformServices {
    if (!appId || typeof appId !== "string") {
      throw new Error("PlatformServices.create requires a non-empty appId");
    }
    return new PlatformServices(appId, options ?? {});
  }

  /**
   * Tear down all services and release resources.
   * Call this when the miniapp is unmounting.
   */
  destroy(): void {
    this.lifecycle.unmount();
    this.cache.destroy();
    this.events.destroy();
  }
}

// ---------------------------------------------------------------------------
// Service accessor functions
// ---------------------------------------------------------------------------

/**
 * Create and register the PlatformServices singleton.
 * Call this once during app initialisation (e.g. in the root component's
 * setup function or inside defineMiniApp's setup hook).
 *
 * @returns The created PlatformServices instance
 */
export function providePlatformServices(
  appId: string,
  options?: PlatformServicesOptions,
): PlatformServices {
  const services = PlatformServices.create(appId, options);
  _instance = services;
  return services;
}

/**
 * Retrieve the current PlatformServices singleton.
 *
 * @throws Error if PlatformServices has not been provided via providePlatformServices()
 */
export function usePlatformServices(): PlatformServices {
  if (!_instance) {
    throw new Error(
      "usePlatformServices() was called before providePlatformServices(). " +
      "Make sure your root component calls providePlatformServices() first.",
    );
  }
  return _instance;
}
