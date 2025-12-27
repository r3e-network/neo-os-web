import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { FederatedMiniApp as FederatedMiniAppRenderer } from "../components/FederatedMiniApp";
import { installMiniAppSDK } from "../lib/miniapp-sdk";
import { coerceMiniAppInfo } from "../lib/miniapp";

export default function FederatedMiniApp() {
  const router = useRouter();
  const appId = typeof router.query.app === "string" ? router.query.app : undefined;
  const view = typeof router.query.view === "string" ? router.query.view : undefined;
  const remote = typeof router.query.remote === "string" ? router.query.remote : undefined;
  const remotes = process.env.NEXT_PUBLIC_MF_REMOTES || "";

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
        installMiniAppSDK({ appId: info?.app_id ?? appId, permissions: info?.permissions });
      } catch {
        if (!mounted) return;
        installMiniAppSDK({ appId });
      }
    };

    loadPermissions();

    return () => {
      mounted = false;
    };
  }, [appId]);

  return (
    <>
      <Head>
        <title>Federated MiniApp Host</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main style={{ padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 960 }}>
        <h1 style={{ margin: "0 0 12px" }}>Federated MiniApp Host</h1>
        <p style={{ margin: "0 0 12px", fontSize: 14 }}>
          Built-in MiniApps can be served as Module Federation remotes. This page loads the <code>builtin/App</code>{" "}
          module from the configured remote.
        </p>
        <div style={{ marginBottom: 12, fontSize: 12 }}>
          <div>
            <strong>Expected remote:</strong> <code>{remote || "builtin"}</code> exposing <code>./App</code>
          </div>
          <div>
            <strong>NEXT_PUBLIC_MF_REMOTES:</strong> <code>{remotes || "not set"}</code>
          </div>
        </div>
        <FederatedMiniAppRenderer appId={appId} view={view} remote={remote} />
      </main>
    </>
  );
}

// Disable static generation - requires client-side router
export const getServerSideProps = async () => {
  return { props: {} };
};
