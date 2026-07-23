import type {
  FrameworkRegistryAbstractAccount,
  FrameworkRegistryApp,
  FrameworkRegistryInvokeOptions,
  FrameworkRegistrySurface,
  FrameworkRegistryTx,
} from "./registry-surface";

export interface FrameworkPlatformAccountSnapshot {
  appId: string;
  registered: true;
  appAdmin: string;
  engineId: string;
  engineHash: string | null;
  active: boolean;
  sharedIdentity: FrameworkRegistryAbstractAccount | null;
  treasuryAccountHash: string | null;
}

export interface FrameworkPlatformAccountSurface {
  readonly available: boolean;
  get(appId?: string): Promise<FrameworkPlatformAccountSnapshot | null>;
  getSharedIdentity(appId?: string): Promise<FrameworkRegistryAbstractAccount | null>;
  materializeSharedIdentity(
    appId?: string,
    options?: FrameworkRegistryInvokeOptions,
  ): Promise<FrameworkRegistryTx>;
}

export interface PlatformAccountSurfaceDeps {
  appId: string;
  registry: FrameworkRegistrySurface;
}

function resolveAppId(defaultAppId: string, value?: string): string {
  const appId = String(value ?? defaultAppId).trim();
  if (!appId) throw new Error("appId is required");
  return appId;
}

function snapshot(
  appId: string,
  app: FrameworkRegistryApp,
  sharedIdentity: FrameworkRegistryAbstractAccount | null,
): FrameworkPlatformAccountSnapshot {
  return {
    appId,
    registered: true,
    appAdmin: app.appAdmin,
    engineId: app.engineId,
    engineHash: app.engineHash,
    active: app.active,
    sharedIdentity,
    treasuryAccountHash: app.accountHash,
  };
}

export function createPlatformAccountSurface(
  deps: PlatformAccountSurfaceDeps,
): FrameworkPlatformAccountSurface {
  return {
    get available() {
      return deps.registry.available;
    },

    async get(appId) {
      const resolvedAppId = resolveAppId(deps.appId, appId);
      const app = await deps.registry.getApp(resolvedAppId);
      if (!app) return null;
      const sharedIdentity = await deps.registry.getAbstractAccount(resolvedAppId);
      return snapshot(resolvedAppId, app, sharedIdentity);
    },

    getSharedIdentity(appId) {
      return deps.registry.getAbstractAccount(resolveAppId(deps.appId, appId));
    },

    materializeSharedIdentity(appId, options) {
      return deps.registry.materializeAbstractAccount(
        resolveAppId(deps.appId, appId),
        options,
      );
    },
  };
}
