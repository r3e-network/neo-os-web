"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";

type ExplorerSearchPanelProps = {
  query: string;
  loading: boolean;
  error: string;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
};

export function ExplorerSearchPanel({
  query,
  loading,
  error,
  onQueryChange,
  onSearch,
}: ExplorerSearchPanelProps) {
  return (
    <>
      <div role="search" className="mx-auto mb-8 flex max-w-2xl gap-2">
        <Input
          id="explorer-search-input"
          aria-label="Search by transaction hash, address, or contract"
          placeholder="Search by tx hash, address, or contract..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
          className="flex-1"
        />
        <Button aria-label="Search" onClick={onSearch} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-center text-sm text-red-600"
        >
          {error}
        </div>
      )}
    </>
  );
}
