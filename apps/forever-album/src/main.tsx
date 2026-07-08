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

    ctx.framework.actions.register("openUpload", async () => {
      album.openUpload();
    });
    ctx.framework.actions.register("closeUpload", async () => {
      album.closeUpload();
    });
    ctx.framework.actions.register("refreshPhotos", async () => {
      await album.loadPhotos();
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
        loadingPhotos: album.loadingPhotos,
        uploading: album.uploading,
        uploadError: album.uploadError,
        showViewer: album.showViewer,
        viewingPhoto: album.viewingPhoto,
        showDecrypt: album.showDecrypt,
        decryptTarget: album.decryptTarget,
        decrypting: album.decrypting,
        decryptedPreview: album.decryptedPreview,
        decryptError: album.decryptError,
        showUpload: album.showUpload,
        selectedImages: album.selectedImages,
        isEncrypted: album.isEncrypted,
        password: album.password,
        totalPayloadSize: album.totalPayloadSize,
        maxTotalBytes: album.maxTotalBytes,
      },
      loadData: album.loadPhotos,
    };
  },
});
