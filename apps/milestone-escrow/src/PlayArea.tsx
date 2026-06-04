/**
 * PlayArea.tsx — Milestone Escrow
 *
 * Full interactive escrow console: stats bar with active/completed/beneficiary
 * counts, hero progress bar, create escrow form, and escrow list with actions.
 */

import { useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import MilestoneHero from "./components/MilestoneHero";
import EscrowBody from "./components/EscrowBody";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);

  const hasAddress = Boolean(state.address?.get());
  const contractReady = bool("contractReady");
  const isRefreshing = bool("isRefreshing");
  const isCreating = bool("isCreating");
  const approvingId = str("approvingId");
  const cancellingId = str("cancellingId");
  const claimingId = str("claimingId");
  const activeCount = num("activeCount");
  const completedCount = num("completedCount");

  const creatorEscrows = (val("creatorEscrows") ?? []) as Array<{ status: string; id: string; [key: string]: unknown }>;
  const beneficiaryEscrows = (val("beneficiaryEscrows") ?? []) as unknown[];

  const totalEscrows = creatorEscrows.length;
  const progressPercent = totalEscrows === 0 ? 0 : Math.round((completedCount / totalEscrows) * 100);

  const steps = Math.min(totalEscrows || 4, 5);
  const milestoneCheckpoints = Array.from({ length: steps }, (_, i) => ({
    position: ((i + 1) / steps) * 100,
    done: i < completedCount,
    label: `M${i + 1}`,
  }));

  const statusLabelFn = state.statusLabelFunc?.get() as ((s: string) => string) | undefined;
  const formatAmountFn = state.formatAmountFunc?.get() as ((sym: string, amt: bigint) => string) | undefined;
  const formatAddressFn = state.formatAddressFunc?.get() as ((a: string) => string) | undefined;

  const statusLabelFunc = typeof statusLabelFn === "function" ? statusLabelFn : (s: string) => s;
  const formatAmountFunc = typeof formatAmountFn === "function" ? formatAmountFn : (a: unknown) => String(a);
  const formatAddressFunc = typeof formatAddressFn === "function" ? formatAddressFn : (a: string) => a;

  // Local create form state. The contract supports 1-12 milestones, so the
  // form keeps an array of per-milestone amount strings (one input each).
  const MIN_MILESTONES = 1;
  const MAX_MILESTONES = 12;
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [beneficiary, setBeneficiary] = useState("");
  const [asset, setAsset] = useState<"GAS" | "NEO">("GAS");
  const [milestoneAmounts, setMilestoneAmounts] = useState<string[]>([""]);
  const [description, setDescription] = useState("");

  const resetForm = () => {
    setBeneficiary("");
    setAsset("GAS");
    setMilestoneAmounts([""]);
    setDescription("");
  };

  const setMilestoneAmount = (index: number, value: string) => {
    setMilestoneAmounts((prev) => prev.map((amt, i) => (i === index ? value : amt)));
  };

  const addMilestone = () => {
    setMilestoneAmounts((prev) =>
      prev.length >= MAX_MILESTONES ? prev : [...prev, ""],
    );
  };

  const removeMilestone = (index: number) => {
    setMilestoneAmounts((prev) =>
      prev.length <= MIN_MILESTONES ? prev : prev.filter((_, i) => i !== index),
    );
  };

  // Running total in human units (display only). Parsing here is forgiving;
  // the composable performs the authoritative base-unit conversion/validation.
  const parseAmount = (raw: string): number => {
    const n = Number(String(raw ?? "").trim());
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const totalAmount = milestoneAmounts.reduce((sum, amt) => sum + parseAmount(amt), 0);
  const totalDisplay = asset === "NEO"
    ? String(Math.trunc(totalAmount))
    : totalAmount.toFixed(8).replace(/\.?0+$/, "") || "0";

  // Lightweight client-side gating: require a beneficiary and at least one
  // positive milestone amount before the (async, on-chain) submit is enabled.
  // The composable still re-validates address/amount/minimums authoritatively.
  const hasBeneficiary = beneficiary.trim().length > 0;
  const allAmountsPositive =
    milestoneAmounts.length > 0 && milestoneAmounts.every((amt) => parseAmount(amt) > 0);
  const canSubmit = hasBeneficiary && allAmountsPositive && !isCreating;

  const handleCreate = async () => {
    if (!canSubmit) return;
    // The standalone MiniAppMilestoneEscrow contract supports both NEO and GAS
    // and 1-12 milestones, so each per-milestone amount is wired through as a
    // real array. The composable converts every amount to base units (GAS x 1e8,
    // NEO integer), sums them, and enforces the sum-equals-total invariant.
    await dispatch("createEscrow", {
      name: description.trim() || beneficiary,
      beneficiary,
      asset,
      notes: description,
      milestones: milestoneAmounts.map((amount) => ({ amount })),
    });
    setShowCreateForm(false);
    resetForm();
  };

  return (
    <div className="milestone-escrow-play-area">
      {/* Hero — headline state, inline metrics, and milestone progress (progress
          band + metrics only appear once at least one escrow exists). */}
      <MilestoneHero
        t={t}
        progressPercent={progressPercent}
        checkpoints={milestoneCheckpoints}
        hasEscrows={totalEscrows > 0}
        activeCount={activeCount}
        completedCount={completedCount}
        totalEscrows={totalEscrows}
      />

      {/* Primary action — surfaced immediately after the hero. */}
      {hasAddress && contractReady && (
        <>
          <NeoButton variant="secondary" onClick={() => setShowCreateForm(!showCreateForm)} aria-label={t("createEscrow") || "Create Escrow"}>
            {showCreateForm ? (t("cancel") || "Cancel") : (t("createEscrow") || "Create Escrow")}
          </NeoButton>

          {showCreateForm && (
            <NeoCard variant="erobo" className="create-form-card">
              <div className="create-form">
                <NeoInput value={beneficiary} label={t("beneficiaryAddress") || "Beneficiary"} placeholder={t("beneficiaryPlaceholder") || "N-address..."} onChange={setBeneficiary} />
                <div className="asset-select" role="radiogroup" aria-label={t("assetType") || "Asset"}>
                  <span className="asset-select__label">{t("assetType") || "Asset"}</span>
                  <div className="asset-select__options">
                    {(["GAS", "NEO"] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={asset === option}
                        className={`asset-select__option${asset === option ? " asset-select__option--active" : ""}`}
                        onClick={() => setAsset(option)}
                      >
                        {option === "NEO" ? (t("assetNeo") || "NEO") : (t("assetGas") || "GAS")}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Milestone repeater — 1-12 staged releases, each with its own
                    amount. The sum is shown live and must equal the deposit. */}
                <div className="milestone-fields" role="group" aria-label={t("milestones") || "Milestones"}>
                  <span className="milestone-fields__label">{t("milestones") || "Milestones"}</span>
                  {milestoneAmounts.map((amt, index) => (
                    <div key={index} className="milestone-row">
                      <div className="milestone-row__input">
                        <NeoInput
                          value={amt}
                          label={t("milestoneLabel", { index: index + 1 }) || `Milestone ${index + 1}`}
                          placeholder={asset === "NEO" ? "1" : (t("milestoneAmountPlaceholder") || "1.5")}
                          onChange={(value: string) => setMilestoneAmount(index, value)}
                        />
                      </div>
                      {milestoneAmounts.length > MIN_MILESTONES && (
                        <button
                          type="button"
                          className="milestone-row__remove"
                          aria-label={t("removeMilestone", { index: index + 1 }) || `Remove milestone ${index + 1}`}
                          onClick={() => removeMilestone(index)}
                        >
                          {t("remove") || "Remove"}
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="milestone-fields__footer">
                    <button
                      type="button"
                      className="milestone-add"
                      disabled={milestoneAmounts.length >= MAX_MILESTONES}
                      onClick={addMilestone}
                    >
                      + {t("addMilestone") || "Add milestone"}
                    </button>
                    <span className="milestone-total">
                      <span className="milestone-total__label">{t("totalAmount") || "Total"}</span>
                      <span className="milestone-total__value">{totalDisplay} {asset}</span>
                    </span>
                  </div>
                </div>
                <NeoInput value={description} type="textarea" label={t("description") || "Description"} placeholder={t("descriptionPlaceholder") || "Milestone description..."} onChange={setDescription} />
                <NeoButton variant="primary" loading={isCreating} disabled={!canSubmit} onClick={handleCreate} aria-label={t("submit") || "Submit"}>
                  {t("submit") || "Submit"}
                </NeoButton>
              </div>
            </NeoCard>
          )}
        </>
      )}

      {/* Escrow List */}
      <EscrowBody
        t={t}
        contractReady={contractReady}
        isRefreshing={isRefreshing}
        hasAddress={hasAddress}
        creatorEscrows={creatorEscrows}
        beneficiaryEscrows={beneficiaryEscrows}
        approvingId={approvingId}
        cancellingId={cancellingId}
        claimingId={claimingId}
        statusLabelFunc={statusLabelFunc}
        formatAmountFunc={formatAmountFunc}
        formatAddressFunc={formatAddressFunc}
        onRefresh={() => dispatch("refreshEscrows")}
        onConnectWallet={() => dispatch("connectWallet")}
        onApprove={(e: unknown) => dispatch("approveMilestone", e)}
        onCancel={(e: unknown) => dispatch("cancelEscrow", e)}
        onClaim={(e: unknown) => dispatch("claimMilestone", e)}
      />
    </div>
  );
}
