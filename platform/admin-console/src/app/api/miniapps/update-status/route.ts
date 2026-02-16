import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { SUPABASE_URL, SERVICE_ROLE_KEY } from "@/lib/constants";
import { z } from "zod";

const updateStatusSchema = z.object({
  appId: z.string().min(1, "appId is required").regex(/^[a-z0-9][a-z0-9_-]*$/, "invalid appId format"),
  status: z.enum(["active", "disabled"], { message: "status must be active or disabled" }),
});

export async function POST(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  if (!SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Service role key not configured" }, { status: 500 });
  }

  let payload: z.infer<typeof updateStatusSchema>;
  try {
    const body = await req.json();
    payload = updateStatusSchema.parse(body);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0]?.message || "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { appId, status } = payload;

  const url = `${SUPABASE_URL}/rest/v1/miniapps?app_id=eq.${encodeURIComponent(appId)}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "PATCH",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ status }),
    });
  } catch {
    return NextResponse.json({ error: "Failed to connect to database" }, { status: 502 });
  }

  if (!response.ok) {
    return NextResponse.json({ error: "Failed to update MiniApp status" }, { status: response.status });
  }

  return NextResponse.json({ success: true });
}
