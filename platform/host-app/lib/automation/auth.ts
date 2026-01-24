import { getSession } from "@auth0/nextjs-auth0";
import type { NextApiRequest, NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";

type AuthSession = {
  userId: string;
};

type ResolveResult =
  | { appId: string }
  | {
      error: {
        status: number;
        message: string;
      };
    };

function normalizeParam(value?: string | string[] | null): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ? String(value[0]).trim() : null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

export async function requireAutomationSession(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<AuthSession | null> {
  const session = await getSession(req, res);
  const userId = session?.user?.sub ? String(session.user.sub) : "";
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return { userId };
}

export async function resolveAutomationAppId(input: {
  appId?: string | string[] | null;
  taskId?: string | string[] | null;
  supabase: SupabaseClient;
}): Promise<ResolveResult> {
  const appId = normalizeParam(input.appId);
  if (appId) return { appId };

  const taskId = normalizeParam(input.taskId);
  if (!taskId) {
    return { error: { status: 400, message: "appId or taskId required" } };
  }

  const { data, error } = await input.supabase
    .from("automation_tasks")
    .select("app_id")
    .eq("id", taskId)
    .maybeSingle();

  if (error) {
    return { error: { status: 500, message: "Task lookup failed" } };
  }
  if (!data?.app_id) {
    return { error: { status: 404, message: "Task not found" } };
  }

  return { appId: String(data.app_id) };
}

export async function assertAutomationOwner(input: {
  appId: string | null | undefined;
  userId: string;
  supabase: SupabaseClient;
}): Promise<{ ok: boolean; status?: number; message?: string }> {
  const appId = normalizeParam(input.appId);
  if (!appId) {
    return { ok: false, status: 400, message: "appId required" };
  }

  const { data: adminRow } = await input.supabase
    .from("admin_emails")
    .select("user_id")
    .eq("user_id", input.userId)
    .maybeSingle();

  if (adminRow) {
    return { ok: true };
  }

  const { data: appRow, error: appErr } = await input.supabase
    .from("miniapps")
    .select("developer_user_id")
    .eq("app_id", appId)
    .maybeSingle();

  if (appErr) {
    return { ok: false, status: 500, message: "Failed to verify app ownership" };
  }
  if (!appRow?.developer_user_id) {
    return { ok: false, status: 404, message: "App not found" };
  }
  if (appRow.developer_user_id !== input.userId) {
    return { ok: false, status: 403, message: "Forbidden" };
  }

  return { ok: true };
}

export function normalizeAutomationParam(value?: string | string[] | null): string | null {
  return normalizeParam(value);
}
