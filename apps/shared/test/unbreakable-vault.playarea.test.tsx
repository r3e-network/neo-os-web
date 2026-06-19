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
    difficultyEasyHint: "Low attempt fee for broad participation.",
    difficultyMediumHint: "Balanced pressure for serious challengers.",
    difficultyHardHint: "High-stakes attempts for premium bounties.",
    secretLabel: "Vault Secret",
    secretPlaceholder: "Enter a secret phrase",
    confirmSecretLabel: "Confirm Secret",
    confirmSecretPlaceholder: "Re-enter the secret",
    secretMismatch: "Secrets do not match",
    minBountyNote: "Minimum bounty: 1 GAS",
    bountyPlaceholder: "Minimum 1",
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
    claimable: "Claimable",
    attemptFee: "Attempt Fee",
    attempts: "Attempts",
    winner: "Winner",
    remainingDaysLabel: "Days Left",
    tokenGas: "GAS",
    secretAttemptLabel: "Break Secret",
    attemptCostNote: "The attempt fee is charged on every try.",
    bountyPaidNote: "This vault is broken — the bounty was paid to the winner.",
    increaseBounty: "Add Bounty",
    increaseBountyLabel: "Increase Bounty (GAS)",
    increaseBountyPlaceholder: "Amount of GAS to add",
    mainnetVaultNote: "On mainnet, the GAS deposit and contract call are batched by the host's operation panel.",
  };
  return messages[key] ?? key;
}

const activeVault = {
  id: "7",
  creator: "0xcreator",
  status: "active",
  winner: "",
  attemptFee: 10000000,
  bounty: 500000000, // 5 GAS in base units
  attempts: 4,
  remainingDays: 9,
  title: "Crack me if you can",
  description: "Hint: it rhymes with cat",
  difficultyName: "Medium",
};
const brokenVault = {
  id: "7",
  creator: "0xcreator",
  status: "broken",
  winner: "0xwinner",
  attemptFee: 10000000,
};
const claimableVault = {
  id: "7",
  creator: "0xcreator",
  status: "claimable",
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
    fireEvent.click(screen.getByRole("radio", { name: "Medium 0.5 GAS" }));
    fireEvent.change(screen.getByLabelText("Vault Secret"), {
      target: { value: "open sesame" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Secret"), {
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

  it("renders difficulty as challenge cards instead of a native select", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector("select")).toBeNull();
    expect(container.querySelector(".vault-select-chevron")).toBeNull();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radio", { name: "Easy 0.1 GAS" }).getAttribute("aria-checked")).toBe("true");
  });

  it("blocks create on a secret/confirm mismatch and shows the mismatch error", () => {
    render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Vault Title"), { target: { value: "Crack me" } });
    fireEvent.change(screen.getByLabelText("Bounty"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Vault Secret"), { target: { value: "open sesame" } });
    fireEvent.change(screen.getByLabelText("Confirm Secret"), { target: { value: "typo" } });

    expect(screen.getByText("Secrets do not match")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Create Vault (bounty + hash)" }),
    ).toHaveProperty("disabled", true);
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

  it("shows the bounty-paid note and no claim control on a broken vault", () => {
    // The contract pays the bounty to the winner ATOMICALLY on the winning
    // attemptBreak — there is no separate on-chain claim. A broken vault simply
    // surfaces that the bounty was already paid.
    render(
      <PlayArea
        t={t}
        state={state({
          vaultIdInput: "7",
          vaultDetails: brokenVault,
          canReclaim: false,
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(
      screen.getByText("This vault is broken — the bounty was paid to the winner."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Claim Bounty" })).toBeNull();
  });

  it("offers Reclaim Vault to the creator of a claimable (expired) vault and dispatches settleVault", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);

    render(
      <PlayArea
        t={t}
        state={state({
          vaultIdInput: "7",
          vaultDetails: claimableVault,
          canReclaim: true,
        })}
        dispatch={dispatch}
      />,
    );

    const reclaimButton = screen.getByRole("button", { name: "Reclaim Vault" });
    // The break-secret input is hidden once a vault is no longer active.
    expect(screen.queryByLabelText("Break Secret")).toBeNull();

    fireEvent.click(reclaimButton);
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("settleVault");
    });
  });

  it("hides claim/reclaim controls on an active vault and shows the attempt cost note", () => {
    render(
      <PlayArea
        t={t}
        state={state({
          vaultIdInput: "7",
          vaultDetails: activeVault,
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

  it("surfaces the bounty, title, hint, attempts and days-left a challenger needs before paying", () => {
    render(
      <PlayArea
        t={t}
        state={state({ vaultIdInput: "7", vaultDetails: activeVault, canReclaim: false })}
        dispatch={vi.fn()}
      />,
    );

    // Previously all of these were fetched but never rendered.
    expect(screen.getByText("Crack me if you can")).toBeTruthy();
    expect(screen.getByText("Hint: it rhymes with cat")).toBeTruthy();
    expect(screen.getByText("5 GAS")).toBeTruthy(); // 5e8 base units → 5 GAS bounty
    expect(screen.getAllByText("Medium").length).toBeGreaterThan(0);
    expect(screen.getByText("4")).toBeTruthy(); // attempts
    expect(screen.getByText("9")).toBeTruthy(); // days left
  });

  it("dispatches increaseBounty with the loaded vault id and the entered amount", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(
      <PlayArea
        t={t}
        state={state({ vaultIdInput: "7", vaultDetails: activeVault, canReclaim: false })}
        dispatch={dispatch}
      />,
    );

    fireEvent.change(screen.getByLabelText("Increase Bounty (GAS)"), {
      target: { value: "2.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Bounty" }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("increaseBounty", "7", "2.5");
    });
  });

  it("localizes recent-vault statuses instead of rendering raw enum text", () => {
    render(
      <PlayArea
        t={t}
        state={state({
          recentVaults: [{ id: "3", creator: "0xc", bounty: 0, status: "claimable" }],
        })}
        dispatch={vi.fn()}
      />,
    );
    // The raw "claimable" enum is mapped to the localized label.
    expect(screen.getByText("Claimable")).toBeTruthy();
    expect(screen.queryByText("claimable")).toBeNull();
  });

  it("shows the honest mainnet handoff note when launched on mainnet", () => {
    render(
      <PlayArea
        t={t}
        state={state()}
        dispatch={vi.fn()}
        launchContext={{ network: "mainnet" }}
      />,
    );
    expect(
      screen.getByText(/the GAS deposit and contract call are batched/),
    ).toBeTruthy();
  });
});
