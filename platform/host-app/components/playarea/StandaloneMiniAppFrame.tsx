import { useEffect, useRef, useState } from "react";

import { MiniAppBundleLoader } from "./MiniAppBundleLoader";
import {
  useEmbeddedCredentialBridge,
  useEmbeddedStorageBridge,
  useEmbeddedWalletBridge,
} from "./bridge";

const LOAD_TIMEOUT_MS = 20_000;
const SETTLE_MS = 400;

/**
 * A MiniApp filling the whole viewport, with nothing of the platform around it.
 *
 * This is what OneGate opens: the page is served by the platform host - so the
 * wallet, storage, and credential bridges, the sandbox policy, and the loading
 * state are the same ones the embedded workspace uses - but no navigation,
 * branding, or platform metadata is rendered. Inside the frame the visitor sees
 * only the app's own UI.
 */
export function StandaloneMiniAppFrame({
  appId,
  name,
  url,
  network,
  iconUrl,
  version,
}: {
  appId: string;
  name: string;
  url: string;
  network: "mainnet" | "testnet";
  iconUrl?: string | null;
  version?: string | null;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [showLoader, setShowLoader] = useState(true);
  const [timedOut, setTimedOut] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEmbeddedWalletBridge({ appId, iframeRef, network });
  useEmbeddedStorageBridge({ appId, iframeRef });
  useEmbeddedCredentialBridge({ appId, iframeRef });

  useEffect(() => {
    setLoaded(false);
    setShowLoader(true);
    setTimedOut(false);
  }, [url, attempt]);

  useEffect(() => {
    if (!loaded) return undefined;
    const timeout = window.setTimeout(() => setShowLoader(false), SETTLE_MS);
    return () => window.clearTimeout(timeout);
  }, [loaded]);

  useEffect(() => {
    if (loaded) return undefined;
    const timeout = window.setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [loaded, url, attempt]);

  const showFailure = showLoader && timedOut && !loaded;

  return (
    <div className="fixed inset-0 bg-[#faf9f7]">
      <iframe
        key={`${url}#${attempt}`}
        ref={iframeRef}
        title={name}
        src={url}
        data-testid="standalone-miniapp-frame"
        data-wallet-bridge="neo-miniapp-host"
        className={`h-full w-full border-0 bg-white transition-opacity duration-300 ${
          showLoader ? "opacity-0" : "opacity-100"
        }`}
        onLoad={() => setLoaded(true)}
        referrerPolicy="no-referrer-when-downgrade"
        /* Matches the embedded surface: the opaque-origin sandbox is what keeps
           a compromised bundle away from window.parent and host storage, and
           the goose game's opt-in motion gesture needs a wildcard container
           policy because named origins cannot match an opaque one. */
        allow={appId === "miniapp-zhuada-e" ? "accelerometer *; gyroscope *" : undefined}
        sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
      {showFailure ? (
        <div
          className="fixed inset-0 z-10 grid place-items-center bg-[#faf9f7] px-6 text-center"
          data-testid="standalone-miniapp-frame-error"
          role="status"
          aria-live="polite"
        >
          <div className="w-full max-w-sm">
            <p className="m-0 text-base font-semibold text-gray-900">
              {name} is taking longer than expected
            </p>
            <p className="m-0 mt-2 text-sm leading-6 text-gray-600">
              The bundle has not responded yet. Retry to request it again.
            </p>
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className="mt-4 inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-emerald-700 bg-emerald-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
              data-testid="standalone-miniapp-frame-retry"
            >
              Retry
            </button>
          </div>
        </div>
      ) : showLoader ? (
        <MiniAppBundleLoader
          name={name}
          iconUrl={iconUrl}
          version={version}
          variant="standalone"
          testId="standalone-miniapp-frame-loading"
        />
      ) : null}
    </div>
  );
}
