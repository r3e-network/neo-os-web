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
    emptyDesc: "Upload your first memory on-chain.",
    emptyTipPublicOrPrivate: "Public or encrypted",
    emptyTipSizeSafe: "Up to 5 · <60KB",
    emptyTitle: "No photos yet",
    encryptPhotos: "Encrypt photos",
    feature1Desc: "Photos are indexed per wallet address with timestamps.",
    feature2Desc: "AES-GCM encryption keeps memories private and local.",
    feature3Desc: "Guards keep uploads within Neo transaction limits.",
    lastTransaction: "Last transaction",
    payloadSize: "Payload",
    readyToSign: "Ready to sign the wallet upload.",
    refreshAlbum: "Refresh album",
    remove: "Remove",
    selectedCount: "Selected",
    sidebarEncrypted: "Encrypted",
    sidebarPublic: "Public",
    sizeUnitByte: "B",
    sizeUnitKbyte: "KB",
    step1: "Select up to five photos and verify the payload stays under 60KB.",
    step2: "Optionally encrypt with a password.",
    step3: "Sign and broadcast the upload transaction with your wallet.",
    tapToSelect: "Tap to Select",
    title: "Forever Album",
    transactionConfirmed: "Submitted",
    transactionPending: "Pending wallet result",
    upload: "Upload",
    uploadNeedsAttention: "Upload needs attention",
    vaultHeroSubtitle: "Select photos, choose privacy, and sign.",
    vaultHeroTitle: "Preserve memories as wallet-signed vault records",
    vaultPrivacyTitle: "Privacy route",
    vaultPublicNote: "Public photos are readable from the album record.",
    vaultRouteTitle: "Upload route",
    vaultSafetyOne: "Wallet scoped",
    vaultSafetyThree: "Size guarded",
    vaultSafetyTwo: "Local privacy",
    vaultStatsTitle: "Album vault summary",
    vaultTimelineOne: "Pick compact images",
    vaultTimelineThree: "Sign on Neo",
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
    lastTx: null,
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
          uploadError:
            "The wallet handoff worked, but this network's Morpheus storage contract is not upgraded for album writes yet.",
          selectedImages: [{ id: "photo-1", size: 68 }],
          totalPayloadSize: 68,
        })}
        dispatch={vi.fn()}
        launchContext={launch("https://neomini.app/miniapps/forever-album")}
      />,
    );

    const alertText = screen.getByRole("alert").textContent ?? "";
    expect(alertText).toContain("Upload needs attention");
    expect(alertText).toContain("Morpheus storage contract is not upgraded");
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

  it("shows the latest wallet transaction receipt after upload", () => {
    render(
      <PlayArea
        t={t}
        state={state({
          selectedImages: [{ id: "photo-1", size: 68 }],
          totalPayloadSize: 68,
          lastTx: {
            txid: "0x1234567890abcdef1234567890abcdef1234567890abcdef",
            success: true,
          },
        })}
        dispatch={vi.fn()}
        launchContext={launch("https://neomini.app/miniapps/forever-album")}
      />,
    );

    const receipt = screen.getByText("Last transaction").closest("div");
    expect(receipt?.textContent).toContain("0x12345678");
    expect(receipt?.textContent).toContain("Submitted");
  });
});
