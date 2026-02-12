/**
 * SearchAutocomplete Component
 * Steam-inspired search with dropdown suggestions
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Search, Clock, TrendingUp, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/react";
import { useRecentSearches } from "./useRecentSearches";
import type { SearchResult } from "./types";

interface SearchAutocompleteProps {
  className?: string;
  placeholder?: string;
  onSearch?: (query: string) => void;
}

export function SearchAutocomplete({ className, placeholder, onSearch }: SearchAutocompleteProps) {
  const router = useRouter();
  const { t } = useTranslation("host");
  const { recentSearches, addSearch, clearSearches } = useRecentSearches();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch search results
  const fetchResults = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/miniapps/search?q=${encodeURIComponent(q)}&limit=6`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        setSuggestions(data.suggestions || []);
      }
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      fetchResults(query);
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchResults]);

  // Handle search submission
  const handleSubmit = useCallback(
    (searchQuery: string) => {
      if (!searchQuery.trim()) return;

      addSearch(searchQuery);
      setIsOpen(false);
      onSearch?.(searchQuery);
      router.push(`/miniapps?q=${encodeURIComponent(searchQuery)}`);
    },
    [addSearch, onSearch, router],
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const totalItems = results.length + suggestions.length;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < results.length) {
            router.push(`/miniapps/${results[selectedIndex].app_id}`);
            setIsOpen(false);
          } else if (selectedIndex >= results.length) {
            const suggestionIdx = selectedIndex - results.length;
            handleSubmit(suggestions[suggestionIdx]);
          } else {
            handleSubmit(query);
          }
          break;
        case "Escape":
          setIsOpen(false);
          inputRef.current?.blur();
          break;
      }
    },
    [results, suggestions, selectedIndex, query, handleSubmit, router],
  );

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const showDropdown = isOpen && (query.trim() || recentSearches.length > 0);

  return (
    <div className={cn("relative", className)}>
      {/* Search Input */}
      <div className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-erobo-ink-soft/60 group-focus-within:text-erobo-purple transition-colors" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || t("actions.search")}
          className="w-full h-10 pl-10 pr-10 text-sm bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 rounded-full focus:bg-white dark:focus:bg-black focus:border-erobo-purple/50 focus:ring-4 focus:ring-erobo-purple/10 transition-all outline-none text-erobo-ink dark:text-white placeholder-erobo-ink-soft/50"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-erobo-ink-soft/60 hover:text-erobo-ink dark:hover:text-white rounded-full hover:bg-erobo-purple/10 dark:hover:bg-white/10 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#0f1219] border border-white/60 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden z-50"
        >
          {/* Loading State */}
          {isLoading && (
            <div className="px-4 py-3 text-sm text-erobo-ink-soft flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-erobo-purple/30 border-t-erobo-purple rounded-full animate-spin" />
              {t("search.searching") || "Searching..."}
            </div>
          )}

          {/* Search Results */}
          {!isLoading && results.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-1 text-[10px] font-bold uppercase text-erobo-ink-soft/60 tracking-wider">
                {t("search.apps") || "Apps"}
              </div>
              {results.map((result, idx) => (
                <Link
                  key={result.app_id}
                  href={`/miniapps/${result.app_id}`}
                  onClick={() => {
                    addSearch(query);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2 hover:bg-erobo-peach/30 dark:hover:bg-white/5 transition-colors",
                    selectedIndex === idx && "bg-erobo-purple/10",
                  )}
                >
                  <img
                    src={result.icon || "/icons/default-app.svg"}
                    alt=""
                    className="w-8 h-8 rounded-lg object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-erobo-ink dark:text-white truncate">{result.name}</div>
                    <div className="text-xs text-erobo-ink-soft truncate">{result.category}</div>
                  </div>
                  <ArrowRight size={14} className="text-erobo-ink-soft/60" />
                </Link>
              ))}
            </div>
          )}

          {/* Suggestions */}
          {!isLoading && suggestions.length > 0 && (
            <div className="py-2 border-t border-erobo-purple/5 dark:border-white/5">
              <div className="px-4 py-1 text-[10px] font-bold uppercase text-erobo-ink-soft/60 tracking-wider">
                {t("search.suggestions") || "Suggestions"}
              </div>
              {suggestions.map((suggestion, idx) => (
                <button
                  key={suggestion}
                  onClick={() => handleSubmit(suggestion)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-erobo-peach/30 dark:hover:bg-white/5 transition-colors",
                    selectedIndex === results.length + idx && "bg-erobo-purple/10",
                  )}
                >
                  <TrendingUp size={14} className="text-erobo-purple" />
                  <span className="text-sm text-erobo-ink dark:text-white">{suggestion}</span>
                </button>
              ))}
            </div>
          )}

          {/* Recent Searches */}
          {!query.trim() && recentSearches.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-1 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-erobo-ink-soft/60 tracking-wider">
                  {t("search.recent") || "Recent"}
                </span>
                <button onClick={clearSearches} className="text-[10px] text-erobo-purple hover:underline">
                  {t("search.clear") || "Clear"}
                </button>
              </div>
              {recentSearches.map((recent) => (
                <button
                  key={recent.query}
                  onClick={() => handleSubmit(recent.query)}
                  className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-erobo-peach/30 dark:hover:bg-white/5 transition-colors"
                >
                  <Clock size={14} className="text-erobo-ink-soft/60" />
                  <span className="text-sm text-erobo-ink dark:text-white">{recent.query}</span>
                </button>
              ))}
            </div>
          )}

          {/* No Results */}
          {!isLoading && query.trim() && results.length === 0 && suggestions.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-erobo-ink-soft">
              {t("search.noResults") || "No apps found"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
