"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

export default function PriceFeedsPage() {
  const [feeds, setFeeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ id: "", symbol: "", pair: "", source: "chainlink", enabled: true });

  useEffect(() => {
    fetchFeeds();
  }, []);

  const fetchFeeds = async () => {
    const res = await fetch("/api/pricefeeds");
    const data = await res.json();
    setFeeds(data);
    setLoading(false);
  };

  const handleSave = async () => {
    await fetch("/api/pricefeeds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setIsEditing(false);
    fetchFeeds();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this pricefeed?")) return;
    await fetch(`/api/pricefeeds?id=${id}`, { method: "DELETE" });
    fetchFeeds();
  };

  const openNew = () => {
    setEditForm({ id: "", symbol: "", pair: "", source: "chainlink", enabled: true });
    setIsEditing(true);
  };

  if (loading) return <div className="flex justify-center p-12"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">PriceFeed Tokens</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage oracle feeds and symbols</p>
        </div>
        <Button onClick={openNew}>Add Token</Button>
      </div>

      {isEditing && (
        <Card variant="glass" className="border-neo/50 shadow-[0_0_15px_rgba(0,229,153,0.1)]">
          <CardHeader>
            <CardTitle>{editForm.id ? "Edit Token" : "New Token"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Feed ID (e.g. BTC-USD)</label>
                <input 
                  className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white" 
                  value={editForm.id} onChange={e => setEditForm({...editForm, id: e.target.value})} disabled={!!editForm.id} 
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Symbol (e.g. BTC)</label>
                <input 
                  className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white" 
                  value={editForm.symbol} onChange={e => setEditForm({...editForm, symbol: e.target.value})} 
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Pair (e.g. BTC/USD)</label>
                <input 
                  className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white" 
                  value={editForm.pair} onChange={e => setEditForm({...editForm, pair: e.target.value})} 
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Data Source</label>
                <select 
                  className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white" 
                  value={editForm.source} onChange={e => setEditForm({...editForm, source: e.target.value})}
                >
                  <option value="chainlink">Chainlink</option>
                  <option value="binance">Binance</option>
                  <option value="okx">OKX</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save Token</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card variant="glass">
        <CardContent className="p-0">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-white/5 text-gray-400">
              <tr>
                <th className="p-4 font-medium">Symbol</th>
                <th className="p-4 font-medium">Feed ID</th>
                <th className="p-4 font-medium">Source</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {feeds.map((feed) => (
                <tr key={feed.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-4 font-bold text-white">{feed.symbol}</td>
                  <td className="p-4">{feed.id}</td>
                  <td className="p-4 capitalize">{feed.source}</td>
                  <td className="p-4">
                    <Badge variant={feed.enabled ? "success" : "default"}>
                      {feed.enabled ? "Active" : "Disabled"}
                    </Badge>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <Button size="sm" variant="secondary" onClick={() => { setEditForm(feed); setIsEditing(true); }}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(feed.id)}>Remove</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
