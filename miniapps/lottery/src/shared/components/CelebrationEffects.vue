<template>
  <view class="celebration-container" :style="{ pointerEvents: 'none' }">
    <canvas
      v-if="active && type !== 'none'"
      ref="canvasRef"
      class="celebration-canvas"
      :style="{ width: width + 'px', height: height + 'px' }"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";

export type EffectType = "fireworks" | "confetti" | "coinrain" | "sparkle" | "none";

const props = withDefaults(
  defineProps<{
    type: EffectType;
    active: boolean;
    duration?: number;
    intensity?: "low" | "medium" | "high";
  }>(),
  {
    duration: 3000,
    intensity: "medium",
  },
);

const emit = defineEmits<{
  (e: "complete"): void;
}>();

// Declare uni global for TypeScript
declare const uni: { getSystemInfoSync: () => { windowWidth: number; windowHeight: number } };

const canvasRef = ref<HTMLCanvasElement | null>(null);
const width = ref(300);
const height = ref(600);
let ctx: CanvasRenderingContext2D | null = null;
let animationId: number | null = null;
let startTime = 0;

// Particle interface
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
  rotation?: number;
  rotationSpeed?: number;
}

let particles: Particle[] = [];

// Color palettes
const PALETTES = {
  fireworks: ["#FF4D4D", "#FFDE59", "#00E599", "#A855F7", "#FF6B9D", "#00D4FF"],
  confetti: ["#9F9DF3", "#F7AAC7", "#00E599", "#FFDE59", "#FF6B9D", "#A855F7"],
  coinrain: ["#FFD700", "#FFA500", "#FFDE59", "#F4C430", "#DAA520"],
  sparkle: ["#FFFFFF", "#9F9DF3", "#00E599", "#F7AAC7"],
};

const intensityMap = { low: 0.5, medium: 1, high: 1.5 };

// Create particles based on effect type
const createParticles = () => {
  const mult = intensityMap[props.intensity];
  const palette = PALETTES[props.type] || PALETTES.confetti;

  switch (props.type) {
    case "fireworks":
      createFireworks(palette, mult);
      break;
    case "confetti":
      createConfetti(palette, mult);
      break;
    case "coinrain":
      createCoinRain(palette, mult);
      break;
    case "sparkle":
      createSparkle(palette, mult);
      break;
  }
};

const createFireworks = (palette: string[], mult: number) => {
  for (let burst = 0; burst < 3 * mult; burst++) {
    const cx = Math.random() * width.value;
    const cy = Math.random() * height.value * 0.5 + height.value * 0.1;
    const count = Math.floor(40 * mult);

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const speed = 2 + Math.random() * 4;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color: palette[Math.floor(Math.random() * palette.length)],
        size: 2 + Math.random() * 2,
      });
    }
  }
};

const createConfetti = (palette: string[], mult: number) => {
  const count = Math.floor(60 * mult);
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * width.value,
      y: -20 - Math.random() * 100,
      vx: (Math.random() - 0.5) * 2,
      vy: 2 + Math.random() * 3,
      life: 1,
      color: palette[Math.floor(Math.random() * palette.length)],
      size: 6 + Math.random() * 4,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
    });
  }
};

const createCoinRain = (palette: string[], mult: number) => {
  const count = Math.floor(25 * mult);
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * width.value,
      y: -30 - Math.random() * 200,
      vx: (Math.random() - 0.5) * 1,
      vy: 3 + Math.random() * 2,
      life: 1,
      color: palette[Math.floor(Math.random() * palette.length)],
      size: 12 + Math.random() * 8,
      rotation: 0,
      rotationSpeed: 5 + Math.random() * 5,
    });
  }
};

const createSparkle = (palette: string[], mult: number) => {
  const count = Math.floor(30 * mult);
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * width.value,
      y: Math.random() * height.value,
      vx: 0,
      vy: -0.5 - Math.random() * 0.5,
      life: Math.random(),
      color: palette[Math.floor(Math.random() * palette.length)],
      size: 2 + Math.random() * 3,
    });
  }
};

// Animation loop
const loop = () => {
  if (!ctx || !width.value) return;

  const elapsed = performance.now() - startTime;
  const progress = Math.min(elapsed / props.duration, 1);

  // Clear canvas
  ctx.clearRect(0, 0, width.value, height.value);

  // Update and draw particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];

    // Update position
    p.x += p.vx;
    p.y += p.vy;

    // Apply physics based on type
    switch (props.type) {
      case "fireworks":
        p.vy += 0.08;
        p.life -= 0.02;
        break;
      case "confetti":
        p.vx += (Math.random() - 0.5) * 0.1;
        p.rotation = (p.rotation || 0) + (p.rotationSpeed || 0);
        if (p.y > height.value) p.life = 0;
        break;
      case "coinrain":
        p.rotation = (p.rotation || 0) + (p.rotationSpeed || 0);
        if (p.y > height.value + 50) p.life = 0;
        break;
      case "sparkle":
        p.life -= 0.015;
        p.size *= 0.99;
        break;
    }

    // Remove dead particles
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }

    // Draw particle
    ctx.save();
    ctx.globalAlpha = p.life * (1 - progress * 0.3);
    ctx.fillStyle = p.color;

    if (props.type === "confetti") {
      ctx.translate(p.x, p.y);
      ctx.rotate(((p.rotation || 0) * Math.PI) / 180);
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    } else if (props.type === "coinrain") {
      ctx.translate(p.x, p.y);
      const scaleX = Math.abs(Math.cos(((p.rotation || 0) * Math.PI) / 180));
      ctx.scale(scaleX || 0.1, 1);
      ctx.beginPath();
      ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
      // Coin shine
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.beginPath();
      ctx.arc(-p.size / 6, -p.size / 6, p.size / 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      if (props.type === "fireworks") {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.fill();
      }
    }

    ctx.restore();
  }

  // Continue or complete
  if (progress < 1 && particles.length > 0) {
    animationId = requestAnimationFrame(loop);
  } else {
    emit("complete");
  }
};

const start = () => {
  if (!canvasRef.value) return;

  try {
    const sysInfo = uni.getSystemInfoSync();
    width.value = sysInfo.windowWidth;
    height.value = sysInfo.windowHeight;
  } catch {
    width.value = window.innerWidth || 375;
    height.value = window.innerHeight || 667;
  }

  setTimeout(() => {
    if (!canvasRef.value) return;
    ctx = canvasRef.value.getContext("2d");
    if (ctx) {
      particles = [];
      startTime = performance.now();
      createParticles();
      loop();
    }
  }, 50);
};

const stop = () => {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  ctx = null;
  particles = [];
};

watch(
  () => props.active,
  (val) => {
    if (val && props.type !== "none") start();
    else stop();
  },
);

onMounted(() => {
  if (props.active && props.type !== "none") start();
});

onUnmounted(() => {
  stop();
});
</script>

<style scoped>
.celebration-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 9999;
  pointer-events: none;
}
.celebration-canvas {
  width: 100%;
  height: 100%;
}
</style>
