import { ShieldCheck } from "lucide-react";
import type { MiniAppInfo } from "../..";
import type { ResolvedMiniAppContractDomain } from "../../../lib/miniapp-runtime";
import {
  contractDomainBadgeClass,
  formatContractDomainNetwork,
  formatContractDomainSource,
} from "./MiniAppDetailSections";

export function TechnicalDetailsPanel({
  app,
  contractDisplayValue,
  runtimeDisplayValue,
  contractDomainBinding,
}: {
  app: MiniAppInfo;
  contractDisplayValue: string;
  runtimeDisplayValue: string;
  contractDomainBinding: ResolvedMiniAppContractDomain | null;
}) {
  return (
    <details className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50">
        <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
        Technical details
      </summary>
      <div className="mt-3 space-y-2">
        <p className="my-0 text-xs text-gray-500">
          Application ID:{" "}
          <code className="break-all rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[11px] text-emerald-700">
            {app.app_id}
          </code>
        </p>
        <p className="my-0 text-xs text-gray-500">
          Contract Hash:{" "}
          <code className="break-all rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[11px] text-emerald-700">
            {contractDisplayValue}
          </code>
        </p>
        <p className="my-0 text-xs text-gray-500">
          Runtime:{" "}
          <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[11px] text-emerald-700">
            {runtimeDisplayValue}
          </span>
        </p>
        {contractDomainBinding && (
          <p
            className="my-0 text-xs text-gray-500"
            data-testid="contract-domain-binding-technical"
          >
            {formatContractDomainNetwork(contractDomainBinding.network)} Domain:{" "}
            <code className="break-all rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[11px] text-emerald-700">
              {contractDomainBinding.domain}
            </code>{" "}
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${contractDomainBadgeClass(contractDomainBinding.source)}`}
            >
              {formatContractDomainSource(contractDomainBinding.source)}
            </span>
          </p>
        )}
        {app.docs_url && (
          <p className="my-0 text-xs text-gray-500">
            Docs URL:{" "}
            <code className="break-all rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[11px] text-emerald-700">
              {app.docs_url}
            </code>
          </p>
        )}
      </div>
    </details>
  );
}
