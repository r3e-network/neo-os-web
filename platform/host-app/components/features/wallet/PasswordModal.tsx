/**
 * Password Modal Component
 * Prompts user to enter password for signing operations (OAuth mode)
 */

import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useTranslation } from "@/lib/i18n/react";

interface PasswordModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (password: string) => Promise<void>;
  title?: string;
  description?: string;
}

export function PasswordModal({ open, onClose, onSubmit, title, description }: PasswordModalProps) {
  const { t } = useTranslation("common");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!password.trim()) {
      setError(t("errors.passwordRequired") || "Password is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSubmit(password);
      setPassword("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.invalidPassword") || "Invalid password");
    } finally {
      setLoading(false);
    }
  }, [password, onSubmit, onClose, t]);

  const handleClose = useCallback(() => {
    setPassword("");
    setError(null);
    onClose();
  }, [onClose]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock size={20} className="text-[#00E599]" />
            {title || t("signing.passwordRequired") || "Password Required"}
          </DialogTitle>
          <DialogDescription>
            {description || t("signing.enterPasswordToSign") || "Enter your password to sign this transaction."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              {t("labels.password") || "Password"}
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="Enter your password"
                disabled={loading}
                className="pr-10"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <AlertCircle size={16} className="text-red-500" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={handleClose} disabled={loading}>
            {t("actions.cancel") || "Cancel"}
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !password.trim()}>
            {loading ? t("actions.loading") || "Signing..." : t("actions.confirm") || "Confirm"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
