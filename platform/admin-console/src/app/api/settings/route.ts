// DEMO DATA: this route serves a read-only sample platform config so the
// console page renders in dev stacks without the settings backend. Every
// response carries the `X-Mock-Data: true` header, which drives the demo-data
// banner in the UI. Mutations are intentionally NOT implemented: there is no
// persistence behind this route, and silently echoing the merged config back
// would make an operator believe a platform setting changed when it did not.
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";

const MOCK_HEADERS = { "X-Mock-Data": "true" } as const;

const DEMO_PLATFORM_CONFIG = {
  maintenanceMode: false,
  approvalGateRequired: true,
  logLevel: "info",
  pricefeedIntervalMs: 60000,
  maxMiniappSizeMb: 50,
} as const;

export async function GET(request: Request) {
  const authResponse = await requireAdminAuth(request);
  if (authResponse) return authResponse;

  return NextResponse.json(DEMO_PLATFORM_CONFIG, { headers: MOCK_HEADERS });
}

export async function POST(request: Request) {
  const authResponse = await requireAdminAuth(request);
  if (authResponse) return authResponse;

  await request.json().catch(() => null);

  return NextResponse.json(
    {
      error:
        "Platform settings persistence is not implemented. The submitted changes were discarded — this console only displays demo configuration.",
      code: "NOT_IMPLEMENTED",
    },
    { status: 501, headers: MOCK_HEADERS },
  );
}
