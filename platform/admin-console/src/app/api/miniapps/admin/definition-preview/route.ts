import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import {
  HOST_PROXY_TIMEOUTS,
  proxyToHost,
  resolveHostAppBaseURL,
} from "@/lib/host-admin-proxy";

const schema = z.object({
  content: z.string().trim().min(1, "content is required"),
});

export async function POST(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  const hostAppBaseURL = resolveHostAppBaseURL();
  if (!hostAppBaseURL) {
    return jsonError("MINIAPP_HOST_APP_BASE_URL is not configured", 500);
  }

  let payload: z.infer<typeof schema>;
  try {
    payload = schema.parse(await req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(error.errors[0]?.message || "Invalid input", 400);
    }
    return jsonError("Invalid JSON body", 400);
  }

  return proxyToHost(req, {
    hostAppBaseURL,
    path: "/api/miniapps/admin/definition-preview",
    method: "POST",
    body: payload,
    timeoutMs: HOST_PROXY_TIMEOUTS.SHORT,
    notOkError: "Failed to preview definition",
    fallbackError: "Failed to reach host-app definition preview endpoint",
    logLabel: "[admin/definition-preview]",
  });
}
