<template>
  <ActionModal :visible="visible" :closeable="false" size="md" @close="emit('close')">
    <div class="envelope-stage">
      <button
        type="button"
        class="red-packet"
        :aria-label="t('openNow')"
        :class="{ 'is-opening': isOpening, 'is-shaking': !isOpening }"
        @click="handleOpen"
      >
        <div class="packet-lid"></div>
        <div class="packet-body">
          <div class="packet-seal">
            <span class="seal-text">{{ t("open") }}</span>
          </div>
        </div>
        <div class="packet-content">
          <span class="packet-msg">
            {{ envelope?.from ? t("fromLabel", { name: envelope.from }) : t("luckyPacket") }}
          </span>
          <span class="packet-note" v-if="envelope?.description">{{ envelope.description }}</span>
        </div>
      </button>

      <div v-if="eligibility" class="eligibility-info">
        <div class="eligibility-row">
          <span class="eligibility-label">{{ t("neoBalance") }}</span>
          <span class="eligibility-value">{{ eligibility.neoBalance }} {{ t("tokenNeo") }}</span>
        </div>
        <div class="eligibility-row">
          <span class="eligibility-label">{{ t("holdingDays") }}</span>
          <span class="eligibility-value">{{ eligibility.holdingDays }}d</span>
        </div>
        <div class="eligibility-badge" :class="eligibility.isEligible ? 'badge-eligible' : 'badge-ineligible'">
          <span>{{ eligibility.isEligible ? t("eligible") : t("ineligible") }}</span>
        </div>
        <span v-if="!eligibility.isEligible" class="eligibility-reason">
          {{ eligibility.reason === "insufficient NEO" ? t("insufficientNeo") : t("holdDurationNotMet") }}
        </span>
      </div>

      <div class="action-area">
        <NeoButton v-if="!isConnected" variant="primary" size="lg" type="button" class="action-btn" @click="handleConnect">
          {{ t("connectAndOpen") }}
        </NeoButton>
        <NeoButton
          v-else
          variant="secondary"
          size="lg"
          type="button"
          class="action-btn"
          :loading="isOpening"
          :disabled="eligibility && !eligibility.isEligible"
          @click="handleOpen"
        >
          {{ isOpening ? t("opening") : t("openNow") }}
        </NeoButton>
      </div>
    </div>
  </ActionModal>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ActionModal, NeoButton } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import type { ClaimItem } from "@/composables/useRedEnvelope";

const props = defineProps<{
  visible: boolean;
  envelope: Record<string, unknown>;
  claim?: ClaimItem | null;
  isConnected: boolean;
  isOpening: boolean;
  eligibility?: {
    isEligible: boolean;
    neoBalance: number;
    holdingDays: number;
    reason: string;
  } | null;
}>();

const { t } = createUseI18n(messages)();

const emit = defineEmits<{
  (e: "connect"): void;
  (e: "open"): void;
  (e: "open-claim", claim: ClaimItem): void;
  (e: "close"): void;
}>();

const isClaim = computed(() => !!props.claim);

const handleConnect = () => {
  emit("connect");
};

const handleOpen = () => {
  if (!props.isConnected) {
    emit("connect");
  } else if (isClaim.value && props.claim) {
    emit("open-claim", props.claim);
  } else {
    emit("open");
  }
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.envelope-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 40px;
}

.red-packet {
  width: 240px;
  height: 320px;
  background: linear-gradient(135deg, var(--red-envelope-accent) 0%, var(--red-envelope-base) 100%);
  border-radius: 20px;
  position: relative;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transform-style: preserve-3d;
  transition: transform 0.5s;
  border: none;
  appearance: none;
  padding: 0;

  &.is-shaking {
    animation: float 3s ease-in-out infinite;
  }

  &.is-opening {
    animation: openPacket 1s forwards;
  }

  &::after {
    content: "";
    position: absolute;
    inset: 10px;
    border: 1px solid var(--red-envelope-gold-border);
    border-radius: 12px;
    pointer-events: none;
  }
}

.packet-seal {
  width: 80px;
  height: 80px;
  background: radial-gradient(circle at 30% 30%, var(--red-envelope-gold), var(--red-envelope-gold-dark));
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 4px solid var(--red-envelope-white);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  z-index: 10;
}

.seal-text {
  font-weight: 800;
  color: var(--red-envelope-base);
  text-transform: uppercase;
  font-size: 14px;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.4);
}

.packet-content {
  margin-top: 20px;
  text-align: center;
  z-index: 5;
}

.packet-msg {
  color: rgba(255, 255, 255, 0.95);
  font-weight: 700;
  font-size: 18px;
  margin-bottom: 8px;
  display: block;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.packet-note {
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  max-width: 200px;
  line-height: 1.4;
}

.action-btn {
  min-width: 200px;
  box-shadow: 0 4px 15px var(--red-envelope-gold-glow);
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0) rotateX(0);
  }
  50% {
    transform: translateY(-10px) rotateX(2deg);
  }
}

@keyframes openPacket {
  0% {
    transform: scale(1);
  }
  20% {
    transform: scale(0.9);
  }
  50% {
    transform: scale(1.1) rotateY(180deg);
    opacity: 0.5;
  }
  100% {
    transform: scale(0) rotateY(360deg);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .packet.is-shaking {
    animation: none;
  }
}
</style>
