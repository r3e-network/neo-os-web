<script setup lang="ts">
import { computed } from 'vue';
import { TurtleColor } from "@/shared/composables/useTurtleMatch";

const props = withDefaults(
  defineProps<{
    color: TurtleColor;
    matched?: boolean;
    size?: "sm" | "md" | "lg";
  }>(),
  {
    matched: false,
    size: "md",
  }
);

interface Theme {
  color: string;
  dark: string;
  light: string;
  highlight: string;
}

const colorMap: Record<number, Theme> = {
  [TurtleColor.Red]: { color: '#EF4444', dark: '#991B1B', light: '#F87171', highlight: '#FECACA' },
  [TurtleColor.Orange]: { color: '#F97316', dark: '#9A3412', light: '#FB923C', highlight: '#FED7AA' },
  [TurtleColor.Yellow]: { color: '#EAB308', dark: '#854D0E', light: '#FACC15', highlight: '#FEF08A' },
  [TurtleColor.Green]: { color: '#22C55E', dark: '#166534', light: '#4ADE80', highlight: '#BBF7D0' },
  [TurtleColor.Blue]: { color: '#3B82F6', dark: '#1E40AF', light: '#60A5FA', highlight: '#BFDBFE' },
  [TurtleColor.Purple]: { color: '#A855F7', dark: '#6B21A8', light: '#C084FC', highlight: '#E9D5FF' },
  [TurtleColor.Pink]: { color: '#EC4899', dark: '#9D174D', light: '#F472B6', highlight: '#FBCFE8' },
  [TurtleColor.Gold]: { color: '#FFD700', dark: '#92400E', light: '#FDE047', highlight: '#FFFBEB' },
};

const currentTheme = computed(() => colorMap[props.color] || colorMap[TurtleColor.Green]);

const containerSize = computed(() => {
  switch (props.size) {
    case "sm": return "40px";
    case "lg": return "120px";
    default: return "80px";
  }
});
</script>

<template>
  <view class="turtle-container" :class="{ 'is-matched': matched }" :style="{ width: containerSize, height: containerSize }">
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" class="turtle-svg">
      <defs>
        <!-- Dynamic shell gradient -->
        <radialGradient :id="'shellGrad-' + color" cx="40%" cy="40%" r="60%">
          <stop offset="0%" :stop-color="currentTheme.highlight" />
          <stop offset="70%" :stop-color="currentTheme.color" />
          <stop offset="100%" :stop-color="currentTheme.dark" />
        </radialGradient>

        <!-- Dynamic skin gradient -->
        <linearGradient :id="'skinGrad-' + color" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" :stop-color="currentTheme.light" />
          <stop offset="100%" :stop-color="currentTheme.dark" />
        </linearGradient>

        <!-- Eye Gradient -->
        <radialGradient id="eyeGrad" cx="30%" cy="30%" r="80%">
          <stop offset="0%" stop-color="#FFFFFF" />
          <stop offset="100%" stop-color="#E5E7EB" />
        </radialGradient>

        <!-- Chrome/Crystal Filter -->
        <filter :id="'refraction-' + color" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" result="blur" />
          <feSpecularLighting in="blur" surfaceScale="5" specularConstant="0.7" specularExponent="30" :lighting-color="currentTheme.highlight" result="spec">
            <fePointLight x="-50" y="-100" z="200" />
          </feSpecularLighting>
          <feComposite in="spec" in2="SourceAlpha" operator="in" result="specOut" />
          <feComposite in="SourceGraphic" in2="specOut" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
        </filter>

        <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="5" stdDeviation="3" flood-opacity="0.3" />
        </filter>
      </defs>

      <g class="turtle-body">
        <!-- Floor Shadow -->
        <ellipse cx="100" cy="160" rx="70" ry="15" fill="#000000" opacity="0.15" class="floor-shadow" />

        <g :filter="'url(#refraction-' + color + ')'">
          <!-- Legs -->
          <g class="turtle-limbs">
            <ellipse cx="60" cy="140" rx="18" ry="12" :fill="'url(#skinGrad-' + color + ')'" transform="rotate(-20 60 140)" />
            <ellipse cx="140" cy="140" rx="18" ry="12" :fill="'url(#skinGrad-' + color + ')'" transform="rotate(20 140 140)" />
            <ellipse cx="50" cy="85" rx="18" ry="12" :fill="'url(#skinGrad-' + color + ')'" transform="rotate(30 50 85)" />
            <ellipse cx="150" cy="85" rx="18" ry="12" :fill="'url(#skinGrad-' + color + ')'" transform="rotate(-30 150 85)" />
          </g>
          
          <!-- Head -->
          <g class="turtle-head">
            <ellipse cx="100" cy="55" rx="30" ry="28" :fill="'url(#skinGrad-' + color + ')'" />
            
            <!-- Eyes -->
            <g class="eyes">
              <!-- Left Eye -->
              <circle cx="85" cy="50" r="8" fill="url(#eyeGrad)" stroke="#ccc" stroke-width="0.5" />
              <circle cx="85" cy="50" r="3" fill="#1F2937" />
              <circle cx="87" cy="48" r="1.5" fill="white" />

              <!-- Right Eye -->
              <circle cx="115" cy="50" r="8" fill="url(#eyeGrad)" stroke="#ccc" stroke-width="0.5" />
              <circle cx="115" cy="50" r="3" fill="#1F2937" />
              <circle cx="113" cy="48" r="1.5" fill="white" />
            </g>
            
            <!-- Smile -->
            <path d="M90 65 Q 100 72 110 65" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="2" stroke-linecap="round" />
          </g>

          <!-- Shell (Main) -->
          <g class="turtle-shell">
            <ellipse cx="100" cy="105" rx="70" ry="60" :fill="'url(#shellGrad-' + color + ')'" filter="url(#dropShadow)" />
            
            <!-- Internal Glow Pulse -->
            <ellipse cx="100" cy="105" rx="65" ry="55" fill="none" :stroke="currentTheme.highlight" stroke-width="2" opacity="0.1" class="shell-pulse" />
            
            <!-- Geometric Patterns -->
            <g opacity="0.2">
              <path d="M100 65 L 125 80 L 125 110 L 100 125 L 75 110 L 75 80 Z" fill="none" :stroke="currentTheme.highlight" stroke-width="1.5" />
              <circle cx="100" cy="105" r="40" fill="none" :stroke="currentTheme.highlight" stroke-width="0.5" stroke-dasharray="2,2" />
            </g>
                  
            <!-- Premium Highlights -->
            <path d="M50 105 Q 50 65 100 55 Q 150 65 150 105" fill="none" stroke="white" stroke-width="4" opacity="0.3" stroke-linecap="round" />
            <ellipse cx="85" cy="75" rx="20" ry="12" transform="rotate(-30 85 75)" fill="white" opacity="0.35" filter="blur(4px)" />
          </g>
        </g>
      </g>
    </svg>
  </view>
</template>

<style lang="scss" scoped>
.turtle-container {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  
  &.is-matched {
    filter: drop-shadow(0 0 15px rgba(255, 255, 255, 0.8));
    animation: match-pulse 1s infinite alternate;
  }
}

.turtle-svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.turtle-body {
  animation: bobbing 4s infinite ease-in-out;
}

.floor-shadow {
  animation: shadow-scale 4s infinite ease-in-out;
  transform-origin: center;
}

.shell-pulse {
  animation: shell-glow-pulse 2s infinite ease-in-out;
  transform-origin: center;
}

@keyframes bobbing {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

@keyframes shadow-scale {
  0%, 100% { transform: scale(1); opacity: 0.15; }
  50% { transform: scale(0.9); opacity: 0.1; }
}

@keyframes shell-glow-pulse {
  0%, 100% { opacity: 0.1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(1.02); }
}

@keyframes match-pulse {
  from { transform: scale(1); }
  to { transform: scale(1.1); }
}
</style>