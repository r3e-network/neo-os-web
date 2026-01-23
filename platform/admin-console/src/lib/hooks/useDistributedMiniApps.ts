// =============================================================================
// Hooks for Distributed MiniApp Management
// =============================================================================

import { useState, useEffect, useCallback } from "react";
import type {
  MiniAppSubmission,
  InternalMiniApp,
  RegistryEntry,
  SubmissionsListResponse,
  ApprovalRequest,
  ApprovalResponse,
  BuildRequest,
  BuildResponse,
  SyncResult,
} from "@/components/admin/miniapps/types";

/**
 * Hook for fetching external submissions
 */
export function useExternalSubmissions(status?: string, limit = 50, offset = 0) {
  const [data, setData] = useState<MiniAppSubmission[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (status && status !== "all") {
        params.set("status", status);
      }

      const response = await fetch(`/api/admin/miniapps/submissions?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to load submissions");
      }

      const result: SubmissionsListResponse = await response.json();
      setData(result.apps);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [status, limit, offset]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  return { submissions: data, total, loading, error, refresh: fetchSubmissions };
}

/**
 * Hook for fetching internal miniapps
 */
export function useInternalMiniApps() {
  const [data, setData] = useState<InternalMiniApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInternal = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/miniapps/internal");

      if (!response.ok) {
        throw new Error("Failed to load internal miniapps");
      }

      const result = await response.json();
      setData(result.miniapps || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInternal();
  }, [fetchInternal]);

  return { miniapps: data, loading, error, refresh: fetchInternal };
}

/**
 * Hook for fetching unified registry
 */
export function useRegistry(sourceType?: "external" | "internal" | "all") {
  const [data, setData] = useState<RegistryEntry[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRegistry = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ limit: "100" });
      if (sourceType && sourceType !== "all") {
        params.set("source_type", sourceType);
      }

      const response = await fetch(`/api/admin/miniapps/registry?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to load registry");
      }

      const result = await response.json();
      setData(result.miniapps || []);
      setLastUpdated(result.meta?.last_updated || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [sourceType]);

  useEffect(() => {
    fetchRegistry();
  }, [fetchRegistry]);

  return { miniapps: data, lastUpdated, loading, error, refresh: fetchRegistry };
}

/**
 * Hook for approval actions
 */
export function useApprovalActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approve = useCallback(async (submissionId: string, triggerBuild = false, reviewNotes?: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/miniapps/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_id: submissionId,
          action: "approve",
          trigger_build: triggerBuild,
          review_notes: reviewNotes,
        } satisfies ApprovalRequest),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || result.details || "Approval failed");
      }

      const result: ApprovalResponse = await response.json();
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const reject = useCallback(async (submissionId: string, reviewNotes?: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/miniapps/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_id: submissionId,
          action: "reject",
          review_notes: reviewNotes,
        } satisfies ApprovalRequest),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || result.details || "Rejection failed");
      }

      const result: ApprovalResponse = await response.json();
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const requestChanges = useCallback(async (submissionId: string, reviewNotes?: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/miniapps/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_id: submissionId,
          action: "request_changes",
          review_notes: reviewNotes,
        } satisfies ApprovalRequest),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || result.details || "Request failed");
      }

      const result: ApprovalResponse = await response.json();
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { approve, reject, requestChanges, loading, error };
}

/**
 * Hook for build trigger
 */
export function useBuildTrigger() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const triggerBuild = useCallback(async (submissionId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/miniapps/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: submissionId } satisfies BuildRequest),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || result.details || "Build trigger failed");
      }

      const result: BuildResponse = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Build failed to start");
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { triggerBuild, loading, error };
}

/**
 * Hook for internal sync
 */
export function useInternalSync() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sync = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/miniapps/internal", {
        method: "POST",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || result.details || "Sync failed");
      }

      const result: SyncResult = await response.json();
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { sync, loading, error };
}
