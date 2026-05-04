import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import {
  createProxyHeaders,
  parseHostErrorPayload,
  resolveHostAppBaseURL,
} from "@/lib/host-admin-proxy";

const definitionItemSchema = z.object({
  file_name: z.string().trim().optional(),
  content: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
});

const requestSchema = z.object({
  dry_run: z.boolean().optional(),
  stop_on_error: z.boolean().optional(),
  definitions: z.array(definitionItemSchema).min(1).max(200),
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
    payload = requestSchema.parse(await req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(error.errors[0]?.message || "Invalid input", 400);
    }
    return jsonError("Invalid JSON body", 400);
  }

  try {
    const upstream = new URL(
      "/api/miniapps/admin/import-batch",
      hostAppBaseURL,
    );
    const response = await fetch(upstream.toString(), {
      method: "POST",
      headers: createProxyHeaders(req),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const message = await parseHostErrorPayload(
        response,
        "Batch import failed",
      );
      return jsonError(message, response.status);
    }

    const data = await response.json().catch((e: unknown) => {
      console.warn(
        "[import-batch] failed to parse response JSON:",
        e instanceof Error ? e.message : String(e),
      );
      return {};
    });
    return NextResponse.json(data, { status: response.status });
  } catch {
    return jsonError("Failed to reach host-app batch import endpoint", 502);
  }
}
