declare module "miniapp/App" {
  export interface MiniAppRemoteProps {
    appId?: string;
    view?: string;
  }

  const RemoteApp: React.ComponentType<MiniAppRemoteProps>;
  export default RemoteApp;
  export const App: React.ComponentType<MiniAppRemoteProps>;
}

declare const __webpack_init_sharing__: (scope: string) => Promise<void>;
declare const __webpack_share_scopes__: {
  default: unknown;
};
