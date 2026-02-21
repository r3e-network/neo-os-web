<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";

onLaunch(() => {
  console.log("Gas Sponsor MiniApp launched");
});

onShow(() => {
  console.log("Gas Sponsor MiniApp shown");
});

onHide(() => {
  console.log("Gas Sponsor MiniApp hidden");
});
</script>

<style>
@import "@/shared/styles/theme.scss";

page {
  background: linear-gradient(135deg, $color-bg-primary 0%, $color-bg-secondary 100%);
  min-height: 100vh;
}
</style>
