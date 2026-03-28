<template>
  <div class="bet-section">
    <!-- Choice Selector -->
    <div class="choice-grid">
      <div
        v-for="side in (['heads', 'tails'] as const)"
        :key="side"
        :class="['choice-card', choice === side ? side : 'inactive']"
        @click="updateChoice(side)"
      >
        <div class="card-inner">
          <div class="symbol-ring">
            <div v-if="side === 'heads'" class="neo-symbol">N</div>
            <div v-else class="gas-symbol">G</div>
          </div>
          <span class="choice-name">{{ t(side) }}</span>
        </div>
      </div>
    </div>

    <!-- Wager Panel -->
    <NeoCard variant="erobo" class="wager-panel">
      <div class="panel-header">
        <span class="label">{{ t("wager") }}</span>
        <div class="balance-pill">
          <span class="val">{{ t("wagerRange") }}</span>
          <span class="unit">{{ t("tokenGas") }}</span>
        </div>
      </div>

      <div class="wager-grid">
        <div
          v-for="amount in BET_PRESETS"
          :key="amount"
          :class="['wager-option', betAmount === amount ? 'selected' : '']"
          @click="updateBetAmount(amount)"
        >
          <span class="amount-val">{{ amount }}</span>
          <span class="amount-unit">{{ t("tokenGas") }}</span>
        </div>
      </div>

      <NeoButton
        variant="primary"
        size="lg"
        block
        type="button"
        :disabled="!canBet"
        :loading="isFlipping"
        class="flip-btn"
        :aria-label="isFlipping ? t('flipping') : t('flipCoin')"
        @click="handleFlip"
      >
        <div class="btn-content">
          <span>{{ isFlipping ? t("flipping") : t("flipCoin") }}</span>
        </div>
      </NeoButton>
    </NeoCard>
  </div>
</template>

<script setup lang="ts">
import { inject } from "vue";
import { NeoCard, NeoButton } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import { BET_PRESETS } from "../composables/useCoinFlip";

defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  choice: "heads" | "tails";
  betAmount: string;
  canBet: boolean;
  isFlipping: boolean;
}>();

const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const handleFlip = async () => {
  const handler = actions.get("placeBet");
  if (handler) await handler();
};

const updateChoice = (side: "heads" | "tails") => {
  const handler = actions.get("setChoice");
  if (handler) handler(side);
};

const updateBetAmount = (amount: string) => {
  const handler = actions.get("setBetAmount");
  if (handler) handler(amount);
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;
@use "../pages/index/fogplay-theme.scss" as *;

.bet-section {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  z-index: 2;
}

/* -- Choice Grid -- */
.choice-grid {
  @include grid-layout(2, 16px);
}

.choice-card {
  position: relative;
  height: 120px;
  background: var(--coin-choice-bg);
  border: 1px solid var(--coin-choice-border);
  border-radius: 20px;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  cursor: pointer;

  .card-inner {
    position: relative;
    z-index: 2;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }

  .symbol-ring {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    border: 2px solid var(--coin-choice-ring);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 22px;
    transition: all 0.3s ease;
  }

  &.heads {
    background: linear-gradient(135deg, var(--coin-green-active-bg) 0%, var(--coin-green-active-bg-light) 100%);
    border-color: var(--coin-success);
    box-shadow: 0 10px 30px var(--coin-side-active-bg);
    transform: scale(1.05);

    .symbol-ring {
      border-color: var(--coin-success);
      color: var(--coin-success);
      box-shadow: 0 0 15px var(--coin-side-active-bg);
    }
    .choice-name {
      color: var(--coin-success);
      text-shadow: 0 0 10px var(--coin-side-glow);
    }
  }

  &.tails {
    background: linear-gradient(135deg, var(--coin-blue-active-bg) 0%, var(--coin-blue-active-bg-light) 100%);
    border-color: var(--coin-blue);
    box-shadow: 0 10px 30px var(--coin-blue-active-bg);
    transform: scale(1.05);

    .symbol-ring {
      border-color: var(--coin-blue);
      color: var(--coin-blue);
      box-shadow: 0 0 15px var(--coin-blue-active-glow);
    }
    .choice-name {
      color: var(--coin-blue);
      text-shadow: 0 0 10px var(--coin-blue-text-glow);
    }
  }

  &.inactive {
    opacity: 0.6;
    &:hover {
      opacity: 1;
      transform: translateY(-4px);
    }
  }
}

.choice-name {
  font-size: 13px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--coin-text-primary);
}

/* -- Wager Panel -- */
.wager-panel {
  width: 100%;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  .label {
    font-size: 12px;
    font-weight: 700;
    color: var(--coin-label);
    text-transform: uppercase;
    letter-spacing: 1px;
  }
}

.balance-pill {
  background: var(--coin-balance-pill-bg);
  padding: 4px 12px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 700;
  color: var(--coin-success);
  border: 1px solid var(--coin-balance-pill-border);

  .unit {
    opacity: 0.7;
    margin-left: 4px;
  }
}

.wager-grid {
  @include grid-layout(4, 10px);
  margin-bottom: 20px;
}

.wager-option {
  background: var(--coin-wager-bg);
  border: 1px solid var(--coin-wager-border);
  padding: 14px 6px;
  border-radius: 14px;
  text-align: center;
  transition: all 0.3s ease;
  cursor: pointer;

  .amount-val {
    display: block;
    font-size: 17px;
    font-weight: 800;
    color: var(--coin-text-primary);
  }
  .amount-unit {
    font-size: 9px;
    opacity: 0.6;
    color: var(--coin-text-secondary);
    text-transform: uppercase;
  }

  &.selected {
    background: var(--coin-success);
    border-color: var(--coin-success);
    box-shadow: 0 0 20px var(--coin-green-active-glow);
    .amount-val,
    .amount-unit {
      color: var(--coin-black);
    }
  }
}

.flip-btn {
  height: 56px;
  font-size: 17px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 2px;
  border-radius: 14px;
}

.btn-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

/* -- Responsive -- */
@media (max-width: 480px) {
  .choice-card {
    height: 100px;
  }
}

/* -- Reduced motion -- */
@media (prefers-reduced-motion: reduce) {
  .choice-card {
    animation: none;
    transition: none;
  }
}
</style>
