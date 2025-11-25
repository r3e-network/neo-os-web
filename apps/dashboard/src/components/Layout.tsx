import { ReactNode } from "react";
import { Route } from "../Router";

type Props = {
  children: ReactNode;
  route: Route;
  onNavigate: (route: Route) => void;
  version?: string;
  connected: boolean;
  tenant?: string;
};

export function Layout({ children, route, onNavigate, version, connected, tenant }: Props) {
  return (
    <div className="layout">
      <nav className="nav-bar">
        <div className="nav-brand">
          <span className="nav-logo">Neo Service Layer</span>
          {version && <span className="nav-version">v{version}</span>}
        </div>
        <div className="nav-links">
          <button
            className={`nav-link ${route === "user" ? "active" : ""}`}
            onClick={() => onNavigate("user")}
          >
            Dashboard
          </button>
          <button
            className={`nav-link ${route === "admin" ? "active" : ""}`}
            onClick={() => onNavigate("admin")}
          >
            Admin
          </button>
          <button
            className={`nav-link ${route === "settings" ? "active" : ""}`}
            onClick={() => onNavigate("settings")}
          >
            Settings
          </button>
        </div>
        <div className="nav-status">
          <span className={`status-dot ${connected ? "connected" : "disconnected"}`} />
          <span className="status-text">{connected ? "Connected" : "Disconnected"}</span>
          {tenant && <span className="nav-tenant">Tenant: {tenant}</span>}
        </div>
      </nav>
      <main className="main-content">
        {children}
      </main>
      <footer className="footer">
        <span>Neo N3 Service Layer</span>
        <a href="https://github.com/R3E-Network/service_layer" target="_blank" rel="noreferrer">
          GitHub
        </a>
        <a href="https://github.com/R3E-Network/service_layer/blob/master/docs" target="_blank" rel="noreferrer">
          Documentation
        </a>
      </footer>
    </div>
  );
}
