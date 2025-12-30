"use client";

import { useState } from "react";
import { Bell, Mail, Zap, AlertTriangle, Clock } from "lucide-react";
import { useNotificationStore } from "@/lib/notifications/store";
import type { DigestFrequency } from "@/lib/notifications/types";

export function NotificationSettings() {
  const { preferences, updatePreferences, bindEmail, verifyEmail, loading } = useNotificationStore();
  const [emailInput, setEmailInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [showVerify, setShowVerify] = useState(false);

  if (!preferences) {
    return <div className="p-4 text-gray-500">Connect wallet to manage notifications</div>;
  }

  const handleBindEmail = async () => {
    if (!emailInput) return;
    await bindEmail(emailInput);
    setShowVerify(true);
  };

  const handleVerify = async () => {
    const success = await verifyEmail(codeInput);
    if (success) {
      setShowVerify(false);
      setCodeInput("");
    }
  };

  return (
    <div className="space-y-6">
      {/* Email Section */}
      <SettingsSection title="Email Notifications" icon={<Mail size={18} />}>
        {preferences.email && preferences.emailVerified ? (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">{preferences.email}</span>
            <span className="text-xs text-emerald-500">✓ Verified</span>
          </div>
        ) : showVerify ? (
          <VerifyCodeInput code={codeInput} onChange={setCodeInput} onVerify={handleVerify} loading={loading} />
        ) : (
          <EmailBindInput email={emailInput} onChange={setEmailInput} onBind={handleBindEmail} loading={loading} />
        )}
      </SettingsSection>

      {/* Notification Types */}
      <SettingsSection title="Notification Types" icon={<Bell size={18} />}>
        <ToggleItem
          label="MiniApp Results"
          description="Wins, losses, and game outcomes"
          checked={preferences.notifyMiniappResults}
          onChange={(v) => updatePreferences({ notifyMiniappResults: v })}
        />
        <ToggleItem
          label="Balance Changes"
          description="Deposits and withdrawals"
          checked={preferences.notifyBalanceChanges}
          onChange={(v) => updatePreferences({ notifyBalanceChanges: v })}
        />
        <ToggleItem
          label="Chain Alerts"
          description="Network issues and congestion"
          checked={preferences.notifyChainAlerts}
          onChange={(v) => updatePreferences({ notifyChainAlerts: v })}
        />
      </SettingsSection>

      {/* Digest Frequency */}
      <SettingsSection title="Digest Frequency" icon={<Clock size={18} />}>
        <FrequencySelector
          value={preferences.digestFrequency}
          onChange={(v) => updatePreferences({ digestFrequency: v })}
        />
      </SettingsSection>
    </div>
  );
}

// Sub-components
function SettingsSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <span className="text-gray-500">{icon}</span>
        <h3 className="font-medium text-gray-900 dark:text-white">{title}</h3>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

function ToggleItem({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition-colors ${checked ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`}
      >
        <span
          className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${checked ? "translate-x-4" : ""}`}
        />
      </button>
    </div>
  );
}

function EmailBindInput({
  email,
  onChange,
  onBind,
  loading,
}: {
  email: string;
  onChange: (v: string) => void;
  onBind: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex gap-2">
      <input
        type="email"
        value={email}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter email address"
        className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
      />
      <button
        onClick={onBind}
        disabled={loading || !email}
        className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50"
      >
        {loading ? "..." : "Bind"}
      </button>
    </div>
  );
}

function VerifyCodeInput({
  code,
  onChange,
  onVerify,
  loading,
}: {
  code: string;
  onChange: (v: string) => void;
  onVerify: () => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">Enter the verification code sent to your email</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => onChange(e.target.value)}
          placeholder="6-digit code"
          maxLength={6}
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
        />
        <button
          onClick={onVerify}
          disabled={loading || code.length !== 6}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          {loading ? "..." : "Verify"}
        </button>
      </div>
    </div>
  );
}

function FrequencySelector({ value, onChange }: { value: DigestFrequency; onChange: (v: DigestFrequency) => void }) {
  const options: { value: DigestFrequency; label: string; desc: string }[] = [
    { value: "instant", label: "Instant", desc: "Get notified immediately" },
    { value: "hourly", label: "Hourly", desc: "Digest every hour" },
    { value: "daily", label: "Daily", desc: "Daily summary at 9 AM" },
  ];

  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
            value === opt.value
              ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
              : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
          }`}
        >
          <div className="text-left">
            <p className="text-sm font-medium text-gray-900 dark:text-white">{opt.label}</p>
            <p className="text-xs text-gray-500">{opt.desc}</p>
          </div>
          {value === opt.value && <span className="text-emerald-500">✓</span>}
        </button>
      ))}
    </div>
  );
}
