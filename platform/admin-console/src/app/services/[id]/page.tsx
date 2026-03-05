"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

export default function ServiceConfigPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/services/${params.id}/config`)
      .then((res) => res.json())
      .then((data) => {
        setConfig(data);
        setLoading(false);
      });
  }, [params.id]);

  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/services/${params.id}/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    setSaving(false);
    alert("Service configuration saved successfully.");
  };

  if (loading) return <div className="flex justify-center p-12"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" onClick={() => router.push("/services")}>&larr; Back</Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Service Configuration</h1>
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
            <CardTitle>Routing & Networking</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="flex items-center justify-between p-4 border rounded-xl border-white/10 bg-white/5">
                <div className="font-semibold text-white">Enable Traffic Routing</div>
                <input 
                  type="checkbox" 
                  checked={config.routing.enabled} 
                  onChange={(e) => setConfig({
                    ...config, 
                    routing: { ...config.routing, enabled: e.target.checked }
                  })}
                  className="w-5 h-5 accent-neo"
                />
              </div>
              <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Max Concurrent Requests</label>
              <input 
                type="number" 
                value={config.routing.max_concurrent_requests}
                onChange={(e) => setConfig({
                  ...config, 
                  routing: { ...config.routing, max_concurrent_requests: parseFloat(e.target.value) }
                })}
                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white"
              />
            </div>
             <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Timeout (ms)</label>
              <input 
                type="number" 
                value={config.routing.timeout_ms}
                onChange={(e) => setConfig({
                  ...config, 
                  routing: { ...config.routing, timeout_ms: parseFloat(e.target.value) }
                })}
                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white"
              />
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader>
            <CardTitle>Security & Compliance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="flex items-center justify-between p-4 border rounded-xl border-white/10 bg-white/5">
                <div className="font-semibold text-white">Require AWS Nitro Attestation Signature</div>
                <input 
                  type="checkbox" 
                  checked={config.security.require_signature} 
                  onChange={(e) => setConfig({
                    ...config, 
                    security: { ...config.security, require_signature: e.target.checked }
                  })}
                  className="w-5 h-5 accent-neo"
                />
              </div>
              <div className="flex items-center justify-between p-4 border rounded-xl border-white/10 bg-white/5">
                <div className="font-semibold text-white">Enforce Contract Allowlist Only</div>
                <input 
                  type="checkbox" 
                  checked={config.security.allowlist_only} 
                  onChange={(e) => setConfig({
                    ...config, 
                    security: { ...config.security, allowlist_only: e.target.checked }
                  })}
                  className="w-5 h-5 accent-neo"
                />
              </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
