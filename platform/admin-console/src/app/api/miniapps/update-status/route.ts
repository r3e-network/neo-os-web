import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import { HOST_PROXY_TIMEOUTS, proxyToHost, resolveHostAppBaseURL } from "@/lib/host-admin-proxy";

const updateStatusSchema = z.object({
  appId: z.string().min(1, "appId is required").regex(/^[a-z0-9][a-z0-9._-]*$/, "invalid appId format"),
  status: z.enum(["active", "disabled"], { message: "status must be active or disabled" }),
});

export async function POST(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  const hostAppBaseURL = resolveHostAppBaseURL();
  if (!hostAppBaseURL) {
    return jsonError("MINIAPP_HOST_APP_BASE_URL is not configured", 500);
  }

  let payload: z.infer<typeof updateStatusSchema>;
  try {
    const body = await req.json();
    payload = updateStatusSchema.parse(body);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(err.errors[0]?.message || "Invalid input", 400);
    }
    return jsonError("Invalid JSON body", 400);
  }

  const { appId, status } = payload;

  return proxyToHost(req, {
    hostAppBaseURL,
    path: "/api/miniapps/admin/status",
    method: "POST",
    body: { app_id: appId, status },
    timeoutMs: HOST_PROXY_TIMEOUTS.SHORT,
    notOkError: "Failed to update MiniApp status",
    fallbackError: "Failed to reach host-app admin endpoint",
    logLabel: "[update-status]",
    parseFallback: { success: true },
    onSuccess: (data) => Response.json(data),
  });
}
