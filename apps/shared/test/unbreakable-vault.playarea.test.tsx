import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../unbreakable-vault/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string) {
  const messages: Record<string, string> = {
    title: "Unbreakable Vault",
    docSubtitle: "Hacker bounty vaults secured by on-chain hashes",
    create: "Create",
    break: "Break",
    createVault: "Create Vault",
    createVaultButton: "Create Vault (bounty + hash)",
    titleLabel: "Vault Title",
    titlePlaceholder: "Give your vault a name",
    descriptionLabel: "Description",
    descriptionPlaceholder: "Optional hints or lore",
    bountyLabel: "Bounty",
    difficultyLabel: "Difficulty",
    difficultyEasy: "Easy",
    difficultyMedium: "Medium",
    difficultyHard: "Hard",
    secretLabel: "Vault Secret",
    secretPlaceholder: "Enter a secret phrase",
    secretNote: "Secret is hashed locally; only the hash is stored on-chain.",
    breakVault: "Break a Vault",
    vaultIdLabel: "Vault ID",
    vaultIdPlaceholder: "Enter vault ID",
    loadVault: "Load Vault",
    attemptBreak: "Attempt Break",
    recentVaults: "Recent Vaults",
    noRecentVaults: "No vaults found",
  };
  return messages[key] ?? key;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    myVaultCount: 0,
    recentVaultCount: 0,
    vaultDifficulty: "1",
    vaultIdInput: "",
    attemptSecret: "",
    attemptFeeDisplay: "0.1",
    createdVaultId: null,
    vaultDetails: null,
    recentVaults: [],
    myVaults: [],
    isLoading: false,
    isCreating: false,
    canAttempt: false,
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      createObservable(value),
    ]),
  );
}

describe("Unbreakable Vault PlayArea", () => {
  it("dispatches a complete create-vault payload with readable difficulty tiers", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);

    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.change(screen.getByLabelText("Vault Title"), {
      target: { value: "Crack me" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "public hint" },
    });
    fireEvent.change(screen.getByLabelText("Bounty"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("Difficulty"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("Vault Secret"), {
      target: { value: "open sesame" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Vault (bounty + hash)" }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        "createVault",
        expect.objectContaining({
          bounty: "1",
          title: "Crack me",
          description: "public hint",
          difficulty: 2,
          secret: "open sesame",
        }),
      );
    });
  });

  it("requires the minimum bounty before enabling create", () => {
    render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Vault Title"), {
      target: { value: "Too small" },
    });
    fireEvent.change(screen.getByLabelText("Bounty"), {
      target: { value: "0.5" },
    });
    fireEvent.change(screen.getByLabelText("Vault Secret"), {
      target: { value: "secret" },
    });

    expect(
      screen.getByRole("button", { name: "Create Vault (bounty + hash)" }),
    ).toHaveProperty("disabled", true);
  });
});
