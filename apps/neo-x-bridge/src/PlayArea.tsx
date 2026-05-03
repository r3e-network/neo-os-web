import {
  Activity,
  ArrowLeftRight,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Copy,
  ExternalLink,
  RadioTower,
  Route,
  ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { NeoButton, NeoCard } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { PlayAreaProps } from "@shared/react/defineMiniApp";
import {
  BRIDGE_RESOURCES,
  compactHash,
  type BridgeOperation,
  type TimelineStep,
} from "./bridgeConsole";
import "./PlayArea.scss";

const EMPTY_OPERATIONS: BridgeOperation[] = [];
const EMPTY_TIMELINE: TimelineStep[] = [];

export default function PlayArea({ t, state, services }: PlayAreaProps) {
  const { str, val } = useStateBindings(state);
  const lastRoute = str("lastRoute", "Neo N3 -> Neo X");
  const lastKind = str("lastKind", "asset");
  const lastDigest = str("lastDigest", t("notAvailable"));
  const lastStatus = str("lastStatus", t("statusReady"));
  const payload = str("lastPayload", t("emptyPayload"));
  const operations = val<BridgeOperation[]>("operationsLog", EMPTY_OPERATIONS) ?? EMPTY_OPERATIONS;
  const timeline = val<TimelineStep[]>("timeline", EMPTY_TIMELINE) ?? EMPTY_TIMELINE;

  const activeOperation = operations[0] ?? null;

  async function copyPayload() {
    await services.clipboard.copy(payload, "copiedPayload");
  }

  return (
    <div className="neo-x-bridge-play-area">
      <section className="bridge-console-hero" aria-label="Neo X bridge overview">
        <div className="bridge-hero-copy">
          <span className="bridge-eyebrow">AxLabs / BaneLabs Bridge Console</span>
          <h2>Neo N3 and Neo X cross-chain control</h2>
          <p>
            One production-facing surface for GAS bridging, arbitrary MessageBridge payloads,
            and lifecycle tracking from source transaction to destination finalization.
          </p>
        </div>
        <div className="bridge-route-card" aria-label="Active route">
          <div className="route-node">
            <span>Neo N3</span>
            <small>NEP-21 / NeoLine</small>
          </div>
          <ArrowLeftRight size={22} aria-hidden="true" />
          <div className="route-node">
            <span>Neo X</span>
            <small>EVM / MetaMask</small>
          </div>
        </div>
      </section>

      <div className="bridge-health-grid" aria-label="Bridge console status">
        <Metric icon={<Route size={17} />} label="Route" value={lastRoute} />
        <Metric icon={<RadioTower size={17} />} label="Bridge Type" value={lastKind} />
        <Metric icon={<Activity size={17} />} label="Status" value={lastStatus} />
        <Metric icon={<ShieldCheck size={17} />} label="Digest" value={compactHash(lastDigest)} mono />
      </div>

      <div className="bridge-workbench">
        <NeoCard variant="erobo" className="bridge-module-card">
          <div className="module-heading">
            <span className="module-kicker">Asset Bridge</span>
            <h3>GAS deposit and withdrawal intent</h3>
          </div>
          <p>
            The asset panel prepares the official Neo X bridge flow around GAS.
            Direction, amount, recipient, wallet requirement, and BaneLabs testnet handoff
            are captured in one auditable payload before signing.
          </p>
          <div className="module-steps" aria-label="Asset bridge flow">
            <FlowPill label="Prepare" active />
            <FlowPill label="Sign source tx" />
            <FlowPill label="Relayer observes" />
            <FlowPill label="Finalize" />
          </div>
        </NeoCard>

        <NeoCard variant="erobo" className="bridge-module-card">
          <div className="module-heading">
            <span className="module-kicker">Message Bridge</span>
            <h3>Contract message payloads</h3>
          </div>
          <p>
            Message intents include target contract, method, payload digest, gas limit,
            and SDK metadata for the BaneLabs MessageBridge path. This keeps data
            relay separate from token movement.
          </p>
          <div className="module-steps" aria-label="Message bridge flow">
            <FlowPill label="Encode" active={lastKind === "message"} />
            <FlowPill label="Nonce/root" />
            <FlowPill label="Attest" />
            <FlowPill label="Deliver" />
          </div>
        </NeoCard>
      </div>

      <div className="bridge-output-grid">
        <NeoCard
          variant="erobo"
          title="Generated bridge intent"
          className="bridge-output-card"
          header={
            <NeoButton size="sm" variant="ghost" aria-label="Copy generated JSON" onClick={copyPayload}>
              <Copy size={15} aria-hidden="true" />
              Copy
            </NeoButton>
          }
        >
          {activeOperation && (
            <div className="operation-summary">
              <span>{activeOperation.id}</span>
              <strong>{activeOperation.title}</strong>
            </div>
          )}
          <pre className="payload-preview">{payload}</pre>
        </NeoCard>

        <NeoCard variant="erobo" title="Operation status" className="bridge-status-card">
          <div className="timeline-list">
            {timeline.map((step) => (
              <div key={step.key} className={`timeline-step timeline-step--${step.state}`}>
                <span className="timeline-icon" aria-hidden="true">
                  {step.state === "done" ? (
                    <CheckCircle2 size={16} />
                  ) : step.state === "active" ? (
                    <Clock3 size={16} />
                  ) : (
                    <CircleDashed size={16} />
                  )}
                </span>
                <span className="timeline-copy">
                  <strong>{step.label}</strong>
                  <small>{step.detail}</small>
                </span>
              </div>
            ))}
          </div>
        </NeoCard>
      </div>

      <div className="bridge-resource-row" aria-label="Bridge resources">
        <ResourceLink label="Testnet Bridge" href={BRIDGE_RESOURCES.bridgeAppTestnet} />
        <ResourceLink label="Asset Bridge Docs" href={BRIDGE_RESOURCES.assetBridgeDocs} />
        <ResourceLink label="MessageBridge Docs" href={BRIDGE_RESOURCES.messageBridgeDocs} />
        <ResourceLink label="BaneLabs SDK" href={BRIDGE_RESOURCES.bridgeSdk} />
      </div>

      {operations.length > 0 && (
        <NeoCard variant="erobo" title="Recent operations" className="bridge-recent-card">
          <div className="recent-operation-list">
            {operations.map((operation) => (
              <div key={operation.id} className="recent-operation">
                <span className="recent-kind">{operation.kind}</span>
                <span className="recent-title">{operation.title}</span>
                <code>{compactHash(operation.digest)}</code>
              </div>
            ))}
          </div>
        </NeoCard>
      )}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="bridge-metric">
      <span className="metric-icon" aria-hidden="true">{icon}</span>
      <span className="metric-copy">
        <small>{label}</small>
        <strong className={mono ? "metric-value--mono" : undefined}>{value}</strong>
      </span>
    </div>
  );
}

function FlowPill({ label, active = false }: { label: string; active?: boolean }) {
  return <span className={`flow-pill${active ? " flow-pill--active" : ""}`}>{label}</span>;
}

function ResourceLink({ label, href }: { label: string; href: string }) {
  return (
    <a className="bridge-resource-link" href={href} target="_blank" rel="noreferrer">
      <span>{label}</span>
      <ExternalLink size={14} aria-hidden="true" />
    </a>
  );
}
