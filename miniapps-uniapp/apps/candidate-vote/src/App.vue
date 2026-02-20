<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";

onLaunch(() => {
  console.log("Candidate Vote MiniApp launched");
});

onShow(() => {
  console.log("Candidate Vote MiniApp shown");
});

onHide(() => {
  console.log("Candidate Vote MiniApp hidden");
});
</script>

<style>
@import "@/shared/styles/theme.scss";

page {
  background: linear-gradient(135deg, $color-bg-primary 0%, $color-bg-secondary 100%);
  min-height: 100vh;
}
</style>
