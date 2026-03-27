import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";

const LIVE_SMOKE_ROOT = path.join(process.cwd(), "docs", "reports", "live-smoke");
const RUN_NAME_PATTERN = /^[A-Za-z0-9._-]+$/;

function resolveSummaryPath(run: string) {
  return path.join(LIVE_SMOKE_ROOT, run, "summary.json");
}

async function listRunDirectories(): Promise<string[]> {
  try {
    const entries = await fs.readdir(LIVE_SMOKE_ROOT, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => b.localeCompare(a));
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return [];
    throw error;
  }
}

export async function GET(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const requestedRun = String(searchParams.get("run") || "").trim();
  if (requestedRun && !RUN_NAME_PATTERN.test(requestedRun)) {
    return jsonError("Invalid run identifier", 400);
  }

  try {
    const availableRuns = await listRunDirectories();
    if (availableRuns.length === 0) {
      return jsonError("No live smoke reports found", 404);
    }

    const resolvedRun = requestedRun || availableRuns[0];
    if (!availableRuns.includes(resolvedRun)) {
      return jsonError(`Live smoke run not found: ${resolvedRun}`, 404);
    }

    const summaryPath = resolveSummaryPath(resolvedRun);
    let summary: unknown;
    try {
      summary = JSON.parse(await fs.readFile(summaryPath, "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
        return jsonError(`summary.json not found for run: ${resolvedRun}`, 404);
      }
      throw error;
    }

    return NextResponse.json({
      root: "docs/reports/live-smoke",
      requestedRun: requestedRun || null,
      latestRun: availableRuns[0],
      run: resolvedRun,
      availableRuns,
      summaryPath: path.relative(process.cwd(), summaryPath),
      summary,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to read live smoke reports", 500);
  }
}
