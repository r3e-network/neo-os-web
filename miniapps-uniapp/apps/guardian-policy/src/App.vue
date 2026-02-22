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
  background: linear-gradient(135deg, #11151f 0%, #1d2738 100%);
  min-height: 100vh;
}
</style>
