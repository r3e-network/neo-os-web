<template>
  <view
    :class="['tarot-card', { flipped: card.flipped }]"
    @click="$emit('flip')"
  >
    <view class="card-inner">
      <!-- Card Front (Revealed) -->
      <view v-if="card.flipped" class="card-face card-front" :class="card.suit">
        <view class="card-border-decoration">
          <text class="corner-star top-left">✦</text>
          <text class="corner-star top-right">✦</text>
          <text class="corner-star bottom-left">✦</text>
          <text class="corner-star bottom-right">✦</text>
        </view>
        
        <view class="card-content">
           <view class="card-header">
              <text class="card-number" v-if="card.suit === 'major'">{{ toRoman(card.id) }}</text>
              <text class="card-number" v-else>{{ toRoman(card.number || 0) }}</text>
           </view>
           
           <view class="card-main-symbol">
              <CardFace :suit="card.suit" :number="card.number" :icon="card.icon" />
           </view>
           
           <view class="card-footer">
              <text class="card-name">{{ card.name }}</text>
              <view class="blockchain-hash">
                 <text class="hash-text">Block: #{{ 1000 + card.id }}</text>
              </view>
           </view>
        </view>
      </view>

      <!-- Card Back (Hidden) -->
      <view v-else class="card-face card-back">
        <view class="card-back-pattern">
          <view class="neo-logo-container">
             <!-- Neo N3 Logo SVG -->
             <svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M168 356V156h52l124 152V156h52v200h-52L220 208v148z" fill="#00E599" />
             </svg>
          </view>
          <text class="pattern-stars">✨</text>
          <text class="pattern-text">NEO TAROT</text>
          <text class="pattern-stars">✨</text>
        </view>
        
        <!-- Circuit Lines Decoration -->
        <view class="circuit-lines">
           <view class="line line-1"></view>
           <view class="line line-2"></view>
           <view class="line line-3"></view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import CardFace from './CardFace.vue';

export interface Card {
  id: number;
  name: string;
  icon: string;
  flipped: boolean;
  suit?: string;
  number?: number;
}

const props = defineProps<{
  card: Card;
}>();

defineEmits(["flip"]);

const toRoman = (num: number): string => {
   if (num === 0) return "0";
   const lookup: Record<string, number> = {M:1000,CM:900,D:500,CD:400,C:100,XC:90,L:50,XL:40,X:10,IX:9,V:5,IV:4,I:1};
   let roman = '';
   for ( let i in lookup ) {
      while ( num >= lookup[i] ) {
         roman += i;
         num -= lookup[i];
      }
   }
   return roman;
}
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

$card-width: 110px;
$card-height: 170px;
$primary-color: #00E599; // Neo Green
$accent-color: #582CA9; // Deep Purple

.tarot-card {
  width: $card-width;
  height: $card-height;
  perspective: 1000px;
  cursor: pointer;
  position: relative;
  
  &:hover .card-inner {
     box-shadow: 0 0 20px rgba($primary-color, 0.4);
  }
}

.card-inner {
  position: relative;
  width: 100%;
  height: 100%;
  text-align: center;
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  transform-style: preserve-3d;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.5);
}

.tarot-card.flipped .card-inner {
  transform: rotateY(180deg);
}

.card-face {
  position: absolute;
  width: 100%;
  height: 100%;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* Front Style */
.card-front {
  background: linear-gradient(135deg, rgba(20, 10, 40, 0.95) 0%, rgba(40, 20, 70, 0.95) 100%);
  transform: rotateY(180deg); // Initially hidden
  padding: 8px;
  box-shadow: inset 0 0 15px rgba($primary-color, 0.2);
  border: 1px solid rgba($primary-color, 0.5);
  
  &.wands { border-color: rgba(255, 95, 95, 0.5); box-shadow: inset 0 0 15px rgba(255, 95, 95, 0.2); }
  &.cups { border-color: rgba(95, 175, 255, 0.5); box-shadow: inset 0 0 15px rgba(95, 175, 255, 0.2); }
  &.pentacles { border-color: rgba(255, 215, 0, 0.5); box-shadow: inset 0 0 15px rgba(255, 215, 0, 0.2); }
  &.swords { border-color: rgba(224, 224, 224, 0.5); box-shadow: inset 0 0 15px rgba(224, 224, 224, 0.2); }

  .card-border-decoration {
    position: absolute;
    top: 4px; left: 4px; right: 4px; bottom: 4px;
    border: 1px solid rgba($primary-color, 0.3);
    border-radius: 8px;
    pointer-events: none;
  }
}

.corner-star {
   position: absolute;
   font-size: 8px;
   color: $primary-color;
   opacity: 0.8;
}
.top-left { top: 6px; left: 6px; }
.top-right { top: 6px; right: 6px; }
.bottom-left { bottom: 6px; left: 6px; }
.bottom-right { bottom: 6px; right: 6px; }

.card-content {
   display: flex;
   flex-direction: column;
   height: 100%;
   width: 100%;
   justify-content: space-between;
   padding: 12px 0;
   z-index: 1;
}

.card-header {
   height: 20px;
}

.card-number {
   font-family: 'Courier New', monospace;
   font-size: 12px;
   color: rgba(255,255,255,0.7);
   letter-spacing: 1px;
}

.card-main-symbol {
   flex: 1;
   display: flex;
   align-items: center;
   justify-content: center;
}

.symbol-text {
   font-size: 48px;
   filter: drop-shadow(0 0 10px rgba(255,255,255,0.4));
   animation: float 4s ease-in-out infinite;
}

.card-footer {
   display: flex;
   flex-direction: column;
   gap: 4px;
}

.card-name {
   font-size: 10px;
   font-weight: bold;
   text-transform: uppercase;
   color: #fff;
   letter-spacing: 0.05em;
   background: rgba($accent-color, 0.4);
   padding: 4px;
   border-radius: 4px;
}

.blockchain-hash {
   font-family: 'Courier New', monospace;
   font-size: 6px;
   color: rgba($primary-color, 0.7);
   opacity: 0.6;
}

/* Back Style */
.card-back {
  background: linear-gradient(135deg, #1a0b2e 0%, #000000 100%);
  border: 1px solid rgba($primary-color, 0.3);
  
  .pattern-text {
     font-size: 8px;
     letter-spacing: 2px;
     color: rgba(255,255,255,0.5);
     margin-top: 8px;
  }
  
  .neo-logo-container {
     width: 50px;
     height: 50px;
     filter: drop-shadow(0 0 8px rgba($primary-color, 0.6));
     
     svg {
       width: 100%;
       height: 100%;
     }
  }
}

.card-back-pattern {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 2;
  gap: 4px;
}

.pattern-stars {
   font-size: 10px;
   opacity: 0.5;
}

/* Circuit Decoration */
.circuit-lines {
   position: absolute;
   top: 0; left: 0; width: 100%; height: 100%;
   opacity: 0.2;
   pointer-events: none;
   
   .line {
      position: absolute;
      background: $primary-color;
   }
   
   .line-1 { width: 1px; height: 30%; top: 0; left: 20%; }
   .line-2 { width: 40%; height: 1px; bottom: 20%; right: 0; }
   .line-3 { width: 1px; height: 20%; bottom: 0; right: 30%; }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
</style>
