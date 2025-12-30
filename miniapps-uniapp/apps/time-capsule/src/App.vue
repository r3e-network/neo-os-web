<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";

onLaunch(() => {
  console.log("Time Capsule launched");
});

onShow(() => {
  console.log("Time Capsule shown");
});

onHide(() => {
  console.log("Time Capsule hidden");
});
</script>

<style>
@import "@/shared/styles/theme.scss";

page {
  background: linear-gradient(135deg, #0d1117 0%, #1a1a2e 100%);
  min-height: 100vh;
}
</style>
