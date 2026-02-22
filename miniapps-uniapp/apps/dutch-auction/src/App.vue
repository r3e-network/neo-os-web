<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";

onLaunch(() => {
  console.log("Dutch Auction launched");
});

onShow(() => {
  console.log("Dutch Auction shown");
});

onHide(() => {
  console.log("Dutch Auction hidden");
});
</script>

<style>
@import "@/shared/styles/theme.scss";

page {
  background: linear-gradient(135deg, #0f1d1a 0%, #164437 100%);
  min-height: 100vh;
}
</style>
