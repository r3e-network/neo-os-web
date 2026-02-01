import { createSSRApp } from "vue";
import App from "./App.vue";

// No need to install i18n plugin if using custom composable
export function createApp() {
    const app = createSSRApp(App);
    return {
        app,
    };
}
