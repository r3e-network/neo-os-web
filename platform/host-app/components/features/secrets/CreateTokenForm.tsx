import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useSecretsStore } from "@/lib/secrets";
import { Key, Lock, FileText, Eye, EyeOff } from "lucide-react";

const SECRET_TYPES = [
  { value: "api_key", label: "API Key", icon: Key, desc: "External service API keys" },
  { value: "encryption_key", label: "Encryption Key", icon: Lock, desc: "For confidential computing" },
  { value: "custom", label: "Custom Secret", icon: FileText, desc: "Custom key-value secret" },
] as const;

interface CreateTokenFormProps {
  onClose: () => void;
  defaultAppId?: string;
}

export function CreateTokenForm({ onClose, defaultAppId }: CreateTokenFormProps) {
  const { createToken, loading } = useSecretsStore();
  const [name, setName] = useState("");
  const [appId, setAppId] = useState(defaultAppId || "");
  const [secretType, setSecretType] = useState<string>("api_key");
  const [secretValue, setSecretValue] = useState("");
  const [showValue, setShowValue] = useState(false);
  const [created, setCreated] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !secretValue.trim()) return;

    try {
      await createToken(name, appId || "global", secretType, secretValue);
      setCreated(true);
    } catch {
      // Error handled by store
    }
  };

  if (created) {
    return (
      <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
        <h4 className="font-semibold text-emerald-800 dark:text-emerald-400">Secret Created!</h4>
        <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">Your secret has been securely stored.</p>
        <Button size="sm" className="mt-3" onClick={onClose}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <h4 className="font-semibold text-gray-900 dark:text-white">Create New Secret</h4>
      <div className="mt-3 space-y-3">
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400">Secret Type</label>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {SECRET_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                aria-pressed={secretType === type.value}
                onClick={() => setSecretType(type.value)}
                className={`rounded-lg border p-2 text-left text-sm text-gray-900 dark:text-white cursor-pointer transition-colors ${
                  secretType === type.value
                    ? "border-neo bg-neo/10 dark:bg-neo/20"
                    : "border-gray-200 dark:border-gray-700 dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600"
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50`}
              >
                <type.icon size={18} />
                <div className="font-medium">{type.label}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="secret-name" className="block text-sm text-gray-600 dark:text-gray-400">Secret Name</label>
          <input
            id="secret-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My API Token"
            className="mt-1 w-full rounded border border-gray-200 bg-white px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
          />
        </div>
        <div>
          <label htmlFor="secret-value" className="block text-sm text-gray-600 dark:text-gray-400">Secret Value</label>
          <div className="relative mt-1">
            <input
              id="secret-value"
              type={showValue ? "text" : "password"}
              value={secretValue}
              onChange={(e) => setSecretValue(e.target.value)}
              placeholder="Enter your secret value"
              className="w-full rounded border border-gray-200 bg-white px-3 py-2 pr-10 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
            />
            <button
              type="button"
              onClick={() => setShowValue(!showValue)}
              aria-label={showValue ? "Hide secret" : "Show secret"}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 rounded-lg"
            >
              {showValue ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="secret-app-scope" className="block text-sm text-gray-600 dark:text-gray-400">App Scope</label>
          <input
            id="secret-app-scope"
            type="text"
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            placeholder="Leave empty for global access"
            className="mt-1 w-full rounded border border-gray-200 bg-white px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Restrict to specific MiniApp or leave empty for all apps
          </p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button type="submit" disabled={loading || !name.trim() || !secretValue.trim()}>
          {loading ? "Creating..." : "Create Secret"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
