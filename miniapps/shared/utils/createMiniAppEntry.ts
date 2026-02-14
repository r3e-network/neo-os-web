import { createSSRApp, type Component } from "vue";

export function createMiniAppEntry(rootComponent: Component) {
  const app = createSSRApp(rootComponent);
  return { app };
}
