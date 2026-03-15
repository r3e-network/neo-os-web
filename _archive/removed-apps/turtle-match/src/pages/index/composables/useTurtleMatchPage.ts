import { ref, computed, onMounted, onUnmounted } from "vue";
import type { StatsDisplayItem } from "@shared/components";
import { useTurtleGame, TurtleColor } from "@/composables/useTurtleGame";
import { useTurtleMatching } from "@/composables/useTurtleMatching";
import { formatGas } from "@shared/utils/format";

const APP_ID = "miniapp-turtle-match";

export function useTurtleMatchPage(t: (key: string) => string) {
  const {
    loading,
    error,
    session,
    stats,
    isConnected,
    hasActiveSession,
    gamePhase,
    connect,
    loadStats,
    startGame,
    settleGame,
  } = useTurtleGame(APP_ID);

  const {
    localGame,
    matchedPairRef,
    remainingBoxes,
    currentReward,
    currentMatches,
    gridTurtles,
    initGame,
    processGameStep,
    resetLocalGame,
  } = useTurtleMatching();

  // UI animation state
  const boxCount = ref(5);
  const showSplash = ref(true);
  const showBlindbox = ref(false);
  const showCelebration = ref(false);
  const showResult = ref(false);
  const currentTurtleColor = ref<TurtleColor>(TurtleColor.Green);
  const matchColor = ref<TurtleColor>(TurtleColor.Green);
  const matchReward = ref<bigint>(BigInt(0));
  const isAutoPlaying = ref(false);

  let autoPlayKickoffTimer: ReturnType<typeof setTimeout> | null = null;
  let activeDelayTimer: ReturnType<typeof setTimeout> | null = null;
  let componentUnmounted = false;

  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      activeDelayTimer = setTimeout(() => {
        activeDelayTimer = null;
        resolve();
      }, ms);
    });
  }

  // Computed display data
  const appState = computed(() => ({}));

  const playerStatsItems = computed<StatsDisplayItem[]>(() => [
    { label: t("totalSessions"), value: stats.value?.totalSessions || 0, icon: "\uD83D\uDCC5" },
    { label: t("totalRewards"), value: `${formatGas(stats.value?.totalPaid || 0n, 3)} GAS`, icon: "\uD83D\uDC8E" },
  ]);

  const opStats = computed<StatsDisplayItem[]>(() => [
    { label: t("totalSessions"), value: stats.value?.totalSessions ?? 0 },
    { label: t("matches"), value: currentMatches.value },
    { label: t("remainingBoxes"), value: remainingBoxes.value },
    { label: t("phase"), value: gamePhase.value },
  ]);

  // Game handlers
  async function handleStartGame() {
    gamePhase.value = "playing";
    const sessionId = await startGame(boxCount.value);
    if (sessionId && session.value) {
      initGame(session.value);
      autoPlayKickoffTimer = setTimeout(() => {
        autoPlayKickoffTimer = null;
        autoPlay();
      }, 500);
    } else {
      gamePhase.value = "idle";
    }
  }

  async function autoPlay() {
    if (!localGame.value || isAutoPlaying.value) return;
    isAutoPlaying.value = true;

    while (!localGame.value.isComplete && !componentUnmounted) {
      showBlindbox.value = true;
      const result = await processGameStep();
      if (componentUnmounted) break;

      if (result.turtle) {
        currentTurtleColor.value = result.turtle.color;
      }

      await delay(2000);
      if (componentUnmounted) break;
      showBlindbox.value = false;

      if (result.matches > 0) {
        matchColor.value = currentTurtleColor.value;
        matchReward.value = result.reward;
        showCelebration.value = true;
        await delay(2500);
        if (componentUnmounted) break;
        showCelebration.value = false;
      }

      await delay(300);
      if (componentUnmounted) break;
    }

    if (!componentUnmounted) {
      isAutoPlaying.value = false;
      gamePhase.value = "settling";
      showResult.value = true;
    }
  }

  async function handleSettle() {
    const success = await settleGame();
    if (success) {
      gamePhase.value = "complete";
    }
  }

  function handleNewGame() {
    resetLocalGame();
    gamePhase.value = "idle";
  }

  // Lifecycle
  onMounted(() => {
    loadStats();
  });

  onUnmounted(() => {
    componentUnmounted = true;
    if (autoPlayKickoffTimer) clearTimeout(autoPlayKickoffTimer);
    if (activeDelayTimer) clearTimeout(activeDelayTimer);
  });

  return {
    // State from useTurtleGame
    loading,
    error,
    session,
    stats,
    isConnected,
    hasActiveSession,
    gamePhase,
    connect,
    loadStats,
    // State from useTurtleMatching
    matchedPairRef,
    remainingBoxes,
    currentReward,
    currentMatches,
    gridTurtles,
    // UI state
    boxCount,
    showSplash,
    showBlindbox,
    showCelebration,
    showResult,
    currentTurtleColor,
    matchColor,
    matchReward,
    // Computed
    appState,
    playerStatsItems,
    opStats,
    // Handlers
    handleStartGame,
    handleSettle,
    handleNewGame,
  };
}
