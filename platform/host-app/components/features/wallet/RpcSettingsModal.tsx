import { useState, useEffect, useMemo, useCallback } from "react";
import { X, Globe, Check, AlertCircle, RefreshCw } from "lucide-react";
import { useWalletStore } from "@/lib/wallet/store";
import { useTranslation } from "@/lib/i18n/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getChainRegistry } from "@/lib/chains/registry";
import type { ChainId, ChainConfig } from "@/lib/chains/types";

interface RpcSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RpcSettingsModal({ isOpen, onClose }: RpcSettingsModalProps) {
  const { t } = useTranslation("common");
  const { networkConfig, setCustomRpcUrl } = useWalletStore();

  // Get active chains from registry
  const chains = useMemo(() => getChainRegistry().getActiveChains(), []);

  // State for custom RPC URLs per chain
  const [customUrls, setCustomUrls] = useState<Partial<Record<ChainId, string>>>({});
  const [testing, setTesting] = useState<ChainId | null>(null);
  const [testResults, setTestResults] = useState<Partial<Record<ChainId, "success" | "error">>>({});

  useEffect(() => {
    if (isOpen) {
      setCustomUrls(networkConfig.customRpcUrls || {});
      setTestResults({});
    }
  }, [isOpen, networkConfig.customRpcUrls]);

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

  // Get RPC test method for Neo N3
  const getRpcTestMethod = (_chain: ChainConfig) => {
    return "getblockcount";
  };

  const testRpcUrl = async (chainId: ChainId, url: string) => {
    if (!url.trim()) {
      setTestResults((prev) => {
        const next = { ...prev };
        delete next[chainId];
        return next;
      });
      return;
    }

    const chain = chains.find((c) => c.id === chainId);
    if (!chain) return;

    setTesting(chainId);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: getRpcTestMethod(chain),
          params: [],
        }),
      });

      const data = await response.json();
      const isValid = data.result && typeof data.result === "number";

      setTestResults((prev) => ({ ...prev, [chainId]: isValid ? "success" : "error" }));
    } catch {
      setTestResults((prev) => ({ ...prev, [chainId]: "error" }));
    } finally {
      setTesting(null);
    }
  };

  const handleSave = () => {
    // Save all custom RPC URLs
    chains.forEach((chain) => {
      const url = customUrls[chain.id]?.trim() || null;
      setCustomRpcUrl(chain.id, url);
    });
    onClose();
  };

  const handleReset = (chainId: ChainId) => {
    setCustomUrls((prev) => {
      const next = { ...prev };
      delete next[chainId];
      return next;
    });
    setTestResults((prev) => {
      const next = { ...prev };
      delete next[chainId];
      return next;
    });
  };

  const updateUrl = (chainId: ChainId, url: string) => {
    setCustomUrls((prev) => ({ ...prev, [chainId]: url }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rpc-settings-title"
        className="relative w-full max-w-md bg-white dark:bg-erobo-bg-deeper border border-gray-200 dark:border-white/10 shadow-2xl rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-neo/10 rounded-full text-neo">
              <Globe size={20} />
            </div>
            <h2 id="rpc-settings-title" className="text-lg font-bold text-gray-900 dark:text-white">
              {t("network.rpcSettings") || "RPC Settings"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("network.rpcDescription") || "Configure custom RPC endpoints. Leave empty to use default."}
          </p>

          <div className="space-y-4">
            {chains.map((chain) => (
              <RpcUrlInput
                key={chain.id}
                label={chain.name}
                value={customUrls[chain.id] || ""}
                onChange={(url) => updateUrl(chain.id, url)}
                defaultUrl={chain.rpcUrls[0] || ""}
                testResult={testResults[chain.id]}
                testing={testing === chain.id}
                onTest={() => testRpcUrl(chain.id, customUrls[chain.id] || "")}
                onReset={() => handleReset(chain.id)}
                chainIcon={chain.icon}
                chainColor={chain.color}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5">
          <Button
            variant="ghost"
            onClick={onClose}
            className="hover:bg-gray-200/50 dark:hover:bg-white/10 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            {t("actions.cancel") || "Cancel"}
          </Button>
          <Button onClick={handleSave} className="bg-neo hover:bg-neo-dark text-black hover:opacity-90 font-bold">
            {t("actions.save") || "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface RpcUrlInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  defaultUrl: string;
  testResult?: "success" | "error";
  testing: boolean;
  onTest: () => void;
  onReset: () => void;
  chainIcon?: string;
  chainColor?: string;
}

function RpcUrlInput({
  label,
  value,
  onChange,
  defaultUrl,
  testResult,
  testing,
  onTest,
  onReset,
  chainIcon,
  chainColor,
}: RpcUrlInputProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {chainIcon && (
            <img
              src={chainIcon}
              alt={label}
              className="w-4 h-4"
              style={{ filter: chainColor ? undefined : "grayscale(1)" }}
            />
          )}
          <label className="text-sm font-bold text-gray-700 dark:text-gray-300">{label}</label>
        </div>
        {value && (
          <button onClick={onReset} className="text-xs text-neo hover:text-neo-dark underline transition-colors">
            Reset to default
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={defaultUrl}
            className="pr-10 font-mono text-sm border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 focus:ring-neo/20 rounded-xl"
          />
          {testResult && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-in fade-in zoom-in duration-200">
              {testResult === "success" ? (
                <Check size={16} className="text-green-500" />
              ) : (
                <AlertCircle size={16} className="text-red-500" />
              )}
            </div>
          )}
        </div>

        <Button
          onClick={onTest}
          disabled={testing || !value.trim()}
          variant="outline"
          className="px-3 rounded-xl border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5"
        >
          {testing ? <RefreshCw size={14} className="animate-spin" /> : "Test"}
        </Button>
      </div>

      {!value && (
        <p className="text-xs text-gray-500 dark:text-gray-400 overflow-hidden text-ellipsis">
          Default: <span className="font-mono opacity-70">{defaultUrl}</span>
        </p>
      )}
    </div>
  );
}

export default RpcSettingsModal;
