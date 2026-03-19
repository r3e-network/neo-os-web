import Head from "next/head";
import { useState } from "react";
import { Layout, PageHero } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Code, FileCode, Cpu } from "lucide-react";

interface SearchResult {
  type: string;
  found: boolean;
  data?: TransactionData;
  address?: string;
  tx_count?: number;
  transactions?: AddressTx[];
  contract_hash?: string;
  call_count?: number;
  calls?: ContractCall[];
}

interface TransactionData {
  hash: string;
  sender: string;
  vm_state: string;
  gas_consumed: string;
  block_index: number;
  block_time: string;
  opcode_traces: OpcodeTrace[];
  contract_calls: ContractCall[];
  syscalls: Syscall[];
}

interface OpcodeTrace {
  step_index: number;
  opcode: string;
  opcode_hex: string;
  gas_consumed: string;
  instruction_ptr: number;
}

interface ContractCall {
  tx_hash: string;
  method: string;
  contract_hash: string;
  gas_consumed: string;
  success: boolean;
}

interface Syscall {
  syscall_name: string;
  gas_consumed: string;
  contract_hash: string;
}

interface AddressTx {
  tx_hash: string;
  role: string;
  block_time: string;
}

export default function ExplorerPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(`/api/explorer/search?q=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(30000) });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch (err) {
      setError("Search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <Head>
        <title>Neo Explorer | MiniApp Platform</title>
      </Head>

      <div className="pb-16 pt-20">
        <PageHero
          eyebrow="Infrastructure"
          title="Neo N3 Explorer"
          description="Search transactions, addresses, and contracts with execution traces from the host app instead of jumping to a separate tool for basic diagnosis."
          stats={[
            { label: "Search types", value: "3", hint: "Transactions, addresses, contracts" },
            { label: "Execution detail", value: "Live", hint: "Opcode traces, calls, syscalls" },
          ]}
        />

        <div className="container mx-auto max-w-6xl px-4 py-8 sm:py-10">
          {/* Search Bar */}
          <div role="search" className="mb-8 flex max-w-2xl mx-auto gap-2">
            <Input
              aria-label="Search by transaction hash, address, or contract"
              placeholder="Search by tx hash, address, or contract..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button aria-label="Search" onClick={handleSearch} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-center text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">{error}</div>}

          <div aria-live="polite">
            {result && <SearchResults result={result} />}
          </div>
        </div>
      </div>
    </Layout>
  );
}

function SearchResults({ result }: { result: SearchResult }) {
  if (!result.found) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-500 dark:text-gray-400">No results found for this query</CardContent>
      </Card>
    );
  }

  switch (result.type) {
    case "transaction":
      return <TransactionResult data={result.data!} />;
    case "address":
      return <AddressResult result={result} />;
    case "contract":
      return <ContractResult result={result} />;
    default:
      return null;
  }
}

function TransactionResult({ data }: { data: TransactionData }) {
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Hash:</span>
              <p className="font-mono text-xs break-all">{data.hash}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Sender:</span>
              <p className="font-mono text-xs break-all">{data.sender}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Status:</span>
              <Badge variant={data.vm_state === "HALT" ? "default" : "destructive"}>{data.vm_state}</Badge>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Gas:</span>
              <p>{data.gas_consumed}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Opcode Traces */}
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
              <table className="w-full text-xs font-mono" aria-label="Opcode execution trace">
                <thead className="sticky top-0 bg-white dark:bg-gray-900">
                  <tr className="border-b">
                    <th scope="col" className="p-2 text-left">Step</th>
                    <th scope="col" className="p-2 text-left">Opcode</th>
                    <th scope="col" className="p-2 text-left">Hex</th>
                    <th scope="col" className="p-2 text-left">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {data.opcode_traces.map((t) => (
                    <tr key={t.step_index} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="p-2">{t.step_index}</td>
                      <td className="p-2 text-emerald-600 dark:text-emerald-400">{t.opcode}</td>
                      <td className="p-2 text-gray-500 dark:text-gray-400">{t.opcode_hex}</td>
                      <td className="p-2">{t.instruction_ptr}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contract Calls */}
      {data.contract_calls?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Contract Calls ({data.contract_calls.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.contract_calls.map((c) => (
                <li key={`${c.contract_hash}-${c.method}`} className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{c.method}</span>
                    <Badge variant={c.success ? "default" : "destructive"}>{c.success ? "Success" : "Failed"}</Badge>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono break-all">{c.contract_hash}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Syscalls */}
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
              {data.syscalls.map((s) => (
                <li key={`${s.contract_hash}-${s.syscall_name}`} className="flex justify-between text-sm p-2 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <span className="font-mono">{s.syscall_name}</span>
                  <span className="text-gray-500 dark:text-gray-400">{s.gas_consumed} GAS</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AddressResult({ result }: { result: SearchResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Address: {result.address}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4">Total Transactions: {result.tx_count}</p>
        <ul className="space-y-2">
          {result.transactions?.map((tx) => (
            <li key={tx.tx_hash} className="flex justify-between p-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm">
              <span className="font-mono text-xs break-all">{tx.tx_hash}</span>
              <Badge variant="outline">{tx.role}</Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ContractResult({ result }: { result: SearchResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contract: {result.contract_hash}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4">Total Calls: {result.call_count}</p>
        <ul className="space-y-2">
          {result.calls?.map((c) => (
            <li key={`${c.contract_hash}-${c.method}`} className="flex justify-between p-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm">
              <span className="font-medium">{c.method}</span>
              <Badge variant={c.success ? "default" : "destructive"}>{c.success ? "Success" : "Failed"}</Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
