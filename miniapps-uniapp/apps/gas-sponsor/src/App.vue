<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";

onLaunch(() => {
  console.log("Gas Sponsor MiniApp launched");
});

onShow(() => {
  console.log("Gas Sponsor MiniApp shown");
});

onHide(() => {
  console.log("Gas Sponsor MiniApp hidden");
});
</script>

<style>
page {
  background-color: #0f0f1a;
}
</style>
