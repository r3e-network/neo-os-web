import Head from "next/head";
import { useState } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, ArrowRight, Code, FileCode, Cpu } from "lucide-react";

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
      const res = await fetch(`/api/explorer/search?q=${encodeURIComponent(query)}`);
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

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Neo N3 Explorer</h1>
          <p className="text-muted-foreground">Search transactions, addresses, and contracts with execution traces</p>
        </div>

        {/* Search Bar */}
        <div className="flex gap-2 mb-8 max-w-2xl mx-auto">
          <Input
            placeholder="Search by tx hash, address, or contract..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        {error && <div className="text-center text-red-500 mb-4">{error}</div>}

        {result && <SearchResults result={result} />}
      </div>
    </Layout>
  );
}

function SearchResults({ result }: { result: SearchResult }) {
  if (!result.found) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">No results found for this query</CardContent>
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
            <FileCode className="h-5 w-5" />
            Transaction Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Hash:</span>
              <p className="font-mono text-xs break-all">{data.hash}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Sender:</span>
              <p className="font-mono text-xs">{data.sender}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>
              <Badge variant={data.vm_state === "HALT" ? "default" : "destructive"}>{data.vm_state}</Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Gas:</span>
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
              <Code className="h-5 w-5" />
              Opcode Execution Trace ({data.opcode_traces.length} steps)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-xs font-mono">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b">
                    <th className="p-2 text-left">Step</th>
                    <th className="p-2 text-left">Opcode</th>
                    <th className="p-2 text-left">Hex</th>
                    <th className="p-2 text-left">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {data.opcode_traces.map((t) => (
                    <tr key={t.step_index} className="border-b hover:bg-muted/50">
                      <td className="p-2">{t.step_index}</td>
                      <td className="p-2 text-green-600">{t.opcode}</td>
                      <td className="p-2 text-muted-foreground">{t.opcode_hex}</td>
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
            <div className="space-y-2">
              {data.contract_calls.map((c, i) => (
                <div key={i} className="p-2 border rounded text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{c.method}</span>
                    <Badge variant={c.success ? "default" : "destructive"}>{c.success ? "Success" : "Failed"}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">{c.contract_hash}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Syscalls */}
      {data.syscalls?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              System Calls ({data.syscalls.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {data.syscalls.map((s, i) => (
                <div key={i} className="flex justify-between text-sm p-2 border rounded">
                  <span className="font-mono">{s.syscall_name}</span>
                  <span className="text-muted-foreground">{s.gas_consumed} GAS</span>
                </div>
              ))}
            </div>
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
        <div className="space-y-2">
          {result.transactions?.map((tx, i) => (
            <div key={i} className="flex justify-between p-2 border rounded text-sm">
              <span className="font-mono text-xs">{tx.tx_hash}</span>
              <Badge variant="outline">{tx.role}</Badge>
            </div>
          ))}
        </div>
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
        <div className="space-y-2">
          {result.calls?.map((c, i) => (
            <div key={i} className="flex justify-between p-2 border rounded text-sm">
              <span className="font-medium">{c.method}</span>
              <Badge variant={c.success ? "default" : "destructive"}>{c.success ? "Success" : "Failed"}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
