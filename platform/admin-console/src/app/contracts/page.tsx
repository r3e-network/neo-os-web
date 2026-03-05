"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

export default function ContractsPage() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ id: "", name: "", hash: "" });
  
  const networkMagic = "Unknown (Mock)"; // process.env is node only

  useEffect(() => {
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    const res = await fetch("/api/contracts");
    const data = await res.json();
    setContracts(data);
    setLoading(false);
  };

  const handleSave = async () => {
    await fetch("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setIsEditing(false);
    fetchContracts();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this contract tracking?")) return;
    await fetch(`/api/contracts?id=${id}`, { method: "DELETE" });
    fetchContracts();
  };

  const openNew = () => {
    setEditForm({ id: "", name: "", hash: "" });
    setIsEditing(true);
  };

  if (loading) return <div className="flex justify-center p-12"><Spinner /></div>;

  return (
    <div className="space-y-6">
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
                <label className="block text-sm text-gray-400 mb-1">Contract Name</label>
                <input 
                  className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white" 
                  value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} 
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Contract Hash (0x...)</label>
                <input 
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
        </CardContent>
      </Card>
    </div>
  );
}
