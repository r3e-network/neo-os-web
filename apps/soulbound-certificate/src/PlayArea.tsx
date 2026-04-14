import { NeoButton, NeoCard } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import TemplateList from "./components/TemplateList";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { num, str, bool } = useStateBindings(state);

  const templatesCount = num("templatesCount");
  const certificatesCount = num("certificatesCount");
  const activeTemplatesCount = num("activeTemplatesCount");
  const templates = (state.templates?.get() ?? []) as unknown[];
  const certificates = (state.certificates?.get() ?? []) as unknown[];
  const address = str("address", "");
  const isRefreshing = bool("isRefreshing");
  const isLoading = bool("isLoading");
  const togglingId = state.togglingId?.get() as string | null;

  return (
    <div className="certificate-play-area">
      {/* Stats Bar */}
      <div className="hero-stats">
        <div className="hero-stat">
          <span className="hero-stat-value">{templatesCount}</span>
          <span className="hero-stat-label">{t("templatesTab") || "Templates"}</span>
        </div>
        <div className="hero-stat">
          <span className="hero-stat-value">{certificatesCount}</span>
          <span className="hero-stat-label">{t("certificatesTab") || "Certificates"}</span>
        </div>
        <div className="hero-stat">
          <span className="hero-stat-value">{activeTemplatesCount}</span>
          <span className="hero-stat-label">{t("sidebarActive") || "Active"}</span>
        </div>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <NeoCard variant="default" className="loading-card">
          <div className="loading-content">
            <div className="loading-spinner" />
            <span className="loading-text">{t("lookingUp") || "Loading..."}</span>
          </div>
        </NeoCard>
      )}

      {/* Template list with all actions */}
      <TemplateList
        templates={templates}
        refreshing={isRefreshing}
        togglingId={togglingId}
        hasAddress={!!address}
        onRefresh={() => dispatch("refreshTemplates")}
        onConnect={() => dispatch("connectWallet")}
        onIssue={(template: unknown) => dispatch("openIssueModal", template)}
        onToggle={(template: unknown) => dispatch("toggleTemplate", template)}
        onCopyIssueLink={(template: unknown) => dispatch("copyIssueLink", template)}
        onShareIssueLink={(template: unknown) => dispatch("shareIssueLink", template)}
        t={t}
      />

      {/* Certificates summary */}
      {certificates.length > 0 && (
        <NeoCard title={t("certificatesTab") || "My Certificates"} variant="default">
          <div className="certificates-grid">
            {(certificates as Array<Record<string, unknown>>).map((cert, idx) => (
              <div key={String(cert.tokenId ?? idx)} className="cert-item">
                <div className="cert-info">
                  <span className="cert-name">{String(cert.name || cert.templateName || `#${idx + 1}`)}</span>
                  {cert.recipientName && (
                    <span className="cert-recipient">{String(cert.recipientName)}</span>
                  )}
                </div>
                <span className={`cert-badge ${cert.revoked ? "revoked" : "valid"}`}>
                  {cert.revoked ? (t("certificateRevoked") || "Revoked") : (t("certificateValid") || "Valid")}
                </span>
              </div>
            ))}
          </div>
        </NeoCard>
      )}

      {/* Wallet connection prompt */}
      {!address && (
        <div className="connect-prompt">
          <NeoButton variant="primary" onClick={() => dispatch("connectWallet")}>
            {t("walletNotConnected") || "Connect Wallet"}
          </NeoButton>
        </div>
      )}
    </div>
  );
}
