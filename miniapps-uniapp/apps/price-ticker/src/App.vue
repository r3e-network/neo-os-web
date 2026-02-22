<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";

onLaunch(() => {
  console.log("Price Ticker launched");
});

onShow(() => {
  console.log("Price Ticker shown");
});

onHide(() => {
  console.log("Price Ticker hidden");
});
</script>

<style>
@import "@/shared/styles/theme.scss";

page {
  background: linear-gradient(135deg, #11151f 0%, #1d2738 100%);
  min-height: 100vh;
}
</style>
