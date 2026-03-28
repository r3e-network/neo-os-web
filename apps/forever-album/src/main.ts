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

    return {
      state: {
        photos: album.photos,
        photosCount: album.photosCount,
        encryptedCount: album.encryptedCount,
        publicCount: album.publicCount,
        loadingPhotos: album.loadingPhotos,
        uploading: album.uploading,
      },
      loadData: album.loadPhotos,
      cleanup: () => { platformServices.destroy(); },
    };
  },
});
