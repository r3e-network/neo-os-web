<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";

onLaunch(() => {
  console.log("Doomsday Clock launched");
});

onShow(() => {
  console.log("Doomsday Clock shown");
});

onHide(() => {
  console.log("Doomsday Clock hidden");
});
</script>

<style>
@import "@/shared/styles/theme.scss";

page {
  background: linear-gradient(135deg, #1d1a12 0%, #443b25 100%);
  min-height: 100vh;
}
</style>
