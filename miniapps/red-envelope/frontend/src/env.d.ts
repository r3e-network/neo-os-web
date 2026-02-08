/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

/** neo-dapi global injected by wallet extension */
interface NeoDapi {
  request(params: { method: string; params?: Record<string, unknown> }): Promise<unknown>;
}

interface Window {
  neo?: NeoDapi;
  OneGate?: NeoDapi;
}
