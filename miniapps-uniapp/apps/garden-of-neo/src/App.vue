<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";

onLaunch(() => {
  console.log("Garden of Neo launched");
});

onShow(() => {
  console.log("Garden of Neo shown");
});

onHide(() => {
  console.log("Garden of Neo hidden");
});
</script>

<style>
@import "@/shared/styles/theme.scss";

page {
  background: linear-gradient(135deg, $color-bg-primary 0%, $color-bg-secondary 100%);
  min-height: 100vh;
}
</style>
