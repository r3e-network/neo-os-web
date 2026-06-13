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

  setup(ctx) {
    const album = useForeverAlbum({
      chainService: ctx.services.chain,
      eventBus: ctx.services.events,
      t: ctx.t,
    });

    const { notify } = ctx.services;
    const launchDefaults = getForeverAlbumLaunchDefaults(ctx.launchContext);
    album.isEncrypted.set(launchDefaults.isEncrypted);

    ctx.registerAction("viewPhoto", async (photo: unknown) => {
      album.viewPhoto(
        photo as {
          id: string;
          data: string;
          encrypted: boolean;
          createdAt: number;
        },
      );
    });

    ctx.registerAction("openUpload", async () => {
      album.openUpload();
    });
    ctx.registerAction("closeUpload", async () => {
      album.closeUpload();
    });
    ctx.registerAction("refreshPhotos", async () => {
      await album.loadPhotos();
    });
    ctx.registerAction("closeViewer", async () => {
      album.closeViewer();
    });
    ctx.registerAction("openDecrypt", async () => {
      album.openDecrypt();
    });
    ctx.registerAction("closeDecrypt", async () => {
      album.closeDecrypt();
    });

    ctx.registerAction("handleDecrypt", async (pwd: unknown) => {
      await notify.guard(
        () => album.handleDecrypt(pwd as string),
        undefined,
        "decryptFailed",
      );
    });

    ctx.registerAction("uploadPhotos", async () => {
      await notify.guard(
        () => album.uploadPhotos(),
        "uploadSuccess",
        "uploadFailed",
      );
    });

    ctx.registerAction("removeImage", async (id: unknown) => {
      album.removeImage(id as string);
    });

    ctx.registerAction("deletePhoto", async (id: unknown) => {
      await notify.guard(() => album.deletePhoto(id as string), "photoDeleted");
    });

    ctx.registerAction("addFiles", async (...args: unknown[]) => {
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
