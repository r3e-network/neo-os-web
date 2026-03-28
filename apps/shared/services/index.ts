/**
 * Platform Service Layer — public API surface.
 *
 * Re-exports all services and their public types for consumption by miniapps.
 *
 * @example
 * ```ts
 * import { providePlatformServices, usePlatformServices } from "@shared/services";
 * import type { ContractArg, TxResult } from "@shared/services";
 * ```
 */

export { PlatformServices, usePlatformServices, providePlatformServices } from "./PlatformServices";
export type { PlatformServicesOptions } from "./PlatformServices";

export { ChainService } from "./ChainService";
export type { ContractArg, ReadOptions, InvokeOptions, TxResult, EventListOptions } from "./ChainService";

export { BalanceService } from "./BalanceService";

export { TransferService } from "./TransferService";

export { OracleService } from "./OracleService";
export type { RandomResult, PriceResult, ComputeParams, ComputeResult } from "./OracleService";
export type {
  OracleQueryRequest,
  OracleQueryResponse,
  OraclePublicKeyResponse,
  ConfidentialStoreRequest,
  ConfidentialStoreResponse,
} from "../composables/useOracle";

export { AAService } from "./AAService";
export type { SponsorshipStatus, SponsorshipResult, RelayResult } from "./AAService";

export { EventBus } from "./EventBus";

export { CacheService } from "./CacheService";

export { LifecycleService } from "./LifecycleService";
export type { AppState } from "./LifecycleService";

export { NotificationService, NOTIFICATION_EVENT } from "./NotificationService";
export type { NotificationType, Notification } from "./NotificationService";

export { ClipboardService } from "./ClipboardService";

export { FormattingService } from "./FormattingService";
