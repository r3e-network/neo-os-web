import { useEffect, useState } from "react";
import { useSecretsStore, SecretToken } from "@/lib/secrets";
import { useWalletStore } from "@/lib/wallet/store";
import { CreateTokenForm } from "./CreateTokenForm";

interface AppSecretsTabProps {
  appId: string;
  appName: string;
}

export function AppSecretsTab({ appId, appName }: AppSecretsTabProps) {
  const { connected } = useWalletStore();
  const { tokens, loading, fetchTokens, revokeToken } = useSecretsStore();
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (connected) {
      fetchTokens(appId);
    }
  }, [connected, appId, fetchTokens]);

  const appTokens = tokens.filter((t) => t.appId === appId || t.appId === "global");

  if (!connected) {
    return (
      <div style={containerStyle}>
        <p style={messageStyle}>Connect wallet to manage secrets for {appName}</p>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h3 style={titleStyle}>Secrets for {appName}</h3>
        <button style={createBtnStyle} onClick={() => setShowCreate(true)}>
          + Add Secret
        </button>
      </div>

      {showCreate && <CreateTokenForm onClose={() => setShowCreate(false)} defaultAppId={appId} />}

      {loading && <p style={messageStyle}>Loading...</p>}

      {!loading && appTokens.length === 0 && <p style={messageStyle}>No secrets configured for this app</p>}

      {appTokens.length > 0 && (
        <div style={listStyle}>
          {appTokens.map((token) => (
            <SecretItem key={token.id} token={token} onRevoke={revokeToken} />
          ))}
        </div>
      )}

      <div style={infoStyle}>
        <p>Secrets are encrypted and stored securely for TEE confidential computing.</p>
      </div>
    </div>
  );
}

function SecretItem({ token, onRevoke }: { token: SecretToken; onRevoke: (id: string) => void }) {
  const typeIcons: Record<string, string> = {
    api_key: "🔑",
    encryption_key: "🔐",
    custom: "📝",
  };

  return (
    <div style={itemStyle}>
      <div style={itemInfoStyle}>
        <span style={iconStyle}>{typeIcons[token.secretType] || "📝"}</span>
        <div>
          <div style={nameStyle}>{token.name}</div>
          <div style={metaStyle}>
            {token.appId === "global" ? "Global" : token.appId} • {token.secretType}
          </div>
        </div>
      </div>
      <div style={actionsStyle}>
        <span style={statusStyle(token.status)}>{token.status}</span>
        {token.status === "active" && (
          <button style={revokeBtnStyle} onClick={() => onRevoke(token.id)}>
            Revoke
          </button>
        )}
      </div>
    </div>
  );
}

// Inline styles
const containerStyle: React.CSSProperties = { padding: "16px 0" };
const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 16,
};
const titleStyle: React.CSSProperties = { fontSize: 18, fontWeight: 600, margin: 0 };
const createBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  background: "#3b82f6",
  color: "white",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
};
const messageStyle: React.CSSProperties = { color: "#6b7280", textAlign: "center", padding: 24 };
const listStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 12 };
const itemStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: 12,
  background: "#f9fafb",
  borderRadius: 8,
};
const itemInfoStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12 };
const iconStyle: React.CSSProperties = { fontSize: 24 };
const nameStyle: React.CSSProperties = { fontWeight: 500 };
const metaStyle: React.CSSProperties = { fontSize: 12, color: "#6b7280" };
const actionsStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8 };
const statusStyle = (status: string): React.CSSProperties => ({
  fontSize: 12,
  padding: "2px 8px",
  borderRadius: 4,
  background: status === "active" ? "#dcfce7" : "#fee2e2",
  color: status === "active" ? "#166534" : "#991b1b",
});
const revokeBtnStyle: React.CSSProperties = {
  padding: "4px 8px",
  fontSize: 12,
  background: "transparent",
  border: "1px solid #ef4444",
  color: "#ef4444",
  borderRadius: 4,
  cursor: "pointer",
};
const infoStyle: React.CSSProperties = {
  marginTop: 16,
  padding: 12,
  background: "#eff6ff",
  borderRadius: 8,
  fontSize: 13,
  color: "#1e40af",
};
