"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

type ReportRow = {
  runId: string;
  generatedAt?: string;
  flagshipStatus?: number;
  selectedStatus?: number;
  flagshipCounts?: { pass?: number; fail?: number; skipped?: number };
  selectedCounts?: { pass?: number; fail?: number; skipped?: number };
  summaryPath: string;
  warnings?: string[];
};

type Props = {
  reports: ReportRow[];
  loading: boolean;
  error: string;
};

function fmtCount(value: number | undefined): string {
  return String(value ?? 0);
}

export function LiveSmokeReportsCard({ reports, loading, error }: Props) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="text-lg">Recent Live Smoke Runs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? <p className="text-sm text-gray-500 dark:text-gray-400">Loading recent reports...</p> : null}
        {!loading && error ? <p className="text-sm text-danger-600 dark:text-danger-400">{error}</p> : null}
        {!loading && !error && reports.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No live smoke summaries found yet.</p>
        ) : null}
        {!loading && !error && reports.length > 0 ? (
          <div className="space-y-3">
            {reports.map((report) => (
              <div
                key={report.runId}
                className="rounded-xl border border-gray-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{report.runId}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{report.generatedAt || "unknown time"}</div>
                  </div>
                  <div className="flex gap-2 text-[11px] font-semibold uppercase tracking-wide">
                    <span className={`rounded-full px-2.5 py-1 ${report.flagshipStatus === 0 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"}`}>
                      Flagship {report.flagshipStatus === 0 ? "OK" : "Needs Review"}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 ${report.selectedStatus === 0 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"}`}>
                      Selected {report.selectedStatus === 0 ? "OK" : "Needs Review"}
                    </span>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-gray-600 dark:text-gray-300 md:grid-cols-2">
                  <div>
                    <div className="font-semibold text-gray-800 dark:text-gray-200">Flagship</div>
                    <div>pass {fmtCount(report.flagshipCounts?.pass)} · fail {fmtCount(report.flagshipCounts?.fail)} · skipped {fmtCount(report.flagshipCounts?.skipped)}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-800 dark:text-gray-200">Selected</div>
                    <div>pass {fmtCount(report.selectedCounts?.pass)} · fail {fmtCount(report.selectedCounts?.fail)} · skipped {fmtCount(report.selectedCounts?.skipped)}</div>
                  </div>
                </div>
                <div className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">
                  Summary: <span className="font-mono">{report.summaryPath}</span>
                </div>
                {report.warnings && report.warnings.length > 0 ? (
                  <div className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
                    {report.warnings.join(" | ")}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
