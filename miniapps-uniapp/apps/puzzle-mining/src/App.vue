<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";

onLaunch(() => {
  console.log("Puzzle Mining launched");
});

onShow(() => {
  console.log("Puzzle Mining shown");
});

onHide(() => {
  console.log("Puzzle Mining hidden");
});
</script>

<style>
@import "@/shared/styles/theme.scss";

page {
  background: linear-gradient(135deg, #15112b 0%, #23153d 100%);
  min-height: 100vh;
}
</style>
