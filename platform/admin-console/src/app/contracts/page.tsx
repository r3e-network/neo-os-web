"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

interface Contract {
  id: string;
  name: string;
  hash: string;
  deployed?: boolean;
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ id: "", name: "", hash: "" });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    fetchContracts()
      .catch((e: unknown) => { console.warn("[contracts] failed to load contracts:", e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (mountedRef.current) setLoading(false); });
    return () => { mountedRef.current = false; };
  }, []);

  const fetchContracts = async () => {
    const res = await fetch("/api/contracts");
    const data = await res.json();
    if (mountedRef.current) setContracts(data);
  };

  const handleSave = async () => {
    setSaveError(null);
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error("Failed to save contract");
      setIsEditing(false);
      fetchContracts();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsEditing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this contract tracking?")) return;
    setDeleteError(null);
    try {
      const res = await fetch(`/api/contracts?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete contract");
      fetchContracts();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
    }
  };

  const openNew = () => {
    setEditForm({ id: "", name: "", hash: "" });
    setIsEditing(true);
  };

  if (loading) return <div className="flex justify-center p-12"><Spinner /></div>;

  return (
    <div className="space-y-6">
      {saveError && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">Failed to save contract: {saveError}</p>
        </div>
      )}
      {deleteError && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">Failed to delete contract: {deleteError}</p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Smart Contracts</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage tracked contracts and hashes</p>
        </div>
        <Button onClick={openNew}>Track New Contract</Button>
      </div>

      {isEditing && (
        <Card variant="glass" className="border-neo/50 shadow-[0_0_15px_rgba(0,229,153,0.1)]">
          <CardHeader>
            <CardTitle>{editForm.id ? "Edit Contract" : "Track Contract"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="contract-name" className="block text-sm text-gray-400 mb-1">Contract Name</label>
                <input
                  id="contract-name"
                  className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white"
                  value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})}
                />
              </div>
              <div>
                <label htmlFor="contract-hash" className="block text-sm text-gray-400 mb-1">Contract Hash (0x...)</label>
                <input
                  id="contract-hash"
                  className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white"
                  value={editForm.hash} onChange={e => setEditForm({...editForm, hash: e.target.value})}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save Contract</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card variant="glass">
        <CardHeader>
          <CardTitle>Deployed Contracts Registry</CardTitle>
        </CardHeader>
        <CardContent>
          {contracts.length > 0 ? (
            <ul className="space-y-4">
              {contracts.map((contract) => (
                <li
                  key={contract.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-white/10 p-4 transition-colors hover:bg-white/5"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-white truncate" title={contract.name}>{contract.name}</div>
                    <div className="text-sm text-gray-400 font-mono truncate" title={contract.hash}>Hash: {contract.hash}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={contract.deployed ? "success" : "default"}>
                      {contract.deployed ? "Tracked" : "Pending"}
                    </Badge>
                    <Button size="sm" variant="secondary" onClick={() => { setEditForm(contract); setIsEditing(true); }}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(contract.id)}>Remove</Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-gray-500 dark:text-gray-400 py-6">No contracts registered</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
