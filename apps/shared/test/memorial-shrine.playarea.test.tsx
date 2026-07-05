import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../memorial-shrine/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    title: "Memorial Shrine", subtitle: "Create permanent memorials.", heroKicker: "Memorial",
    memorials: "Memorials", memorialRailLabel: "Choose a memorial to visit", noMemorials: "No memorials yet.", myTributes: "My tributes", noTributes: "No tributes yet.",
    obituaries: "Obituaries", offeringsReceived: "Offerings received", paying: "Paying tribute...",
    payTributeBtn: "Pay Tribute", createMemorial: "Create Memorial", createBtn: "Create",
    gardenAlt: "Memorial garden", chainPermanence: "On-chain remembrance", memoryStudio: "Memorial Studio",
    foreverRemember: "Forever Remembered", tributeStationDesc: "Choose an offering.", selectOffering: "Select offering",
    payTribute: "Offer Tribute", tributeMessage: "Message", offeringDisclosure: "Permanent tribute.",
    createTitle: "Create a Memorial", createDesc: "Stored on-chain", previewLabel: "Live memorial card",
    previewEmptyName: "Name appears here", previewDatesEmpty: "Years of life", previewRelationEmpty: "Relationship",
    previewBioEmpty: "Add a short life story.", labelName: "Name of Deceased", engravingLabel: "Memorial inscription", labelPhoto: "Photo",
    memoryPresetLabel: "Memory tone", memoryPresetFamily: "Family warmth", memoryPresetFamilyRelation: "Family", memoryPresetFamilyBio: "Remembered with family warmth.",
    memoryPresetMentor: "Mentor legacy", memoryPresetMentorRelation: "Mentor", memoryPresetMentorBio: "Remembered as a mentor.",
    memoryPresetFriend: "Bright companion", memoryPresetFriendRelation: "Friend", memoryPresetFriendBio: "Remembered as a friend.",
    labelBirth: "Birth Year", labelDeath: "Death Year", labelRelation: "Your Relationship", labelBio: "Biography",
    labelObituary: "Obituary", photoHashPlaceholder: "IPFS or HTTPS image", placeholderObituary: "Obituary",
    receiptId: "Payment receipt ID", mainnetTributeNote: "Mainnet note.",
    incense: "Incense", candle: "Candle", flower: "Flowers", fruit: "Fruit", wine: "Wine", feast: "Feast",
    tributeMessagePlaceholder: "Leave a message...", receiptIdPlaceholder: "Receipt ID",
    placeholderName: "Name", placeholderRelation: "Relationship", placeholderBirthYear: "Birth year", placeholderDeathYear: "Death year", placeholderBio: "Biography",
  };
  let value = messages[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) value = value.replaceAll(`{${k}}`, String(v));
  return value;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    memorialCount: 1, tributeCount: 0, isSubmitting: false, isPaying: false,
    memorials: [{ id: 1, name: "John Doe", birthYear: 1950, deathYear: 2024, relationship: "Father" }],
    visitedMemorials: [], recentObituaries: [], myTributes: [], selectedMemorial: null,
    shareStatus: null, lastTx: null, obituaryCount: 0,
    ...overrides,
  };
  return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, createObservable(v)]));
}

function assertZeroLetterSpacing(styles: string) {
  for (const match of styles.matchAll(/letter-spacing:\s*([^;]+);/g)) {
    expect(match[1].trim()).toBe("0");
  }
}

describe("Memorial Shrine PlayArea (v2 scene-driven)", () => {
  it("renders a resource-led memorial garden instead of an emoji placeholder", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    expect(container.querySelector(".shrine-workbench")).toBeTruthy();
    expect(container.querySelector<HTMLImageElement>('.shrine-garden-panel img[src="memorial-garden.webp"]')).toBeTruthy();
    expect(container.querySelector<HTMLImageElement>('.shrine-tribute-card__portrait img[src="shrine-scene-art.webp"]')).toBeTruthy();
    expect(container.querySelector(".shrine-workbench")?.textContent).not.toContain("🌿");
    expect(container.querySelector(".shrine-workbench")?.textContent).not.toContain("🕯️");
  });

  it("renders the memorial detail with a tribute altar when a memorial is selected", () => {
    const { container } = render(
      <PlayArea t={t} state={state({ selectedMemorial: { id: 1, name: "John Doe", birthYear: 1950, deathYear: 2024 } })} dispatch={vi.fn()} />,
    );
    expect(container.querySelector(".shrine-tribute-card__portrait")).toBeTruthy();
    expect(container.querySelector(".shrine-offering-dock")).toBeTruthy();
    expect(container.textContent).toContain("John Doe");
    expect(container.querySelector(".mx2-stage__scene textarea")).toBeFalsy();
  });

  it("surfaces memorial selection as garden stones instead of hiding it in the drawer", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const memorials = [
      { id: 1, name: "John Doe", birthYear: 1950, deathYear: 2024, relationship: "Father", offerings: { flower: 2 } },
      { id: 2, name: "Jane Doe", birthYear: 1954, deathYear: 2023, relationship: "Mother", offerings: { candle: 1, fruit: 1 } },
    ];
    const { container, getByText } = render(
      <PlayArea t={t} state={state({ memorials, selectedMemorial: memorials[0] })} dispatch={dispatch} />,
    );
    const rail = container.querySelector(".shrine-memorial-rail");
    expect(rail).toBeTruthy();
    expect(container.querySelectorAll(".shrine-memorial-stone")).toHaveLength(2);
    expect(container.querySelector(".shrine-memorial-stone--active")?.textContent).toContain("John Doe");
    expect(container.querySelector(".shrine-drawer-shell")).toBeFalsy();
    fireEvent.click(getByText("Jane Doe"));
    expect(dispatch).toHaveBeenCalledWith("openMemorial", 2);
  });

  it("dispatches payTribute with selected offering", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea t={t} state={state({ selectedMemorial: { id: 1, name: "John" }, launchContext: { network: "testnet" } })} dispatch={dispatch} launchContext={{ network: "testnet" }} />,
    );
    // Select an offering (flower = type 3)
    const flowerBtn = Array.from(container.querySelectorAll(".shrine-offering")).find((b) => b.textContent?.includes("Flowers"));
    if (flowerBtn) fireEvent.click(flowerBtn);
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("payTribute", 1, expect.any(Number), expect.any(String), ""));
  });

  it("dispatches createMemorial from the create tab", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea t={t} state={state({ memorials: [], selectedMemorial: null, memorialCount: 0 })} dispatch={dispatch} />,
    );
    fireEvent.change(container.querySelector(".shrine-name-plaque input") as Element, { target: { value: "Jane" } });
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("createMemorial", expect.objectContaining({ name: "Jane" })));
  });

  it("keeps create mode as a memorial card workspace with quick memory presets", () => {
    const { container } = render(
      <PlayArea t={t} state={state({ memorials: [], selectedMemorial: null, memorialCount: 0 })} dispatch={vi.fn()} />,
    );
    expect(container.querySelector('.shrine-workbench[data-mode="create"]')).toBeTruthy();
    expect(container.querySelector(".shrine-inscription-panel")).toBeTruthy();
    expect(container.querySelector(".shrine-create-card .shrine-name-plaque input")).toBeTruthy();
    expect(container.querySelectorAll(".shrine-memory-preset")).toHaveLength(3);
    expect(container.querySelector(".shrine-workbench__focus > .shrine-create-card")).toBeTruthy();
    expect(container.querySelector(".mx2-stage__scene textarea")).toBeFalsy();
  });

  it("applies a memory preset without touching the create transaction shape", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByText } = render(
      <PlayArea t={t} state={state({ memorials: [], selectedMemorial: null, memorialCount: 0 })} dispatch={dispatch} />,
    );
    fireEvent.click(getByText("Family warmth"));
    fireEvent.change(container.querySelector(".shrine-name-plaque input") as Element, { target: { value: "Jane" } });
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("createMemorial", expect.objectContaining({
      name: "Jane",
      relationship: "Family",
      biography: "Remembered with family warmth.",
    })));
  });

  it("shows obituaries + tributes in the drawer", () => {
    const { container } = render(
      <PlayArea t={t} state={state({ recentObituaries: [{ id: 1, name: "John", text: "In loving memory" }] })} dispatch={vi.fn()} />,
    );
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.querySelector(".shrine-drawer-shell")).toBeTruthy();
    expect(container.querySelectorAll(".shrine-drawer-panel")).toHaveLength(4);
    expect(container.querySelectorAll(".shrine-drawer-panel.mx2-open-panel.semi-card")).toHaveLength(4);
    expect(container.querySelectorAll(".shrine-drawer-panel__head")).toHaveLength(0);
    expect(container.querySelectorAll(".shrine-drawer-panel h4")).toHaveLength(0);
    expect(container.querySelector(".shrine-drawer-panel--tribute")).toBeTruthy();
    expect(container.querySelectorAll(".shrine-drawer-list")).toHaveLength(2);
    expect(container.textContent).toContain("John");
  });

  it("keeps create metadata in a compact drawer dossier", () => {
    const { container } = render(
      <PlayArea t={t} state={state({ memorials: [], selectedMemorial: null, memorialCount: 0 })} dispatch={vi.fn()} />,
    );
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.querySelector(".shrine-drawer-panel--studio")).toBeTruthy();
    expect(container.querySelector(".shrine-studio-grid")).toBeTruthy();
    expect(container.querySelectorAll(".shrine-drawer-input")).toHaveLength(0);
    expect(container.querySelectorAll(".shrine-drawer-field.mx2-open-field")).toHaveLength(6);
    expect(container.querySelectorAll(".shrine-drawer-field .mx2-open-field__control input.semi-input")).toHaveLength(4);
    expect(container.querySelectorAll(".shrine-drawer-field .mx2-open-field__control--textarea textarea.semi-input-textarea")).toHaveLength(2);
    const yearInputs = Array.from(container.querySelectorAll<HTMLInputElement>(".shrine-drawer-field .mx2-open-field__control input.semi-input"))
      .filter((input) => input.placeholder === "Birth year" || input.placeholder === "Death year");
    expect(yearInputs).toHaveLength(2);
    for (const input of yearInputs) {
      expect(input.inputMode).toBe("numeric");
      expect(input.getAttribute("pattern")).toBe("[0-9]*");
    }
    expect(container.querySelectorAll(".shrine-drawer-panel__head")).toHaveLength(0);
    expect(container.querySelectorAll(".shrine-drawer-panel h4")).toHaveLength(0);
  });

  it("keeps motion backed by reduced-motion fallbacks", () => {
    const styles = readFileSync(`${process.cwd()}/../memorial-shrine/src/PlayArea.scss`, "utf8");
    expect(styles).toContain("@use \"@shared/styles/v2/motion\"");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration:\s*0\.001ms/);
  });

  it("keeps garden art subordinate to the memorial workflow", () => {
    const styles = readFileSync(`${process.cwd()}/../memorial-shrine/src/PlayArea.scss`, "utf8");
    expect(styles).toMatch(/\.shrine-workbench\s*\{[\s\S]*grid-template-columns:\s*minmax\(240px,\s*0\.68fr\) minmax\(340px,\s*1\.32fr\)/);
    expect(styles).toMatch(/\.shrine-workbench\[data-mode="create"\]\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(styles).toMatch(/\.shrine-workbench\[data-mode="create"\] \.shrine-garden-panel\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/\.shrine-garden-panel > img\s*\{[\s\S]*position:\s*relative/);
    expect(styles).toMatch(/\.shrine-garden-panel > img\s*\{[^}]*object-fit:\s*contain/);
    expect(styles).toMatch(/\.shrine-garden-panel > img\s*\{[^}]*opacity:\s*1/);
    expect(styles).toMatch(/\.shrine-garden-panel > img\s*\{[^}]*filter:\s*none/);
    expect(styles).toMatch(/\.shrine-create-card__media img,[\s\S]*\.shrine-tribute-card__portrait img\s*\{[^}]*object-fit:\s*contain/);
    expect(styles).toMatch(/\.shrine-create-card__media img,[\s\S]*\.shrine-tribute-card__portrait img\s*\{[^}]*opacity:\s*1/);
    expect(styles).toMatch(/\.shrine-inscription-panel\s*\{[\s\S]*border-radius:\s*22px/);
    expect(styles).toMatch(/\.shrine-name-plaque input\s*\{[\s\S]*border-width:\s*0 0 2px/);
    expect(styles).toMatch(/\.shrine-name-plaque input:focus\s*\{[\s\S]*box-shadow:\s*none/);
    expect(styles).not.toMatch(/\.shrine-garden-panel > img\s*\{[^}]*object-fit:\s*cover/);
    expect(styles).not.toMatch(/\.shrine-create-card__media img,[\s\S]*\.shrine-tribute-card__portrait img\s*\{[^}]*object-fit:\s*cover/);
    expect(styles).toMatch(/\.shrine-garden-panel::after\s*\{[\s\S]*content:\s*none/);
    expect(styles).toMatch(/\.shrine-garden-panel__caption\s*\{[\s\S]*box-shadow:\s*none/);
    expect(styles).toMatch(/\.shrine-memorial-rail\s*\{[\s\S]*display:\s*grid/);
    expect(styles).toMatch(/\.shrine-memorial-stone\s*\{[\s\S]*border-radius:\s*18px/);
    expect(styles).toMatch(/\.shrine-memorial-stone--active\s*\{[\s\S]*background:\s*#fff7e8/);
    expect(styles).toMatch(/\.shrine-memorial-stone__name,[\s\S]*\.shrine-memorial-stone__offerings\s*\{[\s\S]*text-overflow:\s*ellipsis/);
    expect(styles).toMatch(/\.shrine-memory-preset\s*\{[\s\S]*border-radius:\s*var\(--mx2-r-pill\)/);
    expect(styles).toMatch(/\.shrine-drawer-shell\s*\{[\s\S]*grid-template-columns:\s*repeat\(12,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.shrine-drawer-panel\.mx2-open-panel\.semi-card\s*\{[\s\S]*border-radius:\s*20px/);
    expect(styles).toMatch(/\.shrine-drawer-panel--studio\.mx2-open-panel\.semi-card,[\s\S]*\.shrine-drawer-panel--tribute\.mx2-open-panel\.semi-card\s*\{[\s\S]*background:\s*linear-gradient\(180deg,\s*#ffffff 0%,\s*#fffaf3 100%\)/);
    expect(styles).toMatch(/\.shrine-drawer-field \.mx2-open-field__control\s*\{[\s\S]*min-height:\s*40px/);
    expect(styles).toMatch(/\.shrine-drawer-field\.mx2-open-field--textarea \.mx2-open-field__control--textarea\s*\{[\s\S]*min-height:\s*72px/);
    expect(styles).not.toMatch(/\.shrine-drawer-panel__head\s*\{/);
    expect(styles).not.toMatch(/\.shrine-drawer-input\s*\{/);
    expect(styles).toMatch(/\.shrine-drawer-list__item\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto/);
    expect(styles).toMatch(/\.memorial-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*max-width:\s*min\(100%,\s*248px\)/);
    expect(styles).toMatch(/\.memorial-play-area \.mx2-action-rail__row \.mx2-btn--primary:not\(:disabled\)\s*\{[\s\S]*background:\s*#9a6a22/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.memorial-play-area \.mx2-score\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.memorial-play-area \.mx2-action-rail__row\s*\{[\s\S]*display:\s*grid/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.memorial-play-area \.mx2-action-rail__row \.mx2-btn--primary svg\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.shrine-garden-panel\s*\{[\s\S]*grid-template-columns:\s*96px minmax\(0,\s*1fr\)/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.shrine-memorial-rail\s*\{[\s\S]*grid-auto-flow:\s*column/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.shrine-memorial-stone\s*\{[\s\S]*scroll-snap-align:\s*start/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.shrine-create-card\s*\{[\s\S]*"media"[\s\S]*"copy"/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.shrine-memory-presets\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.shrine-memory-preset\s*\{[\s\S]*white-space:\s*normal/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.shrine-drawer-shell\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    assertZeroLetterSpacing(styles);
    expect(styles).not.toMatch(/font-size:\s*clamp\(/);
  });

  it("keeps the playarea source free of visible emoji resources and form tabs", () => {
    const source = readFileSync(`${process.cwd()}/../memorial-shrine/src/PlayArea.tsx`, "utf8");
    expect(source).toContain("memorial-garden.webp");
    expect(source).toContain("shrine-scene-art.webp");
    expect(source).toContain("shrine-memorial-rail");
    expect(source).toContain("lucide-react");
    expect(source).not.toContain("emoji");
    expect(source).not.toContain("🌸");
    expect(source).not.toContain("🍎");
    expect(source).not.toContain("🍷");
    expect(source).not.toContain("role=\"tab\"");
    expect(source).not.toContain("<h4>{t(\"memoryStudio\")}</h4>");
  });
});
