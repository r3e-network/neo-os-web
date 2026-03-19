import Head from "next/head";
import { useState } from "react";
import { Layout, PageHero } from "@/components/layout";
import {
  ExplorerSearchPanel,
  ExplorerSearchResults,
  type ExplorerSearchResult,
} from "@/components/features/explorer";

export default function ExplorerPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExplorerSearchResult | null>(null);
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
          <ExplorerSearchPanel
            query={query}
            loading={loading}
            error={error}
            onQueryChange={setQuery}
            onSearch={handleSearch}
          />

          <div aria-live="polite">
            {result && <ExplorerSearchResults result={result} />}
          </div>
        </div>
      </div>
    </Layout>
  );
}
