import { MiniAppInfo, MiniAppStats } from "./types";

type Props = {
  app: MiniAppInfo;
  stats?: MiniAppStats;
  onBack: () => void;
};

export function AppDetailHeader({ app, stats, onBack }: Props) {
  let statusBadge = stats?.last_activity_at ? "Active" : "Inactive";
  let statusColor = stats?.last_activity_at ? "text-neo" : "text-gray-500 dark:text-gray-400";
  if (app.status === "active") {
    statusBadge = "Online";
    statusColor = "text-neo";
  } else if (app.status === "disabled") {
    statusBadge = "Maintenance";
    statusColor = "text-amber-500";
  } else if (app.status === "pending") {
    statusBadge = "Pending";
    statusColor = "text-gray-500 dark:text-gray-400";
  }

  return (
    <header className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/80 px-4 sm:px-8 py-4 sm:py-6">
      <button
        type="button"
        onClick={onBack}
        aria-label="Go back"
        className="mb-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-4 py-2 text-sm text-gray-900 dark:text-white transition-all hover:bg-gray-100 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
      >
        ← Back
      </button>
      <div className="flex items-center gap-5">
        <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-neo/10 text-[64px]">
          {app.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="mb-2 text-xl sm:text-2xl md:text-[28px] font-bold text-gray-900 dark:text-white truncate" title={app.name}>{app.name}</h1>
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-neo/15 px-3 py-1 text-xs font-semibold uppercase text-neo">
              {app.category}
            </span>
            <span className={`text-xs font-medium ${statusColor}`}>● {statusBadge}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
