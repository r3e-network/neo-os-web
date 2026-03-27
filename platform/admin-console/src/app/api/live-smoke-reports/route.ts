import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";

type LiveSmokeSummary = {
  generatedAt?: string;
  flagshipStatus?: number;
  selectedStatus?: number;
  flagshipCounts?: { pass?: number; fail?: number; skipped?: number };
  selectedCounts?: { pass?: number; fail?: number; skipped?: number };
  reports?: { flagship?: string | null; selected?: string | null; summary?: string | null };
  warnings?: string[];
};

export async function GET(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  try {
    const reportsDir = path.resolve(process.cwd(), "..", "..", "docs", "reports", "live-smoke");
    const entries = await fs.readdir(reportsDir, { withFileTypes: true }).catch(() => []);
    const summaries: Array<LiveSmokeSummary & { runId: string; summaryPath: string }> = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const runId = entry.name;
      const summaryPath = path.join(reportsDir, runId, "summary.json");
      try {
        const raw = await fs.readFile(summaryPath, "utf8");
        const parsed = JSON.parse(raw) as LiveSmokeSummary;
        summaries.push({
          ...parsed,
          runId,
          summaryPath: path.relative(path.resolve(process.cwd(), "..", ".."), summaryPath),
        });
      } catch {
        // Ignore malformed or incomplete report directories.
      }
    }

    summaries.sort((a, b) => String(b.generatedAt || "").localeCompare(String(a.generatedAt || "")));

    return NextResponse.json({
      reports: summaries.slice(0, 10),
    });
  } catch (error) {
    return jsonError(`Failed to load live smoke reports: ${error instanceof Error ? error.message : String(error)}`);
  }
}
