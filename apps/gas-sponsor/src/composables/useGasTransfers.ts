/**
 * useGasTransfers — DEPRECATED: Legacy composable preserved for backward compatibility.
 *
 * All donate/send logic has been migrated to useGasSponsor.ts which receives
 * ChainService + EventBus from PlatformServices instead of wiring
 * useContractInteraction + useWallet directly.
 *
 * This file is no longer imported by main.ts. It will be removed in a future cleanup.
 */

export { useGasSponsorApp as useGasTransfers } from "./useGasSponsor";
