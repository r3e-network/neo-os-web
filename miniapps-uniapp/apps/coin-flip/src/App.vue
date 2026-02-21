<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";

onLaunch(() => {
  console.log("Coin Flip launched");
});

onShow(() => {
  console.log("Coin Flip shown");
});

onHide(() => {
  console.log("Coin Flip hidden");
});
</script>

<style>
@import "@/shared/styles/theme.scss";

page {
  background: linear-gradient(135deg, $color-bg-primary 0%, $color-bg-secondary 100%);
  min-height: 100vh;
}
</style>
