/**
 * Vue entry file templates
 */

// Generate index.html
function genIndexHtml(app) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${app.title}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`;
}

// Generate main.ts
function genMainTs() {
  return `import { createSSRApp } from "vue";
import App from "./App.vue";

export function createApp() {
  const app = createSSRApp(App);
  return { app };
}
`;
}

// Generate App.vue
function genAppVue(app) {
  return `<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";

onLaunch(() => {
  console.log("${app.title} launched");
});

onShow(() => {
  console.log("${app.title} shown");
});

onHide(() => {
  console.log("${app.title} hidden");
});
</script>

<style>
@import "@/shared/styles/theme.scss";

page {
  background: linear-gradient(135deg, #0d1117 0%, #1a1a2e 100%);
  min-height: 100vh;
}
</style>
`;
}

module.exports = { genIndexHtml, genMainTs, genAppVue };
