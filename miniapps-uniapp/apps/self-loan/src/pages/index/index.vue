<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Self Loan</text>
      <text class="subtitle">Borrow against future deposits</text>
    </view>

    <view v-if="status" :class="['status-msg', status.type]"
      ><text>{{ status.msg }}</text></view
    >

    <view class="card">
      <text class="card-title">Loan Terms</text>
      <view class="row"
        ><text>Max borrow</text><text class="v">{{ fmt(terms.maxBorrow, 0) }} GAS</text></view
      >
      <view class="row"
        ><text>Interest rate</text><text class="v">{{ terms.interestRate }}% APR</text></view
      >
      <view class="row"
        ><text>Repayment</text><text class="v">{{ terms.repaymentSchedule }}</text></view
      >
    </view>

    <view class="card">
      <text class="card-title">Your Loan</text>
      <view class="row"
        ><text>Borrowed</text><text class="v">{{ fmt(loan.borrowed, 2) }} GAS</text></view
      >
      <view class="row"
        ><text>Collateral locked</text><text class="v">{{ fmt(loan.collateralLocked, 2) }} GAS</text></view
      >
      <view class="row"
        ><text>Next payment</text
        ><text class="v">{{ fmt(loan.nextPayment, 2) }} GAS in {{ loan.nextPaymentDue }}</text></view
      >
    </view>

    <view class="card">
      <text class="card-title">Take Self-Loan</text>
      <uni-easyinput v-model="loanAmount" type="number" placeholder="Amount to borrow" />
      <view class="detail-row">
        <text>Collateral required (150%)</text>
        <text class="collateral">{{ fmt(parseFloat(loanAmount || "0") * 1.5, 2) }} GAS</text>
      </view>
      <view class="detail-row">
        <text>Monthly payment</text>
        <text class="payment">{{ fmt(parseFloat(loanAmount || "0") * 0.085, 3) }} GAS</text>
      </view>
      <view class="action-btn" @click="takeLoan"
        ><text>{{ isLoading ? "Processing..." : "Borrow Now" }}</text></view
      >
      <text class="note">12-month term. Auto-deduct from future deposits.</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments } from "@neo/uniapp-sdk";
import { formatNumber } from "@/shared/utils/format";

type StatusType = "success" | "error";
type Status = { msg: string; type: StatusType };
type Terms = { maxBorrow: number; interestRate: number; repaymentSchedule: string };
type Loan = { borrowed: number; collateralLocked: number; nextPayment: number; nextPaymentDue: string };

const APP_ID = "miniapp-self-loan";
const { payGAS, isLoading } = usePayments(APP_ID);

const terms = ref<Terms>({ maxBorrow: 5000, interestRate: 8.5, repaymentSchedule: "Monthly" });
const loan = ref<Loan>({ borrowed: 0, collateralLocked: 0, nextPayment: 0, nextPaymentDue: "N/A" });
const loanAmount = ref<string>("");
const status = ref<Status | null>(null);
const fmt = (n: number, d = 2) => formatNumber(n, d);

const takeLoan = async (): Promise<void> => {
  if (isLoading.value) return;
  const amount = parseFloat(loanAmount.value);
  if (!(amount > 0 && amount <= terms.value.maxBorrow)) {
    return void (status.value = { msg: `Enter 1-${terms.value.maxBorrow}`, type: "error" });
  }
  const collateral = (amount * 1.5).toFixed(2);
  const fee = "0.015";
  try {
    await payGAS(fee, `selfloan:borrow:${amount}:collateral:${collateral}`);
    status.value = { msg: `Loan approved: ${fmt(amount, 2)} GAS borrowed`, type: "success" };
  } catch (e: any) {
    status.value = { msg: e?.message || "Payment failed", type: "error" };
  }
};
</script>

<style lang="scss">
@import "@/shared/styles/theme.scss";
.app-container {
  min-height: 100vh;
  background: linear-gradient(135deg, $color-bg-primary 0%, $color-bg-secondary 100%);
  color: #fff;
  padding: 20px;
}
.header {
  text-align: center;
  margin-bottom: 24px;
}
.title {
  font-size: 1.8em;
  font-weight: 800;
  color: $color-defi;
}
.subtitle {
  color: $color-text-secondary;
  font-size: 0.9em;
  margin-top: 8px;
}
.status-msg {
  text-align: center;
  padding: 12px;
  border-radius: 10px;
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
  padding: 18px;
  margin-bottom: 16px;
}
.card-title {
  color: $color-defi;
  font-size: 1.05em;
  font-weight: 800;
  display: block;
  margin-bottom: 10px;
}
.row {
  display: flex;
  justify-content: space-between;
  padding: 12px;
  background: rgba($color-defi, 0.1);
  border-radius: 10px;
  margin-bottom: 8px;
}
.v {
  color: $color-defi;
  font-weight: 800;
}
.detail-row {
  display: flex;
  justify-content: space-between;
  margin: 12px 0;
  color: $color-text-secondary;
}
.collateral {
  color: #f59e0b;
  font-weight: 800;
}
.payment {
  color: $color-defi;
  font-weight: 800;
}
.action-btn {
  background: linear-gradient(135deg, $color-defi 0%, darken($color-defi, 10%) 100%);
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  font-weight: 800;
}
.note {
  display: block;
  margin-top: 10px;
  font-size: 0.85em;
  color: $color-text-secondary;
}
</style>
