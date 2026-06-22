import React from "react";
import fs from "node:fs";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../memorial-shrine/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string) {
  const messages: Record<string, string> = {
    title: "Blockchain Memorial",
    subtitle: "Inscribe memories on the blockchain forever",
    heroKicker: "Memorial garden",
    gardenAlt: "A quiet memorial garden with flowers and candlelight",
    chainPermanence: "On-chain remembrance",
    chainPermanenceDesc: "Quiet memorial cards, tribute records, and shared memories.",
    createMemorial: "Create Memorial",
    cancel: "Cancel",
    memorials: "Memorials",
    myTributes: "Tributes",
    obituaries: "Obituaries",
    visited: "Visited",
    foreverRemember: "Forever Remembered",
    share: "Share",
    close: "Close",
    offeringsReceived: "Offerings Received",
    payTribute: "Offer Tribute",
    tributeMessage: "Message",
    tributeMessagePlaceholder: "Leave a short tribute message",
    tributeStationDesc: "Choose a symbolic offering and leave a short message.",
    selectOffering: "Select offering",
    offeringType: "Offering",
    offeringCost: "Offering cost",
    incense: "Incense",
    candle: "Candle",
    flower: "Flowers",
    fruit: "Fruit",
    wine: "Wine",
    feast: "Feast",
    memoryStudio: "Memorial Studio",
    studioStepIdentity: "Identity",
    studioStepStory: "Life and notice",
    studioStepPublish: "Review and publish",
    previewLabel: "Live memorial card",
    previewEmptyName: "Name appears here",
    previewDatesEmpty: "Years of life",
    previewRelationEmpty: "Relationship",
    previewBioEmpty: "Add a short life story to make the card feel personal.",
    previewObituaryEmpty: "The obituary will appear as a quiet public notice.",
    photoUrlHelper: "HTTPS or IPFS image. The preview updates when the URL is valid.",
    createTitle: "Create a Memorial",
    createDesc: "Memorial will be permanently stored on blockchain",
    labelName: "Name of Deceased",
    labelPhoto: "Photo",
    labelRelation: "Your Relationship",
    labelBirth: "Birth Year",
    labelDeath: "Death Year",
    labelBio: "Biography",
    labelObituary: "Obituary",
    placeholderName: "Enter name",
    photoHashPlaceholder: "IPFS hash or HTTPS image URL",
    placeholderRelation: "e.g. Father, Mother...",
    placeholderBirthYear: "1940",
    placeholderDeathYear: "2024",
    placeholderBio: "Record their life story...",
    placeholderObituary: "Obituary will be displayed...",
  };
  return messages[key] ?? key;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    memorials: [
      {
        id: 1,
        name: "Loved one",
        birthYear: 1950,
        deathYear: 2024,
        relationship: "mentor",
        biography: "A generous builder",
      },
    ],
    visitedMemorials: [],
    recentObituaries: [],
    selectedMemorial: {
      id: 1,
      name: "Loved one",
      birthYear: 1950,
      deathYear: 2024,
      relationship: "mentor",
      biography: "A generous builder",
    },
    memorialCount: 1,
    tributeCount: 0,
    obituaryCount: 0,
    isSubmitting: false,
    isPaying: false,
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

describe("Memorial Shrine PlayArea", () => {
  it("dispatches a real tribute payload with fixed offering tiers", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);

    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} launchContext={{ network: "testnet" }} />);

    expect(container.querySelector(".tribute-altar")).toBeTruthy();
    expect(container.querySelector('.tribute-altar__garden img[src="./memorial-garden.jpg"]')).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Always remembered" },
    });
    fireEvent.click(screen.getByRole("radio", { name: /Flowers/ }));
    expect(container.querySelector(".tribute-altar--3")).toBeTruthy();
    expect(screen.getByLabelText("Offering cost").textContent).toContain("0.03 GAS");
    fireEvent.click(screen.getByRole("button", { name: "Offer Tribute" }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        "payTribute",
        1,
        3,
        "Always remembered",
        "",
      );
    });
  });

  it("keeps create disabled until the required memorial fields are ready", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);

    const { container } = render(<PlayArea t={t} state={state({ selectedMemorial: null })} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: "Create Memorial" }));
    expect(container.querySelector(".memorial-studio--idle")).toBeTruthy();
    expect(container.querySelector(".studio-ritual-track")).toBeTruthy();
    expect(container.querySelector('.studio-preview__garden[src="./memorial-garden.jpg"]')).toBeTruthy();
    const submitButton = screen
      .getAllByRole("button", { name: "Create Memorial" })
      .find((button) => button.textContent === "Create Memorial");
    expect(submitButton).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByLabelText("Name of Deceased"), {
      target: { value: "New memorial" },
    });
    fireEvent.change(screen.getByLabelText("Death Year"), {
      target: { value: "2024" },
    });
    expect(container.querySelector(".memorial-studio--ready")).toBeTruthy();
    expect(container.querySelector(".studio-ritual-track__step.is-complete")).toBeTruthy();
    expect(container.querySelectorAll(".studio-ritual-track__step.is-active").length).toBe(2);
    fireEvent.click(submitButton as HTMLElement);

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        "createMemorial",
        expect.objectContaining({
          name: "New memorial",
          deathYear: 2024,
        }),
      );
    });
  });

  it("keeps shrine motion resource-led and reduced-motion safe", () => {
    const styles = fs.readFileSync(
      `${process.cwd()}/../memorial-shrine/src/PlayArea.scss`,
      "utf8",
    );

    expect(styles).toContain("@keyframes shrine-garden-drift");
    expect(styles).toContain("@keyframes shrine-offering-breathe");
    expect(styles).toContain("@keyframes shrine-track-ready");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toContain(".tribute-altar__garden img");
    expect(styles).toContain(".studio-preview__garden");
    expect(styles).toContain(".studio-ritual-track__step.is-complete svg");
    expect(styles).toContain("animation: none");
  });
});
