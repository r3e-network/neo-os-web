/**
 * Developer Token Management Component
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Plus, Trash2, Copy, Check } from "lucide-react";

interface Token {
  id: number;
  token_prefix: string;
  name: string;
  scopes: string[];
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
}

interface TokenManagementProps {
  walletAddress: string;
}

export function TokenManagement({ walletAddress }: TokenManagementProps) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    loadTokens();
  }, [walletAddress]);

  const loadTokens = async () => {
    try {
      const response = await fetch(`/api/tokens?walletAddress=${walletAddress}`);
      const data = await response.json();
      setTokens(data.tokens || []);
    } catch (error) {
      console.error("Failed to load tokens:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (id: number) => {
    if (!confirm("Revoke this token? Applications using it will lose access.")) return;

    try {
      await fetch(`/api/tokens/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });
      await loadTokens();
    } catch (error) {
      console.error("Failed to revoke token:", error);
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
              <Shield size={20} className="text-neo" />
              Developer Tokens
            </CardTitle>
            <CardDescription>API tokens for programmatic access</CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowCreateForm(true)} className="bg-neo hover:bg-neo/90">
            <Plus size={16} className="mr-1" />
            Create Token
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-slate-400">Loading...</div>
        ) : tokens.length === 0 ? (
          <div className="text-center py-8 text-slate-400">No tokens yet</div>
        ) : (
          <div className="space-y-3">
            {tokens.map((token) => (
              <TokenItem key={token.id} token={token} onRevoke={handleRevoke} />
            ))}
          </div>
        )}

        {showCreateForm && (
          <CreateTokenForm
            walletAddress={walletAddress}
            onClose={() => setShowCreateForm(false)}
            onSuccess={() => {
              setShowCreateForm(false);
              loadTokens();
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}

function TokenItem({ token, onRevoke }: { token: Token; onRevoke: (id: number) => void }) {
  const [copied, setCopied] = useState(false);

  const copyPrefix = () => {
    navigator.clipboard.writeText(token.token_prefix);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-gray-100 dark:bg-dark-900 border border-gray-200 dark:border-white/5">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{token.name}</p>
        <div className="flex items-center gap-2 mt-1">
          <code className="text-xs text-slate-500 font-mono">{token.token_prefix}...</code>
          <button onClick={copyPrefix} className="text-slate-400 hover:text-neo">
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={() => onRevoke(token.id)} className="text-red-400 hover:text-red-500">
        <Trash2 size={16} />
      </Button>
    </div>
  );
}

function CreateTokenForm({
  walletAddress,
  onClose,
  onSuccess,
}: {
  walletAddress: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("90");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newToken, setNewToken] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`/api/tokens?walletAddress=${walletAddress}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          expiresInDays: parseInt(expiresInDays),
          scopes: ["read", "write"],
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create token");
      }

      const data = await response.json();
      setNewToken(data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create token");
    } finally {
      setLoading(false);
    }
  };

  if (newToken) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-dark-800 rounded-2xl p-6 max-w-md w-full mx-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Token Created</h3>
          <p className="text-sm text-slate-400 mb-4">Copy this token now. You won't be able to see it again.</p>
          <div className="p-3 bg-gray-100 dark:bg-dark-900 rounded-lg mb-4">
            <code className="text-xs font-mono break-all text-gray-900 dark:text-white">{newToken}</code>
          </div>
          <Button
            onClick={() => {
              navigator.clipboard.writeText(newToken);
              onSuccess();
            }}
            className="w-full"
          >
            Copy & Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-dark-800 rounded-2xl p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create Token</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Token Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My API Token" required />
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Expires In (days)</label>
            <Input
              type="number"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
              min="1"
              max="365"
              required
            />
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
