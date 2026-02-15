<template>
  <ResponsiveLayout :desktop-breakpoint="1024" :title="t('scratchTitle')" class="theme-chinese-lucky">
    <view class="scratch-gallery">
      <!-- Header -->
      <view class="gallery-header">
        <text class="title">{{ t("scratchSelectTicket") }}</text>
        <text class="subtitle">{{ t("scratchSubtitle") }}</text>
      </view>

      <!-- Lottery Grid -->
      <view class="lottery-grid">
        <view
          v-for="lottery in instantTypes"
          :key="lottery.key"
          class="lottery-card"
          :style="{ '--card-color': lottery.color }"
          @click="selectLottery(lottery)"
        >
          <view class="card-banner">
            <text class="lottery-name">{{ lottery.name }}</text>
            <text class="lottery-price">{{ lottery.priceDisplay }}</text>
          </view>
          <view class="card-info">
            <text class="max-prize">{{ t("maxPrize") }} {{ lottery.maxJackpotDisplay }}</text>
            <text class="description">{{ lottery.description }}</text>
          </view>
        </view>
      </view>

      <!-- My Tickets Section -->
      <view class="my-tickets" v-if="unrevealedTickets.length > 0">
        <text class="section-title">{{ t("scratchMyTickets", { count: unrevealedTickets.length }) }}</text>
        <scroll-view scroll-x class="tickets-scroll">
          <view
            v-for="ticket in unrevealedTickets"
            :key="ticket.id"
            class="ticket-item"
            @click="goToPlay(ticket.id)"
          >
            <text class="ticket-type">{{ getTypeName(ticket.type) }}</text>
            <text class="ticket-action">{{ t("scratchPlayAction") }}</text>
          </view>
        </scroll-view>
      </view>
    </view>
  </ResponsiveLayout>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { useLotteryTypes, LotteryType } from '../../shared/composables/useLotteryTypes'
import { useScratchCard } from "../../shared/composables/useScratchCard";
import { useI18n } from '../../composables/useI18n'

const { t } = useI18n()
const { instantTypes, getLotteryType } = useLotteryTypes()
const { loadPlayerTickets, unscratchedTickets, isLoading } = useScratchCard()

const unrevealedTickets = unscratchedTickets

const selectLottery = (lottery: LotteryTypeInfo) => {
  uni.navigateTo({
    url: `/pages/scratch/play?type=${lottery.type}`
  })
}

const goToPlay = (ticketId: string) => {
  uni.navigateTo({
    url: `/pages/scratch/play?ticketId=${ticketId}`
  })
}

const getTypeName = (type: number) => {
  const lottery = getLotteryType(type as LotteryType)
  return lottery?.name || t("unknown")
}

onMounted(async () => {
  // Load unrevealed tickets from contract
  try {
    await loadPlayerTickets()
  } catch {
  }
})
</script>

<style lang="scss" scoped>
@import '../../shared/styles/chinese-lucky.scss';

.scratch-gallery {
  padding: 20rpx;
  min-height: 100vh;
  background: var(--bg-primary);
}

.gallery-header {
  text-align: center;
  padding: 40rpx 0;
  .title {
    display: block;
    font-size: 48rpx;
    font-weight: bold;
    color: var(--lucky-gold-text);
  }
  .subtitle {
    font-size: 28rpx;
    color: var(--text-muted);
  }
}

.lottery-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}

.lottery-card {
  background: var(--bg-card);
  border: 2rpx solid var(--lucky-gold);
  border-radius: 16rpx;
  overflow: hidden;

  .card-banner {
    background: var(--card-color);
    padding: 30rpx;
    text-align: center;
    .lottery-name {
      display: block;
      font-size: 32rpx;
      font-weight: bold;
      color: var(--lucky-banner-text);
    }
    .lottery-price {
      font-size: 24rpx;
      color: var(--lucky-banner-muted);
    }
  }

  .card-info {
    padding: 20rpx;
    .max-prize {
      display: block;
      font-size: 28rpx;
      color: var(--lucky-gold-text);
      font-weight: bold;
    }
    .description {
      font-size: 22rpx;
      color: var(--text-muted);
    }
  }
}

.my-tickets {
  margin-top: 40rpx;
  .section-title {
    font-size: 32rpx;
    color: var(--lucky-gold-text);
    margin-bottom: 20rpx;
  }
}

.tickets-scroll {
  white-space: nowrap;
}

.ticket-item {
  display: inline-block;
  background: var(--bg-card);
  border: 2rpx solid var(--lucky-red);
  border-radius: 12rpx;
  padding: 20rpx 30rpx;
  margin-right: 20rpx;
  .ticket-type {
    display: block;
    color: var(--text-primary);
  }
  .ticket-action {
    color: var(--lucky-red-text);
    font-size: 24rpx;
  }
}
</style>
