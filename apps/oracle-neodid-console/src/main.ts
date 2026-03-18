import { createApp as createVueApp } from "vue";
import App from "./App.vue";

const app = createVueApp(App);
const container = document.getElementById("app");
if (container) {
  app.mount(container);
}
