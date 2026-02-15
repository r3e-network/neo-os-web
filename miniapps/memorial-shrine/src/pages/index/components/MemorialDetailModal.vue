<template>
  <ActionModal :visible="true" :title="memorial.name" :closeable="true" size="lg" @close="$emit('close')">
    <view class="memorial-detail">
      <!-- Tombstone Header -->
      <view class="tombstone-header">
        <view class="header-actions">
          <view class="action-btn share" role="button" tabindex="0" :aria-label="t('share')" @click="$emit('share')">
            <text aria-hidden="true">&#x1F517;</text>
          </view>
        </view>
        <view class="photo-frame">
          <image
            v-if="memorial.photoHash"
            :src="memorial.photoHash"
            mode="aspectFill"
            :alt="memorial.name || t('memorialPhoto')"
          />
          <text v-else class="default-icon">&#x1F56F;&#xFE0F;</text>
        </view>
        <text class="name">{{ memorial.name }}</text>
        <text class="lifespan">{{ memorial.birthYear }} - {{ memorial.deathYear }}</text>
        <text class="relationship">{{ memorial.relationship || t("foreverRemember") }}</text>
      </view>

      <!-- Biography -->
      <view class="section">
        <text class="section-title">&#x1F4DC; {{ t("biography") }}</text>
        <text class="biography">{{ memorial.biography || t("noBio") }}</text>
      </view>

      <!-- Offerings Received -->
      <view class="section">
        <text class="section-title">&#x1F64F; {{ t("offeringsReceived") }}</text>
        <view class="offering-counts">
          <view class="count-item">
            <text class="icon">&#x1F56F;&#xFE0F;</text>
            <text class="label">{{ t("incense") }}</text>
            <text class="count">{{ memorial.offerings.incense }}</text>
          </view>
          <view class="count-item">
            <text class="icon">&#x1F56F;</text>
            <text class="label">{{ t("candle") }}</text>
            <text class="count">{{ memorial.offerings.candle }}</text>
          </view>
          <view class="count-item">
            <text class="icon">&#x1F338;</text>
            <text class="label">{{ t("flower") }}</text>
            <text class="count">{{ memorial.offerings.flower }}</text>
          </view>
          <view class="count-item">
            <text class="icon">&#x1F347;</text>
            <text class="label">{{ t("fruit") }}</text>
            <text class="count">{{ memorial.offerings.fruit }}</text>
          </view>
          <view class="count-item">
            <text class="icon">&#x1F376;</text>
            <text class="label">{{ t("wine") }}</text>
            <text class="count">{{ memorial.offerings.wine }}</text>
          </view>
          <view class="count-item">
            <text class="icon">&#x1F371;</text>
            <text class="label">{{ t("feast") }}</text>
            <text class="count">{{ memorial.offerings.feast }}</text>
          </view>
        </view>
      </view>

      <!-- Pay Tribute -->
      <view class="section">
        <text class="section-title">&#x1F56F;&#xFE0F; {{ t("payTribute") }}</text>
        <view class="offerings-grid">
          <view
            v-for="offering in offerings"
            :key="offering.type"
            class="offering-option"
            :class="{ selected: selectedOffering === offering.type }"
            role="button"
            tabindex="0"
            :aria-label="t(offering.nameKey) + ' - ' + offering.cost + ' GAS'"
            :aria-pressed="selectedOffering === offering.type"
            @click="selectedOffering = offering.type"
          >
            <text class="icon">{{ offering.icon }}</text>
            <text class="name">{{ t(offering.nameKey) }}</text>
            <text class="cost">{{ offering.cost }} GAS</text>
          </view>
        </view>

        <view class="message-input">
          <input v-model="message" :placeholder="t('messagePlaceholder')" class="input" />
        </view>

        <view v-if="status" class="status-bar" :class="status.type">
          <text class="status-text">{{ status.msg }}</text>
        </view>

        <view
          class="tribute-btn"
          role="button"
          tabindex="0"
          :aria-label="isPaying ? t('paying') : t('payTributeBtn')"
          :class="{ disabled: isPaying }"
          @click="payTribute"
        >
          <text>{{ isPaying ? t("paying") : t("payTributeBtn") }}</text>
        </view>
      </view>
    </view>
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

  await memorial.payTribute(props.memorial.id, selectedOffering.value, offering.cost, message.value, setStatus);

  if (status.value?.type === "success") {
    message.value = "";
    emit("tribute-paid", props.memorial.id, selectedOffering.value);
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

  &.selected {
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

  text {
    font-size: 15px;
    font-weight: 600;
    color: var(--shrine-button-text);
  }

  &.disabled {
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
