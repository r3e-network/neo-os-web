<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";

onLaunch(() => {
  console.log("Unbreakable Vault launched");
});

onShow(() => {
  console.log("Unbreakable Vault shown");
});

onHide(() => {
  console.log("Unbreakable Vault hidden");
});
</script>

<style>
@import "@/shared/styles/theme.scss";

page {
  background: linear-gradient(135deg, $color-bg-primary 0%, $color-bg-secondary 100%);
  min-height: 100vh;
}
</style>
