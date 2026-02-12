/**
 * Password Change Component
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Check } from "lucide-react";

interface PasswordChangeProps {
  walletAddress: string;
}

export function PasswordChange({ walletAddress }: PasswordChangeProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          currentPassword,
          newPassword,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to change password");
      }

      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-erobo-ink dark:text-white flex items-center gap-2">
          <Lock size={20} className="text-neo" />
          Change Password
        </CardTitle>
        <CardDescription>Update your account password</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleChange} className="space-y-4">
          <div>
            <label className="text-sm text-slate-400 mb-2 block">Current Password</label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-sm text-slate-400 mb-2 block">New Password</label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </div>

          <div>
            <label className="text-sm text-slate-400 mb-2 block">Confirm New Password</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
          {success && (
            <div className="flex items-center gap-2 text-sm text-green-500">
              <Check size={16} />
              <span>Password changed successfully</span>
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Changing..." : "Change Password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
