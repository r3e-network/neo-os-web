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
  const creatorEscrowCount = num("creatorEscrowCount");
  const beneficiaryEscrowCount = num("beneficiaryEscrowCount");
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

  // Local create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [beneficiary, setBeneficiary] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("GAS");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = async () => {
    await dispatch("createEscrow", {
      beneficiary,
      tokenSymbol,
      amount: amount ? BigInt(amount) : BigInt(0),
      description,
    });
    setShowCreateForm(false);
    setBeneficiary(""); setAmount(""); setDescription("");
  };

  return (
    <div className="milestone-escrow-play-area">
      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="stat-chip">
          <span className="stat-value">{activeCount}</span>
          <span className="stat-label">{t("statusActive") || "Active"}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-value">{completedCount}</span>
          <span className="stat-label">{t("statusCompleted") || "Completed"}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-value">{creatorEscrowCount}</span>
          <span className="stat-label">{t("created") || "Created"}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-value">{beneficiaryEscrowCount}</span>
          <span className="stat-label">{t("beneficiary") || "Beneficiary"}</span>
        </div>
      </div>

      {/* Hero */}
      <MilestoneHero
        t={t}
        progressPercent={progressPercent}
        checkpoints={milestoneCheckpoints}
        activeCount={activeCount}
        completedCount={completedCount}
      />

      {/* Create Escrow */}
      {hasAddress && contractReady && (
        <>
          <NeoButton variant="secondary" onClick={() => setShowCreateForm(!showCreateForm)} aria-label={t("createEscrow") || "Create Escrow"}>
            {showCreateForm ? (t("cancel") || "Cancel") : (t("createEscrow") || "Create Escrow")}
          </NeoButton>

          {showCreateForm && (
            <NeoCard variant="erobo" className="create-form-card">
              <div className="create-form">
                <NeoInput value={beneficiary} label={t("beneficiaryAddress") || "Beneficiary"} placeholder={t("beneficiaryPlaceholder") || "N-address..."} onChange={setBeneficiary} />
                <NeoInput value={tokenSymbol} label={t("tokenSymbol") || "Token"} placeholder="GAS" onChange={setTokenSymbol} />
                <NeoInput value={amount} label={t("amount") || "Amount"} placeholder={t("amountPlaceholder") || "100000000"} onChange={setAmount} />
                <NeoInput value={description} type="textarea" label={t("description") || "Description"} placeholder={t("descriptionPlaceholder") || "Milestone description..."} onChange={setDescription} />
                <NeoButton variant="primary" loading={isCreating} onClick={handleCreate} aria-label={t("submit") || "Submit"}>
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
