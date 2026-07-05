import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../forever-album/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    title: "Forever Album",
    albumTab: "Album",
    vaultHeroTitle: "Forever Album",
    vaultHeroSubtitle: "Your memories, sealed.",
    uploading: "Uploading...",
    upload: "Upload",
    emptyTitle: "No photos",
    emptyDesc: "Select photos to seal.",
    readyToSave: "Ready to seal",
    chooseFiles: "Choose files",
    selectedCount: "{count} selected",
    encryptPhotos: "Encrypt",
    startHere: "Add your first memory",
    selectMore: "Select",
    uploadHint: "{count} selected · Up to {max}",
    stagePrivateMode: "Private seal",
    stagePublicMode: "Public album",
    stageDraftCount: "{count} ready",
    stageSavedCount: "{count} saved",
    stageEmptyCount: "No draft",
    stageEmptyFrameOne: "Pick",
    stageEmptyFrameTwo: "Seal",
    stageEmptyFrameThree: "Keep",
    stageEmptyTitle: "Start with a few light memories",
    stageEmptyCopy: "Choose images and save them locally.",
    stageReadyTitle: "Preview the album seal before saving",
    stageReadyCopy: "Frames and privacy update live.",
    stageSealingTitle: "Sealing this batch locally",
    stageSealingCopy: "Writing to this device.",
    stageArchiveTitle: "Album archive is ready",
    stageArchiveCopy: "Saved memories stay here.",
    privacyModePrivateHint: "Password-protected local storage",
    privacyModePublicHint: "Visible on this device",
    galleryStageTitle: "Album sealing workbench",
    albumMemoryStageLabel: "Memory stage",
    albumMemoryStageAlt: "Warm album scene",
    encrypted: "Encrypted",
    remove: "Remove",
    passwordPlaceholder: "Password",
    sidebarEncrypted: "Encrypted",
    sidebarPublic: "Public",
    refreshAlbum: "Refresh",
    vaultPrivacyTitle: "Privacy",
    localStorageNote: "Photos are saved on your device.",
    step1: "Step 1",
    step2: "Step 2",
    step3: "Step 3",
    vaultSafetyOne: "Safety",
    vaultSafetyTwo: "Encrypted",
    vaultSafetyThree: "Local",
    photoEncrypted: "Encrypted photo",
    decrypt: "Decrypt",
    decrypting: "Decrypting...",
    decryptTitle: "Enter password",
    deletePhoto: "Delete",
    createdAt: "Created",
    albumPhoto: "Photo",
    close: "Close",
  };
  let value = messages[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) value = value.replaceAll(`{${k}}`, String(v));
  return value;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    loadingPhotos: false,
    uploading: false,
    showViewer: false,
    showDecrypt: false,
    decrypting: false,
    isEncrypted: false,
    photosCount: 0,
    encryptedCount: 0,
    publicCount: 0,
    totalPayloadSize: 0,
    maxTotalBytes: 61440,
    password: "",
    uploadError: "",
    decryptedPreview: "",
    decryptError: "",
    photos: [],
    viewingPhoto: null,
    selectedImages: [],
    ...overrides,
  };
  return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, createObservable(v)]));
}

describe("Forever Album PlayArea (v2 scene-driven)", () => {
  it("renders a clean album workbench with empty state", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    expect(container.querySelector(".album-workbench")).toBeTruthy();
    expect(container.querySelector(".album-workbench__memory-card")).toBeTruthy();
    expect(container.querySelector(".album-workbench__memory-image")).toBeTruthy();
    expect(container.querySelector(".album-import")).toBeTruthy();
    expect(container.querySelector(".album-privacy-toggle")).toBeTruthy();
    expect(container.querySelector(".album-dropzone")).toBeNull();
    expect(container.querySelector(".album-workbench__library")).toBeNull();
    expect(container.textContent).toContain("Start with a few light memories");
    expect(container.textContent).not.toContain("📷");
    expect(container.textContent).not.toContain("📎");
  });

  it("renders the gallery with saved photos", () => {
    const { container } = render(
      <PlayArea t={t} state={state({ photos: [{ id: "p1", data: "data:image/png;base64,abc", encrypted: false, createdAt: "2026-01-01" }], photosCount: 1, publicCount: 1 })} dispatch={vi.fn()} />,
    );
    expect(container.querySelector(".album-gallery")).toBeTruthy();
    expect(container.querySelectorAll(".album-gallery__item").length).toBe(1);
  });

  it("dispatches viewPhoto on gallery click", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea t={t} state={state({ photos: [{ id: "p1", data: "data:image/png;base64,abc", encrypted: false, createdAt: "2026-01-01" }] })} dispatch={dispatch} />,
    );
    fireEvent.click(container.querySelector(".album-gallery__item") as Element);
    expect(dispatch).toHaveBeenCalledWith("viewPhoto", expect.objectContaining({ id: "p1" }));
  });

  it("shows upload error when present", () => {
    const { container } = render(<PlayArea t={t} state={state({ uploadError: "File too large" })} dispatch={vi.fn()} />);
    expect(container.querySelector(".album-controls__error[role='alert']")).toBeTruthy();
  });

  it("shows selected image frames in the sealing workbench", () => {
    const { container } = render(
      <PlayArea t={t} state={state({ selectedImages: [{ id: "s1", dataUrl: "data:image/png;base64,abc", size: 1024 }] })} dispatch={vi.fn()} />,
    );
    expect(container.querySelector('.album-workbench[data-state="ready"]')).toBeTruthy();
    expect(container.querySelectorAll(".album-workbench__frame").length).toBe(1);
    expect(container.textContent).toContain("1 ready");
  });

  it("keeps privacy mode as a styled toggle while preserving checkbox behavior", () => {
    const albumState = state({ isEncrypted: true });
    const { container } = render(<PlayArea t={t} state={albumState} dispatch={vi.fn()} />);
    const toggle = container.querySelector(".album-privacy-toggle") as HTMLElement;
    expect(toggle).toBeTruthy();
    expect(toggle.dataset.active).toBe("true");
    expect(container.querySelector(".album-privacy-toggle__input[type='checkbox']")).toBeTruthy();
  });

  it("keeps import, privacy, and thumbnail actions wired to state and dispatch", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const albumState = state({
      selectedImages: [{ id: "s1", dataUrl: "data:image/png;base64,abc", size: 1024 }],
    });
    const { container } = render(<PlayArea t={t} state={albumState} dispatch={dispatch} />);

    const file = new File(["tiny"], "memory.png", { type: "image/png" });
    fireEvent.change(container.querySelector("input[type='file']") as HTMLInputElement, {
      target: { files: [file] },
    });
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("addFiles", [file]));

    fireEvent.click(container.querySelector(".album-privacy-toggle__input") as HTMLInputElement);
    expect(albumState.isEncrypted.get()).toBe(true);

    fireEvent.click(container.querySelector(".album-controls__thumb-remove") as HTMLButtonElement);
    expect(dispatch).toHaveBeenCalledWith("removeImage", "s1");
  });

  it("tucks privacy + how-it-works into the drawer", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.querySelector(".mx2-drawer--open")).toBeTruthy();
    expect(container.textContent).toContain("device");
  });

  it("keeps motion backed by reduced-motion fallbacks", () => {
    const fs = require("node:fs");
    const styles = fs.readFileSync(`${process.cwd()}/../forever-album/src/PlayArea.scss`, "utf8");
    expect(styles).toContain("@use \"@shared/styles/v2/motion\"");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration:\s*0\.001ms/);
    expect(styles).toMatch(/\.album-workbench\s*\{[\s\S]*grid-template-columns:\s*minmax\(250px,\s*0\.78fr\) minmax\(0,\s*1\.22fr\)/);
    expect(styles).toMatch(/\.album-workbench__memory-image\s*\{[\s\S]*object-fit:\s*cover/);
    expect(styles).toMatch(/\.album-workbench__page\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.album-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 188px/);
    expect(styles).toMatch(/@media \(max-width:\s*520px\)\s*\{[\s\S]*\.album-play-area \.mx2-score\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*520px\)\s*\{[\s\S]*\.album-workbench__memory-image\s*\{[\s\S]*height:\s*142px/);
    expect(styles).toMatch(/@media \(max-width:\s*520px\)\s*\{[\s\S]*\.album-workbench__memory-caption small,\n\s*\.album-workbench__memory-strip,\n\s*\.album-workbench__status\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*520px\)\s*\{[\s\S]*\.album-import,\n\s*\.album-privacy-toggle\s*\{[\s\S]*min-height:\s*54px/);
    expect(styles).toMatch(/@media \(max-width:\s*520px\)\s*\{[\s\S]*\.album-import__copy small,\n\s*\.album-privacy-toggle__copy small\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*520px\)\s*\{[\s\S]*\.album-play-area \.mx2-action-rail\s*\{[\s\S]*padding:\s*0 14px/);
    expect(styles).toMatch(/@media \(max-width:\s*520px\)\s*\{[\s\S]*\.album-play-area \.mx2-action-rail__row\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto/);
    expect(styles).toMatch(/@media \(max-width:\s*520px\)\s*\{[\s\S]*\.album-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*width:\s*100%/);
    expect(styles).not.toMatch(/@media \(max-width:\s*520px\)[\s\S]*\.album-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex-basis:\s*156px/);
    expect(styles).not.toContain("album-dropzone");
    expect(styles).not.toContain("album-workbench__library");
    expect(styles).not.toContain("linear-gradient(180deg, #ffffff 0%, var(--mx2-surface-2) 100%)");
    expect(styles).not.toMatch(/\.album-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*300px/);
  });

  it("uses a warm foreground album asset instead of a decorative background", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
      ? path.resolve(process.cwd(), "..")
      : path.resolve(process.cwd(), "apps");
    const source = fs.readFileSync(path.join(appsRoot, "forever-album/src/PlayArea.tsx"), "utf8");
    const asset = path.join(appsRoot, "forever-album/public/forever-album-memory-stage.webp");

    expect(source).toContain("./forever-album-memory-stage.webp");
    expect(fs.existsSync(asset)).toBe(true);
    expect(fs.statSync(asset).size).toBeGreaterThan(40_000);
  });
});
