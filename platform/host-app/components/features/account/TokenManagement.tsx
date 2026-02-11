/**
 * Developer Token Management Component
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Plus, Trash2, Copy, Check } from "lucide-react";
import { useTranslation } from "@/lib/i18n/react";

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
  const { t } = useTranslation("host");
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const loadTokens = useCallback(async () => {
    try {
      if (!walletAddress) return;
      const response = await fetch(`/api/tokens?walletAddress=${walletAddress}`);
      if (response.ok) {
        const data = await response.json();
        setTokens(data.tokens || []);
      }
    } catch (error) {
      console.error("Failed to load tokens:", error);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    if (walletAddress) {
      loadTokens();
    } else {
      setLoading(false);
    }
  }, [walletAddress, loadTokens]);

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

  if (!walletAddress) return null;

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
              <Shield size={20} className="text-neo" />
              {t("account.tokens.title")}
            </CardTitle>
            <CardDescription>{t("account.tokens.subtitle")}</CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowCreateForm(true)} className="bg-neo hover:bg-neo/90 text-dark-950 font-semibold">
            <Plus size={16} className="mr-1" />
            {t("account.tokens.generate")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-slate-400">Loading...</div>
        ) : tokens.length === 0 ? (
          <div className="text-center py-8 text-slate-400">{t("account.tokens.noTokens")}</div>
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
    <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-dark-900/50 border border-gray-200 dark:border-white/5 transition-colors hover:bg-gray-100 dark:hover:bg-dark-900/80">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{token.name}</p>
        <div className="flex items-center gap-2 mt-1">
          <code className="text-xs text-slate-500 font-mono">{token.token_prefix}...</code>
          <button onClick={copyPrefix} className="text-slate-400 hover:text-neo">
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={() => onRevoke(token.id)} className="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10">
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
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-dark-900 rounded-2xl p-6 max-w-md w-full border border-gray-200 dark:border-white/10 shadow-2xl">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Token Created</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Copy this token now. You won't be able to see it again.</p>
          <div className="p-3 bg-gray-100 dark:bg-dark-800 rounded-lg mb-4 border border-gray-200 dark:border-white/10">
            <code className="text-xs font-mono break-all text-gray-900 dark:text-white">{newToken}</code>
          </div>
          <Button
            onClick={() => {
              navigator.clipboard.writeText(newToken);
              onSuccess();
            }}
            className="w-full bg-neo text-dark-950 font-semibold hover:bg-neo/90"
          >
            Copy & Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-900 rounded-2xl p-6 max-w-md w-full border border-gray-200 dark:border-white/10 shadow-2xl">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Create Token</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5 block">Token Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My API Token"
              required
              className="bg-white dark:bg-dark-800 border-gray-200 dark:border-white/10"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5 block">Expires In (days)</label>
            <Input
              type="number"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
              min="1"
              max="365"
              required
              className="bg-white dark:bg-dark-800 border-gray-200 dark:border-white/10"
            />
          </div>
          {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg border border-red-100 dark:border-red-900/30">{error}</p>}
          <div className="flex gap-3 justify-end mt-6">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="dark:bg-transparent dark:border-white/20 dark:text-white">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-neo text-dark-950 font-semibold hover:bg-neo/90">
              {loading ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
