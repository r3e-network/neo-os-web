import React from "react";
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
    createMemorial: "Create Memorial",
    cancel: "Cancel",
    memorials: "Memorials",
    myTributes: "Tributes",
    obituaries: "Obituaries",
    visited: "Visited",
    payTribute: "Offer Tribute",
    tributeMessage: "Message",
    tributeMessagePlaceholder: "Leave a short tribute message",
    offeringType: "Offering",
    offeringCost: "Offering cost",
    incense: "Incense",
    candle: "Candle",
    flower: "Flowers",
    fruit: "Fruit",
    wine: "Wine",
    feast: "Feast",
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

    render(<PlayArea t={t} state={state()} dispatch={dispatch} launchContext={{ network: "testnet" }} />);

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Always remembered" },
    });
    fireEvent.change(screen.getByLabelText("Offering"), {
      target: { value: "3" },
    });
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

    render(<PlayArea t={t} state={state({ selectedMemorial: null })} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: "Create Memorial" }));
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
});
