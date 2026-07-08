/**
 * Shared Neo Pay stream/vesting domain module.
 *
 * Canonical home of the payment-streams composable + helpers consumed by BOTH
 * the `neo-pay` miniapp and the `neo-pay-shared-example` runtime (which
 * previously reached across app packages with `../../neo-pay/src/...` source
 * imports — dissolved per the framework-extraction plan's Wave-6 note).
 */

export { useNeoPayApp } from "./useNeoPayApp";
export type { UseNeoPayAppOptions, UseNeoPayAppReturn } from "./useNeoPayApp";
export { deriveSchedule } from "./deriveSchedule";
export {
  statusLabelKey,
  isFinalizedStatus,
  canClaim,
  releasePerDayDisplay,
  deriveSchedulePreview,
} from "./streamDisplay";
export type { StreamStatusKey, SchedulePreview } from "./streamDisplay";
export { messages } from "./messages";
export type { StreamItem, StreamStatus } from "./types";
