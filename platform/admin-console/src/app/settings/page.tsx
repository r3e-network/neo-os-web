"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

export default function SettingsPage() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        setConfig(data);
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center p-12"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Platform Settings</h1>
          <p className="text-gray-600 dark:text-gray-400">Global configuration and platform tuning</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Configuration"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card variant="glass">
          <CardHeader>
            <CardTitle>System Maintenance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-xl border-gray-200 dark:border-white/10 bg-white/5">
              <div>
                <div className="font-semibold text-white">Maintenance Mode</div>
                <div className="text-sm text-gray-400">Suspend all non-admin traffic</div>
              </div>
              <input 
                type="checkbox" 
                checked={config.maintenanceMode} 
                onChange={(e) => setConfig({...config, maintenanceMode: e.target.checked})}
                className="w-5 h-5 accent-neo"
              />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-xl border-gray-200 dark:border-white/10 bg-white/5">
              <div>
                <div className="font-semibold text-white">MiniApp Approval Gate</div>
                <div className="text-sm text-gray-400">Require manual review for production publish</div>
              </div>
              <input 
                type="checkbox" 
                checked={config.approvalGateRequired} 
                onChange={(e) => setConfig({...config, approvalGateRequired: e.target.checked})}
                className="w-5 h-5 accent-neo"
              />
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader>
            <CardTitle>Tuning Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Max MiniApp Bundle Size (MB)</label>
              <input 
                type="number" 
                value={config.maxMiniappSizeMb}
                onChange={(e) => setConfig({...config, maxMiniappSizeMb: parseInt(e.target.value)})}
                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-neo focus:ring-1 focus:ring-neo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">PriceFeed Refresh Interval (ms)</label>
              <input 
                type="number" 
                value={config.pricefeedIntervalMs}
                onChange={(e) => setConfig({...config, pricefeedIntervalMs: parseInt(e.target.value)})}
                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-neo focus:ring-1 focus:ring-neo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Log Level</label>
              <select 
                value={config.logLevel}
                onChange={(e) => setConfig({...config, logLevel: e.target.value})}
                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-neo focus:ring-1 focus:ring-neo"
              >
                <option value="debug">Debug</option>
                <option value="info">Info</option>
                <option value="warn">Warn</option>
                <option value="error">Error</option>
              </select>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
