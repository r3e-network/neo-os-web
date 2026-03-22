import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import { createProxyHeaders, parseHostErrorPayload, resolveHostAppBaseURL } from "@/lib/host-admin-proxy";

const schema = z.object({
  app_id: z.string().trim().regex(/^[a-z0-9][a-z0-9._-]*$/, "Invalid app_id format"),
  asset_type: z.enum(["icon", "logo", "banner"]),
  content_type: z.string().trim().min(1, "content_type is required"),
  file_name: z.string().trim().optional(),
  variant: z.object({
    theme: z.enum(["light", "dark", "any"]).optional(),
    density: z.enum(["1x", "2x", "3x"]).optional(),
    locale: z.string().trim().max(16).optional(),
  }).optional(),
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

  try {
    const upstream = new URL("/api/miniapps/admin/media/upload-url", hostAppBaseURL);
    const response = await fetch(upstream.toString(), {
      method: "POST",
      headers: createProxyHeaders(req),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      const message = await parseHostErrorPayload(response, "Failed to generate media upload URL");
      return jsonError(message, response.status);
    }

    const data = await response.json().catch((e: unknown) => { console.warn("[media/upload-url] failed to parse response JSON:", e instanceof Error ? e.message : String(e)); return ({}); });
    return NextResponse.json(data, { status: response.status });
  } catch {
    return jsonError("Failed to reach host-app media upload endpoint", 502);
  }
}
