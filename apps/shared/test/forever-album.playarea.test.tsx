import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import { parseMiniAppLaunchContext } from "../utils/launch-params";
import PlayArea from "../../forever-album/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string) {
  const messages: Record<string, string> = {
    albumTab: "Album",
    albumPhoto: "Album photo",
    chooseFiles: "Choose images",
    emptyAction: "Select photos",
    emptyDesc: "Save your first memory to this device.",
    emptyTipPublicOrPrivate: "Public or encrypted",
    emptyTipSizeSafe: "Up to 5 · <60KB",
    emptyTitle: "No photos yet",
    encryptPhotos: "Encrypt photos",
    feature1Desc: "Photos are kept per wallet address on this device, with timestamps.",
    feature2Desc: "AES-GCM encryption keeps memories private and local.",
    feature3Desc: "Guards keep uploads within size limits.",
    localStorageNote:
      "Photos are saved on this device under your wallet address — not on-chain.",
    payloadSize: "Payload",
    readyToSave: "Ready to save to this device.",
    refreshAlbum: "Refresh album",
    remove: "Remove",
    selectedCount: "Selected",
    sidebarEncrypted: "Encrypted",
    sidebarPublic: "Public",
    sizeUnitByte: "B",
    sizeUnitKbyte: "KB",
    step1: "Select up to five photos and verify the payload stays under 60KB.",
    step2: "Optionally encrypt with a password.",
    step3: "Save the album to this device — no transaction, no gas.",
    tapToSelect: "Tap to Select",
    title: "Forever Album",
    upload: "Upload",
    uploadNeedsAttention: "Upload needs attention",
    vaultHeroSubtitle: "Select photos, choose privacy, and save to this device.",
    vaultHeroTitle: "Keep memories in a private, wallet-scoped album on your device",
    vaultPrivacyTitle: "Privacy route",
    vaultPublicNote: "Public photos are stored in the clear on this device.",
    vaultRouteTitle: "Save route",
    vaultSafetyOne: "Wallet scoped",
    vaultSafetyThree: "Size guarded",
    vaultSafetyTwo: "Local privacy",
    vaultStatsTitle: "Album summary",
    vaultTimelineOne: "Pick compact images",
    vaultTimelineThree: "Save to device",
    vaultTimelineTwo: "Encrypt locally",
    vaultUploadTitle: "Memory upload",
  };
  return messages[key] ?? key;
}

function state(
  overrides: Partial<Record<string, unknown>> = {},
): ObservableState {
  const values: Record<string, unknown> = {
    photos: [],
    photosCount: 0,
    encryptedCount: 0,
    publicCount: 0,
    loadingPhotos: false,
    uploading: false,
    uploadError: "",
    showViewer: false,
    viewingPhoto: null,
    showDecrypt: false,
    decryptTarget: null,
    decrypting: false,
    decryptedPreview: "",
    showUpload: false,
    selectedImages: [],
    isEncrypted: false,
    password: "",
    totalPayloadSize: 0,
    decryptError: "",
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      createObservable(value),
    ]),
  );
}

function launch(url: string) {
  return parseMiniAppLaunchContext(url, "miniapp-forever-album");
}

describe("Forever Album PlayArea", () => {
  it("keeps upload failures visible inside the upload panel", () => {
    render(
      <PlayArea
        t={t}
        state={state({
          uploadError: "Image too large for the size limit.",
          selectedImages: [{ id: "photo-1", size: 68 }],
          totalPayloadSize: 68,
        })}
        dispatch={vi.fn()}
        launchContext={launch("https://neomini.app/miniapps/forever-album")}
      />,
    );

    const alertText = screen.getByRole("alert").textContent ?? "";
    expect(alertText).toContain("Upload needs attention");
    expect(alertText).toContain("Image too large");
  });

  it("applies privacy launch params to the embedded upload workspace", () => {
    const { rerender } = render(
      <PlayArea
        t={t}
        state={state()}
        dispatch={vi.fn()}
        launchContext={launch(
          "https://neomini.app/miniapps/forever-album?operation=prepareMiniAppOperation&privacy=encrypted",
        )}
      />,
    );

    expect(
      (screen.getByLabelText("Encrypt photos") as HTMLInputElement).checked,
    ).toBe(true);

    rerender(
      <PlayArea
        t={t}
        state={state({ isEncrypted: true })}
        dispatch={vi.fn()}
        launchContext={launch(
          "https://neomini.app/miniapps/forever-album?operation=prepareMiniAppOperation&privacy=public",
        )}
      />,
    );

    expect(
      (screen.getByLabelText("Encrypt photos") as HTMLInputElement).checked,
    ).toBe(false);
  });

  it("states honestly that photos are saved on-device, not on-chain", () => {
    render(
      <PlayArea
        t={t}
        state={state({
          selectedImages: [{ id: "photo-1", size: 68 }],
          totalPayloadSize: 68,
        })}
        dispatch={vi.fn()}
        launchContext={launch("https://neomini.app/miniapps/forever-album")}
      />,
    );

    expect(
      screen.getByText(
        "Photos are saved on this device under your wallet address — not on-chain.",
      ),
    ).toBeTruthy();
  });

  it("surfaces a decrypt error (wrong password) in the decrypt card", () => {
    render(
      <PlayArea
        t={t}
        state={state({
          showDecrypt: true,
          decryptError: "Decryption failed.",
        })}
        dispatch={vi.fn()}
        launchContext={launch("https://neomini.app/miniapps/forever-album")}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Decryption failed.");
  });
});
