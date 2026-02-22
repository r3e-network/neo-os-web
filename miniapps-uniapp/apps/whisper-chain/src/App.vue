<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";

onLaunch(() => {
  console.log("Whisper Chain launched");
});

onShow(() => {
  console.log("Whisper Chain shown");
});

onHide(() => {
  console.log("Whisper Chain hidden");
});
</script>

<style>
@import "@/shared/styles/theme.scss";

page {
  background: linear-gradient(135deg, #2a1410 0%, #4c2419 100%);
  min-height: 100vh;
}
</style>
