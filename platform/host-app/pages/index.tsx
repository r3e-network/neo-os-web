import Head from "next/head";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

// ============================================================================
// Types
// ============================================================================

type MiniAppInfo = {
  app_id: string;
  name: string;
  description: string;
  icon: string;
  category: "gaming" | "defi" | "governance" | "utility";
  entry_url: string;
  permissions: {
    payments?: boolean;
    governance?: boolean;
    randomness?: boolean;
    datafeed?: boolean;
  };
  limits?: {
    max_gas_per_tx?: string;
    daily_gas_cap_per_user?: string;
  };
};

type WalletState = {
  connected: boolean;
  address: string;
  provider: "neoline" | "o3" | "onegate" | null;
  balance?: { neo: string; gas: string };
};

// ============================================================================
// MiniApp Catalog
// ============================================================================

const MINIAPP_CATALOG: MiniAppInfo[] = [
  {
    app_id: "builtin-lottery",
    name: "Neo Lottery",
    description: "Decentralized lottery with provably fair randomness",
    icon: "🎰",
    category: "gaming",
    entry_url: "/miniapps/builtin/lottery/index.html",
    permissions: { payments: true, randomness: true },
    limits: { max_gas_per_tx: "1", daily_gas_cap_per_user: "10" },
  },
  {
    app_id: "builtin-coin-flip",
    name: "Coin Flip",
    description: "50/50 coin flip - double your GAS with on-chain randomness",
    icon: "🪙",
    category: "gaming",
    entry_url: "/miniapps/builtin/coin-flip/index.html",
    permissions: { payments: true, randomness: true },
    limits: { max_gas_per_tx: "1", daily_gas_cap_per_user: "10" },
  },
  {
    app_id: "builtin-dice-game",
    name: "Dice Game",
    description: "Roll the dice and win up to 6x your bet",
    icon: "🎲",
    category: "gaming",
    entry_url: "/miniapps/builtin/dice-game/index.html",
    permissions: { payments: true, randomness: true },
    limits: { max_gas_per_tx: "0.5", daily_gas_cap_per_user: "5" },
  },
  {
    app_id: "builtin-scratch-card",
    name: "Scratch Card",
    description: "Scratch to reveal instant prizes",
    icon: "🎫",
    category: "gaming",
    entry_url: "/miniapps/builtin/scratch-card/index.html",
    permissions: { payments: true, randomness: true },
    limits: { max_gas_per_tx: "0.2", daily_gas_cap_per_user: "2" },
  },
  {
    app_id: "builtin-gas-spin",
    name: "Gas Spin",
    description: "Spin the wheel for GAS prizes",
    icon: "🎡",
    category: "gaming",
    entry_url: "/miniapps/builtin/gas-spin/index.html",
    permissions: { payments: true, randomness: true },
    limits: { max_gas_per_tx: "0.5", daily_gas_cap_per_user: "5" },
  },
  {
    app_id: "builtin-prediction-market",
    name: "Prediction Market",
    description: "Bet on real-world events with oracle price feeds",
    icon: "📊",
    category: "defi",
    entry_url: "/miniapps/builtin/prediction-market/index.html",
    permissions: { payments: true, datafeed: true },
    limits: { max_gas_per_tx: "1", daily_gas_cap_per_user: "10" },
  },
  {
    app_id: "builtin-price-predict",
    name: "Price Predict",
    description: "Predict GAS price movement and win",
    icon: "📈",
    category: "defi",
    entry_url: "/miniapps/builtin/price-predict/index.html",
    permissions: { payments: true, datafeed: true },
    limits: { max_gas_per_tx: "0.3", daily_gas_cap_per_user: "3" },
  },
  {
    app_id: "builtin-price-ticker",
    name: "Price Ticker",
    description: "Real-time GAS/NEO price from oracle feeds",
    icon: "💹",
    category: "utility",
    entry_url: "/miniapps/builtin/price-ticker/index.html",
    permissions: { datafeed: true },
  },
  {
    app_id: "builtin-flashloan",
    name: "Flash Loan",
    description: "Borrow GAS instantly with 0.09% fee",
    icon: "⚡",
    category: "defi",
    entry_url: "/miniapps/builtin/flashloan/index.html",
    permissions: { payments: true },
    limits: { max_gas_per_tx: "1", daily_gas_cap_per_user: "10" },
  },
  {
    app_id: "builtin-secret-vote",
    name: "Secret Vote",
    description: "Vote on governance proposals with NEO",
    icon: "🗳️",
    category: "governance",
    entry_url: "/miniapps/builtin/secret-vote/index.html",
    permissions: { payments: true, governance: true },
    limits: { max_gas_per_tx: "0.1", daily_gas_cap_per_user: "1" },
  },
];

const CATEGORY_INFO: Record<string, { label: string; color: string }> = {
  gaming: { label: "Gaming", color: "#f39c12" },
  defi: { label: "DeFi", color: "#3498db" },
  governance: { label: "Governance", color: "#9b59b6" },
  utility: { label: "Utility", color: "#2ecc71" },
};

// ============================================================================
// Wallet Integration
// ============================================================================

async function detectNeoWallet(): Promise<WalletState["provider"]> {
  if (typeof window === "undefined") return null;
  const g = window as any;

  if (g?.NEOLineN3?.Init) return "neoline";
  if (g?.NEOLineN3) return "neoline";
  if (g?.neo3Dapi) return "o3";
  if (g?.OneGate) return "onegate";

  return null;
}

async function connectNeoLineWallet(): Promise<{ address: string; publicKey?: string }> {
  const g = window as any;
  const neoline = g?.NEOLineN3;

  if (!neoline?.Init) {
    throw new Error("NeoLine N3 not detected. Please install the NeoLine extension.");
  }

  const inst = new neoline.Init();
  const account = await inst.getAccount();
  const address = account?.address || account?.account?.address;

  if (!address) {
    throw new Error("Failed to get wallet address");
  }

  return { address, publicKey: account?.publicKey };
}

async function connectO3Wallet(): Promise<{ address: string }> {
  const g = window as any;
  const neo3Dapi = g?.neo3Dapi;

  if (!neo3Dapi) {
    throw new Error("O3 wallet not detected. Please install the O3 extension.");
  }

  const account = await neo3Dapi.getAccount();
  return { address: account.address };
}

async function getWalletBalance(address: string): Promise<{ neo: string; gas: string }> {
  // For now, return placeholder - in production, query RPC
  return { neo: "0", gas: "0" };
}

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0a0e1a 0%, #1a1f35 50%, #0d1225 100%)",
    color: "#e7ecff",
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 24px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(0,0,0,0.2)",
    backdropFilter: "blur(10px)",
    position: "sticky" as const,
    top: 0,
    zIndex: 100,
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    fontSize: 20,
    fontWeight: 700,
    color: "#00d4aa",
  },
  walletBtn: {
    padding: "10px 20px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(135deg, #00d4aa, #00a080)",
    color: "white",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  walletConnected: {
    padding: "10px 20px",
    borderRadius: 12,
    border: "1px solid rgba(0,212,170,0.3)",
    background: "rgba(0,212,170,0.1)",
    color: "#00d4aa",
    fontWeight: 500,
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  main: {
    padding: "32px 24px",
    maxWidth: 1400,
    margin: "0 auto",
  },
  heroSection: {
    textAlign: "center" as const,
    marginBottom: 48,
  },
  heroTitle: {
    fontSize: 42,
    fontWeight: 800,
    marginBottom: 16,
    background: "linear-gradient(135deg, #00d4aa, #3498db)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  heroSubtitle: {
    fontSize: 18,
    color: "#8892b0",
    maxWidth: 600,
    margin: "0 auto",
  },
  filterBar: {
    display: "flex",
    gap: 12,
    marginBottom: 32,
    flexWrap: "wrap" as const,
    justifyContent: "center",
  },
  filterBtn: {
    padding: "8px 16px",
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.05)",
    color: "#8892b0",
    cursor: "pointer",
    fontSize: 14,
    transition: "all 0.2s",
  },
  filterBtnActive: {
    background: "rgba(0,212,170,0.2)",
    borderColor: "#00d4aa",
    color: "#00d4aa",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: 24,
  },
  card: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 24,
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  cardHover: {
    transform: "translateY(-4px)",
    borderColor: "rgba(0,212,170,0.4)",
    boxShadow: "0 12px 40px rgba(0,212,170,0.15)",
  },
  cardIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 600,
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 14,
    color: "#8892b0",
    marginBottom: 16,
    lineHeight: 1.5,
  },
  cardCategory: {
    display: "inline-block",
    padding: "4px 12px",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 500,
  },
  cardPermissions: {
    display: "flex",
    gap: 8,
    marginTop: 12,
    flexWrap: "wrap" as const,
  },
  permBadge: {
    padding: "2px 8px",
    borderRadius: 6,
    fontSize: 11,
    background: "rgba(255,255,255,0.05)",
    color: "#8892b0",
  },
  // MiniApp Runner styles
  runnerOverlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.9)",
    zIndex: 200,
    display: "flex",
    flexDirection: "column" as const,
  },
  runnerHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 20px",
    background: "rgba(255,255,255,0.05)",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
  },
  runnerTitle: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    fontSize: 18,
    fontWeight: 600,
  },
  closeBtn: {
    padding: "8px 16px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "transparent",
    color: "#e7ecff",
    cursor: "pointer",
    fontSize: 14,
  },
  iframe: {
    flex: 1,
    border: "none",
    background: "#0b1020",
  },
};

// ============================================================================
// Components
// ============================================================================

function MiniAppCard({ app, onClick }: { app: MiniAppInfo; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const cat = CATEGORY_INFO[app.category];

  return (
    <div
      style={{ ...styles.card, ...(hovered ? styles.cardHover : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <div style={styles.cardIcon}>{app.icon}</div>
      <div style={styles.cardTitle}>{app.name}</div>
      <div style={styles.cardDesc}>{app.description}</div>
      <span
        style={{
          ...styles.cardCategory,
          background: `${cat.color}20`,
          color: cat.color,
        }}
      >
        {cat.label}
      </span>
      <div style={styles.cardPermissions}>
        {app.permissions.payments && <span style={styles.permBadge}>💰 Payments</span>}
        {app.permissions.randomness && <span style={styles.permBadge}>🎲 RNG</span>}
        {app.permissions.datafeed && <span style={styles.permBadge}>📊 Oracle</span>}
        {app.permissions.governance && <span style={styles.permBadge}>🗳️ Governance</span>}
      </div>
    </div>
  );
}

function MiniAppRunner({ app, wallet, onClose }: { app: MiniAppInfo; wallet: WalletState; onClose: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Inject SDK into iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      try {
        const iframeWindow = iframe.contentWindow;
        if (!iframeWindow) return;

        // Create MiniAppSDK object
        (iframeWindow as any).MiniAppSDK = {
          wallet: {
            getAddress: async () => wallet.address || "",
            isConnected: () => wallet.connected,
          },
          payments: {
            payGAS: async (appId: string, amount: number, memo: string) => {
              console.log("payGAS:", { appId, amount, memo });
              // In production, this would trigger wallet transaction
              return { txHash: "0x" + Math.random().toString(16).slice(2) };
            },
          },
          governance: {
            vote: async (appId: string, proposalId: number, neoAmount: number, support: boolean) => {
              console.log("vote:", { appId, proposalId, neoAmount, support });
              return { txHash: "0x" + Math.random().toString(16).slice(2) };
            },
          },
          rng: {
            requestRandom: async (appId: string) => {
              console.log("requestRandom:", { appId });
              return { random: Math.random().toString(16).slice(2) };
            },
          },
          datafeed: {
            getPrice: async (symbol: string) => {
              console.log("getPrice:", { symbol });
              return { price: (Math.random() * 10 + 5).toFixed(4) };
            },
          },
        };
      } catch (e) {
        console.error("Failed to inject SDK:", e);
      }
    };

    iframe.addEventListener("load", handleLoad);
    return () => iframe.removeEventListener("load", handleLoad);
  }, [wallet]);

  return (
    <div style={styles.runnerOverlay}>
      <div style={styles.runnerHeader}>
        <div style={styles.runnerTitle}>
          <span>{app.icon}</span>
          <span>{app.name}</span>
        </div>
        <button style={styles.closeBtn} onClick={onClose}>
          ✕ Close
        </button>
      </div>
      <iframe ref={iframeRef} src={app.entry_url} style={styles.iframe} sandbox="allow-scripts allow-same-origin" />
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

function HomeContent() {
  const [wallet, setWallet] = useState<WalletState>({
    connected: false,
    address: "",
    provider: null,
  });
  const [filter, setFilter] = useState<string>("all");
  const [activeApp, setActiveApp] = useState<MiniAppInfo | null>(null);
  const [connecting, setConnecting] = useState(false);

  // Detect wallet on mount
  useEffect(() => {
    detectNeoWallet().then((provider) => {
      if (provider) {
        console.log("Detected wallet provider:", provider);
      }
    });
  }, []);

  const handleConnectWallet = useCallback(async () => {
    setConnecting(true);
    try {
      const provider = await detectNeoWallet();
      if (!provider) {
        alert("No Neo N3 wallet detected. Please install NeoLine or O3.");
        return;
      }

      let result: { address: string };
      if (provider === "neoline") {
        result = await connectNeoLineWallet();
      } else if (provider === "o3") {
        result = await connectO3Wallet();
      } else {
        throw new Error("Unsupported wallet provider");
      }

      setWallet({
        connected: true,
        address: result.address,
        provider,
      });
    } catch (err: any) {
      alert(err.message || "Failed to connect wallet");
    } finally {
      setConnecting(false);
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    setWallet({ connected: false, address: "", provider: null });
  }, []);

  const filteredApps = filter === "all" ? MINIAPP_CATALOG : MINIAPP_CATALOG.filter((app) => app.category === filter);

  return (
    <>
      <Head>
        <title>Neo MiniApp Marketplace</title>
        <meta name="description" content="Discover and use decentralized MiniApps on Neo N3" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={styles.container}>
        {/* Header */}
        <header style={styles.header}>
          <div style={styles.logo}>
            <span>🌐</span>
            <span>Neo MiniApps</span>
          </div>

          {wallet.connected ? (
            <div style={styles.walletConnected} onClick={handleDisconnect}>
              <span>🟢</span>
              <span>
                {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}
              </span>
            </div>
          ) : (
            <button style={styles.walletBtn} onClick={handleConnectWallet} disabled={connecting}>
              {connecting ? "Connecting..." : "🔗 Connect Wallet"}
            </button>
          )}
        </header>

        {/* Main Content */}
        <main style={styles.main}>
          {/* Hero Section */}
          <section style={styles.heroSection}>
            <h1 style={styles.heroTitle}>Neo MiniApp Marketplace</h1>
            <p style={styles.heroSubtitle}>
              Discover decentralized apps powered by Neo N3. Connect your wallet to play games, trade, vote, and more
              with on-chain security.
            </p>
          </section>

          {/* Filter Bar */}
          <div style={styles.filterBar}>
            {["all", "gaming", "defi", "governance", "utility"].map((cat) => (
              <button
                key={cat}
                style={{
                  ...styles.filterBtn,
                  ...(filter === cat ? styles.filterBtnActive : {}),
                }}
                onClick={() => setFilter(cat)}
              >
                {cat === "all" ? "All Apps" : CATEGORY_INFO[cat]?.label || cat}
              </button>
            ))}
          </div>

          {/* MiniApp Grid */}
          <div style={styles.grid}>
            {filteredApps.map((app) => (
              <MiniAppCard key={app.app_id} app={app} onClick={() => setActiveApp(app)} />
            ))}
          </div>
        </main>
      </div>

      {/* MiniApp Runner Overlay */}
      {activeApp && <MiniAppRunner app={activeApp} wallet={wallet} onClose={() => setActiveApp(null)} />}
    </>
  );
}

// Disable SSR to avoid hydration issues
export default dynamic(() => Promise.resolve(HomeContent), { ssr: false });
