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
    decryptInProgress: "This memory is already being unlocked.",
    decryptContextChanged: "Unlock context changed.",
    invalidPayload: "Invalid encrypted payload.",
    uploadSuccess: "Saved to this device!",
    uploadFailed: "Save failed.",
    connectPromptTitle: "Connect wallet to view your album",
    passwordMismatch: "Passwords do not match.",
    selectPhotosFirst: "Select at least one photo first.",
    saveInProgress: "Save already in progress.",
    storageUnavailable: "Local storage unavailable.",
    storageFull: "Local storage full.",
    storageWriteNotConfirmed: "Local write was not confirmed.",
    albumDataDamaged: "Album data is damaged.",
    albumPartiallyRecovered: "Recovered album with {count} damaged item(s).",
    photoNotFound: "Photo not found.",
    resetNotNeeded: "Reset not needed.",
    albumFull: "Album is full.",
    walletChangedDuringSave: "Wallet changed during save.",
    invalidImageContent: "The file has no supported image signature.",
    fileReadInProgress: "Photo import is still in progress.",
  };
  let value = messages[key] ?? key;
  if (params) {
    for (const [name, replacement] of Object.entries(params)) {
      value = value.replaceAll(`{${name}}`, String(replacement));
    }
  }
  return value;
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
  return { album, address, app };
}

const DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

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
    album.passwordConfirm.set("hunter2");

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
    expect(album.showDecrypt.get()).toBe(false);
    expect(album.showViewer.get()).toBe(true);
    expect(album.viewingPhoto.get()?.id).toBe(photo.id);
  });

  it("surfaces a decrypt error (NOT a silent no-op) on a wrong password", async () => {
    const { album } = makeApp();
    album.selectedImages.set([
      { id: "s1", dataUrl: DATA_URL, size: 10, payloadBytes: DATA_URL.length },
    ]);
    album.isEncrypted.set(true);
    album.password.set("correct");
    album.passwordConfirm.set("correct");
    await album.uploadPhotos();
    await album.loadPhotos();

    album.decryptTarget.set(album.photos.get()[0]);
    // The wrong password must reject (so notify.guard fires) AND set the rendered
    // decryptError observable — the earlier code swallowed it on a dead channel.
    await expect(album.handleDecrypt("wrong")).rejects.toThrow("Decryption failed.");
    expect(album.decryptError.get()).toBe("Decryption failed.");
    expect(album.decryptedPreview.get()).toBe("");
  });

  it("does not reveal a decrypted photo after the wallet partition changes", async () => {
    const { album, address } = makeApp();
    album.selectedImages.set([
      { id: "s1", dataUrl: DATA_URL, size: 10, payloadBytes: DATA_URL.length },
    ]);
    album.isEncrypted.set(true);
    album.password.set("partition-password");
    album.passwordConfirm.set("partition-password");
    await album.uploadPhotos();
    const photo = album.photos.get()[0];
    album.viewPhoto(photo);

    const decrypting = album.handleDecrypt("partition-password");
    address.set(OTHER_WALLET);
    await album.handleWalletChange();

    await expect(decrypting).rejects.toThrow("Unlock context changed.");
    expect(album.walletAddress.get()).toBe(OTHER_WALLET);
    expect(album.decryptedPreview.get()).toBe("");
    expect(album.viewingPhoto.get()).toBeNull();
    expect(album.showViewer.get()).toBe(false);
    expect(album.showDecrypt.get()).toBe(false);
  });

  it("does not reopen a memory after the unlock dialog is cancelled", async () => {
    const { album } = makeApp();
    album.selectedImages.set([
      { id: "s1", dataUrl: DATA_URL, size: 10, payloadBytes: DATA_URL.length },
    ]);
    album.isEncrypted.set(true);
    album.password.set("cancel-password");
    album.passwordConfirm.set("cancel-password");
    await album.uploadPhotos();
    album.viewPhoto(album.photos.get()[0]);

    const decrypting = album.handleDecrypt("cancel-password");
    album.closeDecrypt();

    await expect(decrypting).rejects.toThrow("Unlock context changed.");
    expect(album.decryptedPreview.get()).toBe("");
    expect(album.viewingPhoto.get()).toBeNull();
    expect(album.showViewer.get()).toBe(false);
    expect(album.showDecrypt.get()).toBe(false);
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

  it.each([
    ["png", "image/png", Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ["jpeg", "image/jpeg", Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])],
    ["gif", "image/gif", new TextEncoder().encode("GIF89a")],
    ["webp", "image/webp", new TextEncoder().encode("RIFF0000WEBP")],
    [
      "avif",
      "image/avif",
      Uint8Array.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66, 0x00, 0x00, 0x00, 0x00]),
    ],
  ])("accepts %s from its real file signature", async (_name, expectedType, bytes) => {
    const { album } = makeApp();
    const file = new File([bytes], "memory.bin", { type: "application/octet-stream" });

    const additions = await album.addFiles([file]);

    expect(additions).toHaveLength(1);
    expect(additions[0].dataUrl).toMatch(new RegExp(`^data:${expectedType};base64,`));
    expect(album.uploadError.get()).toBeNull();
  });

  it("rejects a file whose claimed image type does not match real image bytes", async () => {
    const { album } = makeApp();
    const fake = new File(["not an image"], "memory.png", { type: "image/png" });

    await album.addFiles([fake]);

    expect(album.selectedImages.get()).toEqual([]);
    expect(album.uploadError.get()).toBe("The file has no supported image signature.");
  });

  it("accepts the exact 768 KiB source boundary", async () => {
    const { album } = makeApp();
    const bytes = new Uint8Array(768 * 1024);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const additions = await album.addFiles([new File([bytes], "boundary.png", { type: "image/png" })]);

    expect(additions).toHaveLength(1);
    expect(additions[0].size).toBe(768 * 1024);
  });

  it("rejects a source file one byte above the 768 KiB boundary", async () => {
    const { album } = makeApp();
    const bytes = new Uint8Array(768 * 1024 + 1);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    expect(await album.addFiles([new File([bytes], "too-large.png", { type: "image/png" })])).toEqual([]);
    expect(album.uploadError.get()).toBe("Image too large for the size limit.");
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

  it("rejects an empty save instead of reporting fake success", async () => {
    const { album } = makeApp();
    await expect(album.uploadPhotos()).rejects.toThrow("Select at least one photo first.");
    expect(album.photos.get()).toEqual([]);
  });

  it("freezes the selected batch while a local save is in progress", async () => {
    const { album } = makeApp();
    album.selectedImages.set([
      { id: "draft", dataUrl: DATA_URL, size: 10, payloadBytes: DATA_URL.length },
    ]);
    album.uploading.set(true);

    expect(album.removeImage("draft")).toBe(false);
    expect(await album.addFiles([new File(["later"], "later.png", { type: "image/png" })])).toEqual([]);
    expect(album.selectedImages.get().map((item) => item.id)).toEqual(["draft"]);
    expect(album.uploadError.get()).toBe("Save already in progress.");
  });

  it("does not start a save or mutate the draft while selected files are still loading", async () => {
    const { album } = makeApp();
    album.selectedImages.set([
      { id: "draft", dataUrl: DATA_URL, size: 10, payloadBytes: DATA_URL.length },
    ]);
    album.processingFiles.set(true);

    await expect(album.uploadPhotos()).rejects.toThrow("Photo import is still in progress.");
    expect(album.removeImage("draft")).toBe(false);
    expect(await album.addFiles([new File(["later"], "later.png", { type: "image/png" })])).toEqual([]);
    expect(album.selectedImages.get().map((item) => item.id)).toEqual(["draft"]);
    expect(album.uploadError.get()).toBe("Photo import is still in progress.");
  });

  it("keeps the draft and rejects when a local write cannot be confirmed", async () => {
    const { album, app } = makeApp();
    album.selectedImages.set([
      { id: "s1", dataUrl: DATA_URL, size: 10, payloadBytes: DATA_URL.length },
    ]);

    const originalSet = app.storage.local.set.bind(app.storage.local);
    vi.spyOn(app.storage.local, "set").mockImplementation((key, value) => {
      if (String(key).startsWith("__probe__:")) originalSet(key, value);
      // Album writes are intentionally dropped to emulate a browser context
      // that exposes the API but does not persist the write.
    });

    await expect(album.uploadPhotos()).rejects.toThrow("Local write was not confirmed.");
    expect(album.selectedImages.get()).toHaveLength(1);
    expect(album.photos.get()).toHaveLength(0);
    expect(album.storageIssue.get()).toBe("unavailable");
  });

  it("keeps the draft and surfaces quota exhaustion", async () => {
    const { album, app } = makeApp();
    album.selectedImages.set([
      { id: "s1", dataUrl: DATA_URL, size: 10, payloadBytes: DATA_URL.length },
    ]);

    const originalSet = app.storage.local.set.bind(app.storage.local);
    vi.spyOn(app.storage.local, "set").mockImplementation((key, value) => {
      if (String(key).startsWith("__probe__:")) {
        originalSet(key, value);
        return;
      }
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });

    await expect(album.uploadPhotos()).rejects.toThrow("Local storage full.");
    expect(album.selectedImages.get()).toHaveLength(1);
    expect(album.storageIssue.get()).toBe("quota");
  });

  it("keeps an existing album readable when new probe writes hit quota", async () => {
    const { album, app } = makeApp();
    globalThis.localStorage?.setItem(
      `forever-album:photos:${WALLET}`,
      JSON.stringify([{ id: "kept", data: DATA_URL, encrypted: false, createdAt: 1 }]),
    );
    const set = vi.spyOn(app.storage.local, "set").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });

    await album.loadPhotos();

    expect(album.photos.get().map((photo) => photo.id)).toEqual(["kept"]);
    expect(album.storageIssue.get()).toBe("");
    expect(set).not.toHaveBeenCalled();
  });

  it("treats a quota-only probe failure as an empty readable album", async () => {
    const { album, app } = makeApp();
    vi.spyOn(app.storage.local, "set").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });

    await album.loadPhotos();

    expect(album.photos.get()).toEqual([]);
    expect(album.storageIssue.get()).toBe("");
  });

  it("does not turn an unavailable storage adapter into a fake empty album", async () => {
    const { album, app } = makeApp();
    vi.spyOn(app.storage.local, "list").mockReturnValue({});
    vi.spyOn(app.storage.local, "set").mockImplementation(() => {});
    vi.spyOn(app.storage.local, "get").mockReturnValue(null);

    await expect(album.loadPhotos()).rejects.toThrow("Local storage unavailable.");

    expect(album.photos.get()).toEqual([]);
    expect(album.storageIssue.get()).toBe("unavailable");
  });

  it("can replace an existing album with a smaller one without a separate quota probe", async () => {
    const { album, app } = makeApp();
    album.selectedImages.set([
      { id: "s1", dataUrl: DATA_URL, size: 10, payloadBytes: DATA_URL.length },
    ]);
    await album.uploadPhotos();
    const photo = album.photos.get()[0];
    const originalSet = app.storage.local.set.bind(app.storage.local);
    const set = vi.spyOn(app.storage.local, "set").mockImplementation((key, value) => {
      if (String(key).startsWith("__probe__:")) {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      }
      originalSet(key, value);
    });

    await album.deletePhoto(photo.id);

    expect(album.photos.get()).toEqual([]);
    expect(set).toHaveBeenCalledWith(`photos:${WALLET}`, { version: 2, photos: [] });
    expect(set.mock.calls.some(([key]) => String(key).startsWith("__probe__:"))).toBe(false);
  });

  it("clears the previous wallet gallery and sensitive draft on wallet change", async () => {
    const { album, address } = makeApp();
    album.selectedImages.set([
      { id: "s1", dataUrl: DATA_URL, size: 10, payloadBytes: DATA_URL.length },
    ]);
    await album.uploadPhotos();
    expect(album.photos.get()).toHaveLength(1);

    album.selectedImages.set([
      { id: "draft", dataUrl: DATA_URL, size: 10, payloadBytes: DATA_URL.length },
    ]);
    album.password.set("sensitive");
    album.passwordConfirm.set("sensitive");
    address.set(OTHER_WALLET);
    await album.handleWalletChange();

    expect(album.walletAddress.get()).toBe(OTHER_WALLET);
    expect(album.photos.get()).toEqual([]);
    expect(album.selectedImages.get()).toEqual([]);
    expect(album.password.get()).toBe("");
    expect(album.passwordConfirm.get()).toBe("");
  });

  it("preserves a pending draft when the save action itself connects the first wallet", async () => {
    const { album, address } = makeApp(null);
    album.selectedImages.set([
      { id: "draft", dataUrl: DATA_URL, size: 10, payloadBytes: DATA_URL.length },
    ]);
    album.password.set("draft-password");
    album.passwordConfirm.set("draft-password");

    address.set(WALLET);
    await album.handleWalletChange({ preserveDraft: true });

    expect(album.selectedImages.get()).toHaveLength(1);
    expect(album.password.get()).toBe("draft-password");
    expect(album.passwordConfirm.get()).toBe("draft-password");
  });

  it("enforces the wallet album capacity before replacing confirmed storage", async () => {
    const { album } = makeApp();
    const largePhoto = `data:image/png;base64,iVBORw0KGgoA${"A".repeat(1024 * 1024 - 32)}`;
    const existing = Array.from({ length: 3 }, (_value, index) => ({
      id: `large-${index}`,
      data: largePhoto,
      encrypted: false,
      createdAt: index + 1,
    }));
    const key = `forever-album:photos:${WALLET}`;
    globalThis.localStorage?.setItem(key, JSON.stringify(existing));
    const before = globalThis.localStorage?.getItem(key);
    album.selectedImages.set([
      { id: "draft", dataUrl: DATA_URL, size: 10, payloadBytes: DATA_URL.length },
    ]);

    await expect(album.uploadPhotos()).rejects.toThrow("Album is full.");
    expect(globalThis.localStorage?.getItem(key)).toBe(before);
    expect(album.selectedImages.get()).toHaveLength(1);
  });

  it("surfaces damaged storage and resets only the active wallet album", async () => {
    const { album } = makeApp();
    globalThis.localStorage?.setItem(`forever-album:photos:${WALLET}`, "{not-json");
    globalThis.localStorage?.setItem(
      `forever-album:photos:${OTHER_WALLET}`,
      JSON.stringify([{ id: "other", data: DATA_URL, encrypted: false, createdAt: 1 }]),
    );

    await expect(album.loadPhotos()).rejects.toThrow("Album data is damaged.");
    expect(album.storageIssue.get()).toBe("corrupt");
    await album.resetDamagedAlbum();
    expect(globalThis.localStorage?.getItem(`forever-album:photos:${WALLET}`)).toBeNull();
    expect(globalThis.localStorage?.getItem(`forever-album:photos:${OTHER_WALLET}`)).toBeTruthy();
  });

  it("recovers valid records while warning about damaged entries", async () => {
    const { album } = makeApp();
    globalThis.localStorage?.setItem(
      `forever-album:photos:${WALLET}`,
      JSON.stringify([
        { id: "valid", data: DATA_URL, encrypted: false, createdAt: 1 },
        { id: "broken", data: "not-an-image", encrypted: false, createdAt: 2 },
      ]),
    );

    await album.loadPhotos();
    expect(album.photos.get().map((photo) => photo.id)).toEqual(["valid"]);
    expect(album.storageNotice.get()).toBe("Recovered album with 1 damaged item(s).");
  });

  it("drops duplicate local record ids instead of rendering ambiguous photos", async () => {
    const { album } = makeApp();
    globalThis.localStorage?.setItem(
      `forever-album:photos:${WALLET}`,
      JSON.stringify([
        { id: "duplicate", data: DATA_URL, encrypted: false, createdAt: 1 },
        { id: "duplicate", data: DATA_URL, encrypted: false, createdAt: 2 },
      ]),
    );

    await album.loadPhotos();

    expect(album.photos.get()).toHaveLength(1);
    expect(album.photos.get()[0].createdAt).toBe(1);
    expect(album.storageNotice.get()).toBe("Recovered album with 1 damaged item(s).");
  });

  it("leaves a malformed encrypted envelope out of a recoverable album", async () => {
    const { album } = makeApp();
    globalThis.localStorage?.setItem(
      `forever-album:photos:${WALLET}`,
      JSON.stringify([
        { id: "valid", data: DATA_URL, encrypted: false, createdAt: 1 },
        {
          id: "broken-encrypted",
          data: JSON.stringify({ v: 1, alg: "AES-GCM", salt: "!!!!", iv: "!!!!", data: "!!!!" }),
          encrypted: true,
          createdAt: 2,
        },
      ]),
    );

    await album.loadPhotos();

    expect(album.photos.get().map((photo) => photo.id)).toEqual(["valid"]);
    expect(album.storageNotice.get()).toBe("Recovered album with 1 damaged item(s).");
  });

  it("rejects deleting a missing photo instead of emitting a success path", async () => {
    const { album } = makeApp();
    await expect(album.deletePhoto("missing")).rejects.toThrow("Photo not found.");
  });

  it("keeps the viewer and confirmed photo when a delete write is not persisted", async () => {
    const { album, app } = makeApp();
    album.selectedImages.set([
      { id: "s1", dataUrl: DATA_URL, size: 10, payloadBytes: DATA_URL.length },
    ]);
    await album.uploadPhotos();
    const photo = album.photos.get()[0];
    album.viewPhoto(photo);

    const originalSet = app.storage.local.set.bind(app.storage.local);
    vi.spyOn(app.storage.local, "set").mockImplementation((key, value) => {
      if (String(key).startsWith("__probe__:")) originalSet(key, value);
    });

    await expect(album.deletePhoto(photo.id)).rejects.toThrow("Local write was not confirmed.");
    expect(album.photos.get()).toHaveLength(1);
    expect(album.showViewer.get()).toBe(true);
    expect(album.viewingPhoto.get()?.id).toBe(photo.id);
  });
});
