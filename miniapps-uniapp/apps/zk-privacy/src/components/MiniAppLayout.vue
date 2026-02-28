<template>
  <view class="miniapp-layout">
    <!-- Main Content Wrapper -->
    <view class="layout-wrapper">
      
      <!-- Left Major Panel -->
      <view class="left-column">
        <!-- Playfield Area -->
        <view class="playfield-container panel-card">
          <slot name="playfield"></slot>
        </view>

        <!-- Information Area (Below Playfield) -->
        <view class="info-container panel-card">
          <view class="info-tabs">
            <view 
              v-for="tab in tabs" 
              :key="tab.id"
              class="tab-item" 
              :class="{ active: activeTab === tab.id }"
              @click="activeTab = tab.id"
            >
              {{ tab.label }}
            </view>
          </view>

          <view class="tab-content">
            <view v-show="activeTab === 'intro'" class="content-pane">
              <slot name="intro">
                <view class="empty-state">No introduction provided.</view>
              </slot>
            </view>
            <view v-show="activeTab === 'info'" class="content-pane">
              <slot name="info">
                <view class="empty-state">No detailed information available.</view>
              </slot>
            </view>
            <view v-show="activeTab === 'reviews'" class="content-pane">
              <slot name="reviews">
                <view class="empty-state">No reviews yet.</view>
              </slot>
            </view>
            <view v-show="activeTab === 'comments'" class="content-pane">
              <slot name="comments">
                <view class="empty-state">No comments.</view>
              </slot>
            </view>
          </view>
        </view>
      </view>

      <!-- Right Operations Panel -->
      <view class="right-column">
        <view class="operations-container panel-card sticky-panel">
          <slot name="operations"></slot>
        </view>
      </view>

    </view>
  </view>
</template>

<script lang="ts" setup>
import { ref } from 'vue';

const activeTab = ref('intro');

const tabs = [
  { id: 'intro', label: 'Introduction' },
  { id: 'info', label: 'Information' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'comments', label: 'Comments' }
];
</script>

<style scoped>
/* Base Layout Variables & Resets */
.miniapp-layout {
  background-color: #f7f9fc;
  min-height: 100vh;
  padding: 24px 16px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.layout-wrapper {
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Responsive Grid / Flex Layout */
@media (min-width: 992px) {
  .layout-wrapper {
    flex-direction: row;
    align-items: flex-start;
  }
  
  .left-column {
    flex: 1;
    min-width: 0; /* Prevents flex flex-wrap blowout */
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  
  .right-column {
    width: 380px;
    flex-shrink: 0;
  }
  
  /* Make the right panel stick on scroll */
  .sticky-panel {
    position: sticky;
    top: 24px;
  }
}

/* Beautiful Elegant Card Styling */
.panel-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.02);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

/* Playfield Specific */
.playfield-container {
  min-height: 400px; /* Ensures major presence */
  display: flex;
  flex-direction: column;
}

/* Information Tabs */
.info-container {
  min-height: 300px;
  padding: 0; /* Override padding for edge-to-edge tabs */
  overflow: hidden;
}

.info-tabs {
  display: flex;
  border-bottom: 1px solid #edf2f7;
  background: #fafbfc;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 16px 12px;
  font-size: 15px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  position: relative;
  transition: color 0.2s ease;
}

.tab-item:hover {
  color: #0f172a;
  background: rgba(0, 0, 0, 0.01);
}

.tab-item.active {
  color: #007aff;
}

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background-color: #007aff;
  border-radius: 3px 3px 0 0;
}

.tab-content {
  padding: 24px;
}

.content-pane {
  animation: fadeIn 0.3s ease;
}

.empty-state {
  text-align: center;
  color: #94a3b8;
  padding: 40px 0;
  font-size: 14px;
}

/* Operations Panel */
.operations-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Utilities */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
