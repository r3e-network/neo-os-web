import type { ReactNode} from "react";
import React, { Component, useEffect, useState } from "react";
import { AlertCircle, Loader2, Info } from "lucide-react";

type Props = {
  remote?: string;
  appId?: string;
  view?: string;
  theme?: string;
  layout?: "web" | "mobile";
};

const hasRemotes = Boolean(process.env.NEXT_PUBLIC_MF_REMOTES);

// Cache with LRU-like cleanup to prevent memory leaks
const MAX_CACHE_SIZE = 10;
const remoteContainerCache = new Map<string, Promise<RemoteContainer>>();
let sharingInit: Promise<void> | null = null;

// Track active script loads for cleanup
const pendingScripts = new Map<string, HTMLScriptElement>();

type RemoteConfig = {
  name: string;
  entry: string;
};

type RemoteContainer = {
  init: (shareScope: unknown) => Promise<void> | void;
  get: (module: string) => Promise<() => unknown>;
  __initialized?: boolean;
};

const FederatedLoader = ({ remote, appId, view, theme, layout }: Props) => {
  const [LoadedComponent, setLoadedComponent] = useState<React.ComponentType<Props> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const remoteName = (remote || "builtin").trim();
    if (!remoteName) {
      setError("Federated remote not specified");
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    const loadModule = async () => {
      try {
        const remoteConfig = resolveRemote(remoteName);
        if (!remoteConfig) throw new Error(`Remote "${remoteName}" not configured`);
        const mod = await loadFederatedModule(remoteConfig, "App");
        if (mounted) {
          const modWithDefault = mod as { default?: React.ComponentType<Props>; App?: React.ComponentType<Props> };
          const component = modWithDefault.default ?? modWithDefault.App;
          setLoadedComponent(() => component ?? null);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load module");
          setLoading(false);
        }
      }
    };

    loadModule();
    return () => {
      mounted = false;
    };
  }, [remote]);

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-3 text-gray-400">
        <Loader2 size={32} className="animate-spin text-neo" />
        <span className="text-xs font-bold uppercase tracking-widest opacity-70">Loading Module...</span>
      </div>
    );

  if (error) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-500/20 rounded-2xl max-w-md mx-auto text-center shadow-sm">
        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 dark:text-red-400">
          <AlertCircle size={24} />
        </div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase mb-2">Federation Error</h3>
        <code className="text-xs bg-white dark:bg-black/20 px-3 py-2 rounded-lg border border-red-100 dark:border-red-500/10 font-mono text-red-800 dark:text-red-300 block break-all">
          {error}
        </code>
      </div>
    );
  }

  if (!LoadedComponent)
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-3 text-gray-400 border border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
        <Info size={32} />
        <span className="text-xs font-bold uppercase tracking-widest opacity-70">Module Unavailable</span>
      </div>
    );

  return <LoadedComponent appId={appId} view={view} remote={remote} theme={theme} layout={layout} />;
};

export function FederatedMiniApp(props: Props) {
  if (!hasRemotes)
    return (
      <div className="p-8 text-center max-w-md mx-auto bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm backdrop-blur-sm">
        <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600 dark:text-amber-400">
          <AlertCircle size={24} />
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Module Federation Required</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
          Set{" "}
          <code className="bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded text-neo font-mono text-xs border border-gray-200 dark:border-white/10">
            NEXT_PUBLIC_MF_REMOTES
          </code>{" "}
          to enable integrations.
        </p>
      </div>
    );
  return (
    <RemoteErrorBoundary>
      <FederatedLoader {...props} />
    </RemoteErrorBoundary>
  );
}

class RemoteErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-500/20 rounded-2xl max-w-md mx-auto text-center shadow-sm">
        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 dark:text-red-400">
          <AlertCircle size={24} />
        </div>
        <div className="text-sm font-bold text-gray-900 dark:text-white uppercase mb-2">Critical Failure</div>
        <div className="text-xs bg-white dark:bg-black/20 p-3 rounded-lg font-mono text-red-600 dark:text-red-300 break-all">
          {this.state.error.message}
        </div>
      </div>
    );
  }
}

function resolveRemote(remoteName: string): RemoteConfig | null {
  const remotes = parseRemotes(process.env.NEXT_PUBLIC_MF_REMOTES || "");
  const match = remotes.find((entry) => entry.name === remoteName);
  return match || null;
}

function parseRemotes(raw: string): RemoteConfig[] {
  const entries = String(raw)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const remotes: RemoteConfig[] = [];
  for (const entry of entries) {
    const separator = entry.includes("@") ? "@" : entry.includes("=") ? "=" : null;
    if (!separator) continue;
    const [nameRaw, urlRaw] = entry.split(separator);
    const name = String(nameRaw || "").trim();
    const url = String(urlRaw || "").trim();
    if (!name || !url) continue;

    const normalizedURL = url.endsWith(".js") ? url : `${url.replace(/\/$/, "")}/_next/static/chunks/remoteEntry.js`;
    remotes.push({ name, entry: normalizedURL });
  }

  return remotes;
}

async function loadFederatedModule(remote: RemoteConfig, module: string) {
  if (typeof window === "undefined") {
    throw new Error("Federated modules must be loaded in the browser");
  }

  await ensureSharingInitialized();
  const container = await loadRemoteContainer(remote);

  if (!container.__initialized) {
    const shareScope = typeof __webpack_share_scopes__ !== "undefined" ? __webpack_share_scopes__.default : undefined;
    await container.init(shareScope);
    container.__initialized = true;
  }

  const factory = await container.get(`./${module.replace(/^\.\//, "")}`);
  return factory();
}

async function ensureSharingInitialized() {
  if (!sharingInit) {
    if (typeof __webpack_init_sharing__ !== "function") {
      throw new Error("Module Federation runtime not available");
    }
    sharingInit = __webpack_init_sharing__("default");
  }
  await sharingInit;
}

function loadRemoteContainer(remote: RemoteConfig): Promise<RemoteContainer> {
  const cacheKey = `${remote.name}@${remote.entry}`;
  const cached = remoteContainerCache.get(cacheKey);
  if (cached) return cached;

  // LRU-like cache cleanup to prevent memory leaks
  if (remoteContainerCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = remoteContainerCache.keys().next().value;
    if (oldestKey) {
      remoteContainerCache.delete(oldestKey);
      const oldScript = pendingScripts.get(oldestKey);
      if (oldScript) {
        oldScript.remove();
        pendingScripts.delete(oldestKey);
      }
    }
  }

  const loader = new Promise<RemoteContainer>((resolve, reject) => {
    const existing = (window as unknown as Record<string, unknown>)[remote.name] as RemoteContainer | undefined;
    if (existing) {
      resolve(existing);
      return;
    }

    const script = document.createElement("script");
    script.src = remote.entry;
    script.async = true;
    script.type = "text/javascript";
    pendingScripts.set(cacheKey, script);

    const cleanup = () => {
      remoteContainerCache.delete(cacheKey);
      pendingScripts.delete(cacheKey);
      script.remove();
    };
    script.onload = () => {
      pendingScripts.delete(cacheKey);
      const container = (window as unknown as Record<string, unknown>)[remote.name] as RemoteContainer | undefined;
      if (!container) {
        cleanup();
        reject(new Error(`Remote container "${remote.name}" not found`));
        return;
      }
      resolve(container);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error(`Failed to load remote entry ${remote.entry}`));
    };
    document.head.appendChild(script);
  });

  remoteContainerCache.set(cacheKey, loader);
  return loader;
}
