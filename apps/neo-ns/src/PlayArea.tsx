/**
 * PlayArea.tsx -- Neo Name Service
 *
 * React version of the NNS play area with hero stats,
 * domain list, and domain management panel.
 */

import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { Domain } from "./hooks/useNeoNS";
import DomainManagement from "./components/DomainManagement";
import ManageDomain from "./components/ManageDomain";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { val, bool, str } = useStateBindings(state);

  const loading = bool("loading");
  const error = str("error", "");
  const myDomains = val<Domain[]>("myDomains", []);
  const managingDomain = val<Domain | null>("managingDomain", null);

  return (
    <div className="neo-ns-play-area">
      {/* Hero Section */}
      <div className="hero-container">
        <div className="hero-stats">
          <div className="hero-stat-item">
            <span className="hero-stat-value">{myDomains.length}</span>
            <span className="hero-stat-label">{t("tabDomains")}</span>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && <div className="error-banner">{error}</div>}

      {/* Domain Management */}
      {managingDomain ? (
        <ManageDomain
          t={t}
          domain={managingDomain}
          loading={loading}
          dispatch={dispatch}
        />
      ) : (
        <DomainManagement
          t={t}
          domains={myDomains}
          dispatch={dispatch}
        />
      )}
    </div>
  );
}
