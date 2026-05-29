"use client";

import { Input } from "@/components/ui/Input";
import { OperationParamsEditor } from "../CreateFormSubEditors";
import type { MiniAppFormState } from "../../lib/form-types";

type OperationParam = {
  name: string;
  type: string;
  label: string;
  required: boolean;
  default_value: string;
  placeholder: string;
  options: string;
};

type OperationEntry = {
  name: string;
  method: string;
  description: string;
  gas_cost: string;
  button_style: string;
  confirm_message: string;
  params: OperationParam[];
};

type ComponentEntry = {
  type: string;
  display: string;
  props: string;
};

type Props = {
  form: MiniAppFormState;
  update: (key: string, value: string | boolean) => void;
  setForm: (form: MiniAppFormState) => void;
  addContract: () => void;
  removeContract: (i: number) => void;
  updateContract: (i: number, field: "name" | "hash", val: string) => void;
  addOperation: () => void;
  removeOperation: (i: number) => void;
  updateOperation: (
    i: number,
    field:
      | "name"
      | "method"
      | "description"
      | "gas_cost"
      | "button_style"
      | "confirm_message"
      | "params",
    val: string,
  ) => void;
  addComponent: () => void;
  removeComponent: (i: number) => void;
  updateComponent: (
    i: number,
    field: "type" | "display" | "props",
    val: string,
  ) => void;
  modularPreview?: {
    visible: boolean;
    valid: boolean;
    mode: string;
    message: string;
    preview: string;
  };
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
  modularPreview,
}: Props) {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-gray-700">
            Contracts
          </div>
          <button
            type="button"
            onClick={addContract}
            className="cursor-pointer rounded-lg text-xs text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
          >
            + Add Contract
          </button>
        </div>
        {form.contracts.map((c: { name: string; hash: string }, i: number) => (
          <div key={i} className="mb-2 flex flex-wrap gap-2">
            <Input
              id={`contract-name-${i}`}
              placeholder="Contract name"
              value={c.name}
              onChange={(e) => updateContract(i, "name", e.target.value)}
              aria-label="Contract name"
            />
            <Input
              id={`contract-hash-${i}`}
              placeholder="0x..."
              value={c.hash}
              onChange={(e) => updateContract(i, "hash", e.target.value)}
              aria-label="Contract hash"
            />
            <button
              type="button"
              onClick={() => removeContract(i)}
              className="shrink-0 cursor-pointer rounded-lg px-2 text-xs text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
            >
              Remove
            </button>
          </div>
        ))}
        {!form.contracts.length && (
          <p className="text-xs text-gray-500">
            No contracts added
          </p>
        )}
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-gray-700">
            Operations
          </div>
          <button
            type="button"
            onClick={addOperation}
            className="cursor-pointer rounded-lg text-xs text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
          >
            + Add Operation
          </button>
        </div>
        {(form.operations as OperationEntry[]).map(
          (o: OperationEntry, i: number) => (
            <div
              key={i}
              className="mb-3 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3"
            >
              <div className="flex flex-wrap gap-2">
                <Input
                  id={`op-name-${i}`}
                  placeholder="Name"
                  value={o.name}
                  onChange={(e) => updateOperation(i, "name", e.target.value)}
                  aria-label="Operation name"
                />
                <Input
                  id={`op-method-${i}`}
                  placeholder="Method"
                  value={o.method}
                  onChange={(e) => updateOperation(i, "method", e.target.value)}
                  aria-label="Operation method"
                />
                <Input
                  id={`op-desc-${i}`}
                  placeholder="Description"
                  value={o.description}
                  onChange={(e) =>
                    updateOperation(i, "description", e.target.value)
                  }
                  aria-label="Operation description"
                />
                <Input
                  id={`op-gas-${i}`}
                  placeholder="Gas"
                  value={o.gas_cost}
                  onChange={(e) =>
                    updateOperation(i, "gas_cost", e.target.value)
                  }
                  aria-label="Gas cost"
                />
                <button
                  type="button"
                  onClick={() => removeOperation(i)}
                  className="shrink-0 cursor-pointer rounded-lg px-2 text-xs text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                >
                  Remove
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="w-40">
                  <select
                    id={`button-style-${i}`}
                    className="w-full cursor-pointer rounded-xl border border-gray-300 bg-white p-1.5 text-xs text-gray-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
                    value={o.button_style}
                    onChange={(e) =>
                      updateOperation(i, "button_style", e.target.value)
                    }
                    aria-label="Button style"
                  >
                    <option value="">Button Style</option>
                    <option value="primary">Primary</option>
                    <option value="secondary">Secondary</option>
                    <option value="danger">Danger</option>
                    <option value="success">Success</option>
                  </select>
                </div>
                <Input
                  id={`op-confirm-${i}`}
                  placeholder="Confirm message (optional)"
                  value={o.confirm_message}
                  onChange={(e) =>
                    updateOperation(i, "confirm_message", e.target.value)
                  }
                  aria-label="Confirm message"
                />
              </div>
              <OperationParamsEditor
                params={o.params}
                onChange={(params) => {
                  const next = [...form.operations];
                  next[i] = { ...next[i], params };
                  setForm({ ...form, operations: next });
                }}
              />
            </div>
          ),
        )}
        {!form.operations.length && (
          <p className="text-xs text-gray-500">
            No operations added
          </p>
        )}
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-gray-700">
            Components
          </div>
          <button
            type="button"
            onClick={addComponent}
            className="cursor-pointer rounded-lg text-xs text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
          >
            + Add Component
          </button>
        </div>
        {(form.components as ComponentEntry[]).map(
          (c: ComponentEntry, i: number) => (
            <div key={i} className="mb-2 flex flex-wrap gap-2">
              <Input
                id={`comp-type-${i}`}
                placeholder="live_voting"
                value={c.type}
                onChange={(e) => updateComponent(i, "type", e.target.value)}
                aria-label="Component type"
              />
              <Input
                id={`comp-display-${i}`}
                placeholder="card"
                value={c.display}
                onChange={(e) => updateComponent(i, "display", e.target.value)}
                aria-label="Component display"
              />
              <Input
                id={`comp-props-${i}`}
                placeholder='{"key":"value"}'
                value={c.props}
                onChange={(e) => updateComponent(i, "props", e.target.value)}
                aria-label="Component props"
              />
              <button
                type="button"
                onClick={() => removeComponent(i)}
                className="shrink-0 cursor-pointer rounded-lg px-2 text-xs text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
              >
                Remove
              </button>
            </div>
          ),
        )}
        {!form.components.length && (
          <p className="text-xs text-gray-500">
            No components added
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          label="Callback Contract"
          placeholder="0x..."
          value={form.callback_contract}
          onChange={(e) => update("callback_contract", e.target.value)}
        />
        <Input
          label="Callback Method"
          placeholder="onCallback"
          value={form.callback_method}
          onChange={(e) => update("callback_method", e.target.value)}
        />
      </div>
      {modularPreview?.visible && (
        <div
          className={`rounded-xl border p-4 ${modularPreview.valid ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/60"}`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Modular Plan Preview
                {modularPreview.mode ? ` · ${modularPreview.mode}` : ""}
              </div>
              <p
                className={`mt-1 text-xs ${modularPreview.valid ? "text-emerald-700" : "text-amber-700"}`}
              >
                {modularPreview.message}
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase ${modularPreview.valid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
            >
              {modularPreview.valid ? "Valid" : "Needs Fixes"}
            </span>
          </div>
          <p className="mt-3 text-[11px] text-gray-500">
            Shared/router fields are currently driven by imported JSON or
            installed template drafts. Use this preview to validate recipe,
            binding, registry, and instance wiring before save.
          </p>
          {modularPreview.preview && (
            <pre className="mt-3 max-h-80 overflow-auto rounded-lg border border-gray-200 bg-white/80 p-3 text-[11px] leading-5 text-gray-700">
              {modularPreview.preview}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
