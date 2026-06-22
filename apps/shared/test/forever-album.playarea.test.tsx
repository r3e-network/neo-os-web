import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import { parseMiniAppLaunchContext } from "../utils/launch-params";
import PlayArea from "../../forever-album/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
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
    stageArchiveCopy: "Saved memories stay available on this device for this wallet.",
    stageArchiveTitle: "Album archive is ready",
    stageDraftCount: "{count} ready",
    stageEmptyCopy:
      "Choose images and the workbench turns them into a wallet-scoped local album.",
    stageEmptyCount: "No draft",
    stageEmptyFrameOne: "Pick",
    stageEmptyFrameThree: "Keep",
    stageEmptyFrameTwo: "Seal",
    stageEmptyTitle: "Start with a few light memories",
    stagePrivateMode: "Private seal",
    stagePublicMode: "Public album",
    stageReadyCopy: "Frames, privacy, and payload size update live before the save action.",
    stageReadyTitle: "Preview the album seal before saving",
    stageSavedCount: "{count} saved",
    stageSealingCopy: "Encrypting when needed, then writing the album to this device.",
    stageSealingTitle: "Sealing this batch locally",
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
    galleryStageTitle: "Album sealing workbench",
  };
  let text = messages[key] ?? key;
  for (const [name, value] of Object.entries(params ?? {})) {
    text = text.replace(`{${name}}`, String(value));
  }
  return text;
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

  it("applies privacy launch params to the embedded upload workspace", async () => {
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

    await waitFor(() => {
      expect(
        (screen.getByLabelText("Encrypt photos") as HTMLInputElement).checked,
      ).toBe(true);
    });

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

    await waitFor(() => {
      expect(
        (screen.getByLabelText("Encrypt photos") as HTMLInputElement).checked,
      ).toBe(false);
    });
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

  it("renders a private animated sealing workbench for selected photos", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          selectedImages: [
            { id: "photo-1", dataUrl: "data:image/png;base64,a", size: 68 },
            { id: "photo-2", dataUrl: "data:image/png;base64,b", size: 92 },
          ],
          totalPayloadSize: 160,
          isEncrypted: true,
        })}
        dispatch={vi.fn()}
        launchContext={launch(
          "https://neomini.app/miniapps/forever-album?operation=prepareMiniAppOperation&privacy=encrypted",
        )}
      />,
    );

    const stage = screen.getByLabelText("Album sealing workbench");
    expect(stage.className).toContain("forever-album-seal-stage--ready");
    expect(stage.className).toContain("forever-album-seal-stage--private");
    expect(stage.textContent).toContain("Private seal");
    expect(stage.textContent).toContain("2 ready");
    expect(stage.textContent).toContain("Preview the album seal before saving");
    expect(container.querySelectorAll(".forever-album-seal-stage__frame img")).toHaveLength(2);
  });

  it("switches the workbench into sealing motion while uploading", () => {
    render(
      <PlayArea
        t={t}
        state={state({
          selectedImages: [{ id: "photo-1", dataUrl: "data:image/png;base64,a", size: 68 }],
          totalPayloadSize: 68,
          uploading: true,
        })}
        dispatch={vi.fn()}
        launchContext={launch("https://neomini.app/miniapps/forever-album")}
      />,
    );

    const stage = screen.getByLabelText("Album sealing workbench");
    expect(stage.className).toContain("forever-album-seal-stage--sealing");
    expect(stage.textContent).toContain("Sealing this batch locally");
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

  it("keeps the gallery workbench animated with reduced-motion coverage", () => {
    const scss = readFileSync(
      resolve(process.cwd(), "../forever-album/src/PlayArea.scss"),
      "utf8",
    );

    expect(scss).toContain(".forever-album-seal-stage--ready");
    expect(scss).toContain(".forever-album-seal-stage--sealing");
    expect(scss).toContain("@keyframes forever-album-frame-float");
    expect(scss).toContain("@keyframes forever-album-rail-flow");
    expect(scss).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
