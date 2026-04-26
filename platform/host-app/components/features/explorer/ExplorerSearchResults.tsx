"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Code, Cpu, FileCode } from "lucide-react";
import type {
  ExplorerContractCall,
  ExplorerSearchResult,
  ExplorerTransactionData,
} from "./types";

export function ExplorerSearchResults({
  result,
}: {
  result: ExplorerSearchResult;
}) {
  if (!result.found) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-500">
          No results found for this query
        </CardContent>
      </Card>
    );
  }

  switch (result.type) {
    case "transaction":
      if (!result.data) {
        return (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              Transaction data unavailable
            </CardContent>
          </Card>
        );
      }
      return <TransactionResult data={result.data} />;
    case "address":
      return <AddressResult result={result} />;
    case "contract":
      return <ContractResult result={result} />;
    default:
      return null;
  }
}

function TransactionResult({ data }: { data: ExplorerTransactionData }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5" aria-hidden="true" />
            Transaction Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <Field
              label="Hash"
              value={<p className="break-all font-mono text-xs">{data.hash}</p>}
            />
            <Field
              label="Sender"
              value={
                <p className="break-all font-mono text-xs">{data.sender}</p>
              }
            />
            <Field
              label="Status"
              value={
                <Badge
                  variant={data.vm_state === "HALT" ? "default" : "destructive"}
                >
                  {data.vm_state}
                </Badge>
              }
            />
            <Field label="Gas" value={<p>{data.gas_consumed}</p>} />
          </div>
        </CardContent>
      </Card>

      {data.opcode_traces?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" aria-hidden="true" />
              Opcode Execution Trace ({data.opcode_traces.length} steps)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-auto">
              <table
                className="w-full text-xs font-mono"
                aria-label="Opcode execution trace"
              >
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b">
                    <th scope="col" className="p-2 text-left">
                      Step
                    </th>
                    <th scope="col" className="p-2 text-left">
                      Opcode
                    </th>
                    <th scope="col" className="p-2 text-left">
                      Hex
                    </th>
                    <th scope="col" className="p-2 text-left">
                      IP
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.opcode_traces.map((trace) => (
                    <tr
                      key={trace.step_index}
                      className="border-b transition-colors hover:bg-gray-50"
                    >
                      <td className="p-2">{trace.step_index}</td>
                      <td className="p-2 text-emerald-600">{trace.opcode}</td>
                      <td className="p-2 text-gray-500">{trace.opcode_hex}</td>
                      <td className="p-2">{trace.instruction_ptr}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {data.contract_calls?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Contract Calls ({data.contract_calls.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.contract_calls.map((call) => (
                <ContractCallListItem
                  key={`${call.contract_hash}-${call.method}`}
                  call={call}
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {data.syscalls?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" aria-hidden="true" />
              System Calls ({data.syscalls.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {data.syscalls.map((syscall) => (
                <li
                  key={`${syscall.contract_hash}-${syscall.syscall_name}`}
                  className="flex justify-between rounded-lg border border-gray-200 p-2 text-sm"
                >
                  <span className="font-mono">{syscall.syscall_name}</span>
                  <span className="text-gray-500">
                    {syscall.gas_consumed} GAS
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AddressResult({ result }: { result: ExplorerSearchResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Address: {result.address}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4">Total Transactions: {result.tx_count}</p>
        {result.transactions && result.transactions.length > 0 ? (
          <ul className="space-y-2">
            {result.transactions.map((tx) => (
              <li
                key={tx.tx_hash}
                className="flex justify-between rounded-lg border border-gray-200 p-2 text-sm"
              >
                <span className="break-all font-mono text-xs">
                  {tx.tx_hash}
                </span>
                <Badge variant="outline">{tx.role}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No transactions found</p>
        )}
      </CardContent>
    </Card>
  );
}

function ContractResult({ result }: { result: ExplorerSearchResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contract: {result.contract_hash}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4">Total Calls: {result.call_count}</p>
        {result.calls && result.calls.length > 0 ? (
          <ul className="space-y-2">
            {result.calls.map((call) => (
              <li
                key={`${call.contract_hash}-${call.method}`}
                className="flex justify-between rounded-lg border border-gray-200 p-2 text-sm"
              >
                <span className="font-medium">{call.method}</span>
                <Badge variant={call.success ? "default" : "destructive"}>
                  {call.success ? "Success" : "Failed"}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No contract calls found</p>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span className="text-gray-500">{label}:</span>
      {value}
    </div>
  );
}

function ContractCallListItem({ call }: { call: ExplorerContractCall }) {
  return (
    <li className="rounded-lg border border-gray-200 p-2 text-sm">
      <div className="flex justify-between">
        <span className="font-medium">{call.method}</span>
        <Badge variant={call.success ? "default" : "destructive"}>
          {call.success ? "Success" : "Failed"}
        </Badge>
      </div>
      <p className="break-all font-mono text-xs text-gray-500">
        {call.contract_hash}
      </p>
    </li>
  );
}
