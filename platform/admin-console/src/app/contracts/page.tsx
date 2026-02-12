// =============================================================================
// Contracts Page
// =============================================================================

"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";

type Contract = {
  name: string;
  scriptHash: string;
  deployed: boolean;
  network: string;
  description: string;
};

const CONTRACTS: Contract[] = [
  {
    name: "AppRegistry",
    scriptHash: process.env.NEXT_PUBLIC_APP_REGISTRY_HASH || "Not configured",
    deployed: true,
    network: process.env.NEXT_PUBLIC_NEO_NETWORK || "TestNet",
    description: "Central registry for MiniApp metadata and lifecycle management",
  },
  {
    name: "PaymentHub",
    scriptHash: process.env.NEXT_PUBLIC_PAYMENT_HUB_HASH || "Not configured",
    deployed: true,
    network: process.env.NEXT_PUBLIC_NEO_NETWORK || "TestNet",
    description: "Handles GAS payments, fee distribution, and token transfers",
  },
  {
    name: "Governance",
    scriptHash: process.env.NEXT_PUBLIC_GOVERNANCE_HASH || "Not configured",
    deployed: true,
    network: process.env.NEXT_PUBLIC_NEO_NETWORK || "TestNet",
    description: "On-chain governance voting and proposal management",
  },
  {
    name: "PriceFeed",
    scriptHash: process.env.NEXT_PUBLIC_PRICE_FEED_HASH || "Not configured",
    deployed: true,
    network: process.env.NEXT_PUBLIC_NEO_NETWORK || "TestNet",
    description: "Oracle price feed aggregation for token pricing",
  },
  {
    name: "RandomnessLog",
    scriptHash: process.env.NEXT_PUBLIC_RANDOMNESS_LOG_HASH || "Not configured",
    deployed: true,
    network: process.env.NEXT_PUBLIC_NEO_NETWORK || "TestNet",
    description: "Verifiable random function (VRF) result logging",
  },
  {
    name: "AutomationAnchor",
    scriptHash: process.env.NEXT_PUBLIC_AUTOMATION_ANCHOR_HASH || "Not configured",
    deployed: true,
    network: process.env.NEXT_PUBLIC_NEO_NETWORK || "TestNet",
    description: "Cron-like automation trigger anchoring on-chain",
  },
];

export default function ContractsPage() {
  const [expandedContract, setExpandedContract] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contracts</h1>
          <p className="text-muted-foreground">Smart contract deployment status and management</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Deployed Contracts</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contract</TableHead>
                <TableHead>Script Hash</TableHead>
                <TableHead>Network</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CONTRACTS.map((contract) => (
                <TableRow key={contract.name}>
                  <TableCell>
                    <div>
                      <div className="font-medium text-foreground">{contract.name}</div>
                      <div className="text-muted-foreground text-xs">{contract.description}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {contract.scriptHash === "Not configured" ? (
                      <span className="text-amber-400">Not configured</span>
                    ) : (
                      contract.scriptHash
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{contract.network}</TableCell>
                  <TableCell>
                    <Badge
                      variant={contract.deployed && contract.scriptHash !== "Not configured" ? "success" : "warning"}
                    >
                      {contract.deployed && contract.scriptHash !== "Not configured" ? "Deployed" : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setExpandedContract(expandedContract === contract.name ? null : contract.name)}
                    >
                      {expandedContract === contract.name ? "Hide" : "Details"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deployment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-border/20 bg-muted/30 rounded-lg border p-8 text-center">
            <p className="text-muted-foreground">Contract deployment available via CLI</p>
            <p className="text-muted-foreground mt-2 text-sm">
              Use <code className="bg-muted rounded px-1">neo-go contract deploy</code> or the deploy scripts in{" "}
              <code className="bg-muted rounded px-1">cmd/deploy-contracts</code>
            </p>
            <p className="text-muted-foreground mt-4 text-xs">
              Configure contract hashes via environment variables (NEXT_PUBLIC_*_HASH)
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
