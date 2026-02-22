<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";

onLaunch(() => {
  console.log("Neo Lottery launched");
});

onShow(() => {
  console.log("Neo Lottery shown");
});

onHide(() => {
  console.log("Neo Lottery hidden");
});
</script>

<style>
@import "@/shared/styles/theme.scss";

page {
  background: linear-gradient(135deg, #15112b 0%, #23153d 100%);
  min-height: 100vh;
}
</style>
