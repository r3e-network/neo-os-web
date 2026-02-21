import { createSSRApp } from "vue";
import App from "./App.vue";
import { installMockSDK } from "@neo/uniapp-sdk";

// Install mock SDK for standalone development
if (import.meta.env.DEV) {
  installMockSDK();
}

export function createApp() {
  const app = createSSRApp(App);
  return { app };
}
