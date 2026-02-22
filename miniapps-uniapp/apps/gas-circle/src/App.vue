<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";

onLaunch(() => {
  console.log("Gas Circle launched");
});

onShow(() => {
  console.log("Gas Circle shown");
});

onHide(() => {
  console.log("Gas Circle hidden");
});
</script>

<style>
@import "@/shared/styles/theme.scss";

page {
  background: linear-gradient(135deg, #0f1d1a 0%, #164437 100%);
  min-height: 100vh;
}
</style>
