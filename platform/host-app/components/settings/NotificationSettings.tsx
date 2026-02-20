"use client";

import { useEffect, useState } from "react";
import { useNotificationStore } from "@/lib/notifications";
import { Skeleton } from "@/components/ui/skeleton";

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
    return (
      <div className="space-y-6 p-4">
        <Skeleton className="h-7 w-48" />
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
          <Skeleton className="h-5 w-36" />
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-5 w-5 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!preferences) {
    return <div className="py-8 text-center text-gray-500 dark:text-gray-400">No preferences found</div>;
  }

  return (
    <div className="space-y-6 p-4">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">Notification Settings</h2>

      {error && (
        <div role="alert" className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400">
          {error}
          <button
            type="button"
            onClick={clearError}
            className="ml-2 underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 rounded-lg"
          >
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
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Email Notifications</h3>
      {preferences.email ? (
        <div className="flex items-center gap-2">
          <span>{preferences.email}</span>
          {preferences.emailVerified ? (
            <span className="text-emerald-600 dark:text-emerald-400 text-sm">Verified</span>
          ) : (
            <span className="text-yellow-600 dark:text-yellow-400 text-sm">Pending</span>
          )}
        </div>
      ) : showEmailInput ? (
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Email address"
            placeholder="Enter email"
            className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-lg px-2 py-1 flex-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
          />
          <button type="button" onClick={() => bindEmail(email)} className="bg-blue-500 text-white px-3 py-1 rounded-lg hover:bg-blue-600 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50">
            Bind
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowEmailInput(true)}
          className="text-blue-500 dark:text-blue-400 underline transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 rounded-lg"
        >
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
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
      <h3 className="font-semibold text-gray-900 dark:text-white">Notification Types</h3>
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
        <div className="font-medium text-gray-900 dark:text-white">{label}</div>
        <div className="text-sm text-gray-500 dark:text-gray-400">{desc}</div>
      </div>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-5 h-5 accent-neo rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50" />
    </label>
  );
}
