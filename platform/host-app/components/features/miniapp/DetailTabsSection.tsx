import dynamic from "next/dynamic";
import { AppNewsList } from "../..";
import type { MiniAppInfo, MiniAppNotification } from "../..";
import type { NeoNetwork } from "../../../lib/neo-network";
import {
  TAB_PANEL_CLASSNAME,
  type ResolvedTab,
} from "../../../lib/miniapp-detail-helpers";
import { OverviewTab } from "./MiniAppDetailSections";

const AppSecretsTab = dynamic(
  () =>
    import("../secrets/AppSecretsTab").then((m) => ({
      default: m.AppSecretsTab,
    })),
  {
    loading: () => (
      <div className="h-64 animate-pulse bg-gray-100 rounded-xl" />
    ),
    ssr: false,
  },
);
const ReviewsTab = dynamic(
  () =>
    import("../reviews").then((m) => ({
      default: m.ReviewsTab,
    })),
  {
    loading: () => (
      <div className="h-64 animate-pulse bg-gray-100 rounded-xl" />
    ),
    ssr: false,
  },
);
const ForumTab = dynamic(
  () =>
    import("../forum").then((m) => ({
      default: m.ForumTab,
    })),
  {
    loading: () => (
      <div className="h-64 animate-pulse bg-gray-100 rounded-xl" />
    ),
    ssr: false,
  },
);

export function DetailTabsSection({
  app,
  tabs,
  activeTabConfig,
  onTabClick,
  targetNetwork,
  liveNotifications,
  newsLoading,
  showNews,
  showSecrets,
}: {
  app: MiniAppInfo;
  tabs: ResolvedTab[];
  activeTabConfig: ResolvedTab | undefined;
  onTabClick: (tabId: string) => void;
  targetNetwork: NeoNetwork;
  liveNotifications: MiniAppNotification[];
  newsLoading: boolean;
  showNews: boolean;
  showSecrets: boolean;
}) {
  return (
    <section
      className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm shadow-gray-950/5 sm:p-4"
      data-testid="miniapp-detail-tabs"
    >
      <div
        role="tablist"
        className="mb-5 flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-gray-100 p-1"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeTabConfig?.id === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={activeTabConfig?.id === tab.id ? 0 : -1}
            className={`cursor-pointer rounded-xl bg-transparent px-3 py-2 text-sm font-semibold ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 sm:px-4 ${
              activeTabConfig?.id === tab.id
                ? "bg-white text-emerald-700 ring-gray-200"
                : "text-gray-500 ring-transparent hover:bg-white/70 hover:text-gray-900"
            }`}
            onClick={() => onTabClick(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTabConfig?.type === "content" && (
        <div
          id={`tabpanel-${activeTabConfig.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTabConfig.id}`}
          className={TAB_PANEL_CLASSNAME}
        >
          <OverviewTab app={app} blocks={activeTabConfig.blocks} />
        </div>
      )}

      {activeTabConfig?.type === "reviews" && (
        <div
          id={`tabpanel-${activeTabConfig.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTabConfig.id}`}
          className={TAB_PANEL_CLASSNAME}
        >
          <ReviewsTab appId={app.app_id} network={targetNetwork} />
        </div>
      )}

      {activeTabConfig?.type === "forum" && (
        <div
          id={`tabpanel-${activeTabConfig.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTabConfig.id}`}
          className={TAB_PANEL_CLASSNAME}
        >
          <ForumTab appId={app.app_id} network={targetNetwork} />
        </div>
      )}

      {activeTabConfig?.type === "news" && (
        <div
          id={`tabpanel-${activeTabConfig.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTabConfig.id}`}
          className={TAB_PANEL_CLASSNAME}
        >
          {showNews ? (
            <AppNewsList
              notifications={liveNotifications}
              loading={newsLoading}
            />
          ) : (
            <p className="text-xs text-gray-500">
              News feed disabled by manifest.
            </p>
          )}
        </div>
      )}

      {activeTabConfig?.type === "secrets" && (
        <div
          id={`tabpanel-${activeTabConfig.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTabConfig.id}`}
          className={TAB_PANEL_CLASSNAME}
        >
          {showSecrets ? (
            <AppSecretsTab appId={app.app_id} appName={app.name} />
          ) : (
            <p className="text-xs text-gray-500">
              Secrets are not enabled for this MiniApp.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
