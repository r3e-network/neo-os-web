import App from "./App.vue";
import { createMiniAppEntry } from "@shared/utils";

export function createApp() {
  return createMiniAppEntry(App);
}
