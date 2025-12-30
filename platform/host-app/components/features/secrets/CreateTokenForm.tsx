import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useSecretsStore } from "@/lib/secrets";

const SECRET_TYPES = [
  { value: "api_key", label: "API Key", icon: "🔑", desc: "External service API keys" },
  { value: "encryption_key", label: "Encryption Key", icon: "🔐", desc: "For confidential computing" },
  { value: "custom", label: "Custom Secret", icon: "📝", desc: "Custom key-value secret" },
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
      <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
        <h4 className="font-semibold text-green-800">Secret Created!</h4>
        <p className="mt-1 text-sm text-green-700">Your secret has been securely stored.</p>
        <Button size="sm" className="mt-3" onClick={onClose}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 rounded-lg border p-4">
      <h4 className="font-semibold">Create New Secret</h4>
      <div className="mt-3 space-y-3">
        <div>
          <label className="block text-sm text-gray-600">Secret Type</label>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {SECRET_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setSecretType(type.value)}
                className={`rounded border p-2 text-left text-sm ${
                  secretType === type.value ? "border-blue-500 bg-blue-50" : "border-gray-200"
                }`}
              >
                <span className="text-lg">{type.icon}</span>
                <div className="font-medium">{type.label}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-600">Secret Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My API Token"
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600">Secret Value</label>
          <div className="relative mt-1">
            <input
              type={showValue ? "text" : "password"}
              value={secretValue}
              onChange={(e) => setSecretValue(e.target.value)}
              placeholder="Enter your secret value"
              className="w-full rounded border px-3 py-2 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowValue(!showValue)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
            >
              {showValue ? "🙈" : "👁"}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-600">App Scope</label>
          <input
            type="text"
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            placeholder="Leave empty for global access"
            className="mt-1 w-full rounded border px-3 py-2"
          />
          <p className="mt-1 text-xs text-gray-500">Restrict to specific MiniApp or leave empty for all apps</p>
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
