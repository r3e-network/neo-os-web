import React, { Component, ReactNode, useEffect, useState } from "react";

type Props = {
  remote?: string;
  appId?: string;
  view?: string;
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

class RemoteErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="p-3 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/20 max-w-md" role="alert">
        <div className="font-semibold text-gray-900 dark:text-white mb-1.5">Failed to load federated MiniApp</div>
        <div className="text-xs text-red-600 dark:text-red-400">{this.state.error.message}</div>
      </div>
    );
  }
}

function NotConfiguredMessage() {
  return (
    <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-center max-w-md">
      <h3 className="m-0 mb-3 text-gray-600 dark:text-gray-300">Module Federation Not Configured</h3>
      <p className="m-0 text-sm text-gray-500 dark:text-gray-400">
        Set <code>NEXT_PUBLIC_MF_REMOTES</code> to enable federated MiniApps.
      </p>
    </div>
  );
}

function FederatedLoader({ remote, appId, view }: Props) {
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
        if (!remoteConfig) {
          throw new Error(`Remote "${remoteName}" not configured`);
        }
        const mod = await loadFederatedModule(remoteConfig, "App");
        if (mounted) {
          const component =
            (mod as { default?: React.ComponentType<Props>; App?: React.ComponentType<Props> }).default ??
            (mod as { App?: React.ComponentType<Props> }).App;
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

  if (loading) return <p className="text-sm text-gray-400" aria-busy="true">Loading federated MiniApp…</p>;
  if (error) {
    return (
      <div className="p-3 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/20 max-w-md" role="alert">
        <div className="font-semibold text-gray-900 dark:text-white mb-1.5">Failed to load federated MiniApp</div>
        <div className="text-xs text-red-600 dark:text-red-400">{error}</div>
      </div>
    );
  }

  if (!LoadedComponent) return <p className="text-sm text-gray-400">Module not available</p>;
  return <LoadedComponent appId={appId} view={view} remote={remote} />;
}

export function FederatedMiniApp(props: Props) {
  if (!hasRemotes) return <NotConfiguredMessage />;
  return (
    <RemoteErrorBoundary>
      <FederatedLoader {...props} />
    </RemoteErrorBoundary>
  );
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
