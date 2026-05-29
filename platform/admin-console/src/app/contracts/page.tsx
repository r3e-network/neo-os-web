"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  getAdminAuthHeaders,
  getAdminFetchOptions,
} from "@/lib/admin-client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";

interface Contract {
  id: string;
  name: string;
  hash: string;
  deployed?: boolean;
}

const inputClass =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 font-mono text-sm text-gray-900 shadow-sm transition-colors placeholder:text-gray-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";
const labelClass = "mb-1 block text-sm font-semibold text-gray-700";

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ id: "", name: "", hash: "" });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const deployedCount = contracts.filter((contract) => contract.deployed).length;
  const pendingCount = contracts.length - deployedCount;
  const summaryItems = [
    {
      label: "Tracked Contracts",
      value: contracts.length,
      helper: "Registry entries",
    },
    {
      label: "Deployed",
      value: deployedCount,
      helper: "Marked live",
    },
    {
      label: "Pending",
      value: pendingCount,
      helper: "Awaiting confirmation",
    },
  ];

  useEffect(() => {
    mountedRef.current = true;
    fetchContracts()
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        console.warn("[contracts] failed to load contracts:", message);
        if (mountedRef.current) {
          setContracts([]);
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

  const fetchContracts = async () => {
    const res = await fetch("/api/contracts", {
      ...getAdminFetchOptions(),
      headers: getAdminAuthHeaders(),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        data && typeof data === "object" && "error" in data
          ? String(data.error)
          : "Failed to load contracts";
      throw new Error(message);
    }
    if (!Array.isArray(data)) {
      throw new Error("Invalid contracts payload");
    }
    if (mountedRef.current) {
      setContracts(data);
      setLoadError(null);
    }
  };

  const handleSave = async () => {
    setSaveError(null);
    try {
      const res = await fetch("/api/contracts", {
        ...getAdminFetchOptions(),
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminAuthHeaders() },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error("Failed to save contract");
      await fetchContracts();
      setIsEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this contract tracking?")) {
      return;
    }

    setDeleteError(null);
    try {
      const res = await fetch(`/api/contracts?id=${encodeURIComponent(id)}`, {
        ...getAdminFetchOptions(),
        method: "DELETE",
        headers: getAdminAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete contract");
      await fetchContracts();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
    }
  };

  const openNew = () => {
    setEditForm({ id: "", name: "", hash: "" });
    setIsEditing(true);
  };

  const openEdit = (contract: Contract) => {
    setEditForm({
      id: contract.id,
      name: contract.name,
      hash: contract.hash,
    });
    setIsEditing(true);
  };

  const contractInitials = (name: string) => name.slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      {saveError && (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-4">
          <p className="text-sm font-semibold text-danger-700">
            Failed to save contract: {saveError}
          </p>
        </div>
      )}
      {deleteError && (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-4">
          <p className="text-sm font-semibold text-danger-700">
            Failed to delete contract: {deleteError}
          </p>
        </div>
      )}
      {loadError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">
            Failed to load contracts: {loadError}
          </p>
        </div>
      )}

      <div className="contracts-page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title="Smart Contracts"
          description="Track deployed contract hashes used by admin and MiniApp workflows."
          highlightLastWord
        />
        <Button onClick={openNew} disabled={loading}>
          Track New Contract
        </Button>
      </div>

      {loading && (
        <div className="flex justify-center p-12">
          <Spinner />
        </div>
      )}

      {!loading && !loadError && (
        <div
          aria-label="Contract registry summary"
          className="contracts-summary-grid grid gap-3 lg:grid-cols-3"
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

      {!loading && !loadError && isEditing && (
        <Card
          aria-label="Contract tracker editor"
          className="contracts-editor-card"
          variant="default"
        >
          <CardHeader>
            <CardTitle>
              {editForm.id ? "Edit Contract" : "Track Contract"}
            </CardTitle>
            <p className="mt-1 text-sm text-gray-500">
              Keep hash metadata explicit so operators can compare UI routing
              with deployment reports before any transaction flow is exposed.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="contract-name" className={labelClass}>
                  Contract Name
                </label>
                <input
                  id="contract-name"
                  className={inputClass}
                  value={editForm.name}
                  placeholder="PriceFeed"
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                />
              </div>
              <div>
                <label htmlFor="contract-hash" className={labelClass}>
                  Contract Hash
                </label>
                <input
                  id="contract-hash"
                  className={inputClass}
                  value={editForm.hash}
                  placeholder="0x..."
                  onChange={(e) =>
                    setEditForm({ ...editForm, hash: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              This page only tracks metadata. It does not deploy, upgrade, or
              submit contract transactions.
            </div>
            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Save Contract</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !loadError && (
        <Card className="contracts-table-card" variant="default">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle>Contract Registry</CardTitle>
              <p className="mt-1 text-sm text-gray-500">
                Review hashes and deployment status before wiring transaction
                surfaces to contract calls.
              </p>
            </div>
            <Badge variant="info">{contracts.length} contracts</Badge>
          </CardHeader>
          <CardContent className="p-0">
            {contracts.length > 0 ? (
              <>
                <div
                  aria-label="Mobile tracked smart contracts"
                  className="contracts-mobile-list space-y-3 p-4 md:hidden"
                >
                  {contracts.map((contract) => (
                    <article
                      key={contract.id}
                      aria-label={`Contract ${contract.name}`}
                      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-black text-emerald-700">
                            {contractInitials(contract.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-bold text-gray-950">
                              {contract.name}
                            </p>
                            <p className="text-xs font-medium uppercase text-gray-500">
                              Contract hash
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={contract.deployed ? "success" : "default"}
                        >
                          {contract.deployed ? "Tracked" : "Pending"}
                        </Badge>
                      </div>
                      <p className="mt-3 break-all rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs leading-5 text-gray-700">
                        {contract.hash}
                      </p>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openEdit(contract)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleDelete(contract.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="contracts-desktop-table hidden md:block">
                  <Table aria-label="Tracked smart contracts">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contract</TableHead>
                        <TableHead>Hash</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contracts.map((contract) => (
                        <TableRow key={contract.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-black text-emerald-700">
                                {contractInitials(contract.name)}
                              </span>
                              <span className="font-bold text-gray-950">
                                {contract.name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell
                            className="max-w-[28rem] truncate font-mono text-xs text-gray-600"
                            title={contract.hash}
                          >
                            {contract.hash}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                contract.deployed ? "success" : "default"
                              }
                            >
                              {contract.deployed ? "Tracked" : "Pending"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => openEdit(contract)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => handleDelete(contract.id)}
                              >
                                Remove
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
              <p className="px-6 py-10 text-center text-sm text-gray-500">
                No contracts registered
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
