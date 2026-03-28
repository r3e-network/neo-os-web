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

.ticket-play-area { display: flex; flex-direction: column; gap: 20px; padding: 20px 12px; min-height: 300px; }
.hero-container { margin-bottom: 20px; background: radial-gradient(ellipse at center, rgba(130, 80, 255, 0.1) 0%, transparent 70%); }
.ticket-scene { display: flex; justify-content: center; align-items: center; height: 120px; }
.ticket-card { width: 80px; background: linear-gradient(135deg, rgba(130, 80, 255, 0.08) 0%, rgba(255, 255, 255, 0.06) 50%, rgba(80, 200, 255, 0.08) 100%); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px; padding: 8px; text-align: center; background-size: 200% 100%; animation: holographic-shimmer 6s linear infinite; box-shadow: 0 0 20px rgba(130, 80, 255, 0.15), 0 0 40px rgba(130, 80, 255, 0.05); position: relative; overflow: hidden; }
.ticket-card::after { content: ""; position: absolute; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, rgba(130, 80, 255, 0.6), transparent); animation: ticket-scan-line 3s ease-in-out infinite; pointer-events: none; }
.ticket-header { font-size: 6px; font-weight: 800; letter-spacing: 1px; color: var(--text-secondary); margin-bottom: 6px; text-shadow: 0 0 6px rgba(130, 80, 255, 0.3); }
.ticket-qr { font-size: 32px; opacity: 0.3; line-height: 1; animation: qr-pulse 3s ease-in-out infinite; }
.ticket-perforation { margin-top: 6px; border-top: 2px dashed rgba(255, 255, 255, 0.1); }
.hero-stats { display: flex; gap: 16px; justify-content: center; }
.hero-stat { text-align: center; padding: 8px 16px; background: linear-gradient(135deg, rgba(130, 80, 255, 0.1) 0%, rgba(80, 200, 255, 0.06) 100%); border-radius: 8px; border: 1px solid rgba(130, 80, 255, 0.15); }
.hero-stat-value { display: block; font-size: 20px; font-weight: 800; color: var(--text-primary); text-shadow: 0 0 8px rgba(130, 80, 255, 0.3); }
.hero-stat-label { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); letter-spacing: 1px; margin-top: 2px; }
@keyframes holographic-shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
@keyframes ticket-scan-line { 0% { top: 0%; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
@keyframes qr-pulse { 0%, 100% { opacity: 0.3; text-shadow: none; transform: scale(1); } 50% { opacity: 0.7; text-shadow: 0 0 15px rgba(130, 80, 255, 0.5), 0 0 30px rgba(130, 80, 255, 0.2); transform: scale(1.05); } }
@media (prefers-reduced-motion: reduce) { .ticket-card, .ticket-card::after, .ticket-qr { animation: none; } }
</style>
