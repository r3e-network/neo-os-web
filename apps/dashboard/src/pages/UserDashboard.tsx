import { useMemo } from "react";
import { SystemState } from "../hooks/useSystemInfo";
import { Account } from "../api";

type ServiceCard = {
  id: string;
  name: string;
  description: string;
  domain: string;
  status: "active" | "inactive" | "degraded";
  icon: string;
};

type Props = {
  systemState: SystemState;
  accounts: Account[];
  onSelectAccount: (accountId: string) => void;
  onServiceClick: (serviceId: string) => void;
};

const SERVICE_INFO: Record<string, { description: string; icon: string }> = {
  oracle: { description: "Fetch external data for smart contracts", icon: "globe" },
  vrf: { description: "Verifiable random number generation", icon: "dice" },
  functions: { description: "Serverless compute for Web3", icon: "code" },
  datafeeds: { description: "Real-time price and data feeds", icon: "chart" },
  pricefeeds: { description: "Token price oracle data", icon: "dollar" },
  automation: { description: "Schedule and automate tasks", icon: "clock" },
  gasbank: { description: "Gas fee management and sponsorship", icon: "gas" },
  secrets: { description: "Secure secret storage", icon: "key" },
  ccip: { description: "Cross-chain interoperability", icon: "link" },
  datalink: { description: "Webhook and API integrations", icon: "webhook" },
  datastreams: { description: "Real-time data streaming", icon: "stream" },
  dta: { description: "Digital token assets", icon: "token" },
  confcompute: { description: "Confidential computing enclaves", icon: "shield" },
  cre: { description: "Compute runtime environment", icon: "server" },
  random: { description: "Secure random number service", icon: "random" },
};

export function UserDashboard({ systemState, accounts, onSelectAccount, onServiceClick }: Props) {
  const services = useMemo<ServiceCard[]>(() => {
    if (systemState.status !== "ready") return [];

    const descriptors = systemState.descriptors || [];
    const modules = systemState.modules || [];

    return descriptors.map((desc) => {
      const module = modules.find((m) => m.name === desc.name);
      const info = SERVICE_INFO[desc.domain] || { description: desc.domain, icon: "service" };

      let status: "active" | "inactive" | "degraded" = "inactive";
      if (module) {
        const moduleStatus = (module.status || "").toLowerCase();
        const readyStatus = (module.ready_status || "").toLowerCase();
        if (moduleStatus === "started" && readyStatus === "ready") {
          status = "active";
        } else if (moduleStatus.includes("fail") || moduleStatus.includes("error")) {
          status = "degraded";
        } else if (moduleStatus === "started") {
          status = "active";
        }
      }

      return {
        id: desc.name,
        name: desc.name,
        description: info.description,
        domain: desc.domain,
        status,
        icon: info.icon,
      };
    });
  }, [systemState]);

  const activeServices = services.filter((s) => s.status === "active").length;
  const degradedServices = services.filter((s) => s.status === "degraded").length;

  if (systemState.status === "idle") {
    return (
      <div className="user-dashboard">
        <div className="welcome-card">
          <h1>Welcome to Neo Service Layer</h1>
          <p>Configure your API endpoint and authentication in Settings to get started.</p>
          <p className="muted">
            Default: API <code>http://localhost:8080</code>, token <code>dev-token</code>
          </p>
        </div>
      </div>
    );
  }

  if (systemState.status === "loading") {
    return (
      <div className="user-dashboard">
        <div className="loading-card">
          <div className="spinner" />
          <p>Connecting to service layer...</p>
        </div>
      </div>
    );
  }

  if (systemState.status === "error") {
    return (
      <div className="user-dashboard">
        <div className="error-card">
          <h2>Connection Error</h2>
          <p>{systemState.message}</p>
          <p className="muted">Check your API endpoint and token in Settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="user-dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Service Dashboard</h1>
          <p className="muted">Access and manage your blockchain services</p>
        </div>
        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-value">{activeServices}</span>
            <span className="stat-label">Active Services</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{accounts.length}</span>
            <span className="stat-label">Accounts</span>
          </div>
          {degradedServices > 0 && (
            <div className="stat-card warning">
              <span className="stat-value">{degradedServices}</span>
              <span className="stat-label">Degraded</span>
            </div>
          )}
        </div>
      </header>

      <section className="services-section">
        <h2>Available Services</h2>
        <div className="services-grid">
          {services.map((service) => (
            <button
              key={service.id}
              className={`service-card ${service.status}`}
              onClick={() => onServiceClick(service.id)}
            >
              <div className="service-icon">
                <ServiceIcon name={service.icon} />
              </div>
              <div className="service-info">
                <h3>{service.name}</h3>
                <p>{service.description}</p>
                <span className={`service-status ${service.status}`}>
                  {service.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {accounts.length > 0 && (
        <section className="accounts-section">
          <h2>Your Accounts</h2>
          <div className="accounts-grid">
            {accounts.map((account) => (
              <button
                key={account.ID}
                className="account-card"
                onClick={() => onSelectAccount(account.ID)}
              >
                <div className="account-header">
                  <span className="account-id">{account.ID.slice(0, 8)}...</span>
                  {account.Metadata?.tenant && (
                    <span className="account-tenant">{account.Metadata.tenant}</span>
                  )}
                </div>
                <div className="account-owner">
                  <span className="label">Owner:</span>
                  <span className="value">{account.Owner}</span>
                </div>
                {account.CreatedAt && (
                  <div className="account-created">
                    Created: {new Date(account.CreatedAt).toLocaleDateString()}
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="quick-actions">
        <h2>Quick Actions</h2>
        <div className="actions-grid">
          <ActionCard
            title="Create Data Feed"
            description="Set up a new price or data feed"
            icon="chart"
            onClick={() => onServiceClick("datafeeds")}
          />
          <ActionCard
            title="Generate Random"
            description="Request verifiable random numbers"
            icon="dice"
            onClick={() => onServiceClick("vrf")}
          />
          <ActionCard
            title="Deploy Function"
            description="Deploy serverless compute functions"
            icon="code"
            onClick={() => onServiceClick("functions")}
          />
          <ActionCard
            title="Manage Gas"
            description="Top up and manage gas accounts"
            icon="gas"
            onClick={() => onServiceClick("gasbank")}
          />
        </div>
      </section>
    </div>
  );
}

function ServiceIcon({ name }: { name: string }) {
  const icons: Record<string, string> = {
    globe: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z",
    dice: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM7.5 18c-.83 0-1.5-.67-1.5-1.5S6.67 15 7.5 15s1.5.67 1.5 1.5S8.33 18 7.5 18zm0-9C6.67 9 6 8.33 6 7.5S6.67 6 7.5 6 9 6.67 9 7.5 8.33 9 7.5 9zm4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm0-9c-.83 0-1.5-.67-1.5-1.5S15.67 6 16.5 6s1.5.67 1.5 1.5S17.33 9 16.5 9z",
    code: "M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z",
    chart: "M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z",
    dollar: "M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z",
    clock: "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z",
    gas: "M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11c-.94.36-1.61 1.26-1.61 2.33 0 1.38 1.12 2.5 2.5 2.5.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1s-1-.45-1-1V14c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v16h10v-7.5h1.5v5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V9c0-.69-.28-1.32-.73-1.77zM12 10H6V5h6v5zm6 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z",
    key: "M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z",
    link: "M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z",
    webhook: "M17 16l-4-4V8.82C14.16 8.4 15 7.3 15 6c0-1.66-1.34-3-3-3S9 4.34 9 6c0 1.3.84 2.4 2 2.82V12l-4 4H3v5h5v-3.05l4-4.2 4 4.2V21h5v-5h-4z",
    stream: "M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z",
    token: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z",
    shield: "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z",
    server: "M20 13H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-6c0-.55-.45-1-1-1zM7 19c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM20 3H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1zM7 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z",
    random: "M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z",
    service: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z",
  };

  const path = icons[name] || icons.service;
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d={path} />
    </svg>
  );
}

function ActionCard({
  title,
  description,
  icon,
  onClick,
}: {
  title: string;
  description: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button className="action-card" onClick={onClick}>
      <ServiceIcon name={icon} />
      <h3>{title}</h3>
      <p>{description}</p>
    </button>
  );
}
