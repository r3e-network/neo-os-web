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
page {
  background-color: #0f0f1a;
  min-height: 100vh;
}
</style>
