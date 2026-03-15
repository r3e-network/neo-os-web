import { createApp, type Component } from "vue";

export function createMiniAppEntry(rootComponent: Component) {
  const app = createApp(rootComponent);
  return { app };
}
