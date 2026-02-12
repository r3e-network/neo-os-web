import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, X, AlertTriangle } from "lucide-react";
import { useTranslation } from "@/lib/i18n/react";

interface PasswordVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerify: (password: string) => Promise<boolean>;
  title?: string;
  description?: string;
}

export function PasswordVerificationModal({
  isOpen,
  onClose,
  onVerify,
  title,
  description,
}: PasswordVerificationModalProps) {
  const { t } = useTranslation("host");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Close on Escape key
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const success = await onVerify(password);
      if (success) {
        setPassword("");
        onClose();
      } else {
        setError("Invalid password");
      }
    } catch {
      setError("Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPassword("");
    setError("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-verify-title"
        className="relative w-full max-w-md bg-white dark:bg-erobo-bg-deeper border border-erobo-purple/10 dark:border-white/10 shadow-2xl rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-erobo-purple/5 dark:border-white/5 bg-erobo-purple/5/50 dark:bg-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-neo/10 rounded-full text-neo">
              <Lock size={20} />
            </div>
            <h3 id="password-verify-title" className="text-lg font-bold text-erobo-ink dark:text-white">
              {title || t("account.neohub.passwordVerification")}
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="text-erobo-ink-soft/60 hover:text-erobo-ink dark:hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-erobo-ink-soft dark:text-slate-400">{description || t("account.neohub.enterPassword")}</p>

          <div className="space-y-1.5">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("account.neo.password")}
              autoFocus
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/10 p-2.5 rounded-lg font-medium">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={handleClose} className="flex-1">
              {t("account.secrets.btnCancel")}
            </Button>
            <Button
              type="submit"
              disabled={!password || loading}
              className="flex-1 bg-neo hover:bg-neo-dark text-black shadow-md"
            >
              {loading ? "..." : t("reviews.submit")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
