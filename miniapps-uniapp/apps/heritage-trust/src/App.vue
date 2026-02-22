<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";

onLaunch(() => {
  console.log("Heritage Trust launched");
});

onShow(() => {
  console.log("Heritage Trust shown");
});

onHide(() => {
  console.log("Heritage Trust hidden");
});
</script>

<style>
@import "@/shared/styles/theme.scss";

page {
  background: linear-gradient(135deg, #111f2a 0%, #203a4a 100%);
  min-height: 100vh;
}
</style>
