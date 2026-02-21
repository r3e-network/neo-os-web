<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";

onLaunch(() => {
  console.log("Guardian Policy launched");
});

onShow(() => {
  console.log("Guardian Policy shown");
});

onHide(() => {
  console.log("Guardian Policy hidden");
});
</script>

<style>
@import "@/shared/styles/theme.scss";

page {
  background: linear-gradient(135deg, $color-bg-primary 0%, $color-bg-secondary 100%);
  min-height: 100vh;
}
</style>
