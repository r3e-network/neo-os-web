declare module "builtin/App" {
  export interface BuiltinAppProps {
    appId?: string;
    view?: string;
  }

  const RemoteApp: React.ComponentType<BuiltinAppProps>;
  export default RemoteApp;
  export const App: React.ComponentType<BuiltinAppProps>;
}

declare const __webpack_init_sharing__: (scope: string) => Promise<void>;
declare const __webpack_share_scopes__: {
  default: unknown;
};
