/**
 * Secret Management Component
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Key, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n/react";

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
  const { t } = useTranslation("host");
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const loadSecrets = useCallback(async () => {
    try {
      const response = await fetch(`/api/secrets?walletAddress=${walletAddress}`);
      const data = await response.json();
      setSecrets(data.secrets || []);
    } catch (error) {
      console.error("Failed to load secrets:", error);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    if (walletAddress) {
      loadSecrets();
    } else {
      setLoading(false);
    }
  }, [walletAddress, loadSecrets]);

  const handleDelete = async (id: number) => {
    if (!confirm(t("account.secrets.deleteConfirm"))) return;

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

  if (!walletAddress) return null;

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
              <Key size={20} className="text-neo" />
              {t("account.secrets.title")}
            </CardTitle>
            <CardDescription>{t("account.secrets.subtitle")}</CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => setShowCreateForm(true)}
            className="bg-neo hover:bg-neo/90 text-dark-950 font-semibold"
          >
            <Plus size={16} className="mr-1" />
            {t("account.secrets.add")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-slate-400">{t("account.secrets.loading")}</div>
        ) : secrets.length === 0 ? (
          <div className="text-center py-8 text-slate-400">{t("account.secrets.noSecrets")}</div>
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
    <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-dark-900/50 border border-gray-200 dark:border-white/5 transition-colors hover:bg-gray-100 dark:hover:bg-dark-900/80">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{secret.secret_name}</p>
        {secret.description && <p className="text-xs text-slate-500 mt-1">{secret.description}</p>}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDelete(secret.id)}
        className="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10"
      >
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
  const { t } = useTranslation("host");
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-900 rounded-2xl p-6 max-w-md w-full border border-gray-200 dark:border-white/10 shadow-2xl">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">{t("account.secrets.create")}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5 block">
              {t("account.secrets.name")}
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="API_KEY"
              required
              className="bg-white dark:bg-dark-800 border-gray-200 dark:border-white/10"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5 block">
              {t("account.secrets.value")}
            </label>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              type="password"
              required
              className="bg-white dark:bg-dark-800 border-gray-200 dark:border-white/10"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5 block">
              {t("account.secrets.description")}
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-white dark:bg-dark-800 border-gray-200 dark:border-white/10"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5 block">
              {t("account.secrets.password")}
            </label>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              className="bg-white dark:bg-dark-800 border-gray-200 dark:border-white/10"
            />
          </div>
          {error && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg border border-red-100 dark:border-red-900/30">
              {error}
            </p>
          )}
          <div className="flex gap-3 justify-end mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="dark:bg-transparent dark:border-white/20 dark:text-white"
            >
              {t("account.secrets.btnCancel")}
            </Button>
            <Button type="submit" disabled={loading} className="bg-neo text-dark-950 font-semibold hover:bg-neo/90">
              {loading ? t("account.secrets.creating") : t("account.secrets.btnCreate")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
