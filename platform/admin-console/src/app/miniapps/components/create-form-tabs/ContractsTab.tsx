"use client";

import { Input } from "@/components/ui/Input";
import { OperationParamsEditor } from "../CreateFormSubEditors";

type Props = {
  form: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- dynamic form with many optional fields
  update: (key: string, value: string | boolean) => void;
  setForm: (form: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
  addContract: () => void;
  removeContract: (i: number) => void;
  updateContract: (i: number, field: "name" | "hash", val: string) => void;
  addOperation: () => void;
  removeOperation: (i: number) => void;
  updateOperation: (
    i: number,
    field: "name" | "method" | "description" | "gas_cost" | "button_style" | "confirm_message" | "params",
    val: string,
  ) => void;
  addComponent: () => void;
  removeComponent: (i: number) => void;
  updateComponent: (i: number, field: "type" | "display" | "props", val: string) => void;
};

export function ContractsTab({
  form,
  update,
  setForm,
  addContract,
  removeContract,
  updateContract,
  addOperation,
  removeOperation,
  updateOperation,
  addComponent,
  removeComponent,
  updateComponent,
}: Props) {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Contracts</div>
          <button type="button" onClick={addContract} className="text-xs cursor-pointer text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 rounded-md">+ Add Contract</button>
        </div>
        {form.contracts.map((c: { name: string; hash: string }, i: number) => (
          <div key={i} className="flex gap-2 mb-2">
            <Input id={`contract-name-${i}`} placeholder="Contract name" value={c.name} onChange={e => updateContract(i, "name", e.target.value)} aria-label="Contract name" />
            <Input id={`contract-hash-${i}`} placeholder="0x..." value={c.hash} onChange={e => updateContract(i, "hash", e.target.value)} aria-label="Contract hash" />
            <button type="button" onClick={() => removeContract(i)} className="text-red-500 dark:text-red-400 text-xs px-2 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 rounded-lg">Remove</button>
          </div>
        ))}
        {!form.contracts.length && <p className="text-xs text-gray-500 dark:text-gray-400">No contracts added</p>}
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Operations</div>
          <button type="button" onClick={addOperation} className="text-xs cursor-pointer text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 rounded-md">+ Add Operation</button>
        </div>
        {form.operations.map((o: any, i: number) => (
          <div key={i} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 mb-3 space-y-2">
            <div className="flex gap-2">
              <Input id={`op-name-${i}`} placeholder="Name" value={o.name} onChange={e => updateOperation(i, "name", e.target.value)} aria-label="Operation name" />
              <Input id={`op-method-${i}`} placeholder="Method" value={o.method} onChange={e => updateOperation(i, "method", e.target.value)} aria-label="Operation method" />
              <Input id={`op-desc-${i}`} placeholder="Description" value={o.description} onChange={e => updateOperation(i, "description", e.target.value)} aria-label="Operation description" />
              <Input id={`op-gas-${i}`} placeholder="Gas" value={o.gas_cost} onChange={e => updateOperation(i, "gas_cost", e.target.value)} aria-label="Gas cost" />
              <button type="button" onClick={() => removeOperation(i)} className="text-red-500 dark:text-red-400 text-xs px-2 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 rounded-lg">Remove</button>
            </div>
            <div className="flex gap-2">
              <div className="w-40">
                <select id={`button-style-${i}`} className="w-full rounded-md border border-gray-300 dark:border-gray-600 p-1.5 text-xs cursor-pointer transition-colors dark:bg-gray-800 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50" value={o.button_style} onChange={e => updateOperation(i, "button_style", e.target.value)} aria-label="Button style">
                  <option value="">Button Style</option>
                  <option value="primary">Primary</option>
                  <option value="secondary">Secondary</option>
                  <option value="danger">Danger</option>
                  <option value="success">Success</option>
                </select>
              </div>
              <Input id={`op-confirm-${i}`} placeholder="Confirm message (optional)" value={o.confirm_message} onChange={e => updateOperation(i, "confirm_message", e.target.value)} aria-label="Confirm message" />
            </div>
            <OperationParamsEditor params={o.params} onChange={params => { const next = [...form.operations]; next[i] = { ...next[i], params }; setForm({ ...form, operations: next }); }} />
          </div>
        ))}
        {!form.operations.length && <p className="text-xs text-gray-500 dark:text-gray-400">No operations added</p>}
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Components</div>
          <button type="button" onClick={addComponent} className="text-xs cursor-pointer text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 rounded-md">+ Add Component</button>
        </div>
        {form.components.map((c: any, i: number) => (
          <div key={i} className="flex gap-2 mb-2">
            <Input id={`comp-type-${i}`} placeholder="live_voting" value={c.type} onChange={e => updateComponent(i, "type", e.target.value)} aria-label="Component type" />
            <Input id={`comp-display-${i}`} placeholder="card" value={c.display} onChange={e => updateComponent(i, "display", e.target.value)} aria-label="Component display" />
            <Input id={`comp-props-${i}`} placeholder='{"key":"value"}' value={c.props} onChange={e => updateComponent(i, "props", e.target.value)} aria-label="Component props" />
            <button type="button" onClick={() => removeComponent(i)} className="text-red-500 dark:text-red-400 text-xs px-2 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 rounded-lg">Remove</button>
          </div>
        ))}
        {!form.components.length && <p className="text-xs text-gray-500 dark:text-gray-400">No components added</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Callback Contract" placeholder="0x..." value={form.callback_contract} onChange={e => update("callback_contract", e.target.value)} />
        <Input label="Callback Method" placeholder="onCallback" value={form.callback_method} onChange={e => update("callback_method", e.target.value)} />
      </div>
    </div>
  );
}
