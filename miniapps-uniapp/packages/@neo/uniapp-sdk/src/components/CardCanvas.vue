<template>
  <view class="card-canvas">
    <view class="canvas-preview">
      <canvas
        canvas-id="preview-canvas"
        class="preview-canvas"
        :style="{ width: canvasSize + 'px', height: canvasSize + 'px' }"
      />
    </view>
    <view class="canvas-info">
      <text class="active-users">🎨 {{ data.activeUsers }} active</text>
      <text class="canvas-size">{{ data.width }}×{{ data.height }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import type { CanvasData } from "../card-types";

const props = defineProps<{ data: CanvasData }>();
const canvasSize = ref(120);

function renderPixels() {
  const ctx = uni.createCanvasContext("preview-canvas");
  const { pixels, width, height } = props.data;
  const scale = canvasSize.value / width;

  for (let i = 0; i < pixels.length / 6; i++) {
    const color = "#" + pixels.slice(i * 6, i * 6 + 6);
    const x = (i % width) * scale;
    const y = Math.floor(i / width) * scale;
    ctx.setFillStyle(color);
    ctx.fillRect(x, y, scale, scale);
  }
  ctx.draw();
}

onMounted(() => renderPixels());
watch(() => props.data.pixels, renderPixels);
</script>

<style scoped lang="scss">
.card-canvas {
  background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%);
  border-radius: 12px;
  padding: 12px;
  color: #fff;
}
.canvas-preview {
  display: flex;
  justify-content: center;
  margin-bottom: 8px;
}
.preview-canvas {
  border-radius: 4px;
  border: 2px solid rgba(255, 255, 255, 0.1);
}
.canvas-info {
  display: flex;
  justify-content: space-between;
  font-size: 0.8em;
  opacity: 0.9;
}
.active-users {
  color: #10b981;
}
</style>
