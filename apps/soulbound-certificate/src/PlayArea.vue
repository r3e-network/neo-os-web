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
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&display=swap');

.certificate-play-area {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 20px 12px;
  min-height: 300px;
  font-family: 'Cormorant Garamond', Georgia, serif;
  background:
    repeating-linear-gradient(0deg, transparent, transparent 28px, rgba(185, 28, 28, 0.03) 28px, rgba(185, 28, 28, 0.03) 29px),
    linear-gradient(180deg, #FEF3C7 0%, #fdf6e3 40%, #faf0d4 100%);
  color: #3B2F1E;
  border: 3px double #B8860B;
  border-radius: 12px;
  position: relative;
  box-shadow: inset 0 0 60px rgba(184, 134, 11, 0.08), 0 4px 24px rgba(0, 0, 0, 0.12);
}

.certificate-play-area::before {
  content: "";
  position: absolute;
  inset: 6px;
  border: 1px solid rgba(184, 134, 11, 0.3);
  border-radius: 8px;
  pointer-events: none;
}

.hero-container {
  background: radial-gradient(ellipse at 50% 40%, rgba(184, 134, 11, 0.1) 0%, transparent 55%);
  border-bottom: 1px solid rgba(184, 134, 11, 0.15);
  padding-bottom: 12px;
}

.certificate-scene {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100px;
  background: linear-gradient(180deg, rgba(184, 134, 11, 0.06), transparent);
}

.cert-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: seal-radiance 4s ease-in-out infinite;
}

.cert-ribbon {
  width: 30px;
  height: 20px;
  background: linear-gradient(135deg, #B91C1C, #DC2626);
  clip-path: polygon(0 0, 100% 0, 80% 100%, 50% 70%, 20% 100%);
  filter: drop-shadow(0 2px 4px rgba(185, 28, 28, 0.4));
}

.cert-seal {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #DAA520, #B8860B 60%, #8B6914);
  border: 2px solid #DAA520;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  color: #FEF3C7;
  margin-top: -8px;
  animation: stamp-press 3s ease-in-out infinite;
  box-shadow: 0 0 16px rgba(184, 134, 11, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.hero-stats { display: flex; gap: 16px; justify-content: center; }

.hero-stat {
  text-align: center;
  padding: 10px 18px;
  background: linear-gradient(135deg, rgba(184, 134, 11, 0.08), rgba(254, 243, 199, 0.5));
  border-radius: 8px;
  border: 1px solid rgba(184, 134, 11, 0.25);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 2px 6px rgba(0, 0, 0, 0.06);
}

.hero-stat-value {
  display: block;
  font-size: 22px;
  font-weight: 700;
  color: #92400E;
  font-variant-numeric: tabular-nums;
  font-family: 'Cormorant Garamond', Georgia, serif;
}

.hero-stat-label {
  display: block;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  color: #78716C;
  letter-spacing: 1.5px;
  margin-top: 2px;
}

@keyframes stamp-press {
  0%, 100% { transform: scale(1); opacity: 0.9; }
  15% { transform: scale(1.12); opacity: 1; }
  30% { transform: scale(0.96); opacity: 0.95; }
  50% { transform: scale(1); }
}

@keyframes seal-radiance {
  0%, 100% { filter: drop-shadow(0 0 8px rgba(184, 134, 11, 0.2)); }
  50% { filter: drop-shadow(0 0 20px rgba(184, 134, 11, 0.5)); }
}

@media (prefers-reduced-motion: reduce) { .cert-seal, .cert-badge { animation: none; } }
</style>
