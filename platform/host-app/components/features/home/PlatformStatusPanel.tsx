import { CountUp } from "@/components/CountUp";
import { CheckCircle2, Layers3 } from "lucide-react";

export function PlatformStatusPanel({
  platformStats,
  t,
}: {
  platformStats: { label: string; value: number }[];
  t: (key: string, ns?: "common" | "host" | "admin" | "miniapp") => string;
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="m-0 text-xs font-semibold uppercase text-gray-600">
            {t("home.status.title", "host")}
          </p>
          <p className="mt-1 text-sm font-semibold text-gray-900">
            {t("home.status.subtitle", "host")}
          </p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
          <Layers3 className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {platformStats.map((item) => (
          <div
            key={item.label}
            className="rounded-lg border border-gray-200 bg-white p-3 transition-all hover:border-emerald-200 hover:shadow-sm"
          >
            <p className="m-0 truncate text-[11px] font-semibold text-gray-600">
              {item.label}
            </p>
            <CountUp
              value={item.value}
              className="m-0 mt-1 block truncate text-lg font-black text-gray-900"
            />
          </div>
        ))}
      </div>
      <div className="grid gap-2 text-sm text-gray-600">
        {[
          t("home.status.itemNetwork", "host"),
          t("home.status.itemConsole", "host"),
          t("home.status.itemPlayArea", "host"),
        ].map((item) => (
          <div key={item} className="flex items-center gap-2">
            <CheckCircle2
              className="h-4 w-4 text-emerald-600"
              aria-hidden="true"
            />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
