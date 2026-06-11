// DEMO DATA: this route serves read-only contract registry entries so the
// console page renders in dev stacks without the deployment backend. Hashes
// resolve from CONTRACT_*_HASH env when configured and fall back to clearly
// fake placeholder hashes otherwise. Every response carries the
// `X-Mock-Data: true` header, which drives the demo-data banner in the UI.
// Mutations are intentionally NOT implemented: there is no persistence behind
// this route, and silently echoing the mutated list back would make an
// operator believe a contract registration changed when it did not.
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";

const MOCK_HEADERS = { "X-Mock-Data": "true" } as const;

function demoContracts() {
  return [
    { id: "AppRegistry", name: "AppRegistry", hash: process.env.CONTRACT_APPREGISTRY_HASH || "0x1111111111111111111111111111111111111111", deployed: false, _mock: true },
    { id: "Governance", name: "Governance", hash: process.env.CONTRACT_GOVERNANCE_HASH || "0x3333333333333333333333333333333333333333", deployed: false, _mock: true },
    { id: "PriceFeed", name: "PriceFeed", hash: process.env.CONTRACT_PRICEFEED_HASH || "0x4444444444444444444444444444444444444444", deployed: false, _mock: true },
    { id: "RandomnessLog", name: "RandomnessLog", hash: process.env.CONTRACT_RANDOMNESSLOG_HASH || "0x5555555555555555555555555555555555555555", deployed: false, _mock: true },
    { id: "AutomationAnchor", name: "AutomationAnchor", hash: process.env.CONTRACT_AUTOMATIONANCHOR_HASH || "0x6666666666666666666666666666666666666666", deployed: false, _mock: true },
  ];
}

export async function GET(request: Request) {
  const authResponse = await requireAdminAuth(request);
  if (authResponse) return authResponse;

  return NextResponse.json(demoContracts(), { headers: MOCK_HEADERS });
}

export async function POST(request: Request) {
  const authResponse = await requireAdminAuth(request);
  if (authResponse) return authResponse;

  await request.json().catch(() => null);

  return NextResponse.json(
    {
      error:
        "Contract registry persistence is not implemented. The submitted entry was discarded — manage contract hashes through deployment env configuration.",
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
        "Contract registry deletion is not implemented. This console only displays demo registry entries.",
      code: "NOT_IMPLEMENTED",
    },
    { status: 501, headers: MOCK_HEADERS },
  );
}
