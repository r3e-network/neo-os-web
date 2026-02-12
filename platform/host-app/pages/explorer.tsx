import Head from "next/head";
import { useState, useEffect, useRef, useCallback } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, FileCode, Cpu, ChevronDown } from "lucide-react";
import { OpcodeViewer } from "@/components/features/explorer";
import type { ChainId } from "@/lib/chains/types";
import { cn } from "@/lib/utils";

// Supported chains for explorer
const EXPLORER_CHAINS: { id: ChainId; name: string; icon: string }[] = [
  { id: "neo-n3-mainnet", name: "Neo N3", icon: "/chains/neo.svg" },
  { id: "neo-n3-testnet", name: "Neo N3 Testnet", icon: "/chains/neo.svg" },
];

interface SearchResult {
  type: string;
  found: boolean;
  chainId?: ChainId;
  data?: TransactionData;
  address?: string;
  tx_count?: number;
  transactions?: AddressTx[];
  contract_address?: string;
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
  tx_type?: "simple" | "complex";
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
  contract_address?: string;
}

interface ContractCall {
  tx_hash: string;
  method: string;
  contract_address: string;
  gas_consumed: string;
  success: boolean;
}

interface Syscall {
  syscall_name: string;
  gas_consumed: string;
  contract_address: string;
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
  const [selectedChain, setSelectedChain] = useState<ChainId>("neo-n3-mainnet");
  const [showChainMenu, setShowChainMenu] = useState(false);

  const currentChain = EXPLORER_CHAINS.find((c) => c.id === selectedChain) || EXPLORER_CHAINS[0];
  const chainMenuRef = useRef<HTMLDivElement>(null);

  // Close chain menu on outside click or Escape
  useEffect(() => {
    if (!showChainMenu) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowChainMenu(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (chainMenuRef.current && !chainMenuRef.current.contains(e.target as Node)) {
        setShowChainMenu(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showChainMenu]);

  const handleChainKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showChainMenu) {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
          e.preventDefault();
          setShowChainMenu(true);
        }
        return;
      }

      const currentIndex = EXPLORER_CHAINS.findIndex((c) => c.id === selectedChain);

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const nextIndex = (currentIndex + 1) % EXPLORER_CHAINS.length;
          setSelectedChain(EXPLORER_CHAINS[nextIndex].id);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const prevIndex = (currentIndex - 1 + EXPLORER_CHAINS.length) % EXPLORER_CHAINS.length;
          setSelectedChain(EXPLORER_CHAINS[prevIndex].id);
          break;
        }
        case "Enter":
        case " ":
          e.preventDefault();
          setShowChainMenu(false);
          break;
      }
    },
    [showChainMenu, selectedChain],
  );

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(`/api/explorer/search?q=${encodeURIComponent(query)}&chain_id=${selectedChain}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult({ ...data, chainId: selectedChain });
      }
    } catch {
      setError("Search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <Head>
        <title>Neo N3 Explorer | MiniApp Platform</title>
      </Head>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Neo N3 Explorer</h1>
          <p className="text-muted-foreground">
            Search transactions, addresses, and contracts across Neo N3 mainnet and testnet
          </p>
        </div>

        {/* Chain Selector and Search Bar */}
        <div className="flex gap-2 mb-8 max-w-2xl mx-auto">
          {/* Chain Selector */}
          <div className="relative" ref={chainMenuRef}>
            <button
              onClick={() => setShowChainMenu(!showChainMenu)}
              onKeyDown={handleChainKeyDown}
              aria-label="Select blockchain network"
              aria-expanded={showChainMenu}
              aria-haspopup="listbox"
              className="flex items-center gap-2 px-4 py-2 border rounded-md bg-background hover:bg-accent min-w-[160px]"
            >
              <img src={currentChain.icon} alt={currentChain.name} className="w-5 h-5" />
              <span className="text-sm font-medium">{currentChain.name}</span>
              <ChevronDown className={cn("h-4 w-4 ml-auto transition-transform", showChainMenu && "rotate-180")} />
            </button>

            {showChainMenu && (
              <div
                role="listbox"
                aria-label="Blockchain networks"
                className="absolute top-full left-0 mt-1 w-full bg-background border rounded-md shadow-lg z-50"
              >
                {EXPLORER_CHAINS.map((chain) => (
                  <button
                    key={chain.id}
                    role="option"
                    aria-selected={selectedChain === chain.id}
                    onClick={() => {
                      setSelectedChain(chain.id);
                      setShowChainMenu(false);
                    }}
                    className={cn(
                      "flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-accent",
                      selectedChain === chain.id && "bg-accent",
                    )}
                  >
                    <img src={chain.icon} alt={chain.name} className="w-4 h-4" />
                    {chain.name}
                  </button>
                ))}
              </div>
            )}
          </div>

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

      {/* Opcode Traces - Using new OpcodeViewer component */}
      <OpcodeViewer
        hash={data.hash}
        txType={data.tx_type || (data.opcode_traces?.length > 0 ? "complex" : "simple")}
        vmState={data.vm_state}
        gasConsumed={data.gas_consumed}
        opcodes={
          data.opcode_traces?.map((t, idx) => ({
            id: idx,
            tx_hash: data.hash,
            step_index: t.step_index,
            opcode: t.opcode,
            opcode_hex: t.opcode_hex,
            gas_consumed: t.gas_consumed,
            contract_address: t.contract_address,
            stack_size: 0,
            instruction_ptr: t.instruction_ptr,
          })) || []
        }
        contractCalls={data.contract_calls?.map((c, idx) => ({
          id: idx,
          tx_hash: data.hash,
          call_index: idx,
          contract_address: c.contract_address,
          method: c.method,
          args: [],
          gas_consumed: c.gas_consumed,
          success: c.success,
        }))}
      />

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
                  <p className="text-xs text-muted-foreground font-mono">{c.contract_address}</p>
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
        <CardTitle>Contract: {result.contract_address}</CardTitle>
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
