<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";

onLaunch(() => {
  console.log("AI Soulmate launched");
});

onShow(() => {
  console.log("AI Soulmate shown");
});

onHide(() => {
  console.log("AI Soulmate hidden");
});
</script>

<style>
@import "@/shared/styles/theme.scss";

page {
  background: linear-gradient(135deg, #2a1410 0%, #4c2419 100%);
  min-height: 100vh;
}
</style>
