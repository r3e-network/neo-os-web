<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";

onLaunch(() => {
  console.log("Prediction Market launched");
});

onShow(() => {
  console.log("Prediction Market shown");
});

onHide(() => {
  console.log("Prediction Market hidden");
});
</script>

<style>
@import "@/shared/styles/theme.scss";

page {
  background: linear-gradient(135deg, #1d1a12 0%, #443b25 100%);
  min-height: 100vh;
}
</style>
