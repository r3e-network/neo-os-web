<template>
  <ActionModal :visible="true" :title="memorial.name" :closeable="true" size="lg" @close="$emit('close')">
    <div class="memorial-detail">
      <!-- Tombstone Header -->
      <div class="tombstone-header">
        <div class="header-actions">
          <button type="button" class="action-btn share" :aria-label="t('share')" @click="$emit('share')">
            <span aria-hidden="true">&#x1F517;</span>
          </button>
        </div>
        <div class="photo-frame">
          <img
            v-if="memorial.photoHash"
            :src="memorial.photoHash"
            mode="aspectFill"
            :alt="memorial.name?.trim() || t('memorialPhoto')"
          />
          <span v-else class="default-icon" aria-hidden="true">&#x1F56F;&#xFE0F;</span>
        </div>
        <span class="name">{{ memorial.name }}</span>
        <span class="lifespan">{{ memorial.birthYear }}{{ t("yearRangeSeparator") }}{{ memorial.deathYear }}</span>
        <span class="relationship">{{ memorial.relationship || t("foreverRemember") }}</span>
      </div>

      <!-- Biography -->
      <div class="section">
        <span class="section-title" aria-hidden="true">&#x1F4DC;</span>
        <span class="section-title-text">{{ t("biography") }}</span>
        <span class="biography">{{ memorial.biography || t("noBio") }}</span>
      </div>

      <!-- Offerings Received -->
      <div class="section">
        <span class="section-title" aria-hidden="true">&#x1F64F;</span>
        <span class="section-title-text">{{ t("offeringsReceived") }}</span>
        <div class="offering-counts">
          <div class="count-item">
            <span class="icon" aria-hidden="true">&#x1F56F;&#xFE0F;</span>
            <span class="label">{{ t("incense") }}</span>
            <span class="count">{{ memorial.offerings.incense }}</span>
          </div>
          <div class="count-item">
            <span class="icon" aria-hidden="true">&#x1F56F;</span>
            <span class="label">{{ t("candle") }}</span>
            <span class="count">{{ memorial.offerings.candle }}</span>
          </div>
          <div class="count-item">
            <span class="icon" aria-hidden="true">&#x1F338;</span>
            <span class="label">{{ t("flower") }}</span>
            <span class="count">{{ memorial.offerings.flower }}</span>
          </div>
          <div class="count-item">
            <span class="icon" aria-hidden="true">&#x1F347;</span>
            <span class="label">{{ t("fruit") }}</span>
            <span class="count">{{ memorial.offerings.fruit }}</span>
          </div>
          <div class="count-item">
            <span class="icon" aria-hidden="true">&#x1F376;</span>
            <span class="label">{{ t("wine") }}</span>
            <span class="count">{{ memorial.offerings.wine }}</span>
          </div>
          <div class="count-item">
            <span class="icon" aria-hidden="true">&#x1F371;</span>
            <span class="label">{{ t("feast") }}</span>
            <span class="count">{{ memorial.offerings.feast }}</span>
          </div>
        </div>
      </div>

      <!-- Pay Tribute -->
      <div class="section">
        <span class="section-title" aria-hidden="true">&#x1F56F;&#xFE0F;</span>
        <span class="section-title-text">{{ t("payTribute") }}</span>
        <div class="offerings-grid">
          <button
            v-for="offering in offerings"
            :key="offering.type"
            type="button"
            class="offering-option"
            :class="{ selected: selectedOffering === offering.type }"
            :aria-label="t(offering.nameKey) + ' - ' + offering.cost + ' ' + t('tokenGas')"
            :aria-pressed="selectedOffering === offering.type"
            @click="selectedOffering = offering.type"
          >
            <span class="icon" aria-hidden="true">{{ offering.icon }}</span>
            <span class="name">{{ t(offering.nameKey) }}</span>
            <span class="cost">{{ offering.cost }} {{ t("tokenGas") }}</span>
          </button>
        </div>

        <div class="message-input">
          <input id="memorial-message" v-model="message" :placeholder="t('messagePlaceholder')" class="input" :aria-label="t('messagePlaceholder')" />
        </div>

        <div v-if="status" class="status-bar" :class="status.type">
          <span class="status-text">{{ status.msg }}</span>
        </div>

        <button
          type="button"
          class="tribute-btn"
          :aria-label="isPaying ? t('paying') : t('payTributeBtn')"
          :disabled="isPaying"
          @click="payTribute"
        >
          <span>{{ isPaying ? t("paying") : t("payTributeBtn") }}</span>
        </button>
      </div>
    </div>
  </ActionModal>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { ActionModal } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { useMemorialContract } from "@/composables/useMemorialContract";
import type { Memorial } from "@/types";

interface Offering {
  type: number;
  nameKey: string;
  icon: string;
  cost: number;
}

const props = defineProps<{
  memorial: Memorial;
  offerings: Offering[];
}>();

const { t } = createUseI18n(messages)();

const emit = defineEmits<{
  close: [];
  "tribute-paid": [memorialId: number, offeringType: number];
  share: [];
}>();

const memorial = useMemorialContract(t);
const { isPaying } = memorial;
const { status, setStatus } = useStatusMessage(5000);

const selectedOffering = ref(1);
const message = ref("");

const payTribute = async () => {
  const offering = props.offerings.find((o) => o.type === selectedOffering.value);
  if (!offering) return;

  try {
    await memorial.payTribute(props.memorial.id, selectedOffering.value, offering.cost, message.value, setStatus);

    if (status.value?.type === "success") {
      message.value = "";
      emit("tribute-paid", props.memorial.id, selectedOffering.value);
    }
  } catch (_e) {
    console.warn("[memorial-shrine] tribute payment failed:", _e instanceof Error ? _e.message : String(_e));
  }
};
</script>

<style lang="scss" scoped>
.memorial-detail {
  margin: -20px;
}

.tombstone-header {
  text-align: center;
  padding: 24px 16px;
  background: linear-gradient(180deg, var(--shrine-medium), var(--shrine-dark));
  position: relative;
}

.header-actions {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 8px;
  z-index: 10;
}

.action-btn {
  width: 32px;
  height: 32px;
  background: var(--shrine-panel-strong);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: var(--shrine-text);
  cursor: pointer;
  transition: background 0.2s;
  border: none;
  appearance: none;
  padding: 0;

  &:hover {
    background: var(--shrine-panel-soft);
  }
}

.photo-frame {
  width: 80px;
  height: 80px;
  margin: 0 auto 12px;
  border: 3px solid var(--shrine-gold);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle, var(--shrine-gold-soft), transparent);
  overflow: hidden;

  image {
    width: 100%;
    height: 100%;
  }

  .default-icon {
    font-size: 32px;
  }
}

.name {
  display: block;
  font-size: 24px;
  font-weight: 700;
  color: var(--shrine-gold);
  margin-bottom: 4px;
}

.lifespan {
  display: block;
  font-size: 14px;
  color: var(--shrine-muted);
}

.relationship {
  display: block;
  font-size: 12px;
  color: var(--shrine-muted);
  margin-top: 4px;
}

.section {
  padding: 16px;
  border-top: 1px solid var(--shrine-divider);
}

.section-title {
  display: block;
  font-size: 14px;
  color: var(--shrine-gold-light);
  margin-bottom: 12px;
}

.section-title-text {
  display: block;
  font-size: 14px;
  color: var(--shrine-gold-light);
  margin-bottom: 12px;
}

.biography {
  font-size: 13px;
  color: var(--shrine-text);
  line-height: 1.6;
}

.offering-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.count-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: var(--shrine-panel-soft);
  border-radius: 16px;
  font-size: 12px;

  .icon {
    font-size: 14px;
  }
  .label {
    color: var(--shrine-text);
  }
  .count {
    color: var(--shrine-gold-light);
    font-weight: 600;
  }
}

.offerings-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.offering-option {
  flex: 1;
  min-width: 80px;
  padding: 10px 6px;
  text-align: center;
  background: var(--shrine-panel-soft);
  border: 1px solid var(--shrine-panel-border);
  border-radius: 8px;
  appearance: none;
  cursor: pointer;

  &.selected,
  &[aria-pressed="true"] {
    border-color: var(--shrine-gold);
    background: var(--shrine-gold-soft);
  }

  .icon {
    display: block;
    font-size: 24px;
    margin-bottom: 4px;
  }
  .name {
    display: block;
    font-size: 12px;
    color: var(--shrine-text);
  }
  .cost {
    display: block;
    font-size: 10px;
    color: var(--shrine-muted);
  }
}

.message-input {
  margin-bottom: 12px;

  .input {
    width: 100%;
    padding: 10px 12px;
    background: var(--shrine-panel);
    border: 1px solid var(--shrine-panel-border);
    border-radius: 8px;
    color: var(--shrine-text);
    font-size: 13px;
  }
}

.tribute-btn {
  padding: 14px;
  background: var(--shrine-button-bg);
  border-radius: 10px;
  text-align: center;
  border: none;
  appearance: none;
  cursor: pointer;
  width: 100%;

  text {
    font-size: 15px;
    font-weight: 600;
    color: var(--shrine-button-text);
  }

  &:disabled {
    opacity: 0.6;
  }
}

.status-bar {
  padding: 10px 14px;
  border-radius: 8px;
  margin-bottom: 12px;
  text-align: center;

  &.success {
    background: var(--shrine-gold-soft);
    border: 1px solid var(--shrine-gold);
  }
  &.error {
    background: rgba(220, 38, 38, 0.15);
    border: 1px solid rgba(220, 38, 38, 0.4);
  }

  .status-text {
    font-size: 13px;
    font-weight: 600;
    color: var(--shrine-text);
  }
}
</style>
