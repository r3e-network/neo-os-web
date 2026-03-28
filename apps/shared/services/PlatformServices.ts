/**
 * PlatformServices - Central service registry for the MiniApp platform.
 *
 * This is the "Android OS services" layer that all miniapps consume.
 * It wires together CacheService, EventBus, ChainService, BalanceService,
 * TransferService, OracleService, AAService, and LifecycleService into
 * a single injectable object.
 *
 * Usage with Vue 3 provide/inject:
 * ```ts
 * // In the root component (e.g. App.vue):
 * const services = providePlatformServices("miniapp-fogplay", { t });
 *
 * // In any child component:
 * const services = usePlatformServices();
 * const gas = await services.balance.getGasBalance();
 * ```
 *
 * IMPORTANT: PlatformServices.create() must be called inside a Vue
 * component's setup() context (or within defineMiniApp's setup hook).
 * The underlying composables (useContractInteraction, useOracle, etc.)
 * register Vue lifecycle hooks that only work within a setup context.
 * Calling PlatformServices.create() outside setup will cause timer
 * cleanup hooks to silently fail to register.
 */

import { inject, provide } from "vue";
import type { InjectionKey } from "vue";
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
// Injection key
// ---------------------------------------------------------------------------

const PLATFORM_SERVICES_KEY: InjectionKey<PlatformServices> = Symbol("PlatformServices");

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
// Vue composable wrappers
// ---------------------------------------------------------------------------

/**
 * Provide PlatformServices to the component tree via Vue's provide/inject.
 * Call this in the root component's setup() function.
 *
 * @returns The created PlatformServices instance
 */
export function providePlatformServices(
  appId: string,
  options?: PlatformServicesOptions,
): PlatformServices {
  const services = PlatformServices.create(appId, options);
  provide(PLATFORM_SERVICES_KEY, services);
  return services;
}

/**
 * Retrieve the PlatformServices instance from the component tree.
 * Must be called in a descendant of a component that called providePlatformServices().
 *
 * @throws Error if PlatformServices has not been provided
 */
export function usePlatformServices(): PlatformServices {
  const services = inject(PLATFORM_SERVICES_KEY);
  if (!services) {
    throw new Error(
      "usePlatformServices() was called without a matching providePlatformServices() in a parent component. " +
      "Make sure your root App component calls providePlatformServices() in its setup().",
    );
  }
  return services;
}
