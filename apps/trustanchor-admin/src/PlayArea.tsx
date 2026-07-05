/** TrustAnchor Admin -- AA agent trust-routing workspace. */
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  KeyRound,
  Route,
  ShieldCheck,
  Users,
  Vote,
} from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import { CoinArt } from "@shared/art";
import { PlayStage } from "@shared/components-react/v2";
import "./PlayArea.scss";

interface Props {
  t: (key: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

interface AgentRecord {
  id?: string | number;
  agentId?: string | number;
  label?: string;
  account?: string;
  accountAddress?: string;
  address?: string;
  candidate?: string;
  candidateTarget?: string;
  active?: boolean;
  neo?: string;
  neoBalance?: number | null;
}

type OperationMode = "move" | "candidate" | "vote";
type RouteSlot = "from" | "to";

const EMPTY_AGENTS: AgentRecord[] = [];

function getAgentId(agent: AgentRecord, fallback: number) {
  const value = Number(agent.agentId ?? agent.id ?? fallback);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function agentLabel(agent: AgentRecord, fallback: number) {
  const id = getAgentId(agent, fallback);
  return agent.label || `Agent ${String(id).padStart(2, "0")}`;
}

function agentAddress(agent?: AgentRecord) {
  return String(agent?.accountAddress || agent?.account || agent?.address || "");
}

function agentCandidate(agent?: AgentRecord) {
  return String(agent?.candidate || agent?.candidateTarget || "");
}

function short(value: string, head = 8, tail = 6) {
  if (!value) return "-";
  return value.length > head + tail + 3 ? `${value.slice(0, head)}...${value.slice(-tail)}` : value;
}

function balance(agent?: AgentRecord, pendingLabel = "Balance pending") {
  if (!agent) return pendingLabel;
  if (typeof agent.neoBalance === "number") return `${agent.neoBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} NEO`;
  if (agent.neo) return `${agent.neo} NEO`;
  return pendingLabel;
}

function clampAgentId(value: number, max: number) {
  if (!Number.isInteger(value) || value < 1) return 1;
  return Math.min(value, Math.max(max, 1));
}

function normalizeWholeNeoAmount(value: string) {
  const whole = value.split(/[.,]/)[0] ?? "";
  return whole.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
}

export default function PlayArea({ t, state, dispatch }: Props) {
  const { str, val } = useStateBindings(state);
  const rawAgents = val("agentAccounts") as AgentRecord[] | undefined;
  const agents = useMemo(() => rawAgents ?? EMPTY_AGENTS, [rawAgents]);
  const totalNeoDisplay = str("totalNeoDisplay", "-");
  const reserveDisplay = str("reserveDisplay", "-");
  const selectedAgentDisplay = str("selectedAgentDisplay", t("noneFallback"));
  const agentCountDisplay = str("agentCountDisplay", `${agents.length || 0} / 21`);
  const adminState = str("adminState", "loading");
  const expectedAdminDisplay = str("expectedAdminDisplay", "");

  const [mode, setMode] = useState<OperationMode>("move");
  const [activeSlot, setActiveSlot] = useState<RouteSlot>("from");
  const [fromAgentId, setFromAgentId] = useState(1);
  const [toAgentId, setToAgentId] = useState(2);
  const [amount, setAmount] = useState("1");
  const [candidate, setCandidate] = useState("");

  const roster = useMemo(
    () => agents.map((agent, index) => ({ ...agent, normalizedId: getAgentId(agent, index + 1), normalizedLabel: agentLabel(agent, index + 1) })),
    [agents],
  );
  const maxAgentId = roster.length || 21;
  const fromId = clampAgentId(fromAgentId, maxAgentId);
  const toId = clampAgentId(toAgentId === fromId ? (fromId === maxAgentId ? 1 : fromId + 1) : toAgentId, maxAgentId);
  const fromAgent = roster.find((agent) => agent.normalizedId === fromId) ?? roster[0];
  const toAgent = roster.find((agent) => agent.normalizedId === toId) ?? roster[1] ?? roster[0];
  const focusedAgent = mode === "move" ? fromAgent : fromAgent;
  const focusedCandidate = candidate || agentCandidate(focusedAgent);
  const isReadOnly = adminState === "denied";

  const selectAgent = (id: number) => {
    if (mode === "move") {
      if (activeSlot === "from") {
        setFromAgentId(id);
        if (id === toId) setToAgentId(id === 1 ? 2 : 1);
      } else {
        setToAgentId(id === fromId ? (id === 1 ? 2 : 1) : id);
      }
      return;
    }
    setFromAgentId(id);
  };

  const submit = () => {
    if (mode === "move") {
      void dispatch("transferAgentNeo", { fromAgentId: fromId, toAgentId: toId, amount: Number(normalizeWholeNeoAmount(amount)) });
      return;
    }
    if (mode === "candidate") {
      void dispatch("setAgentCandidate", { agentId: fromId, candidate: focusedCandidate.trim() });
      return;
    }
    void dispatch("voteAgent", { agentId: fromId });
  };

  const operationLabel = mode === "move" ? t("moveNeo") : mode === "candidate" ? t("setCandidate") : t("syncVote");
  const operationHint = mode === "move" ? t("moveNeoDesc") : mode === "candidate" ? t("setCandidateDesc") : t("syncVoteDesc");

  const scene = (
    <div className="admin-scene admin-workspace" data-mode={mode}>
      <section className="admin-command" aria-label={t("adminCommandCenter")}>
        <div className="admin-command__head">
          <span><Route size={16} />{t("adminCommandCenter")}</span>
          <strong>{adminState === "admin" ? t("adminScope") : adminState === "denied" ? t("operatorRequiredEyebrow") : t("statsAwaitConnect")}</strong>
        </div>

        <div className="admin-mode" aria-label={t("operationMode")}>
          {([
            ["move", t("moveNeo"), <ArrowRight size={15} key="move" />],
            ["candidate", t("setCandidate"), <KeyRound size={15} key="candidate" />],
            ["vote", t("syncVote"), <Vote size={15} key="vote" />],
          ] as const).map(([value, label, icon]) => (
            <button key={value} type="button" data-active={mode === value ? "true" : undefined} onClick={() => setMode(value)}>
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="admin-route-board">
          <button type="button" className="admin-agent-card" data-active={mode !== "move" || activeSlot === "from" ? "true" : undefined} onClick={() => setActiveSlot("from")}>
            <span>{mode === "move" ? t("fromAgentId") : t("agentId")}</span>
            <strong>{fromAgent?.normalizedLabel ?? `Agent ${fromId}`}</strong>
            <em>{short(agentAddress(fromAgent), 10, 6)}</em>
            <small>{balance(fromAgent, t("agentBalancePending"))}</small>
          </button>

          {mode === "move" ? (
            <>
              <div className="admin-route-link" aria-hidden="true">
                <CoinArt size={34} variant="neo" />
                <ArrowRight size={18} />
              </div>
              <button type="button" className="admin-agent-card" data-active={activeSlot === "to" ? "true" : undefined} onClick={() => setActiveSlot("to")}>
                <span>{t("toAgentId")}</span>
                <strong>{toAgent?.normalizedLabel ?? `Agent ${toId}`}</strong>
                <em>{short(agentAddress(toAgent), 10, 6)}</em>
                <small>{balance(toAgent, t("agentBalancePending"))}</small>
              </button>
            </>
          ) : (
            <div className="admin-candidate-card">
              <span>{t("agentCandidateLabel")}</span>
              <strong>{short(agentCandidate(focusedAgent), 12, 8) || t("agentCandidateNone")}</strong>
              <em>{mode === "candidate" ? t("cardRuleCandidate") : t("voteWitnessTitle")}</em>
            </div>
          )}
        </div>

        <div className="admin-operation-ticket">
          <div>
            <span>{operationLabel}</span>
            <strong>{operationHint}</strong>
          </div>
          {mode === "move" ? (
            <label>
              <span>{t("neoAmount")}</span>
              <input value={amount} inputMode="numeric" onChange={(event) => setAmount(normalizeWholeNeoAmount(event.target.value))} />
            </label>
          ) : mode === "candidate" ? (
            <label className="admin-operation-ticket__candidate">
              <span>{t("candidatePublicKey")}</span>
              <input value={candidate} onChange={(event) => setCandidate(event.target.value)} placeholder={short(agentCandidate(focusedAgent), 14, 10)} />
            </label>
          ) : (
            <p>{t("voteWitnessNote", { agent: fromId, account: short(agentAddress(focusedAgent), 10, 6) })}</p>
          )}
        </div>
      </section>

      <section className="admin-ledger" aria-label={t("agentDirectoryTitle")}>
        <div className="admin-ledger__head">
          <span><Users size={16} />{t("agentDirectoryTitle")}</span>
          <strong>{t("directoryRosterNote", { count: roster.length || 21 })}</strong>
        </div>
        <div className="admin-agent-grid">
          {roster.slice(0, 12).map((agent) => {
            const selected = agent.normalizedId === fromId || (mode === "move" && agent.normalizedId === toId);
            return (
              <button key={agent.normalizedId} type="button" data-selected={selected ? "true" : undefined} onClick={() => selectAgent(agent.normalizedId)}>
                <span>{agent.normalizedLabel}</span>
                <strong>{balance(agent, t("agentBalancePending"))}</strong>
                <em>{agent.active === false ? t("agentInactive") : t("agentActive")}</em>
              </button>
            );
          })}
        </div>
      </section>

      <section className="admin-policy">
        <span><ShieldCheck size={16} />{t("operatorRule")}</span>
        <p>{isReadOnly
          ? (expectedAdminDisplay ? t("operatorRequiredBody", { address: expectedAdminDisplay }) : t("operatorRequiredBodyNoAddress"))
          : t("operatorRuleDesc")}</p>
      </section>
    </div>
  );

  const drawer = (
    <div className="admin-drawer">
      <section>
        <h4>{t("routeMapTitle")}</h4>
        <p><span>{t("trackedNeo")}</span><strong>{totalNeoDisplay}</strong></p>
        <p><span>{t("reserve")}</span><strong>{reserveDisplay}</strong></p>
        <p><span>{t("selectedRoute")}</span><strong>{selectedAgentDisplay}</strong></p>
      </section>
      <section>
        <h4>{t("agentDirectoryTitle")}</h4>
        {roster.length > 0 ? (
          <ul className="mx2-history">
            {roster.slice(0, 10).map((agent) => (
              <li key={agent.normalizedId} className="mx2-history__item">
                <span className="mx2-history__face">{agent.normalizedLabel}</span>
                <span className="mx2-history__result">{short(agentAddress(agent), 9, 5)}</span>
              </li>
            ))}
          </ul>
        ) : <p>{t("agentDirectoryEmpty")}</p>}
      </section>
    </div>
  );

  return (
    <div className="anchor-admin-play-area mx2 mx2-cat-defi">
      <PlayStage
        category="defi"
        stage={{
          eyebrow: t("appName"),
          title: t("adminHeroTitle"),
          subtitle: t("adminHeroSubtitle"),
          badges: <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" /> {agentCountDisplay}</span>,
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
            disabled: isReadOnly || (mode === "candidate" && !focusedCandidate.trim()),
            icon: <BadgeCheck size={17} />,
          },
        }}
        drawerToggleLabel={t("agentDirectoryTitle")}
        drawer={{ title: t("agentDirectoryTitle"), children: drawer }}
      />
    </div>
  );
}
