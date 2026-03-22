import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import { createProxyHeaders, parseHostErrorPayload, resolveHostAppBaseURL } from "@/lib/host-admin-proxy";

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

  try {
    const response = await fetch(new URL("/api/miniapps/admin/status", hostAppBaseURL).toString(), {
      method: "POST",
      headers: createProxyHeaders(req),
      body: JSON.stringify({ app_id: appId, status }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const message = await parseHostErrorPayload(response, "Failed to update MiniApp status");
      return jsonError(message, response.status);
    }

    const data = await response.json().catch((e: unknown) => { console.warn("[update-status] failed to parse response JSON:", e instanceof Error ? e.message : String(e)); return { success: true }; });
    return Response.json(data);
  } catch {
    return jsonError("Failed to reach host-app admin endpoint", 502);
  }
}
