import { createApp, type Component } from "vue";

export function createMiniAppEntry(rootComponent: Component) {
  const app = createApp(rootComponent);
  const container = document.getElementById("app");
  if (container) {
    app.mount(container);
  }
  return { app };
}
