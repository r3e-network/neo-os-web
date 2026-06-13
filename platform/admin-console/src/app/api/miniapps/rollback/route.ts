import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import { HOST_PROXY_TIMEOUTS, proxyToHost, resolveHostAppBaseURL } from "@/lib/host-admin-proxy";

const requestSchema = z.object({
  app_id: z.string().regex(/^[a-z0-9][a-z0-9._-]*$/),
  version_id: z.string().uuid().optional(),
  version_no: z.number().int().positive().optional(),
  release_channel: z.enum(["draft", "published"]).default("published"),
}).refine((value) => Boolean(value.version_id || value.version_no), {
  message: "Either version_id or version_no is required",
  path: ["version_id"],
});

export async function POST(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  const hostAppBaseURL = resolveHostAppBaseURL();
  if (!hostAppBaseURL) {
    return jsonError("MINIAPP_HOST_APP_BASE_URL is not configured", 500);
  }

  let payload: z.infer<typeof requestSchema>;
  try {
    const body = await req.json();
    payload = requestSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(error.errors[0]?.message || "Invalid input", 400);
    }
    return jsonError("Invalid JSON body", 400);
  }

  return proxyToHost(req, {
    hostAppBaseURL,
    path: "/api/miniapps/admin/rollback",
    method: "POST",
    body: payload,
    timeoutMs: HOST_PROXY_TIMEOUTS.EXTENDED,
    notOkError: "Failed to rollback miniapp",
    fallbackError: "Failed to reach host-app rollback endpoint",
    logLabel: "[miniapps/rollback]",
    parseFallback: null,
    onSuccess: (result) => NextResponse.json(result || { success: true }),
  });
}
