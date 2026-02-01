import { ref, computed } from "vue";
import type { Turtle, TurtleColor, GameSession } from "./useTurtleGame";

export interface LocalGameState {
  turtles: Turtle[];
  currentBoxIndex: number;
  totalMatches: number;
  totalReward: bigint;
  isComplete: boolean;
  matchHistory: { color: TurtleColor; reward: bigint }[];
}

export interface GameStepResult {
  turtle: Turtle | null;
  matches: number;
  reward: bigint;
  isComplete: boolean;
}

const REWARD_TABLE: Record<number, bigint> = {
  2: BigInt(10000000),  // 0.1 GAS
  3: BigInt(50000000),  // 0.5 GAS
  4: BigInt(100000000), // 1.0 GAS
  5: BigInt(250000000), // 2.5 GAS
};

export function useTurtleMatching() {
  const localGame = ref<LocalGameState | null>(null);
  const matchedPairRef = ref<number[]>([]);

  const remainingBoxes = computed(() => {
    if (!localGame.value) return 0;
    return localGame.value.turtles.length - localGame.value.currentBoxIndex;
  });

  const currentReward = computed(() => {
    if (!localGame.value) return BigInt(0);
    return localGame.value.totalReward;
  });

  const currentMatches = computed(() => {
    if (!localGame.value) return 0;
    return localGame.value.totalMatches;
  });

  const gridTurtles = computed((): Turtle[] => {
    if (!localGame.value) return [];
    return localGame.value.turtles;
  });

  const initGame = (session: GameSession) => {
    const count = Number(session.boxCount);
    const turtles: Turtle[] = [];
    
    // Generate random turtles
    for (let i = 0; i < count; i++) {
      const color = Math.floor(Math.random() * 5) as TurtleColor;
      turtles.push({
        id: i,
        color,
        isRevealed: false,
        isMatched: false,
      });
    }

    localGame.value = {
      turtles,
      currentBoxIndex: 0,
      totalMatches: 0,
      totalReward: BigInt(0),
      isComplete: false,
      matchHistory: [],
    };
  };

  const processGameStep = async (): Promise<GameStepResult> => {
    if (!localGame.value) {
      return { turtle: null, matches: 0, reward: BigInt(0), isComplete: true };
    }

    const game = localGame.value;
    
    if (game.currentBoxIndex >= game.turtles.length) {
      game.isComplete = true;
      return { turtle: null, matches: 0, reward: BigInt(0), isComplete: true };
    }

    // Reveal current turtle
    const currentTurtle = game.turtles[game.currentBoxIndex];
    currentTurtle.isRevealed = true;
    
    // Count matching turtles of same color
    const revealedSameColor = game.turtles.filter(
      (t, idx) => t.isRevealed && t.color === currentTurtle.color && idx <= game.currentBoxIndex
    );
    
    let matches = 0;
    let reward = BigInt(0);

    // Check for 3+ matches
    if (revealedSameColor.length >= 3) {
      const alreadyMatched = revealedSameColor.filter(t => t.isMatched);
      
      if (alreadyMatched.length === 0) {
        // New match found
        matches = revealedSameColor.length;
        reward = REWARD_TABLE[matches] || BigInt(0);
        game.totalReward += reward;
        game.totalMatches++;
        
        // Mark as matched
        revealedSameColor.forEach(t => {
          t.isMatched = true;
        });
        
        // Update matched pair for animation
        matchedPairRef.value = revealedSameColor.map(t => t.id);
      }
    }

    game.currentBoxIndex++;
    
    if (game.currentBoxIndex >= game.turtles.length) {
      game.isComplete = true;
    }

    return {
      turtle: currentTurtle,
      matches,
      reward,
      isComplete: game.isComplete,
    };
  };

  const resetLocalGame = () => {
    localGame.value = null;
    matchedPairRef.value = [];
  };

  return {
    localGame,
    matchedPairRef,
    remainingBoxes,
    currentReward,
    currentMatches,
    gridTurtles,
    initGame,
    processGameStep,
    resetLocalGame,
  };
}
