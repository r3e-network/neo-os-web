/**
 * useAlbumPhotos — DEPRECATED: Legacy composable preserved for backward compatibility.
 *
 * All photo browsing and decryption logic has been migrated to useForeverAlbum.ts
 * which receives ChainService + EventBus from PlatformServices instead of
 * wiring useContractInteraction + useStatusMessage + useWallet directly.
 *
 * This file is no longer imported by main.ts. It will be removed in a future cleanup.
 */

export { useForeverAlbum as useAlbumPhotos } from "./useForeverAlbum";
