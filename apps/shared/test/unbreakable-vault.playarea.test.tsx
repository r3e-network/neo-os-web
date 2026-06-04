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
    myVaultsStat: "My Vaults",
    openVaultsStat: "Open Vaults",
    claimBounty: "Claim Bounty",
    reclaimVault: "Reclaim Vault",
    vaultStatus: "Status",
    active: "Active",
    broken: "Broken",
    expired: "Expired",
    attemptFee: "Attempt Fee",
    secretAttemptLabel: "Break Secret",
    attemptCostNote: "The attempt fee is charged on every try.",
    bountyPaidNote: "This vault is broken — the bounty was paid to the winner.",
  };
  return messages[key] ?? key;
}

const activeVault = {
  id: "7",
  creator: "0xcreator",
  status: "active",
  winner: "",
  attemptFee: 10000000,
};
const brokenVault = {
  id: "7",
  creator: "0xcreator",
  status: "broken",
  winner: "0xwinner",
  attemptFee: 10000000,
};
const expiredVault = {
  id: "7",
  creator: "0xcreator",
  status: "expired",
  winner: "",
  attemptFee: 10000000,
};

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

  it("labels the hero stat tiles with noun counts, not bare verbs", () => {
    render(
      <PlayArea
        t={t}
        state={state({ myVaultCount: 3, recentVaultCount: 5 })}
        dispatch={vi.fn()}
      />,
    );

    expect(screen.getByText("My Vaults")).toBeTruthy();
    expect(screen.getByText("Open Vaults")).toBeTruthy();
  });

  it("shows a Claim Bounty control and dispatches settleVault when the wallet is the winner", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);

    render(
      <PlayArea
        t={t}
        state={state({
          vaultIdInput: "7",
          vaultDetails: brokenVault,
          canClaim: true,
          canReclaim: false,
        })}
        dispatch={dispatch}
      />,
    );

    const claimButton = screen.getByRole("button", { name: "Claim Bounty" });
    fireEvent.click(claimButton);

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("settleVault");
    });
  });

  it("offers Reclaim Vault to the creator of an expired vault", () => {
    render(
      <PlayArea
        t={t}
        state={state({
          vaultIdInput: "7",
          vaultDetails: expiredVault,
          canClaim: false,
          canReclaim: true,
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Reclaim Vault" })).toBeTruthy();
    // The break-secret input is hidden once a vault is no longer active.
    expect(screen.queryByLabelText("Break Secret")).toBeNull();
  });

  it("hides claim/reclaim controls on an active vault and shows the attempt cost note", () => {
    render(
      <PlayArea
        t={t}
        state={state({
          vaultIdInput: "7",
          vaultDetails: activeVault,
          canClaim: false,
          canReclaim: false,
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Claim Bounty" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reclaim Vault" })).toBeNull();
    expect(
      screen.getByText("The attempt fee is charged on every try."),
    ).toBeTruthy();
  });
});
