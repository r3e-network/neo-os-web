<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";

onLaunch(() => {
  console.log("NeoBurger MiniApp launched");
});

onShow(() => {
  console.log("NeoBurger MiniApp shown");
});

onHide(() => {
  console.log("NeoBurger MiniApp hidden");
});
</script>

<style>
page {
  background-color: #0f0f1a;
  min-height: 100vh;
}
</style>
