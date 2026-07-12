import { useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  KeyRound,
  Minus,
  Network,
  Plus,
  Route,
  ShieldCheck,
  TrendingUp,
  Users,
  Vote,
} from "lucide-react";

import { CoinArt } from "@shared/art";
import type { ObservableState } from "@shared/react/context";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import { PlayStage } from "../PlayStage";
import {
  anchorAgentBalance,
  compactAnchorAgentBalance,
  getAnchorAgentAddress,
  getAnchorAgentCandidate,
  getAnchorAgentId,
  getAnchorAgentLabel,
  groupAnchorAgents,
  isCompressedPublicKey,
  normalizeCandidateKey,
  normalizeWholeNeoInput,
  shortAnchorValue,
  type AnchorAgentRecord,
  type AnchorOperationMode,
  type AnchorRouteSlot,
  type NormalizedAnchorAgent,
} from "./model";

export interface AnchorAdminWorkspaceProps {
  t: (key: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
  flavor: "profit" | "trust";
}

const EMPTY_AGENTS: AnchorAgentRecord[] = [];

interface TopologyProps {
  t: AnchorAdminWorkspaceProps["t"];
  agents: NormalizedAnchorAgent[];
  rosterReady: boolean;
  mode: AnchorOperationMode;
  activeSlot: AnchorRouteSlot;
  fromId: number;
  toId: number;
  totalNeoDisplay: string;
  reserveDisplay: string;
  selectedAgentDisplay: string;
  onSelect: (id: number) => void;
}

function AgentTopology({
  t,
  agents,
  rosterReady,
  mode,
  activeSlot,
  fromId,
  toId,
  totalNeoDisplay,
  reserveDisplay,
  selectedAgentDisplay,
  onSelect,
}: TopologyProps) {
  const rows = useMemo(() => groupAnchorAgents(agents), [agents]);

  return (
    <section className="admin-ledger admin-topology" aria-label={t("agentTopologyTitle")}>
      <header className="admin-topology__head">
        <div>
          <Network size={18} aria-hidden="true" />
          <span>
            <strong>{t("agentTopologyTitle")}</strong>
            <small>{t("agentTopologySubtitle")}</small>
          </span>
        </div>
        <span className="admin-topology__count" data-ready={rosterReady ? "true" : "false"}>
          {rosterReady
            ? t("topologyCount", { count: agents.length })
            : t("topologyPendingCount", { count: agents.length })}
        </span>
      </header>

      <div className="admin-topology__hub">
        <span className="admin-topology__hub-icon" aria-hidden="true">
          <CoinArt size={38} variant="neo" />
        </span>
        <div className="admin-topology__hub-copy">
          <span>{t("anchorHubTitle")}</span>
          <strong>{totalNeoDisplay}</strong>
        </div>
        <dl>
          <div><dt>{t("reserve")}</dt><dd>{reserveDisplay}</dd></div>
          <div><dt>{t("selectedRoute")}</dt><dd>{selectedAgentDisplay}</dd></div>
        </dl>
      </div>

      {rows.length > 0 ? (
        <div className="admin-topology__network" aria-label={t("topologyNetworkLabel")}>
          {rows.map((row, rowIndex) => (
            <ul className="admin-topology__row" key={`row-${rowIndex + 1}`}>
              {row.map((agent) => {
                const isSource = agent.normalizedId === fromId;
                const isTarget = mode === "move" && agent.normalizedId === toId;
                const isFocused = mode === "move"
                  ? (activeSlot === "from" ? isSource : isTarget)
                  : isSource;
                const statusLabel = agent.active === false ? t("agentInactive") : t("agentActive");
                const balanceLabel = anchorAgentBalance(agent, t("agentBalancePending"));
                const nodeLabel = t("agentNodeLabel", {
                  agent: agent.normalizedId,
                  status: statusLabel,
                  balance: balanceLabel,
                });
                return (
                  <li key={agent.normalizedId}>
                    <button
                      type="button"
                      className="admin-agent-node"
                      data-source={isSource ? "true" : undefined}
                      data-target={isTarget ? "true" : undefined}
                      data-focused={isFocused ? "true" : undefined}
                      data-inactive={agent.active === false ? "true" : undefined}
                      data-pending={!rosterReady ? "true" : undefined}
                      aria-pressed={isSource || isTarget}
                      aria-label={nodeLabel}
                      title={nodeLabel}
                      onClick={() => onSelect(agent.normalizedId)}
                    >
                      <span className="admin-agent-node__status" aria-hidden="true" />
                      <strong>{String(agent.normalizedId).padStart(2, "0")}</strong>
                      <small>{compactAnchorAgentBalance(agent)}</small>
                    </button>
                  </li>
                );
              })}
            </ul>
          ))}
        </div>
      ) : (
        <div className="admin-topology__empty" role="status">
          <Users size={24} aria-hidden="true" />
          <strong>{t("agentDirectoryEmpty")}</strong>
          <span>{t("agentDirectoryEmptyHint")}</span>
        </div>
      )}

      <div className="admin-topology__legend" aria-label={t("topologyLegendLabel")}>
        <span data-legend="source">{t("sourceLegend")}</span>
        <span data-legend="target">{t("targetLegend")}</span>
        <span data-legend="active">{t("activeRouteLegend")}</span>
        <span data-legend="inactive">{t("inactiveRouteLegend")}</span>
      </div>
    </section>
  );
}

interface PlannerProps {
  t: AnchorAdminWorkspaceProps["t"];
  mode: AnchorOperationMode;
  activeSlot: AnchorRouteSlot;
  adminState: string;
  rosterReady: boolean;
  expectedAdminDisplay: string;
  fromAgent?: NormalizedAnchorAgent;
  toAgent?: NormalizedAnchorAgent;
  focusedAgent?: NormalizedAnchorAgent;
  amount: string;
  amountValue: number;
  sourceWholeBalance: number;
  sourceBalanceKnown: boolean;
  amountExceedsBalance: boolean;
  candidateDraft: string;
  candidatePreview: string;
  candidateHint: string;
  candidateInvalid: boolean;
  submitFailed: boolean;
  onModeChange: (mode: AnchorOperationMode) => void;
  onSlotChange: (slot: AnchorRouteSlot) => void;
  onAmountChange: (value: string) => void;
  onAmountStep: (delta: number) => void;
  onCandidateChange: (value: string) => void;
}

function RoutePlanner({
  t,
  mode,
  activeSlot,
  adminState,
  rosterReady,
  expectedAdminDisplay,
  fromAgent,
  toAgent,
  focusedAgent,
  amount,
  amountValue,
  sourceWholeBalance,
  sourceBalanceKnown,
  amountExceedsBalance,
  candidateDraft,
  candidatePreview,
  candidateHint,
  candidateInvalid,
  submitFailed,
  onModeChange,
  onSlotChange,
  onAmountChange,
  onAmountStep,
  onCandidateChange,
}: PlannerProps) {
  const operationLabel = mode === "move" ? t("moveNeo") : mode === "candidate" ? t("setCandidate") : t("syncVote");
  const operationHint = mode === "move" ? t("moveNeoDesc") : mode === "candidate" ? t("setCandidateDesc") : t("syncVoteDesc");
  const permissionLabel = adminState === "admin"
    ? (rosterReady ? t("operatorVerified") : t("rosterUnverified"))
    : adminState === "denied"
      ? t("operatorRequiredEyebrow")
      : t("checkingAuthority");
  const preview = mode === "move"
    ? t("moveTransactionPreview", {
        amount: amountValue || 0,
        from: fromAgent?.normalizedId ?? "—",
        to: toAgent?.normalizedId ?? "—",
      })
    : mode === "candidate"
      ? t("candidateTransactionPreview", {
          agent: focusedAgent?.normalizedId ?? "—",
          candidate: shortAnchorValue(candidatePreview, 10, 8),
        })
      : t("voteTransactionPreview", {
          agent: focusedAgent?.normalizedId ?? "—",
          candidate: shortAnchorValue(getAnchorAgentCandidate(focusedAgent), 10, 8),
        });

  return (
    <section className="admin-command admin-planner" aria-label={t("routePlannerTitle")}>
      <header className="admin-command__head">
        <span><Route size={17} aria-hidden="true" />{t("routePlannerTitle")}</span>
        <strong data-authority={adminState === "admin" && !rosterReady ? "loading" : adminState}>{permissionLabel}</strong>
      </header>

      <div className="admin-mode" role="group" aria-label={t("operationMode")}>
        {([
          ["move", t("moveNeo"), <ArrowRight size={15} key="move" />],
          ["candidate", t("setCandidate"), <KeyRound size={15} key="candidate" />],
          ["vote", t("syncVote"), <Vote size={15} key="vote" />],
        ] as const).map(([value, label, icon]) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            data-active={mode === value ? "true" : undefined}
            onClick={() => onModeChange(value)}
          >
            {icon}<span>{label}</span>
          </button>
        ))}
      </div>

      <div className="admin-operation-intro">
        <span>{operationLabel}</span>
        <strong>{operationHint}</strong>
      </div>

      {mode === "move" ? (
        <>
          <div className="admin-route-board" aria-label={t("selectedRoutePlanner")}>
            <button
              type="button"
              className="admin-agent-card"
              data-active={activeSlot === "from" ? "true" : undefined}
              aria-label={t("selectSourceSlot")}
              onClick={() => onSlotChange("from")}
            >
              <span>{t("fromAgentId")}</span>
              <strong>{fromAgent?.normalizedLabel ?? t("chooseAgent")}</strong>
              <em>{shortAnchorValue(getAnchorAgentAddress(fromAgent), 9, 5)}</em>
              <small>{anchorAgentBalance(fromAgent, t("agentBalancePending"))}</small>
            </button>
            <div className="admin-route-link" aria-hidden="true">
              <CoinArt size={31} variant="neo" />
              <ArrowRight size={18} />
            </div>
            <button
              type="button"
              className="admin-agent-card"
              data-active={activeSlot === "to" ? "true" : undefined}
              aria-label={t("selectTargetSlot")}
              onClick={() => onSlotChange("to")}
            >
              <span>{t("toAgentId")}</span>
              <strong>{toAgent?.normalizedLabel ?? t("chooseAgent")}</strong>
              <em>{shortAnchorValue(getAnchorAgentAddress(toAgent), 9, 5)}</em>
              <small>{anchorAgentBalance(toAgent, t("agentBalancePending"))}</small>
            </button>
          </div>

          <div className="admin-operation-ticket">
            <div
              className="admin-amount-console"
              role="group"
              aria-label={t("neoAmountControl")}
              data-invalid={amountExceedsBalance || amountValue <= 0 ? "true" : undefined}
            >
              <div className="admin-amount-console__asset">
                <CoinArt size={28} variant="neo" />
                <span>{t("neoAmount")}</span>
                <strong>{amountValue || 0} NEO</strong>
              </div>
              <div className="admin-amount-console__stepper">
                <button
                  type="button"
                  aria-label={t("decreaseAmount")}
                  onClick={() => onAmountStep(-1)}
                  disabled={amountValue <= 1}
                ><Minus size={14} /></button>
                <label className="admin-amount-console__input">
                  <span>{t("neoAmount")}</span>
                  <input
                    value={amount}
                    inputMode="numeric"
                    aria-invalid={amountExceedsBalance || amountValue <= 0}
                    aria-describedby="anchor-move-hint"
                    onChange={(event) => onAmountChange(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  aria-label={t("increaseAmount")}
                  onClick={() => onAmountStep(1)}
                  disabled={sourceBalanceKnown && amountValue >= sourceWholeBalance}
                ><Plus size={14} /></button>
              </div>
              <div className="admin-amount-console__quick" aria-label={t("quickAmount")}>
                {[1, 5, 10].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={sourceBalanceKnown && preset > sourceWholeBalance}
                    onClick={() => onAmountChange(String(preset))}
                  >{preset}</button>
                ))}
                <button
                  type="button"
                  disabled={!sourceBalanceKnown || sourceWholeBalance <= 0}
                  onClick={() => onAmountChange(String(sourceWholeBalance))}
                >{t("maxAmount")}</button>
              </div>
              <small id="anchor-move-hint">
                {amountExceedsBalance ? t("moveExceedsBalance") : t("moveBalanceHint")}
              </small>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="admin-focus-agent">
            <span>{t("agentId")}</span>
            <strong>{focusedAgent?.normalizedLabel ?? t("chooseAgent")}</strong>
            <small>{anchorAgentBalance(focusedAgent, t("agentBalancePending"))}</small>
          </div>

          {mode === "candidate" ? (
            <div className="admin-operation-ticket">
              <div className="admin-candidate-console" role="group" aria-label={t("candidateControl")}>
                <div className="admin-candidate-console__preview">
                  <KeyRound size={17} aria-hidden="true" />
                  <span>{t("currentCandidate")}</span>
                  <strong>{shortAnchorValue(getAnchorAgentCandidate(focusedAgent), 12, 9)}</strong>
                </div>
                <label className="admin-candidate-console__input">
                  <span>{t("candidatePublicKey")}</span>
                  <input
                    value={candidateDraft}
                    placeholder={t("candidateInputPlaceholder")}
                    spellCheck={false}
                    autoComplete="off"
                    aria-invalid={candidateInvalid}
                    aria-describedby="anchor-candidate-hint"
                    onChange={(event) => onCandidateChange(event.target.value)}
                  />
                </label>
                <small id="anchor-candidate-hint" data-invalid={candidateInvalid ? "true" : undefined}>{candidateHint}</small>
              </div>
            </div>
          ) : (
            <div className="admin-vote-console">
              <Vote size={22} aria-hidden="true" />
              <div>
                <strong>{t("voteWitnessTitle")}</strong>
                <p>{t("voteWitnessNote", {
                  agent: focusedAgent?.normalizedId ?? "—",
                  account: shortAnchorValue(getAnchorAgentAddress(focusedAgent), 9, 5),
                })}</p>
              </div>
            </div>
          )}
        </>
      )}

      <details className="admin-agent-inspector">
        <summary>
          <span><Activity size={16} aria-hidden="true" />{t("agentDetails")}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <dl>
          <div><dt>{t("accountAddress")}</dt><dd><code>{getAnchorAgentAddress(focusedAgent) || "—"}</code></dd></div>
          <div><dt>{t("currentCandidate")}</dt><dd><code>{getAnchorAgentCandidate(focusedAgent) || "—"}</code></dd></div>
          <div><dt>{t("agentStatus")}</dt><dd>{focusedAgent?.active === false ? t("agentInactive") : t("agentActive")}</dd></div>
        </dl>
      </details>

      <div className="admin-transaction-preview" aria-live="polite">
        <span><CheckCircle2 size={15} aria-hidden="true" />{t("transactionPreview")}</span>
        <strong>{preview}</strong>
        {(adminState !== "admin" || !rosterReady) && (
          <small>{adminState === "admin"
            ? t("rosterUnverifiedBody")
            : adminState === "denied"
              ? (expectedAdminDisplay
                  ? t("operatorRequiredBody", { address: expectedAdminDisplay })
                  : t("operatorRequiredBodyNoAddress"))
              : t("operatorCheckingBody")}</small>
        )}
        {submitFailed && <small role="alert">{t("operationRetryHint")}</small>}
      </div>
    </section>
  );
}

export function AnchorAdminWorkspace({ t, state, dispatch, flavor }: AnchorAdminWorkspaceProps) {
  const { str, val } = useStateBindings(state);
  const rawAgents = val("agentAccounts") as AnchorAgentRecord[] | undefined;
  const agents = useMemo(() => rawAgents ?? EMPTY_AGENTS, [rawAgents]);
  const rosterReadyValue = val("agentsLive");
  const totalNeoDisplay = str("totalNeoDisplay", "—");
  const reserveDisplay = str("reserveDisplay", "—");
  const selectedAgentDisplay = str("selectedAgentDisplay", t("noneFallback"));
  const agentCountDisplay = str("agentCountDisplay", `${agents.length || 0} / 21`);
  const adminState = str("adminState", "loading");
  const expectedAdminDisplay = str("expectedAdminDisplay", "");

  const [mode, setMode] = useState<AnchorOperationMode>("move");
  const [activeSlot, setActiveSlot] = useState<AnchorRouteSlot>("from");
  const [fromAgentId, setFromAgentId] = useState(1);
  const [toAgentId, setToAgentId] = useState(2);
  const [amount, setAmount] = useState("1");
  const [candidateDraft, setCandidateDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);

  const roster = useMemo<NormalizedAnchorAgent[]>(
    () => agents.map((agent, index) => ({
      ...agent,
      normalizedId: getAnchorAgentId(agent, index + 1),
      normalizedLabel: getAnchorAgentLabel(agent, index + 1),
    })),
    [agents],
  );
  const rosterReady = typeof rosterReadyValue === "boolean"
    ? rosterReadyValue
    : rawAgents !== undefined;
  const fromAgent = roster.find((agent) => agent.normalizedId === fromAgentId) ?? roster[0];
  const effectiveFromId = fromAgent?.normalizedId ?? fromAgentId;
  const fallbackTarget = roster.find((agent) => agent.normalizedId !== effectiveFromId);
  const toAgent = roster.find((agent) => agent.normalizedId === toAgentId && agent.normalizedId !== effectiveFromId) ?? fallbackTarget;
  const effectiveToId = toAgent?.normalizedId ?? toAgentId;
  const focusedAgent = mode === "move"
    ? (activeSlot === "to" ? toAgent : fromAgent)
    : fromAgent;

  const normalizedAmount = normalizeWholeNeoInput(amount);
  const amountValue = Number(normalizedAmount || "0");
  const sourceBalance = typeof fromAgent?.neoBalance === "number" ? fromAgent.neoBalance : null;
  const sourceBalanceKnown = sourceBalance !== null;
  const sourceWholeBalance = sourceBalanceKnown ? Math.max(0, Math.floor(sourceBalance)) : 0;
  const amountExceedsBalance = sourceBalanceKnown && amountValue > sourceBalance;
  const candidatePreview = normalizeCandidateKey(candidateDraft || getAnchorAgentCandidate(focusedAgent));
  const currentCandidate = normalizeCandidateKey(getAnchorAgentCandidate(focusedAgent));
  const candidateTouched = candidateDraft.trim().length > 0;
  const candidateValid = candidateTouched && isCompressedPublicKey(candidateDraft);
  const candidateChanged = candidateValid && candidatePreview.toLowerCase() !== currentCandidate.toLowerCase();
  const candidateInvalid = candidateTouched && !candidateValid;
  const canOperate = adminState === "admin" && rosterReady && Boolean(fromAgent);
  const canSubmit = !submitting && canOperate && (
    mode === "move"
      ? Boolean(toAgent) && effectiveFromId !== effectiveToId && amountValue > 0 && !amountExceedsBalance
      : mode === "candidate"
        ? candidateValid && candidateChanged
        : true
  );

  const candidateHint = !candidateTouched
    ? t("candidateEntryHint")
    : candidateInvalid
      ? t("candidateInvalidHint")
      : !candidateChanged
        ? t("candidateUnchangedHint")
        : t("candidateReadyHint");

  const selectMode = (nextMode: AnchorOperationMode) => {
    setMode(nextMode);
    setActiveSlot("from");
    setCandidateDraft("");
    setSubmitFailed(false);
  };

  const selectAgent = (id: number) => {
    setSubmitFailed(false);
    if (mode === "move") {
      if (activeSlot === "from") {
        setFromAgentId(id);
        if (id === effectiveToId) {
          const replacement = roster.find((agent) => agent.normalizedId !== id);
          if (replacement) setToAgentId(replacement.normalizedId);
        }
        setActiveSlot("to");
      } else if (id !== effectiveFromId) {
        setToAgentId(id);
      }
      return;
    }
    setFromAgentId(id);
    setCandidateDraft("");
  };

  const stepAmount = (delta: number) => {
    setSubmitFailed(false);
    const next = Math.max(1, amountValue + delta);
    setAmount(String(sourceBalanceKnown ? Math.min(next, Math.max(sourceWholeBalance, 1)) : next));
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitFailed(false);
    try {
      if (mode === "move") {
        await dispatch("transferAgentNeo", {
          fromAgentId: effectiveFromId,
          toAgentId: effectiveToId,
          amount: amountValue,
        });
        return;
      }
      if (mode === "candidate") {
        await dispatch("setAgentCandidate", {
          agentId: effectiveFromId,
          candidate: candidatePreview,
        });
        setCandidateDraft("");
        return;
      }
      await dispatch("voteAgent", { agentId: effectiveFromId });
    } catch {
      // The framework notification guard owns the detailed chain error. Keep
      // the prepared route intact and expose a concise retry state locally.
      setSubmitFailed(true);
    } finally {
      setSubmitting(false);
    }
  };

  const operationLabel = mode === "move" ? t("moveNeo") : mode === "candidate" ? t("setCandidate") : t("syncVote");
  const HubIcon = flavor === "profit" ? TrendingUp : ShieldCheck;

  const scene = (
    <div className="admin-scene admin-workspace" data-mode={mode}>
      <AgentTopology
        t={t}
        agents={roster}
        rosterReady={rosterReady}
        mode={mode}
        activeSlot={activeSlot}
        fromId={effectiveFromId}
        toId={effectiveToId}
        totalNeoDisplay={totalNeoDisplay}
        reserveDisplay={reserveDisplay}
        selectedAgentDisplay={selectedAgentDisplay}
        onSelect={selectAgent}
      />
      <RoutePlanner
        t={t}
        mode={mode}
        activeSlot={activeSlot}
        adminState={adminState}
        rosterReady={rosterReady}
        expectedAdminDisplay={expectedAdminDisplay}
        fromAgent={fromAgent}
        toAgent={toAgent}
        focusedAgent={focusedAgent}
        amount={amount}
        amountValue={amountValue}
        sourceWholeBalance={sourceWholeBalance}
        sourceBalanceKnown={sourceBalanceKnown}
        amountExceedsBalance={amountExceedsBalance}
        candidateDraft={candidateDraft}
        candidatePreview={candidatePreview}
        candidateHint={candidateHint}
        candidateInvalid={candidateInvalid}
        submitFailed={submitFailed}
        onModeChange={selectMode}
        onSlotChange={(slot) => {
          setActiveSlot(slot);
          setSubmitFailed(false);
        }}
        onAmountChange={(value) => {
          setAmount(normalizeWholeNeoInput(value));
          setSubmitFailed(false);
        }}
        onAmountStep={stepAmount}
        onCandidateChange={(value) => {
          setCandidateDraft(value);
          setSubmitFailed(false);
        }}
      />
    </div>
  );

  const drawer = (
    <div className="admin-drawer">
      <section>
        <h4><HubIcon size={16} aria-hidden="true" />{t("routeMapTitle")}</h4>
        <dl className="admin-drawer__metrics">
          <div><dt>{t("trackedNeo")}</dt><dd>{totalNeoDisplay}</dd></div>
          <div><dt>{t("reserve")}</dt><dd>{reserveDisplay}</dd></div>
          <div><dt>{t("selectedRoute")}</dt><dd>{selectedAgentDisplay}</dd></div>
        </dl>
      </section>
      <section>
        <h4><ShieldCheck size={16} aria-hidden="true" />{t("securityChecklistTitle")}</h4>
        <ul className="admin-security-list">
          <li><CheckCircle2 size={15} aria-hidden="true" /><span>{t("safetyMove")}</span></li>
          <li><CheckCircle2 size={15} aria-hidden="true" /><span>{t("safetyTarget")}</span></li>
          <li><CheckCircle2 size={15} aria-hidden="true" /><span>{t("safetyVote")}</span></li>
        </ul>
        <p className="admin-drawer__policy">{t("operatorRuleDesc")}</p>
        <p className="admin-drawer__policy">{t("yieldCausality")}</p>
      </section>
      <section>
        <h4><Users size={16} aria-hidden="true" />{t("agentDirectoryTitle")}</h4>
        {roster.length > 0 ? (
          <ul className="admin-drawer__roster">
            {roster.map((agent) => (
              <li key={agent.normalizedId}>
                <span className="admin-drawer__status" data-active={agent.active === false ? "false" : "true"} aria-hidden="true" />
                <strong>{agent.normalizedLabel}</strong>
                <code>{shortAnchorValue(getAnchorAgentAddress(agent), 8, 5)}</code>
                <em>{anchorAgentBalance(agent, t("agentBalancePending"))}</em>
              </li>
            ))}
          </ul>
        ) : <p className="admin-drawer__policy">{t("agentDirectoryEmpty")}</p>}
      </section>
    </div>
  );

  return (
    <div className="anchor-admin-play-area mx2 mx2-cat-defi" data-anchor-flavor={flavor}>
      <PlayStage
        category="defi"
        stage={{
          eyebrow: t("appName"),
          title: t("adminHeroTitle"),
          subtitle: t("adminHeroSubtitle"),
          badges: (
            <span className="mx2-badge" data-tone={adminState === "admin" && rosterReady ? "success" : "neutral"}>
              <span className="mx2-badge__dot" /> {rosterReady
                ? agentCountDisplay
                : t("topologyPendingCount", { count: roster.length })}
            </span>
          ),
        }}
        scene={scene}
        score={[
          { label: t("trackedNeo"), value: totalNeoDisplay, accent: true },
          { label: t("agentCount"), value: agentCountDisplay },
          { label: t("selectedRoute"), value: selectedAgentDisplay },
        ]}
        actions={{
          primary: {
            label: operationLabel,
            onClick: submit,
            disabled: !canSubmit,
            loading: submitting,
            icon: <BadgeCheck size={17} />,
          },
        }}
        drawerToggleLabel={t("operationsAndDirectory")}
        drawer={{ title: t("operationsAndDirectory"), children: drawer }}
      />
    </div>
  );
}
