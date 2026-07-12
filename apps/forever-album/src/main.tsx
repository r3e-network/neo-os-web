/**
 * Forever Album — Entry Point (React / OS Services Pattern)
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useForeverAlbum } from "./composables/useForeverAlbum";
import { getForeverAlbumLaunchDefaults } from "./launch";

defineMiniApp({
  appId: "miniapp-forever-album",
  playArea: PlayArea,
  manifest,
  messages,
  // Legacy album namespace: pre-framework albums were stored under
  // "forever-album:photos:<address>", so pin app.storage.local to the same
  // "forever-album:" prefix — existing device-local albums are not orphaned.
  storagePrefix: "forever-album:",

  setup(ctx) {
    const app = ctx.framework;
    const album = useForeverAlbum({
      app,
      t: ctx.t,
    });

    const launchDefaults = getForeverAlbumLaunchDefaults(ctx.launchContext);
    album.isEncrypted.set(launchDefaults.isEncrypted);

    let observedWallet = app.wallet.address() || "";
    const stopWalletObservation = app.wallet.observe().subscribe(() => {
      const nextWallet = app.wallet.address() || "";
      if (nextWallet === observedWallet) return;
      // A first connection establishes the partition for an unowned draft;
      // switching away from an existing wallet still clears every draft/view.
      const preserveDraft = !observedWallet && Boolean(nextWallet);
      observedWallet = nextWallet;
      void app.notify.guard(
        () => album.handleWalletChange({ preserveDraft }),
        { errorKey: "loadFailed" },
      );
    });

    ctx.framework.actions.register("viewPhoto", async (photo: unknown) => {
      album.viewPhoto(
        photo as {
          id: string;
          data: string;
          encrypted: boolean;
          createdAt: number;
        },
      );
    });

    ctx.framework.actions.register("refreshPhotos", async () => {
      await app.notify.guard(() => album.loadPhotos(), { errorKey: "loadFailed" });
    });
    ctx.framework.actions.register("closeViewer", async () => {
      album.closeViewer();
    });
    ctx.framework.actions.register("openDecrypt", async () => {
      album.openDecrypt();
    });
    ctx.framework.actions.register("closeDecrypt", async () => {
      album.closeDecrypt();
    });

    ctx.framework.actions.register("handleDecrypt", async (pwd: unknown) => {
      await app.notify.guard(() => album.handleDecrypt(pwd as string), {
        errorKey: "decryptFailed",
      });
    });

    ctx.framework.actions.register("uploadPhotos", async () => {
      await app.notify.guard(() => album.uploadPhotos(), {
        successKey: "uploadSuccess",
        errorKey: "uploadFailed",
      });
    });

    ctx.framework.actions.register("removeImage", async (id: unknown) => {
      album.removeImage(id as string);
    });

    ctx.framework.actions.register("deletePhoto", async (id: unknown) => {
      await app.notify.guard(() => album.deletePhoto(id as string), {
        successKey: "photoDeleted",
        errorKey: "deleteFailed",
      });
    });

    ctx.framework.actions.register("resetDamagedAlbum", async () => {
      await app.notify.guard(() => album.resetDamagedAlbum(), {
        successKey: "albumReset",
        errorKey: "albumResetFailed",
      });
    });

    ctx.framework.actions.register("addFiles", async (...args: unknown[]) => {
      const files = args[0] as File[] | FileList | undefined;
      if (!files) return;
      await album.addFiles(files);
    });

    return {
      state: {
        photos: album.photos,
        photosCount: album.photosCount,
        encryptedCount: album.encryptedCount,
        publicCount: album.publicCount,
        albumPayloadSize: album.albumPayloadSize,
        maxAlbumBytes: album.maxAlbumBytes,
        walletAddress: album.walletAddress,
        storageIssue: album.storageIssue,
        storageMessage: album.storageMessage,
        storageNotice: album.storageNotice,
        loadingPhotos: album.loadingPhotos,
        processingFiles: album.processingFiles,
        uploading: album.uploading,
        uploadError: album.uploadError,
        showViewer: album.showViewer,
        viewingPhoto: album.viewingPhoto,
        showDecrypt: album.showDecrypt,
        decryptTarget: album.decryptTarget,
        decrypting: album.decrypting,
        decryptedPreview: album.decryptedPreview,
        decryptPassword: album.decryptPassword,
        decryptError: album.decryptError,
        selectedImages: album.selectedImages,
        isEncrypted: album.isEncrypted,
        password: album.password,
        passwordConfirm: album.passwordConfirm,
        totalPayloadSize: album.totalPayloadSize,
        maxTotalBytes: album.maxTotalBytes,
      },
      loadData: album.loadPhotos,
      cleanup: stopWalletObservation,
    };
  },
});
