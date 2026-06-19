import { NeoButton } from "@shared/components-react";

interface EscrowExplainerProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  /**
   * "connect"     — no wallet yet: show the value pitch + a Connect CTA.
   * "unsupported" — wallet connected but the contract isn't configured on the
   *                 active network: show the value pitch + a network notice.
   */
  mode: "connect" | "unsupported";
  onConnectWallet: () => void;
}

/**
 * EscrowExplainer — the explanatory empty / disconnected state.
 *
 * Replaces the engineer-facing "deployment pending" card with a marketing +
 * how-it-works panel: a short value pitch, a three-step explainer, and a
 * read-only sample escrow that demonstrates the staged-release model (exact
 * amounts, asset, milestone status, and the no-fee disclosure) before the user
 * connects a wallet. This is display-only — every figure shown here is a fixed
 * illustrative sample and dispatches nothing.
 */
export default function EscrowExplainer({ t, mode, onConnectWallet }: EscrowExplainerProps) {
  const steps = [t("step1"), t("step2"), t("step3")];

  // Illustrative sample (display only, no contract call). Amounts are shown with
  // their exact units so the staged-release math is legible at a glance:
  // 5 + 3 + 2 GAS = 10 GAS total, with milestone 1 already approved & released.
  const sampleMilestones = [
    { n: 1, amount: "5", state: t("milestoneClaimedPill"), tone: "claimed" as const },
    { n: 2, amount: "3", state: t("milestoneApprovedPill"), tone: "approved" as const },
    { n: 3, amount: "2", state: t("milestonePendingPill"), tone: "pending" as const },
  ];

  return (
    <section className="escrow-intro" aria-label={t("howItWorks")}>
      <div className="escrow-intro__pitch">
        <h3 className="escrow-intro__headline">{t("introHeadline")}</h3>
        <p className="escrow-intro__lede">{t("introLede")}</p>

        <ol className="escrow-intro__steps">
          {steps.map((copy, i) => (
            <li key={i} className="escrow-intro__step">
              <span className="escrow-intro__step-num" aria-hidden="true">{i + 1}</span>
              <span className="escrow-intro__step-body">
                <span className="escrow-intro__step-kicker">{t("stepLabel", { n: i + 1 })}</span>
                <span className="escrow-intro__step-copy">{copy}</span>
              </span>
            </li>
          ))}
        </ol>

        <p className="escrow-intro__note" role="note">{t("noFeeNotice")}</p>

        {mode === "connect" ? (
          <div className="escrow-intro__cta">
            <NeoButton
              variant="primary"
              block
              aria-label={t("connectWallet")}
              onClick={onConnectWallet}
            >
              {t("connectWallet")}
            </NeoButton>
            <span className="escrow-intro__cta-hint">{t("connectToStart")}</span>
          </div>
        ) : (
          <div className="escrow-intro__network-notice" role="status">
            <span className="escrow-intro__network-title">{t("deploymentPendingTitle")}</span>
            <span className="escrow-intro__network-desc">{t("deploymentPendingDesc")}</span>
          </div>
        )}
      </div>

      {/* Read-only sample escrow: shows the staged-release model with exact
          amounts, asset, and per-milestone status before any wallet connects. */}
      <aside className="escrow-intro__preview" aria-label={t("previewLabel")}>
        <span className="escrow-intro__preview-tag">{t("previewLabel")}</span>
        <div className="escrow-preview-card" aria-hidden="false">
          <div className="escrow-preview-card__head">
            <span className="escrow-preview-card__title">{t("escrowNamePlaceholder")}</span>
            <span className="escrow-preview-card__status">{t("statusActive")}</span>
          </div>
          <span className="escrow-preview-card__meta">{t("previewNetwork")}</span>
          <div className="escrow-preview-card__amount-row">
            <span className="escrow-preview-card__amount">10 GAS</span>
            <span className="escrow-preview-card__released">
              {t("releasedOfTotal", { released: "5 GAS", total: "10 GAS" })}
            </span>
          </div>
          <ul className="escrow-preview-card__milestones">
            {sampleMilestones.map((m) => (
              <li key={m.n} className={`escrow-preview-milestone escrow-preview-milestone--${m.tone}`}>
                <span className="escrow-preview-milestone__label">{t("milestoneNumber", { n: m.n })}</span>
                <span className="escrow-preview-milestone__amount">{m.amount} GAS</span>
                <span className="escrow-preview-milestone__pill">{m.state}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </section>
  );
}
