<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";

onLaunch(() => {
  console.log("Dice Game launched");
});

onShow(() => {
  console.log("Dice Game shown");
});

onHide(() => {
  console.log("Dice Game hidden");
});
</script>

<style>
@import "@/shared/styles/theme.scss";

page {
  background: linear-gradient(135deg, #15112b 0%, #23153d 100%);
  min-height: 100vh;
}
</style>
