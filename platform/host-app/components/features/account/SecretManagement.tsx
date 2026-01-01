/**
 * Secret Management Component
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Key, Plus, Trash2, Eye, EyeOff } from "lucide-react";

interface Secret {
  id: number;
  secret_name: string;
  description: string;
  created_at: string;
}

interface SecretManagementProps {
  walletAddress: string;
}

export function SecretManagement({ walletAddress }: SecretManagementProps) {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    loadSecrets();
  }, [walletAddress]);

  const loadSecrets = async () => {
    try {
      const response = await fetch(`/api/secrets?walletAddress=${walletAddress}`);
      const data = await response.json();
      setSecrets(data.secrets || []);
    } catch (error) {
      console.error("Failed to load secrets:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this secret? This action cannot be undone.")) return;

    try {
      await fetch(`/api/secrets/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });
      await loadSecrets();
    } catch (error) {
      console.error("Failed to delete secret:", error);
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
              <Key size={20} className="text-neo" />
              Secrets
            </CardTitle>
            <CardDescription>Manage encrypted secrets for MiniApp development</CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowCreateForm(true)} className="bg-neo hover:bg-neo/90">
            <Plus size={16} className="mr-1" />
            Add Secret
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-slate-400">Loading...</div>
        ) : secrets.length === 0 ? (
          <div className="text-center py-8 text-slate-400">No secrets yet</div>
        ) : (
          <div className="space-y-3">
            {secrets.map((secret) => (
              <SecretItem key={secret.id} secret={secret} onDelete={handleDelete} />
            ))}
          </div>
        )}

        {showCreateForm && (
          <CreateSecretForm
            walletAddress={walletAddress}
            onClose={() => setShowCreateForm(false)}
            onSuccess={() => {
              setShowCreateForm(false);
              loadSecrets();
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}

function SecretItem({ secret, onDelete }: { secret: Secret; onDelete: (id: number) => void }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-gray-100 dark:bg-dark-900 border border-gray-200 dark:border-white/5">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{secret.secret_name}</p>
        {secret.description && <p className="text-xs text-slate-500 mt-1">{secret.description}</p>}
      </div>
      <Button variant="ghost" size="sm" onClick={() => onDelete(secret.id)} className="text-red-400 hover:text-red-500">
        <Trash2 size={16} />
      </Button>
    </div>
  );
}

function CreateSecretForm({
  walletAddress,
  onClose,
  onSuccess,
}: {
  walletAddress: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`/api/secrets?walletAddress=${walletAddress}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secretName: name,
          secretValue: value,
          description,
          password,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create secret");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create secret");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-dark-800 rounded-2xl p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create Secret</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Secret Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="API_KEY" required />
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Secret Value</label>
            <Input value={value} onChange={(e) => setValue(e.target.value)} type="password" required />
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Description (optional)</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Your Password</label>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
