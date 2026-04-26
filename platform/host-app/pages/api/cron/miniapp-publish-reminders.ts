import type { NextApiRequest, NextApiResponse } from "next";
import { timingSafeEqual } from "crypto";
import { apiError } from "@/lib/api-response";

async function callPublishReminderEndpoint(
  baseUrl: string,
  cronSecret: string,
): Promise<{
  ok: boolean;
  status: number;
  payload: unknown;
}> {
  const response = await fetch(
    `${baseUrl}/api/miniapps/admin/publish-reminders`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        "X-Admin-Key": String(process.env.MINIAPP_ADMIN_API_KEY || ""),
        "X-CSRF-Token": "cron",
        Cookie: "csrf-token=cron",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ dry_run: false }),
      signal: AbortSignal.timeout(15000),
    },
  );

  const payload = await response.json().catch((e: unknown) => {
    console.warn(
      "[miniapp-publish-reminders] failed to parse response JSON:",
      e instanceof Error ? e.message : String(e),
    );
    return null;
  });
  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET" && req.method !== "POST") {
    return apiError.methodNotAllowed(res);
  }

  const cronSecret = String(process.env.CRON_SECRET || "").trim();
  const authHeader = String(req.headers.authorization || "").trim();
  const expected = `Bearer ${cronSecret}`;

  if (
    !cronSecret ||
    authHeader.length !== expected.length ||
    !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
  ) {
    return apiError.unauthorized(res, "Unauthorized");
  }

  const baseUrl = String(
    process.env.HOST_APP_BASE_URL ||
      process.env.NEXT_PUBLIC_HOST_APP_BASE_URL ||
      "",
  ).trim();
  if (!baseUrl) {
    return apiError.configError(
      res,
      "HOST_APP_BASE_URL is required for publish reminder cron",
    );
  }

  try {
    const result = await callPublishReminderEndpoint(baseUrl, cronSecret);
    if (!result.ok) {
      res.status(result.status).json({
        success: false,
        message: "Publish reminder cron invocation failed",
        upstream: result.payload,
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Publish reminder cron executed",
      upstream: result.payload,
      timestamp: new Date().toISOString(),
    });
    return;
  } catch (error) {
    return apiError.internal(
      res,
      error instanceof Error
        ? `Publish reminder cron error: ${error.message}`
        : "Publish reminder cron failed",
    );
  }
}
