<template>
  <div class="stats-container">
    <div class="section fade-up delay-2">
      <div class="section-media">
        <img class="section-image" src="/static/neoburger-placeholder.svg" mode="widthFix" :alt="t('bneoHeroAlt')" />
      </div>
      <div class="section-content">
        <span class="section-title">{{ t("whatIsBneoTitle") }}</span>
        <span class="section-strong">{{ t("whatIsBneoStrong") }}</span>
        <div class="section-pair">
          <span class="section-label">{{ t("bneoContractAddressLabel") }}</span>
          <span class="section-value">{{ t("bneoContractAddressValue") }}</span>
        </div>
        <div class="section-pair">
          <span class="section-label">{{ t("bneoScriptHashLabel") }}</span>
          <span class="section-value">{{ t("bneoScriptHashValue") }}</span>
        </div>
      </div>
    </div>

    <div class="section reverse fade-up delay-3">
      <div class="section-media">
        <img class="section-image" src="/static/neoburger-placeholder.svg" mode="widthFix" :alt="t('bneoSplitAlt')" />
      </div>
      <div class="section-content">
        <span class="section-title">{{ t("whyNeedBneoTitle") }}</span>
        <span class="section-strong">{{ t("bneoRate") }}</span>
        <span class="section-text">{{ t("whyNeedBneoDesc1") }}</span>
        <span class="section-text">{{ t("whyNeedBneoDesc2") }}</span>
      </div>
    </div>

    <div class="section center fade-up delay-4">
      <span class="section-title">{{ t("rewardsSourceTitle") }}</span>
      <img
        class="section-image"
        src="/static/neoburger-placeholder.svg"
        mode="widthFix"
        :alt="t('rewardsConnectionAlt')"
      />
      <span class="section-text center">{{ t("rewardsSourceDesc") }}</span>
      <span class="section-strong center">{{ t("rewardsSourceStrong") }}</span>
    </div>

    <div class="section fade-up delay-5">
      <div class="section-content">
        <span class="section-title">{{ t("getGasRewardsTitle") }}</span>
        <span class="section-strong">
          {{ t("getGasRewardsStrong") }}
          <span class="linkish" role="button" tabindex="0" :aria-label="t('jazzUp')" @click="emit('switchToJazz')">{{
            t("jazzUp")
          }}</span>
        </span>
      </div>
      <div class="section-media">
        <img class="section-image" src="/static/neoburger-placeholder.svg" mode="widthFix" :alt="t('rewardsAlt')" />
      </div>
    </div>

    <div class="footer fade-up delay-6">
      <img class="footer-logo" src="/static/neoburger-placeholder.svg" mode="widthFix" :alt="t('footerLogoAlt')" />
      <div class="footer-links">
        <template v-for="(link, index) in footerLinks" :key="link.label">
          <span
            class="footer-link"
            role="link"
            tabindex="0"
            :aria-label="link.label"
            @click="emit('openLink', link.url)"
            >{{ link.label }}</span
          >
          <span v-if="index < footerLinks.length - 1" class="footer-divider">|</span>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

const { t } = createUseI18n(messages)();

const emit = defineEmits<{
  (e: "switchToJazz"): void;
  (e: "openLink", url: string): void;
}>();

const footerLinks = computed(() => [
  { label: t("footerDoc"), url: t("docsUrl") },
  { label: t("footerNeo"), url: t("neoUrl") },
  { label: t("footerTwitter"), url: t("twitterUrl") },
  { label: t("footerGithub"), url: t("githubUrl") },
]);
</script>

<style lang="scss" scoped>
.stats-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section {
  background: var(--burger-surface);
  border-radius: 24px;
  padding: 22px;
  border: 1px solid var(--burger-border);
  box-shadow: var(--burger-card-shadow-strong);
  display: grid;
  gap: 18px;
}

.section.reverse {
  direction: rtl;
}

.section.reverse .section-content,
.section.reverse .section-media {
  direction: ltr;
}

.section.center {
  text-align: center;
  justify-items: center;
}

.section-title {
  font-family: "Bebas Neue", "Manrope", sans-serif;
  font-size: 28px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.section-strong {
  font-weight: 700;
  font-size: 14px;
  line-height: 1.5;
}

.section-text {
  font-size: 13px;
  line-height: 1.6;
  color: var(--burger-text-soft);
}

.section-text.center {
  text-align: center;
}

.section-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 700;
  color: var(--burger-text-muted);
}

.section-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--burger-text-subtle);
}

.section-pair {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 8px;
}

.section-media {
  width: 100%;
}

.section-image {
  width: 100%;
  border-radius: 18px;
}

.linkish {
  color: var(--burger-accent-deep);
  font-weight: 700;
  text-decoration: underline;
  margin-left: 6px;
}

.footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.footer-logo {
  width: 80px;
}

.footer-links {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--burger-text-muted);
}

.footer-link {
  font-weight: 700;
  cursor: pointer;
}

.footer-divider {
  opacity: 0.4;
}

.fade-up {
  animation: fadeUp 0.8s ease both;
}

.delay-2 {
  animation-delay: 0.2s;
}

.delay-3 {
  animation-delay: 0.3s;
}

.delay-4 {
  animation-delay: 0.4s;
}

.delay-5 {
  animation-delay: 0.5s;
}

.delay-6 {
  animation-delay: 0.6s;
}

@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (min-width: 768px) {
  .section {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: center;
  }

  .section.center {
    grid-template-columns: 1fr;
  }
}
</style>
