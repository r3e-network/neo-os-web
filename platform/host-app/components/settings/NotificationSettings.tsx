"use client";

import { useEffect, useState } from "react";
import { useNotificationStore } from "@/lib/notifications";

interface NotificationSettingsProps {
  walletAddress: string;
}

export function NotificationSettings({ walletAddress }: NotificationSettingsProps) {
  const { preferences, loading, error, loadPreferences, updatePreferences, bindEmail, clearError } =
    useNotificationStore();

  const [email, setEmail] = useState("");
  const [showEmailInput, setShowEmailInput] = useState(false);

  useEffect(() => {
    if (walletAddress) {
      loadPreferences(walletAddress);
    }
  }, [walletAddress, loadPreferences]);

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  if (!preferences) {
    return <div className="p-4">No preferences found</div>;
  }

  return (
    <div className="space-y-6 p-4">
      <h2 className="text-xl font-bold">Notification Settings</h2>

      {error && (
        <div className="bg-red-100 p-3 rounded text-red-700">
          {error}
          <button onClick={clearError} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Email Section */}
      <EmailSection
        preferences={preferences}
        email={email}
        setEmail={setEmail}
        showEmailInput={showEmailInput}
        setShowEmailInput={setShowEmailInput}
        bindEmail={bindEmail}
      />

      {/* Toggle Section */}
      <ToggleSection preferences={preferences} updatePreferences={updatePreferences} />
    </div>
  );
}

// Email Section Component
function EmailSection({
  preferences,
  email,
  setEmail,
  showEmailInput,
  setShowEmailInput,
  bindEmail,
}: {
  preferences: { email: string | null; emailVerified: boolean };
  email: string;
  setEmail: (v: string) => void;
  showEmailInput: boolean;
  setShowEmailInput: (v: boolean) => void;
  bindEmail: (email: string) => Promise<void>;
}) {
  return (
    <div className="border rounded p-4">
      <h3 className="font-semibold mb-2">Email Notifications</h3>
      {preferences.email ? (
        <div className="flex items-center gap-2">
          <span>{preferences.email}</span>
          {preferences.emailVerified ? (
            <span className="text-green-600 text-sm">Verified</span>
          ) : (
            <span className="text-yellow-600 text-sm">Pending</span>
          )}
        </div>
      ) : showEmailInput ? (
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter email"
            className="border rounded px-2 py-1 flex-1"
          />
          <button onClick={() => bindEmail(email)} className="bg-blue-500 text-white px-3 py-1 rounded">
            Bind
          </button>
        </div>
      ) : (
        <button onClick={() => setShowEmailInput(true)} className="text-blue-500 underline">
          Add email
        </button>
      )}
    </div>
  );
}

// Toggle Section Component
function ToggleSection({
  preferences,
  updatePreferences,
}: {
  preferences: {
    notifyMiniappResults: boolean;
    notifyBalanceChanges: boolean;
    notifyChainAlerts: boolean;
  };
  updatePreferences: (p: Record<string, boolean>) => Promise<void>;
}) {
  const toggles = [
    { key: "notifyMiniappResults", label: "MiniApp Results", desc: "Win/loss" },
    { key: "notifyBalanceChanges", label: "Balance Changes", desc: "Deposits" },
    { key: "notifyChainAlerts", label: "Chain Alerts", desc: "Network health" },
  ];

  return (
    <div className="border rounded p-4 space-y-3">
      <h3 className="font-semibold">Notification Types</h3>
      {toggles.map((t) => (
        <Toggle
          key={t.key}
          label={t.label}
          desc={t.desc}
          checked={preferences[t.key as keyof typeof preferences]}
          onChange={(v) => updatePreferences({ [t.key]: v })}
        />
      ))}
    </div>
  );
}

// Toggle Component
function Toggle({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between">
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-sm text-gray-500">{desc}</div>
      </div>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-5 h-5" />
    </label>
  );
}
