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
export type { ContractArg, ReadOptions, InvokeOptions, TxResult, EventListOptions, SignedMessageResult } from "./ChainService";

export { BalanceService } from "./BalanceService";

export { TransferService } from "./TransferService";

// OracleService + off-chain composable types removed: miniapp platform
// is now self-contained. Oracle integrations go directly on-chain via
// composables/useMorpheusDataFeed.ts and the standard contract.invoke
// pattern (see flagship miniapps for the on-chain-mediated VRF flow).

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
