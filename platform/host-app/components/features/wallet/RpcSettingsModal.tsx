import { useState, useEffect } from "react";
import { X, Globe, Check, AlertCircle, RefreshCw } from "lucide-react";
import { useWalletStore, NetworkType, DEFAULT_RPC_URLS } from "@/lib/wallet/store";
import { useTranslation } from "@/lib/i18n/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface RpcSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RpcSettingsModal({ isOpen, onClose }: RpcSettingsModalProps) {
  const { t } = useTranslation("common");
  const { networkConfig, setCustomRpcUrl } = useWalletStore();

  const [testnetUrl, setTestnetUrl] = useState(networkConfig.customRpcUrls.testnet || "");
  const [mainnetUrl, setMainnetUrl] = useState(networkConfig.customRpcUrls.mainnet || "");
  const [testing, setTesting] = useState<NetworkType | null>(null);
  const [testResults, setTestResults] = useState<Record<NetworkType, "success" | "error" | null>>({
    testnet: null,
    mainnet: null,
  });

  useEffect(() => {
    if (isOpen) {
      setTestnetUrl(networkConfig.customRpcUrls.testnet || "");
      setMainnetUrl(networkConfig.customRpcUrls.mainnet || "");
      setTestResults({ testnet: null, mainnet: null });
    }
  }, [isOpen, networkConfig.customRpcUrls]);

  if (!isOpen) return null;

  const testRpcUrl = async (network: NetworkType, url: string) => {
    if (!url.trim()) {
      setTestResults((prev) => ({ ...prev, [network]: null }));
      return;
    }

    setTesting(network);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getblockcount",
          params: [],
        }),
      });

      const data = await response.json();
      if (data.result && typeof data.result === "number") {
        setTestResults((prev) => ({ ...prev, [network]: "success" }));
      } else {
        setTestResults((prev) => ({ ...prev, [network]: "error" }));
      }
    } catch {
      setTestResults((prev) => ({ ...prev, [network]: "error" }));
    } finally {
      setTesting(null);
    }
  };

  const handleSave = () => {
    setCustomRpcUrl("testnet", testnetUrl.trim() || null);
    setCustomRpcUrl("mainnet", mainnetUrl.trim() || null);
    onClose();
  };

  const handleReset = (network: NetworkType) => {
    if (network === "testnet") {
      setTestnetUrl("");
    } else {
      setMainnetUrl("");
    }
    setTestResults((prev) => ({ ...prev, [network]: null }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white dark:bg-[#050505] border border-gray-200 dark:border-white/10 shadow-2xl rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-neo/10 rounded-full text-neo">
              <Globe size={20} />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {t("network.rpcSettings") || "RPC Settings"}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("network.rpcDescription") || "Configure custom RPC endpoints. Leave empty to use default."}
          </p>

          <div className="space-y-4">
            <RpcUrlInput
              label={t("network.testnet") || "Testnet"}
              value={testnetUrl}
              onChange={setTestnetUrl}
              defaultUrl={DEFAULT_RPC_URLS.testnet}
              testResult={testResults.testnet}
              testing={testing === "testnet"}
              onTest={() => testRpcUrl("testnet", testnetUrl)}
              onReset={() => handleReset("testnet")}
            />

            <RpcUrlInput
              label={t("network.mainnet") || "Mainnet"}
              value={mainnetUrl}
              onChange={setMainnetUrl}
              defaultUrl={DEFAULT_RPC_URLS.mainnet}
              testResult={testResults.mainnet}
              testing={testing === "mainnet"}
              onTest={() => testRpcUrl("mainnet", mainnetUrl)}
              onReset={() => handleReset("mainnet")}
            />
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
          <Button
            onClick={handleSave}
            className="bg-neo hover:bg-neo-dark text-black hover:opacity-90 font-bold"
          >
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
  testResult: "success" | "error" | null;
  testing: boolean;
  onTest: () => void;
  onReset: () => void;
}

function RpcUrlInput({ label, value, onChange, defaultUrl, testResult, testing, onTest, onReset }: RpcUrlInputProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-bold text-gray-700 dark:text-gray-300">{label}</label>
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
