<template>
  <div class="ticket-play-area">
    <div class="hero-container">
      <HeroSection variant="erobo" compact>
        <template #background>
          <div class="ticket-scene" aria-hidden="true">
            <div class="ticket-card">
              <div class="ticket-header">{{ t("eventPass") }}</div>
              <div class="ticket-qr">▣</div>
              <div class="ticket-perforation" />
            </div>
          </div>
        </template>
        <template #stats>
          <div class="hero-stats">
            <div class="hero-stat">
              <span class="hero-stat-value">{{ eventsCount }}</span>
              <span class="hero-stat-label">{{ t("sidebarEvents") }}</span>
            </div>
            <div class="hero-stat">
              <span class="hero-stat-value">{{ ticketsCount }}</span>
              <span class="hero-stat-label">{{ t("sidebarTickets") }}</span>
            </div>
          </div>
        </template>
      </HeroSection>
    </div>

    <EventList
      :address="address"
      :events="events"
      :is-refreshing="isRefreshing"
      :toggling-id="togglingId"
      @refresh="handleRefreshEvents"
      @connect="handleConnect"
      @issue="handleIssue"
      @toggle="handleToggle"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { HeroSection } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import EventList from "./pages/index/components/EventList.vue";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

const eventsCount = computed(() => Number(props.state.eventsCount?.value ?? 0));
const ticketsCount = computed(() => Number(props.state.ticketsCount?.value ?? 0));
const events = computed(() => props.state.events?.value ?? []);
const address = computed(() => props.state.address?.value as string | null);
const isRefreshing = computed(() => Boolean(props.state.isRefreshing?.value ?? false));
const togglingId = computed(() => props.state.togglingId?.value as string | null);

const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const handleRefreshEvents = async () => { const h = actions.get("refreshEvents"); if (h) await h(); };
const handleConnect = async () => { const h = actions.get("connectWallet"); if (h) await h(); };
const handleIssue = async (event: unknown) => { const h = actions.get("openIssueModal"); if (h) await h(event); };
const handleToggle = async (event: unknown) => { const h = actions.get("toggleEvent"); if (h) await h(event); };
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "./pages/index/event-ticket-pass-theme.scss" as *;
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&display=swap');

.ticket-play-area {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 20px 12px;
  min-height: 300px;
  font-family: 'Syne', sans-serif;
  background: linear-gradient(160deg, #0D0D1A 0%, #1A0A2E 40%, #0F172A 100%);
  color: #E2E8F0;
  border-radius: 12px;
  position: relative;
  overflow: hidden;
}

.ticket-play-area::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 20% 80%, rgba(236, 72, 153, 0.12) 0%, transparent 40%),
    radial-gradient(circle at 80% 20%, rgba(6, 182, 212, 0.12) 0%, transparent 40%);
  pointer-events: none;
}

.hero-container {
  background: none;
  position: relative;
  z-index: 1;
}

.ticket-scene {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 120px;
}

.ticket-card {
  width: 88px;
  background: linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(6, 182, 212, 0.12) 50%, rgba(236, 72, 153, 0.08) 100%);
  border: 1px solid rgba(236, 72, 153, 0.3);
  border-radius: 10px;
  padding: 10px;
  text-align: center;
  background-size: 200% 100%;
  animation: holographic-shimmer 6s linear infinite;
  box-shadow:
    0 0 24px rgba(236, 72, 153, 0.2),
    0 0 48px rgba(6, 182, 212, 0.1),
    inset 0 0 20px rgba(236, 72, 153, 0.05);
  position: relative;
  overflow: hidden;
}

.ticket-card::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, #EC4899, #06B6D4, transparent);
  animation: ticket-scan-line 3s ease-in-out infinite;
  pointer-events: none;
}

.ticket-header {
  font-size: 6px;
  font-weight: 800;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #EC4899;
  margin-bottom: 6px;
  text-shadow: 0 0 8px rgba(236, 72, 153, 0.6);
}

.ticket-qr {
  font-size: 32px;
  opacity: 0.4;
  line-height: 1;
  color: #06B6D4;
  animation: qr-pulse 3s ease-in-out infinite;
}

.ticket-perforation {
  margin-top: 6px;
  border-top: 2px dashed rgba(236, 72, 153, 0.25);
  position: relative;
}

.ticket-perforation::before,
.ticket-perforation::after {
  content: "";
  position: absolute;
  top: -6px;
  width: 10px;
  height: 10px;
  background: #0D0D1A;
  border-radius: 50%;
}

.ticket-perforation::before { left: -14px; }
.ticket-perforation::after { right: -14px; }

.hero-stats { display: flex; gap: 16px; justify-content: center; position: relative; z-index: 1; }

.hero-stat {
  text-align: center;
  padding: 10px 18px;
  background: linear-gradient(135deg, rgba(236, 72, 153, 0.1) 0%, rgba(6, 182, 212, 0.08) 100%);
  border-radius: 10px;
  border: 1px solid rgba(236, 72, 153, 0.2);
  backdrop-filter: blur(8px);
}

.hero-stat-value {
  display: block;
  font-size: 22px;
  font-weight: 800;
  color: #F0ABFC;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 12px rgba(236, 72, 153, 0.5);
  font-family: 'Syne', sans-serif;
}

.hero-stat-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: #67E8F9;
  letter-spacing: 1.5px;
  margin-top: 2px;
}

@keyframes holographic-shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
@keyframes ticket-scan-line { 0% { top: 0%; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
@keyframes qr-pulse {
  0%, 100% { opacity: 0.4; text-shadow: none; transform: scale(1); }
  50% { opacity: 0.8; text-shadow: 0 0 20px rgba(6, 182, 212, 0.6), 0 0 40px rgba(236, 72, 153, 0.3); transform: scale(1.05); }
}
@media (prefers-reduced-motion: reduce) { .ticket-card, .ticket-card::after, .ticket-qr { animation: none; } }
</style>
