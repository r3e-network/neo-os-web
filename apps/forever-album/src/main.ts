import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useForeverAlbum } from "./composables/useForeverAlbum";

defineMiniApp({
  appId: "miniapp-forever-album",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-forever-album", {
      t: ctx.t as (key: string) => string,
    });

    const album = useForeverAlbum({
      chain: platformServices.chain,
      eventBus: platformServices.events,
      t: ctx.t,
    });

    ctx.registerAction("viewPhoto", async (photo: unknown) => {
      album.viewPhoto(photo as { id: string; data: string; encrypted: boolean; createdAt: number });
    });

    ctx.registerAction("openUpload", async () => { album.openUpload(); });
    ctx.registerAction("closeUpload", async () => { album.closeUpload(); });
    ctx.registerAction("closeViewer", async () => { album.closeViewer(); });
    ctx.registerAction("openDecrypt", async () => { album.openDecrypt(); });
    ctx.registerAction("closeDecrypt", async () => { album.closeDecrypt(); });

    ctx.registerAction("handleDecrypt", async (pwd: unknown) => {
      try {
        await album.handleDecrypt(pwd as string);
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("decryptFailed"), "error");
      }
    });

    ctx.registerAction("uploadPhotos", async () => {
      try {
        await album.uploadPhotos();
        ctx.setStatus(ctx.t("uploadSuccess"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("uploadFailed"), "error");
      }
    });

    ctx.registerAction("removeImage", async (id: unknown) => {
      album.removeImage(id as string);
    });

    return {
      state: {
        photos: album.photos,
        photosCount: album.photosCount,
        encryptedCount: album.encryptedCount,
        publicCount: album.publicCount,
        loadingPhotos: album.loadingPhotos,
        uploading: album.uploading,
        showViewer: album.showViewer,
        viewingPhoto: album.viewingPhoto,
        showDecrypt: album.showDecrypt,
        decryptTarget: album.decryptTarget,
        decrypting: album.decrypting,
        decryptedPreview: album.decryptedPreview,
        showUpload: album.showUpload,
        selectedImages: album.selectedImages,
        isEncrypted: album.isEncrypted,
        password: album.password,
        totalPayloadSize: album.totalPayloadSize,
      },
      loadData: album.loadPhotos,
      cleanup: () => { platformServices.destroy(); },
    };
  },
});
