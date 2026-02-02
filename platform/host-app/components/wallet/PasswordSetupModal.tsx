/**
 * PasswordSetupModal - Modal for setting up social account password
 */

import { useState, useCallback } from "react";

// Simple password validation (replaces deleted auth0/crypto)
interface PasswordValidation {
  valid: boolean;
  errors?: string[];
}

function validatePassword(password: string): PasswordValidation {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

interface PasswordSetupModalProps {
  isOpen: boolean;
  onSetup: (password: string) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function PasswordSetupModal({ isOpen, onSetup, onCancel, isLoading }: PasswordSetupModalProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const handlePasswordChange = useCallback((value: string) => {
    setPassword(value);
    setError(null);

    // Validate password strength
    const validation = validatePassword(value);
    setValidationErrors(validation.errors || []);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      // Validate password match
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }

      // Validate password strength
      const validation = validatePassword(password);
      if (!validation.valid) {
        setError("Password does not meet requirements");
        return;
      }

      try {
        await onSetup(password);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Setup failed");
      }
    },
    [password, confirmPassword, onSetup],
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-black/60 border border-white/10 p-8 shadow-2xl backdrop-blur-xl">
        <h2 className="mb-4 text-xl font-bold text-white tracking-tight">Set Up Your Neo Wallet</h2>

        <p className="mb-6 text-sm text-white/60 leading-relaxed">
          Create a password to secure your Neo wallet. This password will be used to sign transactions.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-white/80 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/30 focus:border-neo/50 focus:outline-none focus:ring-1 focus:ring-neo/50 transition-all"
              placeholder="Enter password"
              disabled={isLoading}
              minLength={8}
              required
            />
            {validationErrors.length > 0 && (
              <ul className="mt-2 text-xs text-yellow-400/80 space-y-1 pl-1">
                {validationErrors.map((err, i) => (
                  <li key={i}>• {err}</li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-white/80 mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/30 focus:border-neo/50 focus:outline-none focus:ring-1 focus:ring-neo/50 transition-all"
              placeholder="Confirm password"
              disabled={isLoading}
              minLength={8}
              required
            />
          </div>

          {error && <p className="text-sm font-bold text-red-400 text-center">{error}</p>}

          <div className="flex gap-4 pt-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isLoading}
                className="flex-1 rounded-full border border-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/10 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={isLoading || validationErrors.length > 0}
              className="flex-1 rounded-full bg-neo px-4 py-3 text-sm font-bold text-black hover:bg-neo/90 shadow-[0_0_15px_rgba(0,229,153,0.3)] transition-all disabled:opacity-50"
            >
              {isLoading ? "Setting up..." : "Create Wallet"}
            </button>
          </div>
        </form>

        <p className="mt-6 text-xs text-white/40 text-center leading-relaxed">
          Your private key is encrypted with your password and stored securely. We never have access to your unencrypted
          private key.
        </p>
      </div>
    </div>
  );
}
