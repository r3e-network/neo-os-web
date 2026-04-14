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
  const { createToken, loading, error, clearError } = useSecretsStore();
  const [name, setName] = useState("");
  const [appId, setAppId] = useState(defaultAppId || "");
  const [secretType, setSecretType] = useState<string>("api_key");
  const [secretValue, setSecretValue] = useState("");
  const [showValue, setShowValue] = useState(false);
  const [created, setCreated] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !secretValue.trim()) {
      setValidationError("Please fill in all required fields.");
      return;
    }
    setValidationError(null);
    clearError();

    try {
      await createToken(name, appId || "global", secretType, secretValue);
      setCreated(true);
    } catch {
      // error set by store, will be shown via {error && ...}
    }
  };

  if (created) {
    return (
      <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <h4 className="font-semibold text-emerald-800">Secret Created!</h4>
        <p className="mt-1 text-sm text-emerald-700">Your secret has been securely stored.</p>
        <Button size="sm" className="mt-3" onClick={onClose}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 rounded-lg border border-gray-200 p-4">
      <h4 className="font-semibold text-gray-900">Create New Secret</h4>
      <div className="mt-3 space-y-3">
        <div>
          <div className="block text-sm text-gray-600">Secret Type</div>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {SECRET_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                aria-pressed={secretType === type.value}
                onClick={() => setSecretType(type.value)}
                className={`rounded-lg border p-2 text-left text-sm text-gray-900 cursor-pointer transition-colors ${
                  secretType === type.value
                    ? "border-neo bg-neo/10"
                    : "border-gray-200 hover:border-gray-300"
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50`}
              >
                <type.icon size={18} />
                <div className="font-medium">{type.label}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="secret-name" className="block text-sm text-gray-600">Secret Name</label>
          <input
            id="secret-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My API Token"
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-900 placeholder-gray-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
          />
        </div>
        <div>
          <label htmlFor="secret-value" className="block text-sm text-gray-600">Secret Value</label>
          <div className="relative mt-1">
            <input
              id="secret-value"
              type={showValue ? "text" : "password"}
              value={secretValue}
              onChange={(e) => setSecretValue(e.target.value)}
              placeholder="Enter your secret value"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pr-10 text-gray-900 placeholder-gray-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
            />
            <button
              type="button"
              onClick={() => setShowValue(!showValue)}
              aria-label={showValue ? "Hide secret" : "Show secret"}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 rounded-lg"
            >
              {showValue ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="secret-app-scope" className="block text-sm text-gray-600">App Scope</label>
          <input
            id="secret-app-scope"
            type="text"
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            placeholder="Leave empty for global access"
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-900 placeholder-gray-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
          />
          <p className="mt-1 text-xs text-gray-500">
            Restrict to specific MiniApp or leave empty for all apps
          </p>
        </div>
      </div>
      {validationError && (
        <p className="mt-3 text-sm text-red-600" role="alert">{validationError}</p>
      )}
      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>
      )}
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
