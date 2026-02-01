<template>
  <view 
    :class="[
      'responsive-card',
      `variant-${variant}`,
      `size-${size}`,
      { 'hoverable': hoverable, 'clickable': clickable, 'full-width': fullWidth }
    ]"
    :style="customStyles"
    @click="handleClick"
    @touchstart="handleTouchStart"
    @touchend="handleTouchEnd"
  >
    <!-- Card Header -->
    <view v-if="$slots.header || title" class="card-header">
      <slot name="header">
        <view class="header-content">
          <view v-if="icon" class="header-icon">
            <AppIcon :name="icon" :size="iconSize" />
          </view>
          <view class="header-text">
            <text v-if="title" class="card-title">{{ title }}</text>
            <text v-if="subtitle" class="card-subtitle">{{ subtitle }}</text>
          </view>
        </view>
        <view v-if="$slots.headerActions" class="header-actions">
          <slot name="headerActions" />
        </view>
      </slot>
    </view>
    
    <!-- Card Media -->
    <view v-if="$slots.media || image" class="card-media">
      <slot name="media">
        <image 
          v-if="image" 
          :src="image" 
          :mode="imageMode" 
          class="media-image"
          @error="handleImageError"
        />
      </slot>
    </view>
    
    <!-- Card Content -->
    <view :class="['card-content', { 'no-padding': noPadding }]">
      <slot />
    </view>
    
    <!-- Card Footer -->
    <view v-if="$slots.footer" class="card-footer">
      <slot name="footer" />
    </view>
    
    <!-- Loading Overlay -->
    <view v-if="loading" class="loading-overlay">
      <view class="loading-spinner" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from './AppIcon.vue';

/**
 * ResponsiveCard Component
 * 
 * A card component that adapts its layout and styling based on screen size.
 * Provides consistent card patterns across mobile and desktop views.
 * 
 * @example
 * ```vue
 * <ResponsiveCard 
 *   title="Card Title"
 *   subtitle="Card subtitle"
 *   variant="default"
 *   size="md"
 *   hoverable
 * >
 *   <p>Card content goes here</p>
 *   <template #footer>
 *     <button>Action</button>
 *   </template>
 * </ResponsiveCard>
 * ```
 */

interface Props {
  /** Card title */
  title?: string;
  /** Card subtitle */
  subtitle?: string;
  /** Icon name (from AppIcon) */
  icon?: string;
  /** Image URL for card media */
  image?: string;
  /** Image display mode */
  imageMode?: 'scaleToFill' | 'aspectFit' | 'aspectFill' | 'widthFix' | 'heightFix' | 'top' | 'bottom' | 'center' | 'left' | 'right' | 'top left' | 'top right' | 'bottom left' | 'bottom right';
  /** Visual variant */
  variant?: 'default' | 'elevated' | 'outlined' | 'filled' | 'glass';
  /** Size preset */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Whether card can be hovered */
  hoverable?: boolean;
  /** Whether card is clickable */
  clickable?: boolean;
  /** Whether card takes full width */
  fullWidth?: boolean;
  /** Whether to remove default padding */
  noPadding?: boolean;
  /** Show loading state */
  loading?: boolean;
  /** Custom background color */
  bgColor?: string;
  /** Custom border color */
  borderColor?: string;
  /** Custom shadow */
  shadow?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  subtitle: '',
  icon: '',
  image: '',
  imageMode: 'aspectFill',
  variant: 'default',
  size: 'md',
  hoverable: false,
  clickable: false,
  fullWidth: false,
  noPadding: false,
  loading: false,
  bgColor: '',
  borderColor: '',
  shadow: '',
});

const emit = defineEmits<{
  (e: 'click', event: Event): void;
  (e: 'imageError', event: Event): void;
}>();

// Icon size based on card size
const iconSize = computed(() => {
  const sizes = { sm: 16, md: 20, lg: 24, xl: 28 };
  return sizes[props.size];
});

// Custom styles
const customStyles = computed(() => {
  const styles: Record<string, string> = {};
  if (props.bgColor) styles['--card-bg'] = props.bgColor;
  if (props.borderColor) styles['--card-border'] = props.borderColor;
  if (props.shadow) styles['--card-shadow'] = props.shadow;
  return styles;
});

// Handle click
const handleClick = (event: Event) => {
  if (props.clickable) {
    emit('click', event);
  }
};

// Handle touch for mobile feedback
const handleTouchStart = (event: TouchEvent) => {
  if (props.clickable) {
    const target = event.currentTarget as HTMLElement;
    target?.classList.add('touch-active');
  }
};

const handleTouchEnd = (event: TouchEvent) => {
  const target = event.currentTarget as HTMLElement;
  target?.classList.remove('touch-active');
};

// Handle image error
const handleImageError = (event: Event) => {
  emit('imageError', event);
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/responsive.scss" as responsive;

// ============================================================================
// Base Card Styles
// ============================================================================

.responsive-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--card-bg, var(--bg-secondary, rgba(255, 255, 255, 0.05)));
  border-radius: var(--radius-lg, 12px);
  border: 1px solid var(--card-border, var(--border-color, rgba(255, 255, 255, 0.1)));
  transition: all var(--transition-normal, 0.25s ease);
  overflow: hidden;
  
  // Prevent text selection on clickable cards
  &.clickable {
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    
    &:active, &.touch-active {
      transform: scale(0.98);
    }
  }
  
  // Hover effect (desktop only)
  &.hoverable {
    @include responsive.mouse {
      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
      }
    }
  }
  
  // Full width
  &.full-width {
    width: 100%;
  }
}

// ============================================================================
// Size Variants
// ============================================================================

// Small
.size-sm {
  .card-header {
    padding: 12px 16px;
  }
  
  .card-content {
    padding: 12px 16px;
  }
  
  .card-footer {
    padding: 12px 16px;
  }
  
  .card-title {
    font-size: 14px;
  }
  
  .card-subtitle {
    font-size: 12px;
  }
}

// Medium (default)
.size-md {
  .card-header {
    padding: 16px 20px;
    
    @include responsive.desktop {
      padding: 20px 24px;
    }
  }
  
  .card-content {
    padding: 16px 20px;
    
    @include responsive.desktop {
      padding: 20px 24px;
    }
  }
  
  .card-footer {
    padding: 16px 20px;
    
    @include responsive.desktop {
      padding: 20px 24px;
    }
  }
  
  .card-title {
    font-size: 16px;
    
    @include responsive.desktop {
      font-size: 18px;
    }
  }
  
  .card-subtitle {
    font-size: 13px;
    
    @include responsive.desktop {
      font-size: 14px;
    }
  }
}

// Large
.size-lg {
  .card-header {
    padding: 20px 24px;
    
    @include responsive.desktop {
      padding: 24px 32px;
    }
  }
  
  .card-content {
    padding: 20px 24px;
    
    @include responsive.desktop {
      padding: 24px 32px;
    }
  }
  
  .card-footer {
    padding: 20px 24px;
    
    @include responsive.desktop {
      padding: 24px 32px;
    }
  }
  
  .card-title {
    font-size: 18px;
    
    @include responsive.desktop {
      font-size: 20px;
    }
  }
  
  .card-subtitle {
    font-size: 14px;
    
    @include responsive.desktop {
      font-size: 15px;
    }
  }
}

// Extra Large
.size-xl {
  .card-header {
    padding: 24px 32px;
    
    @include responsive.desktop {
      padding: 32px 40px;
    }
  }
  
  .card-content {
    padding: 24px 32px;
    
    @include responsive.desktop {
      padding: 32px 40px;
    }
  }
  
  .card-footer {
    padding: 24px 32px;
    
    @include responsive.desktop {
      padding: 32px 40px;
    }
  }
  
  .card-title {
    font-size: 20px;
    
    @include responsive.desktop {
      font-size: 24px;
    }
  }
  
  .card-subtitle {
    font-size: 15px;
    
    @include responsive.desktop {
      font-size: 16px;
    }
  }
}

// ============================================================================
// Visual Variants
// ============================================================================

.variant-default {
  // Default styles already applied
}

.variant-elevated {
  box-shadow: var(--card-shadow, 0 4px 12px rgba(0, 0, 0, 0.1));
  border: none;
  
  @include responsive.desktop {
    box-shadow: var(--card-shadow, 0 8px 24px rgba(0, 0, 0, 0.12));
  }
}

.variant-outlined {
  background: transparent;
  border: 2px solid var(--card-border, var(--border-color, rgba(255, 255, 255, 0.15)));
}

.variant-filled {
  background: var(--card-bg, var(--bg-primary, rgba(255, 255, 255, 0.1)));
  border: none;
}

.variant-glass {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

// ============================================================================
// Card Header
// ============================================================================

.card-header {
  border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.06));
  
  .header-content {
    display: flex;
    align-items: center;
    gap: 12px;
    
    @include responsive.desktop {
      gap: 16px;
    }
  }
  
  .header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md, 10px);
    background: var(--bg-tertiary, rgba(255, 255, 255, 0.05));
    flex-shrink: 0;
    
    @include responsive.desktop {
      width: 48px;
      height: 48px;
    }
  }
  
  .header-text {
    flex: 1;
    min-width: 0;
  }
  
  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

.card-title {
  display: block;
  font-weight: 600;
  color: var(--text-primary, #fff);
  line-height: 1.3;
}

.card-subtitle {
  display: block;
  color: var(--text-secondary, rgba(255, 255, 255, 0.6));
  line-height: 1.4;
  margin-top: 4px;
}

// ============================================================================
// Card Media
// ============================================================================

.card-media {
  width: 100%;
  overflow: hidden;
  
  .media-image {
    width: 100%;
    height: 180px;
    object-fit: cover;
    
    @include responsive.tablet-up {
      height: 220px;
    }
    
    @include responsive.desktop {
      height: 280px;
    }
  }
}

// ============================================================================
// Card Content
// ============================================================================

.card-content {
  flex: 1;
  
  &.no-padding {
    padding: 0;
  }
}

// ============================================================================
// Card Footer
// ============================================================================

.card-footer {
  border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.06));
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

// ============================================================================
// Loading State
// ============================================================================

.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  border-radius: inherit;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: var(--accent-primary, #3b82f6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

// Respect reduced motion
@media (prefers-reduced-motion: reduce) {
  .loading-spinner {
    animation: none;
    border-top-color: rgba(255, 255, 255, 0.5);
  }
}
</style>
