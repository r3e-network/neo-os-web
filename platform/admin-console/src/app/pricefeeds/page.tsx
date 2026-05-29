"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  getAdminAuthHeaders,
  getAdminFetchOptions,
} from "@/lib/admin-client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";

interface PriceFeed {
  id: string;
  symbol: string;
  pair: string;
  source: string;
  enabled: boolean;
}

export default function PriceFeedsPage() {
  const [feeds, setFeeds] = useState<PriceFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    id: "",
    symbol: "",
    pair: "",
    source: "chainlink",
    enabled: true,
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const activeFeeds = feeds.filter((feed) => feed.enabled).length;
  const disabledFeeds = feeds.length - activeFeeds;
  const uniqueSources = new Set(feeds.map((feed) => feed.source)).size;
  const summaryItems = [
    { label: "Configured Feeds", value: feeds.length, helper: "Registry entries" },
    { label: "Active Feeds", value: activeFeeds, helper: "Enabled for runtime" },
    { label: "Disabled", value: disabledFeeds, helper: "Held out safely" },
    { label: "Sources", value: uniqueSources, helper: "Provider groups" },
  ];
  const inputClass =
    "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 shadow-sm transition-colors placeholder:text-gray-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-gray-50 disabled:text-gray-500";
  const labelClass = "mb-1 block text-sm font-semibold text-gray-700";

  useEffect(() => {
    mountedRef.current = true;
    fetchFeeds()
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        console.warn("[pricefeeds] failed to load feeds:", message);
        if (mountedRef.current) {
          setFeeds([]);
          setLoadError(message);
        }
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchFeeds = async () => {
    const res = await fetch("/api/pricefeeds", {
      ...getAdminFetchOptions(),
      headers: getAdminAuthHeaders(),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        data && typeof data === "object" && "error" in data
          ? String(data.error)
          : "Failed to load pricefeeds";
      throw new Error(message);
    }
    if (!Array.isArray(data)) {
      throw new Error("Invalid pricefeed payload");
    }
    if (mountedRef.current) setFeeds(data);
    if (mountedRef.current) setLoadError(null);
  };

  const handleSave = async () => {
    setSaveError(null);
    try {
      const res = await fetch("/api/pricefeeds", {
        ...getAdminFetchOptions(),
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminAuthHeaders() },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error("Failed to save pricefeed");
      await fetchFeeds();
      setIsEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this pricefeed?")) return;
    setDeleteError(null);
    try {
      const res = await fetch(`/api/pricefeeds?id=${id}`, {
        ...getAdminFetchOptions(),
        method: "DELETE",
        headers: getAdminAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete pricefeed");
      await fetchFeeds();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
    }
  };

  const openNew = () => {
    setEditForm({
      id: "",
      symbol: "",
      pair: "",
      source: "chainlink",
      enabled: true,
    });
    setIsEditing(true);
  };

  return (
    <div className="space-y-6">
      {saveError && (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-4">
          <p className="text-sm font-semibold text-danger-700">
            Failed to save pricefeed: {saveError}
          </p>
        </div>
      )}
      {deleteError && (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-4">
          <p className="text-sm font-semibold text-danger-700">
            Failed to delete pricefeed: {deleteError}
          </p>
        </div>
      )}
      {loadError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">
            Failed to load pricefeeds: {loadError}
          </p>
        </div>
      )}
      <div className="pricefeeds-page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title="PriceFeed Tokens"
          description="Manage oracle feed metadata, providers, and runtime enablement."
          highlightLastWord
        />
        <Button onClick={openNew} disabled={loading}>
          Add Token
        </Button>
      </div>

      {!loading && (
        <div
          aria-label="PriceFeed inventory summary"
          className="pricefeeds-summary-grid grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {summaryItems.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase text-gray-500">
                {item.label}
              </p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className="text-2xl font-black text-gray-950">
                  {item.value}
                </p>
                <p className="text-right text-xs font-medium text-gray-500">
                  {item.helper}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex justify-center p-12">
          <Spinner />
        </div>
      )}

      {!loading && !loadError && isEditing && (
        <Card
          aria-label="PriceFeed token editor"
          className="pricefeeds-editor-card"
          variant="default"
        >
          <CardHeader>
            <CardTitle>
              {editForm.id ? "Edit Feed Token" : "New Feed Token"}
            </CardTitle>
            <p className="mt-1 text-sm text-gray-500">
              Keep identifiers explicit so operators can compare registry rows
              with mainnet freshness reports.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="feed-id"
                  className={labelClass}
                >
                  Feed ID
                </label>
                <input
                  id="feed-id"
                  className={inputClass}
                  value={editForm.id}
                  placeholder="TWELVEDATA:BTC-USD"
                  onChange={(e) =>
                    setEditForm({ ...editForm, id: e.target.value })
                  }
                  disabled={!!editForm.id}
                />
              </div>
              <div>
                <label
                  htmlFor="feed-symbol"
                  className={labelClass}
                >
                  Symbol
                </label>
                <input
                  id="feed-symbol"
                  className={inputClass}
                  value={editForm.symbol}
                  placeholder="BTC"
                  onChange={(e) =>
                    setEditForm({ ...editForm, symbol: e.target.value })
                  }
                />
              </div>
              <div>
                <label
                  htmlFor="feed-pair"
                  className={labelClass}
                >
                  Pair
                </label>
                <input
                  id="feed-pair"
                  className={inputClass}
                  value={editForm.pair}
                  placeholder="BTC/USD"
                  onChange={(e) =>
                    setEditForm({ ...editForm, pair: e.target.value })
                  }
                />
              </div>
              <div>
                <label
                  htmlFor="feed-source"
                  className={labelClass}
                >
                  Data Source
                </label>
                <select
                  id="feed-source"
                  className={inputClass}
                  value={editForm.source}
                  onChange={(e) =>
                    setEditForm({ ...editForm, source: e.target.value })
                  }
                >
                  <option value="chainlink">Chainlink</option>
                  <option value="binance">Binance</option>
                  <option value="okx">OKX</option>
                  <option value="twelvedata">Twelve Data</option>
                </select>
              </div>
            </div>
            <label
              htmlFor="feed-enabled"
              className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
            >
              <span>
                <span className="block text-sm font-semibold text-gray-800">
                  Enable feed for runtime use
                </span>
                <span className="text-xs text-gray-500">
                  Disabled feeds remain visible for audit without appearing as
                  active sources.
                </span>
              </span>
              <input
                id="feed-enabled"
                type="checkbox"
                aria-label="Enable feed for runtime use"
                className="h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                checked={editForm.enabled}
                onChange={(e) =>
                  setEditForm({ ...editForm, enabled: e.target.checked })
                }
              />
            </label>
            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Save Token</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !loadError && (
        <Card className="pricefeeds-table-card" variant="default">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle>Oracle Feed Registry</CardTitle>
              <p className="mt-1 text-sm text-gray-500">
                Track symbols, provider routing, and whether each feed is
                active for runtime reads.
              </p>
            </div>
            <Badge variant="info">{feeds.length} feeds</Badge>
          </CardHeader>
          <CardContent className="p-0">
            {feeds.length > 0 ? (
              <Table aria-label="Price feed sources">
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Feed ID</TableHead>
                    <TableHead>Pair</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feeds.map((feed) => (
                    <TableRow key={feed.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-black text-emerald-700">
                            {feed.symbol.slice(0, 2).toUpperCase()}
                          </span>
                          <span className="font-bold text-gray-950">
                            {feed.symbol}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-gray-600">
                        {feed.id}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {feed.pair}
                      </TableCell>
                      <TableCell>
                        <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-bold uppercase text-gray-600">
                          {feed.source}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={feed.enabled ? "success" : "default"}>
                          {feed.enabled ? "Active" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setEditForm(feed);
                              setIsEditing(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleDelete(feed.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="px-6 py-10 text-center text-sm text-gray-500">
                No price feeds configured
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
