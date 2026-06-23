import React from "react";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
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
    challengeConsole: "Challenge console",
    challengeConsoleTitle: "Build a bounty vault or inspect one to break",
    createVault: "Create Vault",
    createVaultButton: "Create Vault (bounty + hash)",
    titleLabel: "Vault Title",
    titlePlaceholder: "Give your vault a name",
    descriptionLabel: "Description",
    descriptionPlaceholder: "Optional hints or lore",
    descriptionPending: "Hint pending",
    descriptionReady: "Public hint armed",
    bountyLabel: "Bounty",
    bountyPresetLabel: "Bounty presets",
    difficultyLabel: "Difficulty",
    netPayoutLabel: "Net Payout",
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
    challengeDeskTitle: "Challenge target",
    challengeDeskEmpty: "Load a vault to challenge",
    challengeDeskHint: "Enter a vault ID to inspect the bounty, difficulty, attempt fee, and public hint before paying.",
    challengeDeskLoaded: "Vault loaded and ready for inspection.",
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
    daysUnit: "days",
    tokenGas: "GAS",
    secretAttemptLabel: "Break Secret",
    attemptCostNote: "The attempt fee is charged on every try.",
    bountyPaidNote: "This vault is broken — the bounty was paid to the winner.",
    increaseBounty: "Add Bounty",
    increaseBountyLabel: "Increase Bounty (GAS)",
    increaseBountyPlaceholder: "Amount of GAS to add",
    mainnetVaultNote: "On mainnet, the GAS deposit and contract call are batched by the host's operation panel.",
    notAvailable: "Not available",
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

    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

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
    expect(container.querySelector(".vault-blueprint__lock.is-ready")).toBeTruthy();
    expect(container.querySelector(".vault-console-stack")).toBeTruthy();
    expect(container.querySelector(".vault-console-module--identity.is-active")).toBeTruthy();
    expect(container.querySelector(".vault-console-module--bounty.is-active")).toBeTruthy();
    expect(container.querySelector(".vault-console-module--lore.is-active")).toBeTruthy();
    expect(container.querySelector(".vault-secret-panel--ready")).toBeTruthy();
    expect(container.querySelectorAll(".vault-secret-panel__status .is-active").length).toBe(3);
    expect(container.querySelector(".vault-system-stage--ready")).toBeTruthy();
    expect(container.querySelector('.vault-system-stage__token img[src="./logo.jpg"]')).toBeTruthy();
    expect(container.querySelector(".vault-system-stage__difficulty")?.textContent).toContain("Medium");
    expect(container.querySelector(".vault-system-stage__difficulty")?.textContent).toContain("0.5 GAS");
    expect(container.querySelector(".vault-system-stage__core")).toBeTruthy();
    expect(container.querySelectorAll(".vault-system-stage__node").length).toBe(2);
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

  it("lets bounty presets arm the vault funding console without using a select", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "5 GAS" }));

    expect((screen.getByLabelText("Bounty") as HTMLInputElement).value).toBe("5");
    expect(container.querySelector(".vault-console-module--bounty.is-active")).toBeTruthy();
    expect(container.querySelector(".vault-bounty-presets button.is-active")?.textContent).toBe("5 GAS");
    expect(container.querySelectorAll(".vault-bounty-presets button")).toHaveLength(3);
  });

  it("uses a challenge console mode switch instead of stacking both workflows", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(screen.getByText("Build a bounty vault or inspect one to break")).toBeTruthy();
    expect(container.querySelector(".vault-command-shell--create")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Create Vault" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByText("Load a vault to challenge")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Break a Vault" }));

    expect(container.querySelector(".vault-command-shell--break")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Break a Vault" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Load a vault to challenge")).toBeTruthy();
    expect(screen.queryByLabelText("Vault Title")).toBeNull();
  });

  it("opens the break desk automatically when a vault is loaded", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ vaultIdInput: "7", vaultDetails: activeVault, canAttempt: true })}
        dispatch={vi.fn()}
      />,
    );

    expect(screen.getByRole("tab", { name: "Break a Vault" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Crack me if you can")).toBeTruthy();
    expect(container.querySelector(".vault-id-scanner.is-armed.is-locked")).toBeTruthy();
    expect(container.querySelector(".vault-id-scanner__beam")).toBeTruthy();
    expect(container.querySelector(".vault-target-card--loaded")).toBeTruthy();
    expect(container.querySelector(".vault-target-card--attempt-ready")).toBeTruthy();
    expect(container.querySelector(".vault-secret-attempt.is-ready")).toBeTruthy();
    expect(container.querySelector(".vault-secret-attempt__charge")).toBeTruthy();
    expect(container.querySelector(".vault-break-stage--attempt")).toBeTruthy();
    expect(container.querySelector(".vault-break-stage__reticle")).toBeTruthy();
    expect(container.querySelectorAll(".vault-break-stage__route .is-active").length).toBe(3);
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

    const { container } = render(
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
    expect(container.querySelector(".vault-target-card--claimable")).toBeTruthy();

    fireEvent.click(reclaimButton);
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("settleVault");
    });
  });

  it("hides claim/reclaim controls on an active vault and shows the attempt cost note", () => {
    const { container } = render(
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
    expect(container.querySelector(".vault-secret-attempt")).toBeTruthy();
    expect(screen.getByLabelText("Break Secret")).toBeTruthy();
    expect(
      screen.getByText("The attempt fee is charged on every try."),
    ).toBeTruthy();
  });

  it("charges the challenge input when a breaker enters a secret", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          vaultIdInput: "7",
          vaultDetails: activeVault,
          attemptSecret: "cat",
          canAttempt: true,
        })}
        dispatch={vi.fn()}
      />,
    );

    expect((screen.getByLabelText("Break Secret") as HTMLInputElement).value).toBe("cat");
    expect(container.querySelector(".vault-secret-attempt.is-charged.is-ready")).toBeTruthy();
    expect(container.querySelector(".vault-secret-attempt__icon")).toBeTruthy();
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

  it("keeps vault challenge motion explicit and reduced-motion safe", () => {
    const repoPath = resolve(process.cwd(), "apps/unbreakable-vault/src/PlayArea.scss");
    const sharedPath = resolve(process.cwd(), "../unbreakable-vault/src/PlayArea.scss");
    const css = readFileSync(existsSync(repoPath) ? repoPath : sharedPath, "utf8");

    expect(css).toContain("@keyframes vault-system-ready-ring");
    expect(css).toContain("@keyframes vault-system-token-idle");
    expect(css).toContain("@keyframes vault-system-token-route");
    expect(css).toContain("@keyframes vault-system-token-seal");
    expect(css).toContain("@keyframes vault-system-difficulty-ready");
    expect(css).toContain("@keyframes vault-system-seal");
    expect(css).toContain("@keyframes vault-console-module-scan");
    expect(css).toContain("@keyframes vault-bounty-chip-ready");
    expect(css).toContain("@keyframes vault-secret-calibrate");
    expect(css).toContain("@keyframes vault-input-scan");
    expect(css).toContain("@keyframes vault-id-beam-route");
    expect(css).toContain("@keyframes vault-secret-charge");
    expect(css).toContain("@keyframes vault-secret-ready-pulse");
    expect(css).toContain("@keyframes vault-break-scan");
    expect(css).toContain("@keyframes vault-break-reticle");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain(".vault-system-stage__token");
    expect(css).toContain(".vault-system-stage__difficulty");
    expect(css).toContain(".vault-console-module");
    expect(css).toContain(".vault-bounty-presets");
    expect(css).toContain(".vault-secret-panel--ready");
    expect(css).toContain(".vault-id-scanner");
    expect(css).toContain(".vault-secret-attempt");
    expect(css).toContain(".vault-break-stage__scan");
    expect(css).toContain("animation: none");
  });
});
