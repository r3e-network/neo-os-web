/**
 * Account Backup Component
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, AlertTriangle } from "lucide-react";

interface AccountBackupProps {
  walletAddress: string;
}

export function AccountBackup({ walletAddress }: AccountBackupProps) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleBackup = async () => {
    if (!password) {
      setError("Password is required");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/account/get-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, password }),
      });

      if (!response.ok) {
        throw new Error("Invalid password");
      }

      const { privateKey, address } = await response.json();

      // Create backup file
      const backup = {
        version: "1.0",
        address,
        privateKey,
        exportedAt: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `neo-account-${address.substring(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="glass-card border-amber-500/20">
      <CardHeader>
        <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
          <Download size={20} className="text-amber-500" />
          Account Backup
        </CardTitle>
        <CardDescription>Export your private key for backup</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <AlertTriangle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-600 dark:text-amber-400">
            <p className="font-semibold mb-1">Security Warning</p>
            <p>Never share your private key. Store it securely offline.</p>
          </div>
        </div>

        <div>
          <label className="text-sm text-slate-400 mb-2 block">Enter Password</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your account password"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button onClick={handleBackup} disabled={loading || !password} className="w-full">
          {loading ? "Exporting..." : "Export Private Key"}
        </Button>
      </CardContent>
    </Card>
  );
}
