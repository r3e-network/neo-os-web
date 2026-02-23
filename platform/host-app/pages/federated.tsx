import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { FederatedMiniApp as FederatedMiniAppRenderer } from "../components/FederatedMiniApp";
import { installMiniAppSDK } from "../lib/miniapp-sdk";
import { coerceMiniAppInfo } from "../lib/miniapp";
import { logger } from "../lib/logger";

export default function FederatedMiniApp() {
  const router = useRouter();
  const appId = typeof router.query.app === "string" ? router.query.app : undefined;
  const view = typeof router.query.view === "string" ? router.query.view : undefined;
  const remote = typeof router.query.remote === "string" ? router.query.remote : undefined;
  useEffect(() => {
    if (!appId) return;
    let mounted = true;

    const loadPermissions = async () => {
      try {
        const res = await fetch(`/api/miniapp-stats?app_id=${encodeURIComponent(appId)}`, { signal: AbortSignal.timeout(30000) });
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
      } catch (err) {
        logger.warn("Failed to load miniapp permissions:", err);
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
      <main className="p-6 font-sans max-w-[960px]">
        <h1 className="mb-3">Federated MiniApp Host</h1>
        <p className="mb-3 text-sm">
          Platform MiniApps can be served as Module Federation remotes. This page loads the <code>miniapp/App</code>{" "}
          module from the configured remote.
        </p>
        <div className="mb-3 text-xs">
          <div>
            <strong>Expected remote:</strong> <code>{remote || "miniapp"}</code> exposing <code>./App</code>
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
