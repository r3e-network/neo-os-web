import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, type CSSProperties } from "react";
import { FederatedMiniApp as FederatedMiniAppRenderer } from "../components/FederatedMiniApp";
import { MiniAppFrame } from "../components/features/miniapp";
import { installMiniAppSDK } from "../lib/miniapp-sdk";
import { coerceMiniAppInfo, getContractForChain } from "../lib/miniapp";
import type { ChainId } from "../lib/chains/types";
import { useMiniAppLayout } from "../hooks/useMiniAppLayout";
// Chain configuration comes from MiniApp manifest only - no environment defaults

/** Get effective chainId from app manifest - returns null if app has no chain support */
function getEffectiveChainId(supportedChains?: ChainId[]): ChainId | null {
  if (supportedChains && supportedChains.length > 0) {
    return supportedChains[0];
  }
  return null;
}

export default function FederatedMiniApp() {
  const router = useRouter();
  const appId = typeof router.query.app === "string" ? router.query.app : undefined;
  const view = typeof router.query.view === "string" ? router.query.view : undefined;
  const remote = typeof router.query.remote === "string" ? router.query.remote : undefined;
  const remotes = process.env.NEXT_PUBLIC_MF_REMOTES || "";
  const layout = useMiniAppLayout(router.query.layout);

  useEffect(() => {
    if (!appId) return;
    let mounted = true;

    const loadPermissions = async () => {
      try {
        const res = await fetch(`/api/miniapp-stats?app_id=${encodeURIComponent(appId)}`);
        const payload = await res.json();
        const list = Array.isArray(payload?.stats)
          ? payload.stats
          : Array.isArray(payload)
            ? payload
            : payload
              ? [payload]
              : [];
        const info = coerceMiniAppInfo(list[0]);
        if (!mounted) return;
        const chainId = getEffectiveChainId(info?.supportedChains);
        const contractAddress = info ? getContractForChain(info, chainId) : null;
        installMiniAppSDK({
          appId: info?.app_id ?? appId,
          chainId,
          contractAddress,
          permissions: info?.permissions,
          layout,
        });
      } catch {
        if (!mounted) return;
        installMiniAppSDK({ appId, chainId: getEffectiveChainId(), layout });
      }
    };

    loadPermissions();

    return () => {
      mounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId]);

  return (
    <>
      <Head>
        <title>Federated MiniApp Host</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main style={pageStyle}>
        <header style={headerStyle}>
          <div style={headerInnerStyle}>
            <h1 style={titleStyle}>Federated MiniApp Host</h1>
            <p style={subtitleStyle}>
              Built-in MiniApps can be served as Module Federation remotes. This page loads the <code>builtin/App</code>{" "}
              module from the configured remote.
            </p>
            <div style={metaStyle}>
              <div>
                <strong>Expected remote:</strong> <code>{remote || "builtin"}</code> exposing <code>./App</code>
              </div>
              <div>
                <strong>NEXT_PUBLIC_MF_REMOTES:</strong> <code>{remotes || "not set"}</code>
              </div>
            </div>
          </div>
        </header>
        <section style={frameAreaStyle}>
          <MiniAppFrame layout={layout}>
            <div className="w-full h-full overflow-y-auto overflow-x-hidden">
              <FederatedMiniAppRenderer appId={appId} view={view} remote={remote} layout={layout} />
            </div>
          </MiniAppFrame>
        </section>
      </main>
    </>
  );
}

// Disable static generation - requires client-side router
export const getServerSideProps = async () => {
  return { props: {} };
};

const pageStyle: CSSProperties = {
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  background: "#000",
  color: "#e5e5e5",
  fontFamily: "system-ui, sans-serif",
};

const headerStyle: CSSProperties = {
  padding: 24,
  borderBottom: "1px solid #1f1f1f",
  background: "#0a0a0a",
};

const headerInnerStyle: CSSProperties = {
  maxWidth: 960,
  margin: "0 auto",
};

const titleStyle: CSSProperties = {
  margin: "0 0 12px",
};

const subtitleStyle: CSSProperties = {
  margin: "0 0 12px",
  fontSize: 14,
  color: "#b3b3b3",
};

const metaStyle: CSSProperties = {
  marginBottom: 0,
  fontSize: 12,
  color: "#9ca3af",
};

const frameAreaStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  padding: 24,
  background: "#000",
};
