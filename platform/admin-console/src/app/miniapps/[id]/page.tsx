"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

export default function MiniAppConfigPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/miniapps/${params.id}/config`)
      .then((res) => res.json())
      .then((data) => {
        setConfig(data);
        setLoading(false);
      });
  }, [params.id]);

  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/miniapps/${params.id}/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    setSaving(false);
    alert("Configuration saved successfully.");
  };

  if (loading) return <div className="flex justify-center p-12"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" onClick={() => router.push("/miniapps")}>&larr; Back</Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">MiniApp Configuration</h1>
          <p className="text-gray-600 dark:text-gray-400 font-mono text-sm">{params.id}</p>
        </div>
        <div className="ml-auto">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Configuration"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card variant="glass">
          <CardHeader>
            <CardTitle>TEE Permissions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(config.permissions).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between p-4 border rounded-xl border-white/10 bg-white/5">
                <div className="font-semibold text-white capitalize">{key.replace(/_/g, ' ')}</div>
                {typeof value === 'boolean' ? (
                  <input 
                    type="checkbox" 
                    checked={value} 
                    onChange={(e) => setConfig({
                      ...config, 
                      permissions: { ...config.permissions, [key]: e.target.checked }
                    })}
                    className="w-5 h-5 accent-neo"
                  />
                ) : (
                  <input 
                    type="number" 
                    value={value as number}
                    onChange={(e) => setConfig({
                      ...config, 
                      permissions: { ...config.permissions, [key]: parseFloat(e.target.value) }
                    })}
                    className="w-24 bg-black/20 border border-white/10 rounded-lg px-3 py-1 text-white text-right"
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader>
            <CardTitle>Tokens & Assets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Allowed Assets (Comma separated)</label>
              <input 
                type="text" 
                value={config.tokens.allowed_assets.join(', ')}
                onChange={(e) => setConfig({
                  ...config, 
                  tokens: { ...config.tokens, allowed_assets: e.target.value.split(',').map(s => s.trim()) }
                })}
                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">24H Withdrawal Limit</label>
              <input 
                type="number" 
                value={config.tokens.withdrawal_limit_24h}
                onChange={(e) => setConfig({
                  ...config, 
                  tokens: { ...config.tokens, withdrawal_limit_24h: parseFloat(e.target.value) }
                })}
                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white"
              />
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader>
            <CardTitle>Lifecycle Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             {Object.entries(config.actions).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between p-4 border rounded-xl border-red-500/20 bg-red-500/5">
                <div className="font-semibold text-white capitalize">{key.replace(/_/g, ' ')}</div>
                <input 
                  type="checkbox" 
                  checked={value as boolean} 
                  onChange={(e) => setConfig({
                    ...config, 
                    actions: { ...config.actions, [key]: e.target.checked }
                  })}
                  className="w-5 h-5 accent-red-500"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
