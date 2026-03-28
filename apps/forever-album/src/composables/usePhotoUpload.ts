/**
 * usePhotoUpload — DEPRECATED: Legacy composable preserved for backward compatibility.
 *
 * All upload logic has been migrated to useForeverAlbum.ts which receives
 * ChainService + EventBus from PlatformServices instead of wiring
 * useContractInteraction + useWallet directly.
 *
 * This file is no longer imported by main.ts. It will be removed in a future cleanup.
 */

export { useForeverAlbum as usePhotoUpload } from "./useForeverAlbum";
