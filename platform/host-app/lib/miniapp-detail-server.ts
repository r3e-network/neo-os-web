import type { GetServerSideProps } from "next";
import { coerceMiniAppInfo } from "./miniapp";
import { fetchWithTimeout, resolveInternalBaseUrl } from "./edge";
import { loadBundledMiniAppById } from "./miniapp-definitions";
import {
  loadMiniAppCatalog,
  resolveCatalogNetwork,
  supportsCatalogNetwork,
} from "./miniapp-catalog";
import { isArchivedMiniAppId } from "./archived-miniapps";
import { logger } from "./logger";
import { isSharedModeApp, resolveSharedModeRuntime } from "./chain";
import { getRpcNetwork } from "./rpc-helpers";
import {
  appendNavItemIfMissing,
  findCatalogAppById,
  resolveMiniAppDetailRouteId,
  resolveOneGateStandaloneRedirect,
  sanitizeForJson,
  toMiniAppNavItems,
  withBundledAuthoritativeFields,
  type AppDetailPageProps,
  type RequestLike,
} from "./miniapp-detail-helpers";

// Server-Side Props
export const getMiniAppDetailServerSideProps: GetServerSideProps<
  AppDetailPageProps
> = async (context) => {
  const routeParams = context.params as { id: string };
  const id = resolveMiniAppDetailRouteId(routeParams.id);
  const encodedId = encodeURIComponent(id);

  if (id !== routeParams.id) {
    const queryString = (context.req.url || "").split("?")[1];
    return {
      redirect: {
        destination: `/miniapps/${id}${queryString ? `?${queryString}` : ""}`,
        permanent: false,
      },
    };
  }

  const oneGateStandaloneRedirect = resolveOneGateStandaloneRedirect(
    id,
    context.req.url,
  );
  if (oneGateStandaloneRedirect) {
    return {
      redirect: {
        destination: oneGateStandaloneRedirect,
        permanent: false,
      },
    };
  }

  if (isArchivedMiniAppId(id)) {
    return { notFound: true };
  }

  const fallback = await loadBundledMiniAppById(id);
  const targetNetwork = getRpcNetwork();
  const catalogNetwork = resolveCatalogNetwork(targetNetwork);
  const rawMiniAppNav = await loadMiniAppCatalog("active", {
    includeManifest: true,
  }).catch((e: unknown) => {
    console.warn(
      "[miniapps/id] miniapp navigation catalog failed:",
      e instanceof Error ? e.message : String(e),
    );
    return [];
  });

  try {
    const baseUrl = resolveInternalBaseUrl(
      context.req as RequestLike | undefined,
    );
    const catalogApp = withBundledAuthoritativeFields(
      findCatalogAppById(rawMiniAppNav, id),
      fallback,
    );
    const notifRes =
      process.env.PLAYWRIGHT === "1"
        ? null
        : await fetchWithTimeout(
            `${baseUrl}/api/app/${encodedId}/news?limit=20`,
            {},
            2000,
          ).catch((e: unknown) => {
            console.warn(
              "[miniapps/id] news fetch failed:",
              e instanceof Error ? e.message : String(e),
            );
            return null;
          });

    const notifData = notifRes?.ok
      ? await notifRes.json().catch((e: unknown) => {
          console.warn(
            "[miniapps/id] failed to parse notifications JSON:",
            e instanceof Error ? e.message : String(e),
          );
          return { notifications: [] };
        })
      : { notifications: [] };
    const app = coerceMiniAppInfo(catalogApp, fallback ?? undefined);

    if (!app) {
      return { notFound: true };
    }
    const miniAppNavItems = appendNavItemIfMissing(
      toMiniAppNavItems(rawMiniAppNav),
      app,
    );

    const sharedRuntime =
      supportsCatalogNetwork(app, catalogNetwork) && isSharedModeApp(app)
        ? await resolveSharedModeRuntime(app, targetNetwork).catch(
            (e: unknown) => {
              console.warn(
                "[miniapps/id] shared runtime resolve failed:",
                e instanceof Error ? e.message : String(e),
              );
              return null;
            },
          )
        : null;

    return {
      props: {
        app: sanitizeForJson(app),
        miniAppNav: sanitizeForJson(miniAppNavItems),
        notifications: notifData.notifications || [],
        sharedRuntime: sanitizeForJson(sharedRuntime),
      },
    };
  } catch (loadError) {
    logger.error("Failed to fetch app details:", loadError);
    if (fallback) {
      return {
        props: {
          app: sanitizeForJson(fallback),
          miniAppNav: sanitizeForJson(
            appendNavItemIfMissing(toMiniAppNavItems(rawMiniAppNav), fallback),
          ),
          notifications: [],
          sharedRuntime: null,
          error:
            "Using fallback app metadata while live API data is unavailable",
        },
      };
    }
    return {
      props: {
        app: null,
        miniAppNav: sanitizeForJson(toMiniAppNavItems(rawMiniAppNav)),
        notifications: [],
        sharedRuntime: null,
        error: "Failed to load app details",
      },
    };
  }
};
