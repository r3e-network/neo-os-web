<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";

onLaunch(() => {
  console.log("ZK Badge launched");
});

onShow(() => {
  console.log("ZK Badge shown");
});

onHide(() => {
  console.log("ZK Badge hidden");
});
</script>

<style>
@import "@/shared/styles/theme.scss";

page {
  background: linear-gradient(135deg, #11151f 0%, #1d2738 100%);
  min-height: 100vh;
}
</style>
