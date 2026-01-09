/**
 * Neo Account Management Component
 * For social account users to manage their Neo account:
 * - View current Neo address
 * - Regenerate new account
 * - Import external WIF
 * - Export account (with password verification)
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wallet, RefreshCw, Download, Upload, AlertTriangle, Check, Copy, Eye, EyeOff } from "lucide-react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useAccountSetup } from "@/lib/wallet/hooks/useAccountSetup";
import { useAccountManagement } from "@/lib/wallet/hooks/useAccountManagement";
import { useTranslation } from "@/lib/i18n/react";
import { cn } from "@/lib/utils";

interface NeoAccountManagementProps {
  walletAddress?: string;
}

type ActiveModal = "none" | "regenerate" | "import" | "export";

export function NeoAccountManagement({ walletAddress }: NeoAccountManagementProps) {
  const { t } = useTranslation("host");
  const { user } = useUser();
  const { state, setupAccount, checkStatus } = useAccountSetup();
  const { importWIF, verifyPassword, loading, error: mgmtError } = useAccountManagement();

  const [activeModal, setActiveModal] = useState<ActiveModal>("none");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [wifInput, setWifInput] = useState("");
  const [showWif, setShowWif] = useState(false);
  const [exportedWif, setExportedWif] = useState("");
  const [localError, setLocalError] = useState("");
  const [localSuccess, setLocalSuccess] = useState("");
  const [localLoading, setLocalLoading] = useState(false);

  // Only show for social account users
  if (!user) {
    return null;
  }

  const currentAddress = state.address || walletAddress;

  const resetState = () => {
    setPassword("");
    setConfirmPassword("");
    setWifInput("");
    setExportedWif("");
    setLocalError("");
    setLocalSuccess("");
    setShowWif(false);
  };

  const closeModal = () => {
    setActiveModal("none");
    resetState();
  };

  // Handle regenerate account
  const handleRegenerate = async () => {
    setLocalError("");
    setLocalSuccess("");

    if (password.length < 8) {
      setLocalError(t("account.neo.passwordMinLength") || "Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setLocalError(t("account.neo.passwordMismatch") || "Passwords do not match");
      return;
    }

    setLocalLoading(true);
    try {
      const result = await setupAccount(password);
      setLocalSuccess(t("account.neo.regenerateSuccess") || `New account created: ${result.address}`);
      await checkStatus();
      setTimeout(closeModal, 2000);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to regenerate account");
    } finally {
      setLocalLoading(false);
    }
  };

  // Handle import WIF
  const handleImport = async () => {
    setLocalError("");
    setLocalSuccess("");

    if (!wifInput.trim()) {
      setLocalError(t("account.neo.wifRequired") || "WIF is required");
      return;
    }

    if (password.length < 8) {
      setLocalError(t("account.neo.passwordMinLength") || "Password must be at least 8 characters");
      return;
    }

    setLocalLoading(true);
    try {
      const result = await importWIF(wifInput.trim(), password);
      if (result) {
        setLocalSuccess(t("account.neo.importSuccess") || `Account imported: ${result.address}`);
        await checkStatus();
        setTimeout(closeModal, 2000);
      } else {
        setLocalError(t("account.neo.importFailed") || "Failed to import account");
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to import account");
    } finally {
      setLocalLoading(false);
    }
  };

  // Handle export account
  const handleExport = async () => {
    setLocalError("");

    if (!password) {
      setLocalError(t("account.neo.passwordRequired") || "Password is required");
      return;
    }

    setLocalLoading(true);
    try {
      const response = await fetch("/api/account/export-wif", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to export account");
      }

      const data = await response.json();
      setExportedWif(data.wif);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to export account");
    } finally {
      setLocalLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setLocalSuccess(t("account.neo.copied") || "Copied to clipboard");
    setTimeout(() => setLocalSuccess(""), 2000);
  };

  return (
    <Card className="rounded-2xl bg-white/50 dark:bg-black/40 backdrop-blur-sm border-gray-200 dark:border-white/10 shadow-sm">
      <CardHeader className="border-b border-gray-100 dark:border-white/5 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <Wallet className="text-neo mr-2" size={28} />
              {t("account.neo.title") || "Neo Account"}
            </CardTitle>
            <CardDescription className="mt-1 text-gray-500 dark:text-gray-400">
              {t("account.neo.subtitle") || "Manage your Neo blockchain account"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-8 space-y-6">
        {/* Current Address Display */}
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                {t("account.neo.currentAddress") || "Current Address"}
              </p>
              <p className="text-sm font-mono font-medium text-gray-900 dark:text-white truncate">{currentAddress || "—"}</p>
            </div>
            {currentAddress && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(currentAddress)}
                className="ml-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white"
              >
                <Copy size={16} />
              </Button>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ActionButton
            icon={<RefreshCw size={18} />}
            label={t("account.neo.regenerate") || "Regenerate"}
            description={t("account.neo.regenerateDesc") || "Create new account"}
            onClick={() => setActiveModal("regenerate")}
            variant="warning"
          />
          <ActionButton
            icon={<Upload size={18} />}
            label={t("account.neo.import") || "Import WIF"}
            description={t("account.neo.importDesc") || "Use existing account"}
            onClick={() => setActiveModal("import")}
            variant="default"
          />
          <ActionButton
            icon={<Download size={18} />}
            label={t("account.neo.export") || "Export"}
            description={t("account.neo.exportDesc") || "Backup your key"}
            onClick={() => setActiveModal("export")}
            variant="default"
            disabled={!currentAddress}
          />
        </div>

        {/* Success/Error Messages */}
        {localSuccess && (
          <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 text-green-700 dark:text-green-400 rounded-lg">
            <Check size={16} />
            <span className="text-sm font-bold">{localSuccess}</span>
          </div>
        )}
      </CardContent>

      {/* Modals */}
      {activeModal !== "none" && (
        <ModalOverlay onClose={closeModal}>
          {activeModal === "regenerate" && (
            <RegenerateModal
              password={password}
              setPassword={setPassword}
              confirmPassword={confirmPassword}
              setConfirmPassword={setConfirmPassword}
              onSubmit={handleRegenerate}
              onCancel={closeModal}
              loading={localLoading}
              error={localError}
              success={localSuccess}
              t={t}
            />
          )}
          {activeModal === "import" && (
            <ImportModal
              wifInput={wifInput}
              setWifInput={setWifInput}
              password={password}
              setPassword={setPassword}
              showWif={showWif}
              setShowWif={setShowWif}
              onSubmit={handleImport}
              onCancel={closeModal}
              loading={localLoading}
              error={localError}
              success={localSuccess}
              t={t}
            />
          )}
          {activeModal === "export" && (
            <ExportModal
              password={password}
              setPassword={setPassword}
              exportedWif={exportedWif}
              showWif={showWif}
              setShowWif={setShowWif}
              onSubmit={handleExport}
              onCancel={closeModal}
              onCopy={() => copyToClipboard(exportedWif)}
              loading={localLoading}
              error={localError}
              t={t}
            />
          )}
        </ModalOverlay>
      )}
    </Card>
  );
}

// Sub-components
function ActionButton({
  icon,
  label,
  description,
  onClick,
  variant = "default",
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  variant?: "default" | "warning";
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "p-5 text-left rounded-xl border border-gray-200 dark:border-white/10 transition-all duration-300",
        "hover:shadow-md hover:border-gray-300 dark:hover:border-white/20 hover:-translate-y-0.5",
        disabled && "opacity-50 cursor-not-allowed hover:translate-y-0 hover:shadow-none hover:border-gray-200 dark:hover:border-white/10",
        variant === "warning"
          ? "bg-amber-50 dark:bg-amber-900/10 hover:bg-amber-100 dark:hover:bg-amber-900/20"
          : "bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10"
      )}
    >
      <div className="flex items-center gap-2.5 mb-2">
        <span className={variant === "warning" ? "text-amber-500" : "text-neo"}>{icon}</span>
        <span className="text-sm font-bold uppercase tracking-wide text-gray-900 dark:text-white">{label}</span>
      </div>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 leading-relaxed">{description}</p>
    </button>
  );
}

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-200">{children}</div>
    </div>
  );
}

function RegenerateModal({
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  onSubmit,
  onCancel,
  loading,
  error,
  success,
  t,
}: any) {
  return (
    <div className="bg-white dark:bg-[#050505] border border-gray-200 dark:border-white/10 shadow-2xl rounded-2xl overflow-hidden">
      <div className="p-6 border-b border-gray-100 dark:border-white/5 bg-amber-50/50 dark:bg-amber-900/10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-full text-amber-600 dark:text-amber-400">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t("account.neo.regenerateTitle") || "Regenerate Account"}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {t("account.neo.regenerateWarning") || "Warning: This will replace your current account."}
            </p>
          </div>
        </div>
      </div>
      <div className="p-6 space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1 block">
            {t("account.neo.newPassword") || "New Password"}
          </label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 12 characters"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1 block">
            {t("account.neo.confirmPassword") || "Confirm Password"}
          </label>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-red-500 font-semibold bg-red-50 dark:bg-red-900/10 p-2 rounded-lg">{error}</p>}
        {success && <p className="text-sm text-green-500 font-semibold bg-green-50 dark:bg-green-900/10 p-2 rounded-lg">{success}</p>}
        <div className="flex gap-3 pt-2">
          <Button onClick={onCancel} variant="ghost" className="flex-1">
            {t("actions.cancel") || "Cancel"}
          </Button>
          <Button onClick={onSubmit} disabled={loading} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white shadow-md">
            {loading ? "..." : t("account.neo.regenerate") || "Regenerate"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ImportModal({
  wifInput,
  setWifInput,
  password,
  setPassword,
  showWif,
  setShowWif,
  onSubmit,
  onCancel,
  loading,
  error,
  success,
  t,
}: any) {
  return (
    <div className="bg-white dark:bg-[#050505] border border-gray-200 dark:border-white/10 shadow-2xl rounded-2xl overflow-hidden">
      <div className="p-6 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-neo/10 rounded-full text-neo">
            <Upload size={20} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t("account.neo.importTitle") || "Import Account"}</h3>
        </div>
      </div>
      <div className="p-6 space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1 block">
            {t("account.neo.wifKey") || "WIF Private Key"}
          </label>
          <div className="relative">
            <Input
              type={showWif ? "text" : "password"}
              value={wifInput}
              onChange={(e) => setWifInput(e.target.value)}
              className="pr-10"
              placeholder="Enter your WIF key"
            />
            <button
              type="button"
              onClick={() => setShowWif(!showWif)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              {showWif ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1 block">
            {t("account.neo.encryptPassword") || "Encryption Password"}
          </label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 12 characters"
          />
        </div>
        {error && <p className="text-sm text-red-500 font-semibold bg-red-50 dark:bg-red-900/10 p-2 rounded-lg">{error}</p>}
        {success && <p className="text-sm text-green-500 font-semibold bg-green-50 dark:bg-green-900/10 p-2 rounded-lg">{success}</p>}
        <div className="flex gap-3 pt-2">
          <Button onClick={onCancel} variant="ghost" className="flex-1">
            {t("actions.cancel") || "Cancel"}
          </Button>
          <Button onClick={onSubmit} disabled={loading} className="flex-1 bg-neo hover:bg-neo-dark text-black shadow-md">
            {loading ? "..." : t("account.neo.import") || "Import"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ExportModal({
  password,
  setPassword,
  exportedWif,
  showWif,
  setShowWif,
  onSubmit,
  onCancel,
  onCopy,
  loading,
  error,
  t,
}: any) {
  return (
    <div className="bg-white dark:bg-[#050505] border border-gray-200 dark:border-white/10 shadow-2xl rounded-2xl overflow-hidden">
      <div className="p-6 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-neo/10 rounded-full text-neo">
            <Download size={20} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t("account.neo.exportTitle") || "Export Account"}</h3>
        </div>
      </div>
      <div className="p-6 space-y-4">
        {!exportedWif ? (
          <>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("account.neo.exportInfo") || "Enter your password to reveal your WIF private key."}
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1 block">
                {t("account.neo.password") || "Password"}
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-500 font-semibold bg-red-50 dark:bg-red-900/10 p-2 rounded-lg">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button onClick={onCancel} variant="ghost" className="flex-1">
                {t("actions.cancel") || "Cancel"}
              </Button>
              <Button onClick={onSubmit} disabled={loading} className="flex-1 bg-neo hover:bg-neo-dark text-black shadow-md">
                {loading ? "..." : t("account.neo.reveal") || "Reveal"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/20 text-red-600 dark:text-red-400 text-xs rounded-lg flex items-center gap-2">
              <AlertTriangle size={14} className="flex-shrink-0" />
              {t("account.neo.wifWarning") || "Never share your WIF key with anyone!"}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1 block">
                {t("account.neo.yourWif") || "Your WIF Key"}
              </label>
              <div className="relative">
                <Input
                  type={showWif ? "text" : "password"}
                  value={exportedWif}
                  readOnly
                  className="pr-20 font-mono text-xs bg-gray-50 dark:bg-black/40"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <button onClick={() => setShowWif(!showWif)} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                    {showWif ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button onClick={onCopy} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            </div>
            <Button onClick={onCancel} variant="outline" className="w-full">
              {t("actions.close") || "Close"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default NeoAccountManagement;
