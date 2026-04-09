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
  const { str, bool, val } = useStateBindings(state);

  const hasAddress = Boolean(state.address?.get());
  const contractReady = bool("contractReady");
  const isRefreshing = bool("isRefreshing");
  const approvingId = str("approvingId");
  const cancellingId = str("cancellingId");
  const claimingId = str("claimingId");

  const creatorEscrows = (val("creatorEscrows") ?? []) as Array<{ status: string; id: string; [key: string]: unknown }>;
  const beneficiaryEscrows = (val("beneficiaryEscrows") ?? []) as unknown[];

  const activeCount = creatorEscrows.filter((e) => e.status === "active").length;
  const completedCount = creatorEscrows.filter((e) => e.status === "completed").length;
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

  return (
    <div className="milestone-escrow-play-area">
      <MilestoneHero
        t={t}
        progressPercent={progressPercent}
        checkpoints={milestoneCheckpoints}
        activeCount={activeCount}
        completedCount={completedCount}
      />
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
