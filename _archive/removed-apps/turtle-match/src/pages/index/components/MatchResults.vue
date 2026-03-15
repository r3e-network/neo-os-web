<template>
  <div class="match-results">
    <div v-for="(match, index) in matches" :key="index" class="match-item">
      <div class="match-turtle">
        <TurtleSprite :color="match.color" matched />
      </div>
      <span class="match-reward">+{{ formatGas(match.reward, 3) }} GAS</span>
    </div>
    <div v-if="matches.length === 0" class="no-matches">
      <span>{{ t("noMatchesYet") }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";
import { formatGas } from "@shared/utils/format";
import TurtleSprite from "./TurtleSprite.vue";
import type { TurtleColor } from "../../composables/useTurtleGame";

const { t } = createUseI18n(messages)();

interface Match {
  color: TurtleColor;
  reward: bigint;
}

interface Props {
  matches: Match[];
}

defineProps<Props>();
</script>

<style lang="scss" scoped>
.match-results {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.match-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: var(--turtle-glass);
  border: 1px solid var(--turtle-panel-border);
  border-radius: 12px;
}

.match-turtle {
  width: 40px;
  height: 40px;
}

.match-reward {
  font-size: 14px;
  font-weight: 700;
  color: var(--turtle-accent);
}

.no-matches {
  text-align: center;
  padding: 24px;
  color: var(--turtle-text-muted);
  font-style: italic;
}
</style>
