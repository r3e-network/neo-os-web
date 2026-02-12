<template>
  <NeoCard variant="erobo" class="map-card">
    <view class="map-container">
      <view class="coordinate-display">
        <text class="coord-label">{{ t("coordinates") }}:</text>
        <text class="coord-value">X: {{ selectedX }} / Y: {{ selectedY }}</text>
      </view>

      <view class="zoom-controls">
        <view class="zoom-btn" role="button" tabindex="0" :aria-label="t('zoomOut') || 'Zoom out'" @click="$emit('zoomOut')">
          <text aria-hidden="true">-</text>
        </view>
        <text class="zoom-level">{{ zoomLevel }}x</text>
        <view class="zoom-btn" role="button" tabindex="0" :aria-label="t('zoomIn') || 'Zoom in'" @click="$emit('zoomIn')">
          <text aria-hidden="true">+</text>
        </view>
      </view>

      <view class="pixel-map-wrapper">
        <view class="pixel-map" :style="{ transform: `scale(${zoomLevel})` }">
          <view
            v-for="(tile, i) in tiles"
            :key="i"
            :class="[
              'pixel',
              tile.owned && 'pixel-owned',
              tile.selected && 'pixel-selected',
              tile.isYours && 'pixel-yours',
            ]"
            :style="{ backgroundColor: getTileColor(tile) }"
            role="button"
            tabindex="0"
            :aria-label="`${t('coordinates')} ${i} — ${tile.isYours ? t('yourTerritory') : tile.owned ? t('othersTerritory') : t('available')}`"
            @click="$emit('selectTile', i)"
          >
            <view v-if="tile.selected" class="pixel-cursor"></view>
          </view>
        </view>
      </view>

      <view class="map-legend">
        <view class="legend-item">
          <view class="legend-color legend-available"></view>
          <text class="legend-text">{{ t("available") }}</text>
        </view>
        <view class="legend-item">
          <view class="legend-color legend-yours"></view>
          <text class="legend-text">{{ t("yourTerritory") }}</text>
        </view>
        <view class="legend-item">
          <view class="legend-color legend-others"></view>
          <text class="legend-text">{{ t("othersTerritory") }}</text>
        </view>
      </view>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";
import type { Tile } from "@/composables/useMapTiles";

defineProps<{
  tiles: Tile[];
  selectedX: number;
  selectedY: number;
  zoomLevel: number;
  getTileColor: (tile: Tile) => string;
  t: (key: string) => string;
}>();

defineEmits(["selectTile", "zoomIn", "zoomOut"]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.map-card {
  border: 4px solid var(--map-border);
  border-radius: 4px;
  background: var(--map-bg);
  box-shadow: var(--map-shadow);
  position: relative;

  &::after {
    content: "X";
    position: absolute;
    top: 10px;
    right: 10px;
    font-family: "Times New Roman", serif;
    font-weight: bold;
    color: var(--map-red);
    font-size: 24px;
    opacity: 0.5;
    pointer-events: none;
  }
}

.pixel-map-wrapper {
  background: var(--map-tile-bg);
  border: 2px dashed var(--map-border);
  border-radius: 4px;
  padding: 16px;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: auto;
  box-shadow: var(--map-panel-shadow);
}

.pixel-map {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 2px;
}

.pixel {
  width: 32px;
  height: 32px;
  border: 1px solid var(--map-tile-border);
  cursor: pointer;
  background: var(--map-paper);
  transition: all 0.2s;

  &.pixel-selected {
    border: 3px solid var(--map-red);
    transform: scale(1.1);
    z-index: 20;
    position: relative;
    &::after {
      content: "X";
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: var(--map-red);
      font-weight: bold;
      font-size: 20px;
      line-height: 1;
    }
  }
  &.pixel-yours {
    background-color: var(--map-gold) !important;
    border: 1px solid var(--map-border);
  }
}

.coordinate-display {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--map-paper);
  color: var(--map-ink);
  border: 1px solid var(--map-border);
  border-radius: 4px;
  font-family: "Courier New", monospace;
  font-weight: 700;
  font-size: 14px;
  margin-bottom: 12px;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  justify-content: center;
}

.zoom-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--map-paper);
  color: var(--map-ink);
  border: 1px solid var(--map-border);
  border-radius: 50%;
  cursor: pointer;
  font-weight: bold;
}

.zoom-level {
  font-family: "Courier New", monospace;
  font-weight: 700;
  min-width: 40px;
  text-align: center;
}

.map-legend {
  display: flex;
  gap: 12px;
  justify-content: center;
  padding: 8px;
  background: var(--map-paper);
  border: 1px solid var(--map-border);
  border-radius: 4px;
  margin-top: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.legend-color {
  width: 12px;
  height: 12px;
  border: 1px solid var(--map-border);

  &.legend-available {
    background: var(--map-paper);
  }
  &.legend-yours {
    background: var(--map-gold);
  }
  &.legend-others {
    background: var(--neo-orange);
  }
}

.legend-text {
  font-size: 11px;
  font-weight: 600;
}
</style>
