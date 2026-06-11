// DEMO DATA: this route serves read-only sample metadata so the console page
// renders in dev stacks without the secret backend. Every response carries the
// `X-Mock-Data: true` header, which drives the demo-data banner in the UI.
// Mutations are intentionally NOT implemented: persisting oracle secrets
// requires the TEE-backed vault, and silently "accepting" a pasted secret
// would make an operator believe a key rotation happened when it did not.
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";

const MOCK_HEADERS = { "X-Mock-Data": "true" } as const;

const DEMO_ORACLE_SECRETS = [
  { id: "1", name: "binance_api_key", description: "Binance API Key for Market Data", lastUpdated: "2026-03-01T10:00:00Z" },
  { id: "2", name: "okx_api_key", description: "OKX API Key", lastUpdated: "2026-03-02T12:30:00Z" },
  { id: "3", name: "twelvedata_api_key", description: "Twelve Data API Key", lastUpdated: "2026-03-05T12:00:00Z" },
] as const;

export async function GET(request: Request) {
  const authResponse = await requireAdminAuth(request);
  if (authResponse) return authResponse;

  // Never return the actual secret values, only metadata
  return NextResponse.json(DEMO_ORACLE_SECRETS, { headers: MOCK_HEADERS });
}

export async function POST(request: Request) {
  const authResponse = await requireAdminAuth(request);
  if (authResponse) return authResponse;

  // Drain the body so the submitted secret value never lingers in the request
  // stream, then refuse explicitly instead of pretending to store it.
  await request.json().catch(() => null);

  return NextResponse.json(
    {
      error:
        "Oracle secret storage is not implemented. The submitted value was discarded — configure secrets through the TEE vault deployment, not this console.",
      code: "NOT_IMPLEMENTED",
    },
    { status: 501, headers: MOCK_HEADERS },
  );
}

export async function DELETE(request: Request) {
  const authResponse = await requireAdminAuth(request);
  if (authResponse) return authResponse;

  return NextResponse.json(
    {
      error:
        "Oracle secret deletion is not implemented. This console only displays demo metadata; manage real secrets through the TEE vault deployment.",
      code: "NOT_IMPLEMENTED",
    },
    { status: 501, headers: MOCK_HEADERS },
  );
}
