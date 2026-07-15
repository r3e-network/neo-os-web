import type { AdminNavigationIcon } from "@/lib/admin-navigation";
import { cn } from "@/lib/utils";

type IconProps = {
  active?: boolean;
  className?: string;
  icon: AdminNavigationIcon;
  testIdPrefix?: string;
};

const iconPaths: Record<AdminNavigationIcon, string[]> = {
  analytics: [
    "M4 17.5l5-5 3 3 7-8",
    "M15 7.5h4v4",
    "M4 20h16",
  ],
  contracts: [
    "M7 3.5h7l3 3v14H7z",
    "M14 3.5v4h4",
    "M9.5 11h5",
    "M9.5 14h5",
    "M9.5 17h3",
  ],
  dashboard: [
    "M4 5h7v7H4z",
    "M13 5h7v4h-7z",
    "M13 11h7v8h-7z",
    "M4 14h7v5H4z",
  ],
  miniapps: [
    "M6 4h12v16H6z",
    "M9 7h6",
    "M9 10h6",
    "M9 13h2",
    "M12 17h.01",
  ],
  priceFeeds: [
    "M4 15.5l4-4 3 3 5-6 4 4",
    "M4 20h16",
    "M4 5h16",
  ],
  secrets: [
    "M8.5 13.5a4.5 4.5 0 1 1 3.2 1.3L10 16.5h-2v2H5.5V16L8.5 13.5z",
    "M14.5 9.5h.01",
  ],
  services: [
    "M7 7h10",
    "M7 12h10",
    "M7 17h10",
    "M4 7h.01",
    "M4 12h.01",
    "M4 17h.01",
  ],
  settings: [
    "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z",
    "M12 3.5v2",
    "M12 18.5v2",
    "M4.6 7.2l1.7 1",
    "M17.7 15.8l1.7 1",
    "M4.6 16.8l1.7-1",
    "M17.7 8.2l1.7-1",
  ],
  simulations: [
    "M7 7h10v10H7z",
    "M10 10h4v4h-4z",
    "M4 9h3",
    "M17 9h3",
    "M4 15h3",
    "M17 15h3",
    "M9 4v3",
    "M15 4v3",
    "M9 17v3",
    "M15 17v3",
  ],
  templates: [
    "M5 5h6v6H5z",
    "M13 5h6v6h-6z",
    "M5 13h6v6H5z",
    "M13 13h6v6h-6z",
  ],
  users: [
    "M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    "M15.5 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
    "M3.5 19c.7-3.2 2.6-5 5-5s4.3 1.8 5 5",
    "M13.5 14.5c2.2.2 3.7 1.7 4.2 4.5",
  ],
};

export function AdminNavIcon({
  active,
  className,
  icon,
  testIdPrefix = "admin-nav-icon",
}: IconProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition-colors",
        active
          ? "border-neo-200 bg-surface text-neo-700 shadow-sm"
          : "border-border bg-canvas-alt text-ink-muted",
        className,
      )}
      data-testid={`${testIdPrefix}-${icon}`}
    >
      <svg
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        {iconPaths[icon].map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </span>
  );
}
