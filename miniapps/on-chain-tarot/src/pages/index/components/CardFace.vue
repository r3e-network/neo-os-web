<template>
  <view class="card-face-container" :class="suit">
    <!-- Major Arcana Layout -->
    <view v-if="suit === 'major'" class="layout-major">
      <view class="major-frame">
        <text class="major-icon">{{ icon }}</text>
      </view>
    </view>

    <!-- Number Cards Layout (1-10) -->
    <view v-else-if="number && number <= 10" class="layout-pip">
      <view class="pip-grid" :data-count="number">
        <view v-for="n in number" :key="n" class="pip-wrapper">
          <text class="pip-icon">{{ getSuitIcon(suit) }}</text>
        </view>
      </view>
    </view>

    <!-- Court Cards Layout (J, Q, K, A is usually 1, handled above if mapped to 1) -->
    <!-- Assuming Page(11), Knight(12), Queen(13), King(14) -->
    <view v-else class="layout-court">
      <view class="court-frame">
        <text class="court-rank">{{ getCourtLabel(number) }}</text>
        <text class="court-icon">{{ getSuitIcon(suit) }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
const props = defineProps<{
  suit?: string;
  number?: number;
  icon?: string;
}>();

const getSuitIcon = (suit?: string) => {
  switch (suit) {
    case "wands": return "🔥"; // Fire/Wands
    case "cups": return "🏆"; // Water/Cups
    case "swords": return "⚔️"; // Air/Swords
    case "pentacles": return "🪙"; // Earth/Pentacles
    default: return "★";
  }
};

const getCourtLabel = (num?: number) => {
  switch (num) {
    case 1: return "A";
    case 11: return "Page";
    case 12: return "Knight";
    case 13: return "Queen";
    case 14: return "King";
    default: return "";
  }
};
</script>

<style lang="scss" scoped>
.card-face-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
}

/* Suit Colors */
.wands .pip-icon, .wands .court-icon { color: var(--tarot-suit-wands); text-shadow: 0 0 5px rgba(255, 95, 95, 0.5); }
.cups .pip-icon, .cups .court-icon { color: var(--tarot-suit-cups); text-shadow: 0 0 5px rgba(95, 175, 255, 0.5); }
.swords .pip-icon, .swords .court-icon { color: var(--tarot-suit-swords); text-shadow: 0 0 5px rgba(224, 224, 224, 0.5); }
.pentacles .pip-icon, .pentacles .court-icon { color: var(--tarot-suit-pentacles); text-shadow: 0 0 5px rgba(255, 215, 0, 0.5); }

/* Major Arcana */
.major-frame {
  width: 80%;
  height: 70%;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
}
.major-icon {
  font-size: 48px;
  filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.4));
  animation: float 6s ease-in-out infinite;
}

/* Pips (Number Cards) */
.pip-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-content: center;
  gap: 4px;
  width: 100%;
  height: 100%;
}

.pip-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30%; /* 3 columns approx */
  height: 20%;
}

.pip-icon {
  font-size: 20px;
}

/* Custom Pip Layouts for standard tarot/playing card look */
.pip-grid[data-count="1"] .pip-wrapper { width: 100%; height: 100%; .pip-icon { font-size: 50px; } }
.pip-grid[data-count="2"] .pip-wrapper { width: 100%; height: 50%; }
.pip-grid[data-count="3"] .pip-wrapper { width: 100%; height: 33%; }
.pip-grid[data-count="4"] .pip-wrapper { width: 50%; height: 50%; }

/* Court Cards */
.court-frame {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.court-rank {
  font-size: 16px;
  font-weight: bold;
  font-family: 'Courier New', monospace;
  letter-spacing: 2px;
  color: rgba(255,255,255,0.8);
}
.court-icon {
  font-size: 56px;
  border: 1px solid currentColor;
  padding: 10px;
  border-radius: 8px;
  background: rgba(0,0,0,0.2);
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}
</style>
