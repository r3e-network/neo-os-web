<template>
  <MiniAppPage
    name="event-ticket-pass"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    @tab-change="onTabChange"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="resetAndReload"
  >
    <template #content>
      <div class="hero-container">
        <HeroSection variant="erobo" icon="🎫" compact>
          <template #background>
            <div class="ticket-scene" aria-hidden="true">
              <div class="ticket-card">
                <div class="ticket-header">EVENT PASS</div>
                <div class="ticket-qr">▣</div>
                <div class="ticket-perforation" />
              </div>
            </div>
          </template>
          <template #stats>
            <div class="hero-stats">
              <div class="hero-stat">
                <span class="hero-stat-value">{{ contract.events.value.length }}</span>
                <span class="hero-stat-label">{{ t("sidebarEvents") }}</span>
              </div>
              <div class="hero-stat">
                <span class="hero-stat-value">{{ contract.tickets.value.length }}</span>
                <span class="hero-stat-label">{{ t("sidebarTickets") }}</span>
              </div>
            </div>
          </template>
        </HeroSection>
      </div>

      <ContractAvailabilityCard
        v-if="!contractReady"
        :title="t('deploymentPendingTitle')"
        :description="t('deploymentPendingDesc')"
      />
      <EventList
        v-else
        :address="address"
        :events="contract.events"
        :is-refreshing="contract.isRefreshing"
        :toggling-id="contract.togglingId"
        @refresh="contract.refreshEvents"
        @connect="contract.connectWallet"
        @issue="contract.openIssueModal"
        @toggle="contract.toggleEvent"
      />
    </template>

    <template #operation>
      <ContractAvailabilityCard
        v-if="!contractReady"
        :title="t('deploymentPendingTitle')"
        :description="t('deploymentPendingDesc')"
        compact
      />
      <EventCreateForm v-else v-model:form="contract.form" :is-creating="contract.isCreating" @create="contract.createEvent" />
    </template>

    <template #tab-tickets>
      <ContractAvailabilityCard
        v-if="!contractReady"
        :title="t('deploymentPendingTitle')"
        :description="t('deploymentPendingDesc')"
      />
      <TicketManagement
        v-else
        :address="address"
        :tickets="contract.tickets"
        :ticket-qrs="contract.ticketQrs"
        :is-refreshing="contract.isRefreshingTickets"
        @refresh="contract.refreshTickets"
        @connect="contract.connectWallet"
        @copy="contract.copyTokenId"
      />
    </template>

    <template #tab-checkin>
      <ContractAvailabilityCard
        v-if="!contractReady"
        :title="t('deploymentPendingTitle')"
        :description="t('deploymentPendingDesc')"
      />
      <CheckinTab
        v-else
        v-model:token-id="contract.checkin.tokenId"
        :lookup="contract.lookup"
        :is-looking-up="contract.isLookingUp"
        :is-checking-in="contract.isCheckingIn"
        :status="status"
        @lookup="contract.lookupTicket"
        @checkin="contract.checkInTicket"
      />
    </template>
  </MiniAppPage>
  <TicketIssueModal
    v-if="contractReady"
    :visible="contract.issueModalOpen"
    v-model:recipient="contract.issueForm.recipient"
    v-model:seat="contract.issueForm.seat"
    v-model:memo="contract.issueForm.memo"
    :is-issuing="contract.isIssuing"
    @close="contract.closeIssueModal"
    @issue="contract.issueTicket"
  />
</template>
<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useWallet } from "@shared/utils/wallet-sdk";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import { messages } from "@/locale/messages";
import { MiniAppPage, HeroSection, ContractAvailabilityCard } from "@shared/components";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { useEventTicketContract } from "@/composables/useEventTicketContract";
import EventList from "./components/EventList.vue";

const {
  t,
  templateConfig,
  sidebarItems,
  sidebarTitle,
  fallbackMessage,
  status,
  setStatus,
  clearStatus,
  handleBoundaryError,
} = createMiniApp({
  name: "event-ticket-pass",
  messages,
  template: {
    tabs: [
      { key: "create", labelKey: "createTab", icon: "➕", default: true },
      { key: "tickets", labelKey: "ticketsTab", icon: "🎫" },
      { key: "checkin", labelKey: "checkinTab", icon: "✅" },
    ],
    docFeatureCount: 3,
  },
  sidebarItems: [
    { labelKey: "sidebarEvents", value: () => contract.events.value.length },
    { labelKey: "sidebarTickets", value: () => contract.tickets.value.length },
    { labelKey: "sidebarActive", value: () => contract.events.value.filter((e) => e.active).length },
  ],
});

const wallet = useWallet() as WalletSDK;
const { address, connect } = wallet;
const { ensure: ensureContractAddress, ensureSafe: ensureContractSafe } = useContractAddress(t);

const contract = useEventTicketContract(wallet, ensureContractAddress, setStatus, t);
const contractReady = ref(false);

const activeTab = ref("create");

const appState = computed(() => ({
  activeTab: activeTab.value,
  address: address.value,
  isCreating: contract.isCreating.value,
  isRefreshing: contract.isRefreshing.value,
  eventsCount: contract.events.value.length,
  ticketsCount: contract.tickets.value.length,
}));

const ensureContractReady = async () => {
  contractReady.value = await ensureContractSafe({ silentChainCheck: true });
  return contractReady.value;
};

const onTabChange = async (tab: string) => {
  activeTab.value = tab;
  if (!contractReady.value) return;
  if (tab === "tickets") {
    await contract.refreshTickets();
  }
  if (tab === "create") {
    await contract.refreshEvents();
  }
};

const resetAndReload = async () => {
  if (!(await ensureContractReady())) {
    contract.events.value = [];
    contract.tickets.value = [];
    contract.lookup.value = null;
    return;
  }
  if (address.value) {
    await contract.refreshEvents();
    await contract.refreshTickets();
  }
};

onMounted(async () => {
  if (!(await ensureContractReady())) return;
  await connect();
  if (address.value) {
    await contract.refreshEvents();
    await contract.refreshTickets();
  }
});

watch(address, async (newAddr) => {
  if (!(await ensureContractReady())) {
    contract.events.value = [];
    contract.tickets.value = [];
    contract.lookup.value = null;
    return;
  }
  if (newAddr) {
    await contract.refreshEvents();
    await contract.refreshTickets();
  } else {
    contract.events.value = [];
    contract.tickets.value = [];
    contract.lookup.value = null;
  }
});
</script>
<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "./event-ticket-pass-theme.scss" as *;
:global(body) {
  background: linear-gradient(135deg, var(--ticket-bg-start) 0%, var(--ticket-bg-end) 100%);
  color: var(--ticket-text);
}

.hero-container {
  margin-bottom: 20px;
}

.ticket-scene {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 120px;
}

.ticket-card {
  width: 80px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 8px;
  text-align: center;
}

.ticket-header {
  font-size: 6px;
  font-weight: 800;
  letter-spacing: 1px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.ticket-qr {
  font-size: 32px;
  opacity: 0.3;
  line-height: 1;
}

.ticket-perforation {
  margin-top: 6px;
  border-top: 2px dashed rgba(255, 255, 255, 0.1);
}

.hero-stats {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.hero-stat {
  text-align: center;
  padding: 8px 16px;
  background: rgba(159, 157, 243, 0.08);
  border-radius: 8px;
  border: 1px solid rgba(159, 157, 243, 0.15);
}

.hero-stat-value {
  display: block;
  font-size: 20px;
  font-weight: 800;
  color: var(--text-primary);
}

.hero-stat-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 1px;
  margin-top: 2px;
}

/* ── Event Ticket Hero Enhancements ── */

.hero-container {
  background: radial-gradient(ellipse at center, rgba(130, 80, 255, 0.1) 0%, transparent 70%);
  transition: box-shadow 0.4s ease;
}

@keyframes ticket-scan-line {
  0% {
    top: 0%;
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    top: 100%;
    opacity: 0;
  }
}

@keyframes holographic-shimmer {
  0% {
    background-position: -200% center;
  }
  100% {
    background-position: 200% center;
  }
}

@keyframes qr-pulse {
  0%,
  100% {
    opacity: 0.3;
    text-shadow: none;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    text-shadow:
      0 0 15px rgba(130, 80, 255, 0.5),
      0 0 30px rgba(130, 80, 255, 0.2);
    transform: scale(1.05);
  }
}

.ticket-card {
  background: linear-gradient(
    135deg,
    rgba(130, 80, 255, 0.08) 0%,
    rgba(255, 255, 255, 0.06) 50%,
    rgba(80, 200, 255, 0.08) 100%
  );
  background-size: 200% 100%;
  animation: holographic-shimmer 6s linear infinite;
  box-shadow:
    0 0 20px rgba(130, 80, 255, 0.15),
    0 0 40px rgba(130, 80, 255, 0.05);
  position: relative;
  overflow: hidden;
  transition: box-shadow 0.3s ease;

  &::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, rgba(130, 80, 255, 0.6), transparent);
    animation: ticket-scan-line 3s ease-in-out infinite;
    pointer-events: none;
  }
}

.ticket-qr {
  animation: qr-pulse 3s ease-in-out infinite;
}

.ticket-header {
  text-shadow: 0 0 6px rgba(130, 80, 255, 0.3);
}

.hero-stat {
  background: linear-gradient(135deg, rgba(130, 80, 255, 0.1) 0%, rgba(80, 200, 255, 0.06) 100%);
  border: 1px solid rgba(130, 80, 255, 0.15);
  box-shadow: 0 0 10px rgba(130, 80, 255, 0.08);
  transition:
    box-shadow 0.3s ease,
    transform 0.2s ease;

  &:hover {
    box-shadow: 0 0 20px rgba(130, 80, 255, 0.25);
    transform: translateY(-1px);
  }
}

.hero-stat-value {
  text-shadow: 0 0 8px rgba(130, 80, 255, 0.3);
}
</style>
