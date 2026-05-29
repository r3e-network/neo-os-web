"use client";

import { Activity, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { AdminAccessRequiredState } from "@/components/layout/AdminAccessRequiredState";

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
  adminReady: boolean;
  reports: ReportRow[];
  loading: boolean;
  error: string;
};

function fmtCount(value: number | undefined): string {
  return String(value ?? 0);
}

function statusPillClass(ok: boolean): string {
  return ok
    ? "rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700"
    : "rounded-full bg-amber-50 px-2.5 py-1 text-amber-700";
}

export function LiveSmokeReportsCard({
  adminReady,
  reports,
  loading,
  error,
}: Props) {
  const needsReviewCount = reports.filter(
    (report) => report.flagshipStatus !== 0 || report.selectedStatus !== 0,
  ).length;

  return (
    <Card
      className="live-smoke-reports-card live-smoke-reports-shell overflow-hidden"
      variant="default"
    >
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary-100 bg-primary-50 text-primary-700">
              <Activity className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-lg">Recent Live Smoke Runs</CardTitle>
              <p className="mt-1 text-sm text-gray-500">
                Track the latest flagship and selected MiniApp validation runs.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="font-semibold uppercase text-gray-500">Runs</p>
              <p className="mt-1 text-lg font-black text-gray-900">
                {reports.length}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="font-semibold uppercase text-gray-500">Review</p>
              <p className="mt-1 text-lg font-black text-gray-900">
                {needsReviewCount}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 bg-gray-50">
        {!adminReady ? (
          <AdminAccessRequiredState description="Save an admin API key above to load recent live smoke reports." />
        ) : null}
        {adminReady && loading ? (
          <p className="text-sm text-gray-500">Loading recent reports...</p>
        ) : null}
        {adminReady && !loading && error ? (
          <p className="text-sm text-danger-600">{error}</p>
        ) : null}
        {adminReady && !loading && !error && reports.length === 0 ? (
          <p className="text-sm text-gray-500">No live smoke summaries found yet.</p>
        ) : null}
        {adminReady && !loading && !error && reports.length > 0 ? (
          <div className="space-y-3">
            {reports.map((report) => (
              <div
                key={report.runId}
                className="live-smoke-report-row rounded-xl border border-gray-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      {report.runId}
                    </div>
                    <div className="text-xs text-gray-500">
                      {report.generatedAt || "unknown time"}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase">
                    <span
                      className={`${statusPillClass(
                        report.flagshipStatus === 0,
                      )} inline-flex items-center gap-1`}
                    >
                      {report.flagshipStatus === 0 ? (
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      )}
                      Flagship{" "}
                      {report.flagshipStatus === 0 ? "OK" : "Needs Review"}
                    </span>
                    <span
                      className={`${statusPillClass(
                        report.selectedStatus === 0,
                      )} inline-flex items-center gap-1`}
                    >
                      {report.selectedStatus === 0 ? (
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      )}
                      Selected{" "}
                      {report.selectedStatus === 0 ? "OK" : "Needs Review"}
                    </span>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-gray-600 md:grid-cols-2">
                  <div>
                    <div className="font-semibold text-gray-800">Flagship</div>
                    <div>
                      pass {fmtCount(report.flagshipCounts?.pass)} · fail{" "}
                      {fmtCount(report.flagshipCounts?.fail)} · skipped{" "}
                      {fmtCount(report.flagshipCounts?.skipped)}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-800">Selected</div>
                    <div>
                      pass {fmtCount(report.selectedCounts?.pass)} · fail{" "}
                      {fmtCount(report.selectedCounts?.fail)} · skipped{" "}
                      {fmtCount(report.selectedCounts?.skipped)}
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-[11px] text-gray-500">
                  Summary:{" "}
                  <span className="font-mono">{report.summaryPath}</span>
                </div>
                {report.warnings && report.warnings.length > 0 ? (
                  <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
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
