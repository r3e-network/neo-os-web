"use client";

import { Input } from "@/components/ui/Input";
import { ContractInitSchemaAutoForm } from "../ContractInitSchemaAutoForm";
import type { ContractInitSchemaField } from "../../lib/contract-init-schema";
import type { MiniAppFormState } from "../../lib/form-types";

type Props = {
  form: MiniAppFormState;
  mode: "create" | "edit";
  update: (key: string, value: string | boolean) => void;
  contractInitSchemaState: {
    fields: ContractInitSchemaField[];
    error: string;
  };
  contractInitParamValues: Record<string, unknown>;
  updateContractInitParamField: (field: ContractInitSchemaField, value: string | boolean) => void;
  applyContractSchemaDefaults: () => void;
};

export function BasicTab({
  form,
  mode,
  update,
  contractInitSchemaState,
  contractInitParamValues,
  updateContractInitParamField,
  applyContractSchemaDefaults,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input label="App ID *" placeholder="com.example.myapp" value={form.app_id} onChange={e => update("app_id", e.target.value)} disabled={mode === "edit"} />
        <Input label="Name *" placeholder="My App" value={form.name} onChange={e => update("name", e.target.value)} />
        <Input label="Name (ZH)" placeholder="我的小程序" value={form.name_zh} onChange={e => update("name_zh", e.target.value)} />
        <Input label="Entry URL *" placeholder="mf://manifest?app=com.example.myapp" value={form.entry_url} onChange={e => update("entry_url", e.target.value)} />
        <Input label="Version" placeholder="1.0.0" value={form.version} onChange={e => update("version", e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Developer User ID *" placeholder="UUID from users table" value={form.developer_user_id} onChange={e => update("developer_user_id", e.target.value)} />
        <Input label="Developer Pubkey (hex)" placeholder="03f35d..." value={form.developer_pubkey} onChange={e => update("developer_pubkey", e.target.value)} />
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm pb-2">
            <input type="checkbox" checked={form.attestation_required} onChange={e => update("attestation_required", e.target.checked)} className="rounded accent-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50" />
            Attestation Required
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No-Code Template Binding</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Input label="Frontend Template ID" placeholder="prediction.market.modern" value={form.frontend_template_id} onChange={e => update("frontend_template_id", e.target.value)} />
          <Input label="Frontend Version" placeholder="1.0.0" value={form.frontend_template_version} onChange={e => update("frontend_template_version", e.target.value)} />
          <Input label="Frontend Variant" placeholder="market-modern" value={form.frontend_template_variant} onChange={e => update("frontend_template_variant", e.target.value)} />
        </div>
        <div>
          <label htmlFor="frontend-params-json" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Frontend Params JSON</label>
          <textarea
            id="frontend-params-json"
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 p-2 text-xs font-mono transition-colors resize-none dark:bg-gray-800 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
            rows={4}
            value={form.frontend_template_params_json}
            onChange={e => update("frontend_template_params_json", e.target.value)}
            placeholder={`{\n  "show_disclaimer": true\n}`}
            aria-label="Frontend params JSON"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Input label="Contract Template ID" placeholder="prediction-binary" value={form.contract_template_id} onChange={e => update("contract_template_id", e.target.value)} />
          <Input label="Contract Version" placeholder="1.2.0" value={form.contract_template_version} onChange={e => update("contract_template_version", e.target.value)} />
          <Input label="Contract Variant" placeholder="oracle-required" value={form.contract_template_variant} onChange={e => update("contract_template_variant", e.target.value)} />
          <Input label="Factory Template Ref" placeholder="factory.prediction.v2" value={form.contract_template_factory_ref} onChange={e => update("contract_template_factory_ref", e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Input
            label="Requires Host Capabilities"
            placeholder="oracle,attestation,secrets"
            value={form.contract_template_requires_capabilities}
            onChange={e => update("contract_template_requires_capabilities", e.target.value)}
          />
          <Input
            label="Min Factory Version"
            placeholder="1.0.0"
            value={form.contract_template_min_factory_version}
            onChange={e => update("contract_template_min_factory_version", e.target.value)}
          />
          <Input
            label="Max Factory Version"
            placeholder="2.0.0"
            value={form.contract_template_max_factory_version}
            onChange={e => update("contract_template_max_factory_version", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="contract-init-params-json" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Contract Init Params JSON</label>
            <textarea
              id="contract-init-params-json"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 p-2 text-xs font-mono transition-colors resize-none dark:bg-gray-800 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
              rows={4}
              value={form.contract_template_init_params_json}
              onChange={e => update("contract_template_init_params_json", e.target.value)}
              placeholder={`{\n  "oracle": "0x...",\n  "fee_bps": 100\n}`}
              aria-label="Contract init params JSON"
            />
          </div>
          <div>
            <label htmlFor="contract-init-schema-json" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Contract Init Schema JSON</label>
            <textarea
              id="contract-init-schema-json"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 p-2 text-xs font-mono transition-colors resize-none dark:bg-gray-800 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
              rows={4}
              value={form.contract_template_init_schema_json}
              onChange={e => update("contract_template_init_schema_json", e.target.value)}
              placeholder={`{\n  "type": "object",\n  "required": ["oracle"]\n}`}
              aria-label="Contract init schema JSON"
            />
          </div>
        </div>
        <ContractInitSchemaAutoForm
          fields={contractInitSchemaState.fields}
          values={contractInitParamValues}
          parseError={contractInitSchemaState.error}
          onChange={updateContractInitParamField}
          onApplyDefaults={applyContractSchemaDefaults}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="contract-method-schema-json" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Contract Method Schema JSON</label>
            <textarea
              id="contract-method-schema-json"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 p-2 text-xs font-mono transition-colors resize-none dark:bg-gray-800 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
              rows={4}
              value={form.contract_template_method_schema_json}
              onChange={e => update("contract_template_method_schema_json", e.target.value)}
              placeholder={`{\n  "buyYes": { "params": ["amount"] }\n}`}
              aria-label="Contract method schema JSON"
            />
          </div>
          <div>
            <label htmlFor="security-profile-json" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Security Profile JSON</label>
            <textarea
              id="security-profile-json"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 p-2 text-xs font-mono transition-colors resize-none dark:bg-gray-800 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
              rows={4}
              value={form.contract_template_security_profile_json}
              onChange={e => update("contract_template_security_profile_json", e.target.value)}
              placeholder={`{\n  "upgradeable": false,\n  "audited": true\n}`}
              aria-label="Security profile JSON"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Input
            label="Audit Provider"
            placeholder="BlockSec"
            value={form.contract_template_audit_provider}
            onChange={e => update("contract_template_audit_provider", e.target.value)}
          />
          <Input
            label="Audit Hash"
            placeholder="ipfs://... or sha256:..."
            value={form.contract_template_audit_hash}
            onChange={e => update("contract_template_audit_hash", e.target.value)}
          />
          <Input
            label="Audit Date"
            placeholder="2026-02-22"
            value={form.contract_template_audit_date}
            onChange={e => update("contract_template_audit_date", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
