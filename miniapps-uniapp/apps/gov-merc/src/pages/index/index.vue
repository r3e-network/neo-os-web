<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Vote Mercenary</text>
      <text class="subtitle">Rent your voting power</text>
    </view>

    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>

    <view class="card">
      <view class="stats-grid">
        <view class="stat-box">
          <text class="stat-value">{{ formatNum(votingPower) }}</text>
          <text class="stat-label">Your VP</text>
        </view>
        <view class="stat-box">
          <text class="stat-value">{{ formatNum(earned) }}</text>
          <text class="stat-label">Earned</text>
        </view>
        <view class="stat-box">
          <text class="stat-value">{{ activeRentals }}</text>
          <text class="stat-label">Rentals</text>
        </view>
      </view>
    </view>

    <view class="card">
      <text class="card-title">Rent Out Your Votes</text>
      <uni-easyinput v-model="rentAmount" type="number" placeholder="Voting power to rent" />
      <uni-easyinput v-model="rentPrice" type="number" placeholder="Price per vote (GAS)" />
      <view class="duration-row">
        <view
          v-for="d in durations"
          :key="d.hours"
          :class="['duration-btn', rentDuration === d.hours && 'active']"
          @click="rentDuration = d.hours"
        >
          <text>{{ d.label }}</text>
        </view>
      </view>
      <view class="list-btn" @click="listVotes" :style="{ opacity: isLoading ? 0.6 : 1 }">
        <text>{{ isLoading ? "Listing..." : "List for Rent" }}</text>
      </view>
    </view>

    <view class="card">
      <text class="card-title">Available Rentals</text>
      <view class="rentals-list">
        <text v-if="rentals.length === 0" class="empty">No rentals available</text>
        <view v-for="(r, i) in rentals" :key="i" class="rental-item">
          <view class="rental-header">
            <text class="rental-power">{{ r.power }} VP</text>
            <text class="rental-price">{{ r.price }} GAS</text>
          </view>
          <view class="rental-meta">
            <text class="rental-duration">{{ r.duration }}</text>
            <text class="rental-owner">{{ r.owner }}</text>
          </view>
          <view class="rent-btn" @click="rentVotes(r.id)">
            <text>Rent Now</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments } from "@neo/uniapp-sdk";
import { formatNumber } from "@/shared/utils/format";

const APP_ID = "miniapp-gov-merc";

interface Rental {
  id: number;
  power: number;
  price: number;
  duration: string;
  owner: string;
}

const { payGAS, isLoading } = usePayments(APP_ID);

const rentAmount = ref("100");
const rentPrice = ref("0.5");
const rentDuration = ref(24);
const votingPower = ref(1000);
const earned = ref(12.5);
const activeRentals = ref(2);
const status = ref<{ msg: string; type: string } | null>(null);

const durations = [
  { hours: 6, label: "6h" },
  { hours: 24, label: "24h" },
  { hours: 72, label: "3d" },
  { hours: 168, label: "7d" },
];

const rentals = ref<Rental[]>([
  { id: 1, power: 500, price: 2.5, duration: "24h", owner: "0x1a2b...3c4d" },
  { id: 2, power: 1000, price: 4.0, duration: "3d", owner: "0x5e6f...7g8h" },
]);

const formatNum = (n: number) => formatNumber(n, 1);

const listVotes = async () => {
  if (isLoading.value) return;
  const amount = parseFloat(rentAmount.value);
  if (amount < 10) {
    status.value = { msg: "Min: 10 VP", type: "error" };
    return;
  }
  try {
    status.value = { msg: "Listing votes...", type: "loading" };
    await payGAS("0.1", `list:${rentAmount.value}:${rentPrice.value}:${rentDuration.value}`);
    activeRentals.value++;
    status.value = { msg: "Listed successfully!", type: "success" };
  } catch (e: any) {
    status.value = { msg: e.message || "Error", type: "error" };
  }
};

const rentVotes = async (id: number) => {
  try {
    status.value = { msg: "Renting votes...", type: "loading" };
    const rental = rentals.value.find((r) => r.id === id);
    if (rental) {
      await payGAS(String(rental.price), `rent:${id}`);
      votingPower.value += rental.power;
      status.value = { msg: `Rented ${rental.power} VP!`, type: "success" };
    }
  } catch (e: any) {
    status.value = { msg: e.message || "Error", type: "error" };
  }
};
</script>

<style lang="scss">
@import "@/shared/styles/theme.scss";

.app-container {
  min-height: 100vh;
  background: linear-gradient(135deg, $color-bg-primary 0%, $color-bg-secondary 100%);
  color: $color-text-primary;
  padding: 20px;
}

.header {
  text-align: center;
  margin-bottom: 24px;
}
.title {
  font-size: 1.8em;
  font-weight: bold;
  color: $color-governance;
}
.subtitle {
  color: $color-text-secondary;
  font-size: 0.9em;
  margin-top: 8px;
}

.status-msg {
  text-align: center;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 16px;
  &.success {
    background: rgba($color-success, 0.15);
    color: $color-success;
  }
  &.error {
    background: rgba($color-error, 0.15);
    color: $color-error;
  }
}

.card {
  background: $color-bg-card;
  border: 1px solid $color-border;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
}

.card-title {
  color: $color-governance;
  font-size: 1.1em;
  font-weight: bold;
  display: block;
  margin-bottom: 12px;
}

.stats-grid {
  display: flex;
  gap: 8px;
}
.stat-box {
  flex: 1;
  text-align: center;
  background: rgba($color-governance, 0.1);
  border-radius: 8px;
  padding: 12px;
}
.stat-value {
  color: $color-governance;
  font-size: 1.2em;
  font-weight: bold;
  display: block;
}
.stat-label {
  color: $color-text-secondary;
  font-size: 0.8em;
}

.duration-row {
  display: flex;
  gap: 8px;
  margin: 16px 0;
}
.duration-btn {
  flex: 1;
  padding: 12px;
  text-align: center;
  background: rgba($color-governance, 0.1);
  border: 2px solid transparent;
  border-radius: 8px;
  &.active {
    border-color: $color-governance;
    background: rgba($color-governance, 0.2);
  }
}

.list-btn {
  background: linear-gradient(135deg, $color-governance 0%, darken($color-governance, 10%) 100%);
  color: #fff;
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  font-weight: bold;
}

.rentals-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.empty {
  color: $color-text-secondary;
  text-align: center;
}
.rental-item {
  padding: 14px;
  background: rgba($color-governance, 0.05);
  border-radius: 12px;
}
.rental-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}
.rental-power {
  color: $color-governance;
  font-weight: bold;
  font-size: 1.1em;
}
.rental-price {
  color: $color-text-primary;
  font-weight: bold;
}
.rental-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.85em;
  margin-bottom: 10px;
}
.rental-duration {
  color: $color-text-secondary;
}
.rental-owner {
  color: $color-text-secondary;
}
.rent-btn {
  background: rgba($color-governance, 0.2);
  color: $color-governance;
  padding: 10px;
  border-radius: 8px;
  text-align: center;
  font-weight: bold;
}
</style>
