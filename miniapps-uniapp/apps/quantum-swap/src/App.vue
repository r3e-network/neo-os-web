<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";

onLaunch(() => {
  console.log("Quantum Swap launched");
});

onShow(() => {
  console.log("Quantum Swap shown");
});

onHide(() => {
  console.log("Quantum Swap hidden");
});
</script>

<style>
@import "@/shared/styles/theme.scss";

page {
  background: linear-gradient(135deg, #0f1d1a 0%, #164437 100%);
  min-height: 100vh;
}
</style>
