/**
 * Vue entry file templates
 */

const CATEGORY_GRADIENTS = {
  gaming: "linear-gradient(135deg, #15112b 0%, #23153d 100%)",
  defi: "linear-gradient(135deg, #0f1d1a 0%, #164437 100%)",
  social: "linear-gradient(135deg, #2a1410 0%, #4c2419 100%)",
  nft: "linear-gradient(135deg, #111f2a 0%, #203a4a 100%)",
  governance: "linear-gradient(135deg, #1d1a12 0%, #443b25 100%)",
  utility: "linear-gradient(135deg, #11151f 0%, #1d2738 100%)",
};

function pickBackground(app) {
  return CATEGORY_GRADIENTS[app.category] || "linear-gradient(135deg, #0d1117 0%, #1a1a2e 100%)";
}

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
  background: ${pickBackground(app)};
  min-height: 100vh;
}
</style>
`;
}

module.exports = { genIndexHtml, genMainTs, genAppVue };
