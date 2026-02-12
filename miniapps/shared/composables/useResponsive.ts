import { ref, computed, onMounted, onUnmounted } from "vue";

const DEFAULT_BREAKPOINTS = { sm: 480, md: 768, lg: 1024, xl: 1280 };

export function useResponsive(breakpoints = DEFAULT_BREAKPOINTS) {
  const windowWidth = ref(typeof window !== "undefined" ? window.innerWidth : breakpoints.lg);
  const windowHeight = ref(typeof window !== "undefined" ? window.innerHeight : 800);
  const devicePixelRatio = ref(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);

  const isMobile = computed(() => windowWidth.value < breakpoints.md);
  const isTablet = computed(() => windowWidth.value >= breakpoints.md && windowWidth.value < breakpoints.lg);
  const isDesktop = computed(() => windowWidth.value >= breakpoints.lg);
  const isLargeDesktop = computed(() => windowWidth.value >= breakpoints.xl);
  const isPortrait = computed(() => windowHeight.value >= windowWidth.value);
  const isLandscape = computed(() => windowWidth.value > windowHeight.value);

  const containerClasses = computed(() => ({
    "is-mobile": isMobile.value,
    "is-tablet": isTablet.value,
    "is-desktop": isDesktop.value,
    "is-large-desktop": isLargeDesktop.value,
    "is-portrait": isPortrait.value,
    "is-landscape": isLandscape.value,
    "is-retina": devicePixelRatio.value > 1,
  }));

  const updateDimensions = () => {
    if (typeof window !== "undefined") {
      windowWidth.value = window.innerWidth;
      windowHeight.value = window.innerHeight;
      devicePixelRatio.value = window.devicePixelRatio || 1;
    }
  };

  onMounted(() => {
    window.addEventListener("resize", updateDimensions);
    window.addEventListener("orientationchange", updateDimensions);
    updateDimensions();
  });

  onUnmounted(() => {
    window.removeEventListener("resize", updateDimensions);
    window.removeEventListener("orientationchange", updateDimensions);
  });

  return {
    windowWidth,
    windowHeight,
    devicePixelRatio,
    isMobile,
    isTablet,
    isDesktop,
    isLargeDesktop,
    isPortrait,
    isLandscape,
    containerClasses,
  };
}
