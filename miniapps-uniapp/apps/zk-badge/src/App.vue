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
  background: linear-gradient(135deg, #0d1117 0%, #1a1a2e 100%);
  min-height: 100vh;
}
</style>
