<template>
  <div class="certificate-play-area">
    <div class="hero-container">
      <HeroSection variant="erobo" compact>
        <template #background>
          <div class="certificate-scene" aria-hidden="true">
            <div class="cert-badge">
              <div class="cert-ribbon" />
              <div class="cert-seal">✦</div>
            </div>
          </div>
        </template>
        <template #stats>
          <div class="hero-stats">
            <div class="hero-stat">
              <span class="hero-stat-value">{{ templatesCount }}</span>
              <span class="hero-stat-label">{{ t("templatesTab") }}</span>
            </div>
            <div class="hero-stat">
              <span class="hero-stat-value">{{ certificatesCount }}</span>
              <span class="hero-stat-label">{{ t("certificatesTab") }}</span>
            </div>
          </div>
        </template>
      </HeroSection>
    </div>

    <TemplateList
      :templates="templates"
      :refreshing="isRefreshing"
      :toggling-id="togglingId"
      :has-address="!!address"
      @refresh="handleRefreshTemplates"
      @connect="handleConnect"
      @issue="handleOpenIssueModal"
      @toggle="handleToggle"
      @copy-issue-link="handleCopyIssueLink"
      @share-issue-link="handleShareIssueLink"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { HeroSection } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import TemplateList from "./components/TemplateList.vue";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

const templatesCount = computed(() => Number(props.state.templatesCount?.value ?? 0));
const certificatesCount = computed(() => Number(props.state.certificatesCount?.value ?? 0));
const templates = computed(() => (props.state.templates?.value ?? []) as unknown[]);
const address = computed(() => props.state.address?.value as string | null);
const isRefreshing = computed(() => Boolean(props.state.isRefreshing?.value ?? false));
const togglingId = computed(() => props.state.togglingId?.value as string | null);

const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const handleRefreshTemplates = async () => { const h = actions.get("refreshTemplates"); if (h) await h(); };
const handleConnect = async () => { const h = actions.get("connectWallet"); if (h) await h(); };
const handleOpenIssueModal = async (template: unknown) => { const h = actions.get("openIssueModal"); if (h) await h(template); };
const handleToggle = async (template: unknown) => { const h = actions.get("toggleTemplate"); if (h) await h(template); };
const handleCopyIssueLink = async (template: unknown) => { const h = actions.get("copyIssueLink"); if (h) await h(template); };
const handleShareIssueLink = async (template: unknown) => { const h = actions.get("shareIssueLink"); if (h) await h(template); };
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "./pages/index/soulbound-certificate-theme.scss" as *;

.certificate-play-area { display: flex; flex-direction: column; gap: 24px; padding: 20px 12px; min-height: 300px; }
.hero-container { background: radial-gradient(ellipse at 50% 40%, rgba(159, 157, 243, 0.08) 0%, transparent 55%); }
.certificate-scene { display: flex; justify-content: center; align-items: center; height: 100px; background: linear-gradient(180deg, rgba(159, 157, 243, 0.04), transparent); }
.cert-badge { display: flex; flex-direction: column; align-items: center; animation: seal-radiance 4s ease-in-out infinite; }
.cert-ribbon { width: 30px; height: 20px; background: linear-gradient(135deg, var(--soul-accent, #9f9df3), var(--soul-accent-secondary, #f7aac7)); clip-path: polygon(0 0, 100% 0, 80% 100%, 50% 70%, 20% 100%); }
.cert-seal { width: 50px; height: 50px; border-radius: 50%; background: linear-gradient(135deg, rgba(159, 157, 243, 0.3), rgba(247, 170, 199, 0.2)); border: 2px solid rgba(159, 157, 243, 0.4); display: flex; align-items: center; justify-content: center; font-size: 20px; color: var(--soul-accent, #9f9df3); margin-top: -8px; animation: stamp-press 3s ease-in-out infinite; box-shadow: 0 0 16px rgba(159, 157, 243, 0.25); }
.hero-stats { display: flex; gap: 16px; justify-content: center; }
.hero-stat { text-align: center; padding: 8px 16px; background: rgba(159, 157, 243, 0.08); border-radius: 8px; border: 1px solid rgba(159, 157, 243, 0.15); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05); }
.hero-stat-value { display: block; font-size: 20px; font-weight: 800; color: var(--text-primary); font-variant-numeric: tabular-nums; }
.hero-stat-label { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); letter-spacing: 1px; margin-top: 2px; }
@keyframes stamp-press { 0%, 100% { transform: scale(1); opacity: 0.9; } 15% { transform: scale(1.12); opacity: 1; } 30% { transform: scale(0.96); opacity: 0.95; } 50% { transform: scale(1); } }
@keyframes seal-radiance { 0%, 100% { box-shadow: 0 0 12px rgba(159, 157, 243, 0.2); } 50% { box-shadow: 0 0 24px rgba(159, 157, 243, 0.45), 0 0 48px rgba(247, 170, 199, 0.12); } }
@media (prefers-reduced-motion: reduce) { .cert-seal, .cert-badge { animation: none; } }
</style>
