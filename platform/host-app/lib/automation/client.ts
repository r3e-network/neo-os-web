import type { RegisterTaskRequest, RegisterTaskResponse, TaskStatusResponse } from "@/lib/db/types";

const API_BASE = "/api/automation";

/** Throw on non-2xx responses with server error message when available */
async function ensureOk(res: Response): Promise<void> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as Record<string, string>).error || `Request failed: ${res.status}`);
  }
}

export async function registerTask(request: RegisterTaskRequest): Promise<RegisterTaskResponse> {
  const res = await fetch(`${API_BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  await ensureOk(res);
  return res.json();
}

export async function unregisterTask(appId: string, taskName: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/unregister`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appId, taskName }),
  });
  await ensureOk(res);
  return res.json();
}

export async function getTaskStatus(appId: string, taskName: string): Promise<TaskStatusResponse> {
  const res = await fetch(`${API_BASE}/status?appId=${appId}&taskName=${taskName}`);
  await ensureOk(res);
  return res.json();
}

export async function listTasks(appId?: string): Promise<{ tasks: unknown[] }> {
  const url = appId ? `${API_BASE}/list?appId=${appId}` : `${API_BASE}/list`;
  const res = await fetch(url);
  await ensureOk(res);
  return res.json();
}

export async function updateTask(
  taskId: string,
  payload?: Record<string, unknown>,
  schedule?: { intervalSeconds?: number; cron?: string; maxRuns?: number },
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/update`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId, payload, schedule }),
  });
  await ensureOk(res);
  return res.json();
}

export async function enableTask(taskId: string): Promise<{ success: boolean; status: string }> {
  const res = await fetch(`${API_BASE}/enable`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId }),
  });
  await ensureOk(res);
  return res.json();
}

export async function disableTask(taskId: string): Promise<{ success: boolean; status: string }> {
  const res = await fetch(`${API_BASE}/disable`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId }),
  });
  await ensureOk(res);
  return res.json();
}

export async function getTaskLogs(taskId?: string, appId?: string, limit = 50): Promise<{ logs: unknown[] }> {
  const params = new URLSearchParams();
  if (taskId) params.set("taskId", taskId);
  if (appId) params.set("appId", appId);
  params.set("limit", String(limit));
  const res = await fetch(`${API_BASE}/logs?${params}`);
  await ensureOk(res);
  return res.json();
}
