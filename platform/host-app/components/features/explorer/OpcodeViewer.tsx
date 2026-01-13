"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Code, List, Zap } from "lucide-react";
import type { OpcodeTrace, ContractCall } from "./types";
import { getOpcodeMetadata, getCategoryColor, formatGas } from "./opcode-utils";

interface OpcodeViewerProps {
  hash: string;
  txType: "simple" | "complex";
  vmState?: string;
  gasConsumed?: string;
  opcodes: OpcodeTrace[];
  contractCalls?: ContractCall[];
}

type ViewMode = "flow" | "text";

export function OpcodeViewer({ hash, txType, vmState, gasConsumed, opcodes, contractCalls = [] }: OpcodeViewerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("flow");
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  if (txType === "simple") {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-center">
        <Code className="mx-auto h-12 w-12 text-gray-400 mb-3" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Simple Transfer</h3>
        <p className="text-gray-500 dark:text-gray-400">
          Opcode traces are not stored for simple NEP-17 transfers to optimize storage.
        </p>
      </div>
    );
  }

  const toggleStep = (step: number) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(step)) {
      newExpanded.delete(step);
    } else {
      newExpanded.add(step);
    }
    setExpandedSteps(newExpanded);
  };

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">VM Execution Trace</h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">{opcodes.length} steps</span>
            {vmState && (
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  vmState === "HALT"
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                    : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                }`}
              >
                {vmState}
              </span>
            )}
            {gasConsumed && (
              <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                <Zap size={14} />
                {formatGas(gasConsumed)} GAS
              </span>
            )}
          </div>
          {/* View mode toggle */}
          <div className="flex items-center gap-1 bg-gray-200 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode("flow")}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                viewMode === "flow"
                  ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <Code size={14} className="inline mr-1" />
              Flow
            </button>
            <button
              onClick={() => setViewMode("text")}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                viewMode === "text"
                  ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <List size={14} className="inline mr-1" />
              Text
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-h-[600px] overflow-y-auto">
        {viewMode === "flow" ? (
          <FlowView
            opcodes={opcodes}
            contractCalls={contractCalls}
            expandedSteps={expandedSteps}
            toggleStep={toggleStep}
          />
        ) : (
          <TextView opcodes={opcodes} contractCalls={contractCalls} />
        )}
      </div>
    </div>
  );
}

// Flow View - Visual representation with expandable steps
interface FlowViewProps {
  opcodes: OpcodeTrace[];
  contractCalls: ContractCall[];
  expandedSteps: Set<number>;
  toggleStep: (step: number) => void;
}

function FlowView({ opcodes, contractCalls, expandedSteps, toggleStep }: FlowViewProps) {
  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {opcodes.map((trace, idx) => {
        const meta = getOpcodeMetadata(trace.opcode);
        const isExpanded = expandedSteps.has(trace.step_index);
        const isSyscall = trace.opcode === "SYSCALL";

        return (
          <div key={trace.id || idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            <button
              onClick={() => toggleStep(trace.step_index)}
              className="w-full px-4 py-2 flex items-center gap-3 text-left"
            >
              {/* Step number */}
              <span className="w-12 text-xs font-mono text-gray-400">#{trace.step_index}</span>

              {/* Expand icon */}
              {isSyscall ? (
                isExpanded ? (
                  <ChevronDown size={14} className="text-gray-400" />
                ) : (
                  <ChevronRight size={14} className="text-gray-400" />
                )
              ) : (
                <span className="w-3.5" />
              )}

              {/* Opcode badge */}
              <span className={`px-2 py-0.5 rounded text-xs font-mono font-medium ${getCategoryColor(meta.category)}`}>
                {trace.opcode}
              </span>

              {/* Description */}
              <span className="flex-1 text-sm text-gray-600 dark:text-gray-400 truncate">{meta.description}</span>

              {/* Instruction pointer */}
              <span className="text-xs font-mono text-gray-400">
                @{trace.instruction_ptr.toString(16).padStart(4, "0")}
              </span>

              {/* Stack size */}
              <span className="text-xs text-gray-400">stack: {trace.stack_size}</span>
            </button>

            {/* Expanded details for SYSCALL */}
            {isExpanded && isSyscall && (
              <div className="px-4 pb-3 pl-24">
                <div className="bg-gray-100 dark:bg-gray-900 rounded p-3 text-sm">
                  <div className="font-mono text-xs text-gray-500 mb-1">Hex: 0x{trace.opcode_hex}</div>
                  {trace.contract_address && (
                    <div className="text-xs text-gray-500">Contract: {trace.contract_address}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Text View - Annotated text representation
interface TextViewProps {
  opcodes: OpcodeTrace[];
  contractCalls: ContractCall[];
}

function TextView({ opcodes, contractCalls }: TextViewProps) {
  return (
    <div className="p-4">
      <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-sm font-mono">
        <code>
          {opcodes.map((trace, idx) => {
            const meta = getOpcodeMetadata(trace.opcode);
            return (
              <div key={trace.id || idx} className="hover:bg-gray-800 -mx-2 px-2">
                <span className="text-gray-500">{String(trace.step_index).padStart(4, " ")} </span>
                <span className="text-blue-400">{trace.instruction_ptr.toString(16).padStart(4, "0")}</span>
                <span className="text-gray-500"> | </span>
                <span className={getTextColor(meta.category)}>{trace.opcode.padEnd(12, " ")}</span>
                <span className="text-gray-500"> ; {meta.description}</span>
                {trace.contract_address && (
                  <span className="text-purple-400"> @ {trace.contract_address.slice(0, 10)}...</span>
                )}
                {"\n"}
              </div>
            );
          })}
        </code>
      </pre>

      {/* Contract Calls Summary */}
      {contractCalls.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Contract Calls ({contractCalls.length})
          </h4>
          <div className="space-y-2">
            {contractCalls.map((call, idx) => (
              <div key={call.id || idx} className="bg-gray-50 dark:bg-gray-800 rounded p-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${call.success ? "bg-green-500" : "bg-red-500"}`} />
                  <span className="font-mono text-gray-900 dark:text-white">{call.method}</span>
                  <span className="text-gray-500">on</span>
                  <span className="font-mono text-xs text-gray-500">{call.contract_address.slice(0, 16)}...</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getTextColor(category: string): string {
  const colors: Record<string, string> = {
    push: "text-cyan-400",
    arithmetic: "text-green-400",
    logic: "text-purple-400",
    stack: "text-yellow-400",
    control: "text-red-400",
    syscall: "text-orange-400",
    other: "text-gray-400",
  };
  return colors[category] || "text-gray-400";
}
