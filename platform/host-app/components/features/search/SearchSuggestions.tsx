"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import { Search, X, TrendingUp, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchResult } from "@/pages/api/miniapps/search";

interface SearchSuggestionsProps {
  onSelect?: (appId: string) => void;
  className?: string;
}

export function SearchSuggestions({ onSelect, className }: SearchSuggestionsProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Debounced search
  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/miniapps/search?q=${encodeURIComponent(q)}&limit=6`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        setSuggestions(data.suggestions || []);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const total = results.length + suggestions.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % total);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + total) % total);
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      if (selectedIndex < results.length) {
        handleSelectApp(results[selectedIndex].app_id);
      } else {
        handleSelectSuggestion(suggestions[selectedIndex - results.length]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const handleSelectApp = (appId: string) => {
    setOpen(false);
    if (onSelect) {
      onSelect(appId);
    } else {
      router.push(`/miniapps/${appId}`);
    }
  };

  const handleSelectSuggestion = (suggestion: string) => {
    setQuery(suggestion);
    setSelectedIndex(-1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setOpen(false);
      router.push(`/miniapps?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setSelectedIndex(-1);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search MiniApps..."
            className="w-full h-10 pl-10 pr-10 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
                inputRef.current?.focus();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </form>

      {open && (query || suggestions.length > 0) && (
        <SearchDropdown
          query={query}
          results={results}
          suggestions={suggestions}
          loading={loading}
          selectedIndex={selectedIndex}
          onSelectApp={handleSelectApp}
          onSelectSuggestion={handleSelectSuggestion}
        />
      )}
    </div>
  );
}

interface SearchDropdownProps {
  query: string;
  results: SearchResult[];
  suggestions: string[];
  loading: boolean;
  selectedIndex: number;
  onSelectApp: (appId: string) => void;
  onSelectSuggestion: (s: string) => void;
}

function SearchDropdown({
  query,
  results,
  suggestions,
  loading,
  selectedIndex,
  onSelectApp,
  onSelectSuggestion,
}: SearchDropdownProps) {
  return (
    <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl z-50 overflow-hidden">
      {loading && <div className="px-4 py-3 text-sm text-gray-500">Searching...</div>}

      {!loading && results.length > 0 && (
        <div className="py-2">
          <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase">Apps</div>
          {results.map((r, i) => (
            <button
              key={r.app_id}
              onClick={() => onSelectApp(r.app_id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800",
                selectedIndex === i && "bg-gray-100 dark:bg-gray-800",
              )}
            >
              <span className="text-2xl">{r.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{r.name}</p>
                <p className="text-xs text-gray-500 truncate">{r.description}</p>
              </div>
              <span className="text-xs text-gray-400 capitalize">{r.category}</span>
            </button>
          ))}
        </div>
      )}

      {!loading && suggestions.length > 0 && (
        <div className="py-2 border-t border-gray-100 dark:border-gray-800">
          <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase flex items-center gap-1">
            <TrendingUp size={12} />
            Suggestions
          </div>
          {suggestions.map((s, i) => (
            <button
              key={s}
              onClick={() => onSelectSuggestion(s)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800",
                selectedIndex === results.length + i && "bg-gray-100 dark:bg-gray-800",
              )}
            >
              <Search size={14} className="text-gray-400" />
              {s}
            </button>
          ))}
        </div>
      )}

      {!loading && !query && (
        <div className="px-4 py-3 text-xs text-gray-500">Try searching for "lottery", "dice", or "vote"</div>
      )}

      {!loading && query && results.length === 0 && (
        <div className="px-4 py-6 text-center text-sm text-gray-500">No apps found for "{query}"</div>
      )}
    </div>
  );
}
