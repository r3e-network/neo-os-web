import type { GetServerSideProps } from "next";
import Head from "next/head";

import { StandaloneMiniAppFrame } from "../../components/playarea/StandaloneMiniAppFrame";
import { isArchivedMiniAppId } from "@/lib/archived-miniapps";
import { loadBundledMiniAppById } from "@/lib/miniapp-definitions";
import {
  buildLocalBundleEntryUrl,
  findMiniAppCdnApp,
  resolveMiniAppBundle,
} from "@/lib/miniapp-cdn";
import { resolveMiniAppDetailRouteId } from "@/lib/miniapp-detail-helpers";
import { normalizeNeoNetwork } from "@/lib/neo-network";
import { getRpcNetwork } from "@/lib/rpc-helpers";

type PlayPageProps = {
  appId: string;
  name: string;
  url: string;
  network: "mainnet" | "testnet";
  iconUrl: string | null;
  version: string | null;
};

/**
 * The chrome-free launch surface.
 *
 * OneGate points at this route rather than at a raw CDN bundle URL, which keeps
 * the wallet/storage/credential bridges, the sandbox policy, and the loading
 * state under the platform's control while showing the visitor nothing but the
 * app itself. No navigation, no branding, no platform metadata - the page is a
 * single full-viewport frame.
 *
 * It deliberately renders no <Layout>: chrome in this host is opt-in per page,
 * so omitting it is what makes the surface bare.
 */
export default function PlayPage({
  appId,
  name,
  url,
  network,
  iconUrl,
  version,
}: PlayPageProps) {
  return (
    <>
      <Head>
        {/* The app's own name only - naming the platform here would put platform
            branding in the OneGate title bar. */}
        <title>{name}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="robots" content="noindex" />
      </Head>
      <StandaloneMiniAppFrame
        appId={appId}
        name={name}
        url={url}
        network={network}
        iconUrl={iconUrl}
        version={version}
      />
    </>
  );
}

function firstQueryValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export const getServerSideProps: GetServerSideProps<PlayPageProps> = async (context) => {
  const routeParams = context.params as { id: string };
  const id = resolveMiniAppDetailRouteId(routeParams.id);
  if (!id || isArchivedMiniAppId(id)) return { notFound: true };

  const network =
    normalizeNeoNetwork(
      firstQueryValue(context.query.network as string | string[] | undefined) ||
        firstQueryValue(context.query.chain as string | string[] | undefined),
    ) || getRpcNetwork();

  // The CDN catalogue is the authority once apps live in their own repos; the
  // bundled definition is the fallback that keeps local development and the E2E
  // suite working without a live CDN.
  const cdnApp = await findMiniAppCdnApp(id);
  const bundled = cdnApp ? null : await loadBundledMiniAppById(id);
  if (!cdnApp && !bundled) return { notFound: true };

  const slug = cdnApp?.slug || id.replace(/^miniapp-/, "");
  const resolved = cdnApp
    ? { entry_url: cdnApp.entry_url, version: cdnApp.version }
    : await resolveMiniAppBundle(slug);

  const entryUrl =
    resolved.entry_url ||
    (bundled?.dapp_url as string | undefined) ||
    buildLocalBundleEntryUrl(slug);

  // `source=standalone` tells the app shell it owns the whole viewport, so it
  // renders its own header instead of the trimmed embedded layout.
  const separator = entryUrl.includes("?") ? "&" : "?";
  const params = new URLSearchParams({ network, source: "standalone" });
  for (const [key, value] of Object.entries(context.query)) {
    if (key === "id" || key === "network" || key === "chain" || key === "source") continue;
    const single = firstQueryValue(value as string | string[] | undefined);
    if (single) params.set(key, single);
  }

  return {
    props: {
      appId: cdnApp?.app_id || bundled?.app_id || id,
      name: cdnApp?.name || bundled?.name || slug,
      url: `${entryUrl}${separator}${params.toString()}`,
      network,
      iconUrl: cdnApp?.icon_url || (bundled?.logo_url as string | undefined) || null,
      version: ("version" in resolved ? resolved.version : null) || null,
    },
  };
};
