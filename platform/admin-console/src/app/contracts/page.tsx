import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const CONTRACTS = [
  { name: "AppRegistry", env: "CONTRACT_APPREGISTRY_HASH" },
  { name: "PaymentHub", env: "CONTRACT_PAYMENTHUB_HASH" },
  { name: "Governance", env: "CONTRACT_GOVERNANCE_HASH" },
  { name: "PriceFeed", env: "CONTRACT_PRICEFEED_HASH" },
  { name: "RandomnessLog", env: "CONTRACT_RANDOMNESSLOG_HASH" },
  { name: "AutomationAnchor", env: "CONTRACT_AUTOMATIONANCHOR_HASH" },
];

export default function ContractsPage() {
  const networkMagic = String(process.env.NEO_NETWORK_MAGIC || "").trim();
  const network = networkMagic ? `Magic ${networkMagic}` : "Unknown";
  const contracts = CONTRACTS.map((item) => {
    const hash = String(process.env[item.env] || "").trim();
    const deployed = /^0x[0-9a-fA-F]{40}$/.test(hash);
    return {
      ...item,
      hash: deployed ? hash : "Not configured",
      deployed,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contracts</h1>
          <p className="text-gray-600">Manage smart contracts</p>
        </div>
        <Button>Deploy New Contract</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Deployed Contracts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {contracts.map((contract) => (
              <div
                key={contract.name}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-4"
              >
                <div>
                  <div className="font-medium text-gray-900">{contract.name}</div>
                  <div className="text-sm text-gray-500">Hash: {contract.hash}</div>
                  <div className="text-sm text-gray-500">Network: {network}</div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={contract.deployed ? "success" : "default"}>
                    {contract.deployed ? "Deployed" : "Not Deployed"}
                  </Badge>
                  <Button size="sm" variant="ghost">
                    View
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contract Deployment Wizard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
            <p className="text-gray-600">Contract deployment available via CLI</p>
            <p className="mt-2 text-sm text-gray-500">
              Use <code className="bg-gray-200 px-1 rounded">neo-go contract deploy</code> or the deploy scripts in{" "}
              <code className="bg-gray-200 px-1 rounded">cmd/deploy-contracts</code>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
