"use client";

import { Input } from "@/components/ui/Input";

type Props = {
  form: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- dynamic form with many optional fields
  permissionKeys: string[];
  togglePerm: (key: string) => void;
  update: (key: string, value: string | boolean) => void;
};

export function PermissionsTab({ form, permissionKeys, togglePerm, update }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <div className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Permissions</div>
        <div className="flex flex-wrap gap-3">
          {permissionKeys.map(key => (
            <label key={key} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={!!form.permissions[key]} onChange={() => togglePerm(key)} className="rounded accent-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50" />
              {key}
            </label>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Input label="Daily Gas Cap/User" placeholder="20" value={form.daily_gas_cap_per_user} onChange={e => update("daily_gas_cap_per_user", e.target.value)} />
        <Input label="Governance Cap" placeholder="100" value={form.governance_cap} onChange={e => update("governance_cap", e.target.value)} />
        <Input label="Max Gas/Tx" placeholder="5" value={form.max_gas_per_tx} onChange={e => update("max_gas_per_tx", e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Assets Allowed (comma-separated)" placeholder="GAS" value={form.assets_allowed} onChange={e => update("assets_allowed", e.target.value)} />
        <Input label="Governance Assets (comma-separated)" placeholder="BNEO" value={form.governance_assets_allowed} onChange={e => update("governance_assets_allowed", e.target.value)} />
      </div>
    </div>
  );
}
