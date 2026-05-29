import { ShieldCheck } from "lucide-react";

export function NetworkSafetyBadge({
  networkSafetyOk,
  targetNetworkLabel,
  walletNetworkLabel,
  testId,
}: {
  networkSafetyOk: boolean;
  targetNetworkLabel: string;
  walletNetworkLabel: string;
  testId?: string;
}) {
  return (
    <div
      className={`mt-3 rounded-xl border px-3 py-2 text-xs ${
        networkSafetyOk
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-amber-200 bg-amber-50 text-amber-700"
      }`}
      data-testid={testId}
    >
      <div className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="m-0 font-semibold">Target: {targetNetworkLabel}</p>
          <p className="m-0 break-words">Wallet: {walletNetworkLabel}</p>
        </div>
      </div>
    </div>
  );
}
