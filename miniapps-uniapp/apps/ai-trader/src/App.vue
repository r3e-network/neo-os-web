<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";

onLaunch(() => {
  console.log("AI Trader launched");
});

onShow(() => {
  console.log("AI Trader shown");
});

onHide(() => {
  console.log("AI Trader hidden");
});
</script>

<style>
@import "@/shared/styles/theme.scss";

page {
  background: linear-gradient(135deg, #0f1d1a 0%, #164437 100%);
  min-height: 100vh;
}
</style>
