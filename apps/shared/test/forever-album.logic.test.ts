import { beforeEach, describe, expect, it, vi } from "vitest";

import { useForeverAlbum } from "../../forever-album/src/composables/useForeverAlbum";
import { createMiniAppFramework } from "../react";
import { createObservable } from "../react/context";

beforeEach(() => {
  try {
    globalThis.localStorage?.clear();
  } catch {
    /* memory storage stub may be absent — ignore */
  }
});

const WALLET = "NgaiKFjurmNmiRzDRQGs44yzByXuSkdGPF";
const OTHER_WALLET = "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq";

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    passwordRequired: "Password required for encryption.",
    imageTooLarge: "Image too large for the size limit.",
    maxPhotosReached: "You already selected the max photos.",
    encryptedTooLarge: "Encrypted data exceeds size limit.",
    totalTooLarge: "Total size exceeds the limit.",
    decryptFailed: "Decryption failed.",
    invalidPayload: "Invalid encrypted payload.",
    uploadSuccess: "Saved to this device!",
    uploadFailed: "Save failed.",
    connectPromptTitle: "Connect wallet to view your album",
  };
  return params ? messages[key] ?? key : messages[key] ?? key;
}

function makeApp(walletAddress: string | null = WALLET) {
  const address = createObservable<string | null>(walletAddress);
  const ensureWallet = vi.fn(async () => walletAddress ?? "");
  const chain = { address, ensureWallet };
  const app = createMiniAppFramework(
    { services: { chain }, t } as never,
    // Mirror the app wiring: the album store lives in the legacy
    // "forever-album:" namespace (defineMiniApp storagePrefix).
    { appId: "miniapp-forever-album", storagePrefix: "forever-album:" },
  );
  const album = useForeverAlbum({ app, t });
  return { album, address };
}

const DATA_URL = "data:image/png;base64,aGVsbG8=";

describe("useForeverAlbum — local-only storage", () => {
  it("saves selected photos to the wallet's device-local album and reloads them", async () => {
    const { album } = makeApp();
    album.selectedImages.set([
      { id: "s1", dataUrl: DATA_URL, size: 10, payloadBytes: DATA_URL.length },
    ]);

    await album.uploadPhotos();
    await album.loadPhotos();

    const photos = album.photos.get();
    expect(photos).toHaveLength(1);
    expect(photos[0].data).toBe(DATA_URL);
    expect(photos[0].encrypted).toBe(false);
    // Selection is cleared after a successful save.
    expect(album.selectedImages.get()).toEqual([]);
  });

  it("persists across a fresh composable instance (survives reload), scoped per wallet", async () => {
    const first = makeApp();
    first.album.selectedImages.set([
      { id: "s1", dataUrl: DATA_URL, size: 10, payloadBytes: DATA_URL.length },
    ]);
    await first.album.uploadPhotos();

    // The store key is byte-identical to the pre-framework localStorage key,
    // so albums saved before the app.storage.local migration still resolve.
    expect(globalThis.localStorage?.getItem(`forever-album:photos:${WALLET}`)).toBeTruthy();

    // A new instance on the SAME wallet sees the saved photo.
    const second = makeApp();
    await second.album.loadPhotos();
    expect(second.album.photos.get()).toHaveLength(1);

    // A DIFFERENT wallet has its own (empty) album.
    const other = makeApp(OTHER_WALLET);
    await other.album.loadPhotos();
    expect(other.album.photos.get()).toHaveLength(0);
  });

  it("encrypts photos so the stored data is ciphertext, then decrypts with the right password", async () => {
    const { album } = makeApp();
    album.selectedImages.set([
      { id: "s1", dataUrl: DATA_URL, size: 10, payloadBytes: DATA_URL.length },
    ]);
    album.isEncrypted.set(true);
    album.password.set("hunter2");

    await album.uploadPhotos();
    await album.loadPhotos();

    const photo = album.photos.get()[0];
    expect(photo.encrypted).toBe(true);
    // The stored data is the AES-GCM envelope, NOT the plaintext data URL.
    expect(photo.data).not.toBe(DATA_URL);
    expect(photo.data).toContain("AES-GCM");

    // Right password decrypts back to the original image.
    album.decryptTarget.set(photo);
    await album.handleDecrypt("hunter2");
    expect(album.decryptedPreview.get()).toBe(DATA_URL);
    expect(album.decryptError.get()).toBe("");
  });

  it("surfaces a decrypt error (NOT a silent no-op) on a wrong password", async () => {
    const { album } = makeApp();
    album.selectedImages.set([
      { id: "s1", dataUrl: DATA_URL, size: 10, payloadBytes: DATA_URL.length },
    ]);
    album.isEncrypted.set(true);
    album.password.set("correct");
    await album.uploadPhotos();
    await album.loadPhotos();

    album.decryptTarget.set(album.photos.get()[0]);
    // The wrong password must reject (so notify.guard fires) AND set the rendered
    // decryptError observable — the earlier code swallowed it on a dead channel.
    await expect(album.handleDecrypt("wrong")).rejects.toThrow("Decryption failed.");
    expect(album.decryptError.get()).toBe("Decryption failed.");
    expect(album.decryptedPreview.get()).toBe("");
  });

  it("surfaces the max-photos rejection on the VISIBLE uploadError", async () => {
    const { album } = makeApp();
    // Fill the selection to the max, then attempt to add one more.
    album.selectedImages.set(
      Array.from({ length: 5 }, (_v, i) => ({
        id: `f${i}`,
        dataUrl: DATA_URL,
        size: 10,
        payloadBytes: DATA_URL.length,
      })),
    );
    await album.addFiles([{ type: "image/png", size: 10 } as unknown as File]);
    // The rejection lands on the rendered uploadError observable (the dead
    // "album:error" eventBus channel is gone along with the bus dependency).
    expect(album.uploadError.get()).toBe("You already selected the max photos.");
  });

  it("blocks an encrypted upload with no password via a visible uploadError", async () => {
    const { album } = makeApp();
    album.selectedImages.set([
      { id: "s1", dataUrl: DATA_URL, size: 10, payloadBytes: DATA_URL.length },
    ]);
    album.isEncrypted.set(true);
    album.password.set("");
    await expect(album.uploadPhotos()).rejects.toThrow("Password required for encryption.");
    expect(album.uploadError.get()).toBe("Password required for encryption.");
  });

  it("deletes a photo from the device-local album", async () => {
    const { album } = makeApp();
    album.selectedImages.set([
      { id: "s1", dataUrl: DATA_URL, size: 10, payloadBytes: DATA_URL.length },
    ]);
    await album.uploadPhotos();
    await album.loadPhotos();
    const id = album.photos.get()[0].id;

    await album.deletePhoto(id);
    expect(album.photos.get()).toHaveLength(0);
  });
});
