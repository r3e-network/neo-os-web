export type MicrogameCoreVerb =
  | "tap"
  | "hold"
  | "dodge"
  | "match"
  | "merge"
  | "aim"
  | "swipe"
  | "survive";

export type MicrogameFit = "high" | "medium";

export interface MicrogameModeTemplate {
  key: "easy" | "medium" | "hard";
  roundSeconds: readonly [number, number];
  entryGas: string;
  rewardGas: string;
  targetSuccessRate: string;
}

export interface MicrogameArchetype {
  id: string;
  name: string;
  familiarPattern: string;
  coreVerb: MicrogameCoreVerb;
  sessionSeconds: readonly [number, number];
  verification: string;
  gamefiFit: MicrogameFit;
  primarySkillSignal: string;
  playSurface: string;
  controlModel: string;
  assetDirection: string;
  antiAbuse: readonly string[];
  modeTemplates: readonly MicrogameModeTemplate[];
  implementationNotes: readonly string[];
}

const DEFAULT_MODES = [
  {
    key: "easy",
    roundSeconds: [20, 45],
    entryGas: "0.02",
    rewardGas: "0.10",
    targetSuccessRate: "60-70%",
  },
  {
    key: "medium",
    roundSeconds: [30, 60],
    entryGas: "0.10",
    rewardGas: "0.50",
    targetSuccessRate: "30-45%",
  },
  {
    key: "hard",
    roundSeconds: [45, 90],
    entryGas: "0.20",
    rewardGas: "1.00",
    targetSuccessRate: "10-20%",
  },
] as const satisfies readonly MicrogameModeTemplate[];

export const MICROGAME_ARCHETYPES = [
  {
    id: "white-tile-rush",
    name: "White Tile Rush",
    familiarPattern: "Don't Tap The White Tile / Piano Tiles",
    coreVerb: "tap",
    sessionSeconds: [10, 30],
    verification: "Replay the generated lane sequence and tap timestamps.",
    gamefiFit: "high",
    primarySkillSignal: "Accuracy under speed pressure, with miss and late-tap penalties.",
    playSurface: "A clean vertical lane board where the next safe tiles are the hero.",
    controlModel: "Single-finger tap lanes; the primary surface uses game controls only.",
    assetDirection: "Glossy lane tiles, hit sparks, rhythm pulse, and Neo/GAS reward trail.",
    antiAbuse: [
      "Reject impossible tap cadence.",
      "Use server/TEE seed for lane generation.",
      "Record down/up timestamps rather than only final score.",
    ],
    modeTemplates: DEFAULT_MODES,
    implementationNotes: [
      "Strong first candidate for a short-session GameFi arcade app.",
      "Difficulty should change speed and lane pattern, not expose raw parameters.",
    ],
  },
  {
    id: "ten-second-stand",
    name: "Ten Second Stand",
    familiarPattern: "Ten-second survival / avoid-the-hazards challenges",
    coreVerb: "survive",
    sessionSeconds: [10, 20],
    verification: "Replay hazard seed and sampled player positions.",
    gamefiFit: "high",
    primarySkillSignal: "Survival time and collision-free movement.",
    playSurface: "A compact arena with a visible character, hazards, and a large timer.",
    controlModel: "Drag or virtual stick movement; one-thumb mobile control.",
    assetDirection: "Bright arcade arena, readable hazards, impact effects, and countdown motion.",
    antiAbuse: [
      "Clamp movement delta per frame.",
      "Sample positions at fixed intervals.",
      "Validate collisions against the deterministic hazard timeline.",
    ],
    modeTemplates: DEFAULT_MODES,
    implementationNotes: [
      "Good hard-mode challenge because the win condition is instantly understood.",
      "Results should emphasize verified survival time, not raw chain internals.",
    ],
  },
  {
    id: "stack-tower",
    name: "Stack Tower",
    familiarPattern: "Stack block timing games",
    coreVerb: "tap",
    sessionSeconds: [20, 60],
    verification: "Replay drop timestamps and block overlap calculations.",
    gamefiFit: "high",
    primarySkillSignal: "Precise timing across a growing tower.",
    playSurface: "A tall animated tower with the active block occupying the main view.",
    controlModel: "Tap to drop; secondary stats belong in a drawer.",
    assetDirection: "Warm blocks, falling shadows, satisfying slice effects, and height markers.",
    antiAbuse: [
      "Use deterministic horizontal velocity per layer.",
      "Reject drops outside the session deadline.",
      "Derive score from replayed overlap, not client-submitted score.",
    ],
    modeTemplates: DEFAULT_MODES,
    implementationNotes: [
      "Excellent visual progression and easy replay loop.",
      "Can reuse leaderboard and achievement helpers directly.",
    ],
  },
  {
    id: "knife-timing",
    name: "Knife Timing",
    familiarPattern: "Rotating target timing games",
    coreVerb: "aim",
    sessionSeconds: [15, 45],
    verification: "Replay target rotation seed and throw timestamps.",
    gamefiFit: "high",
    primarySkillSignal: "Timing precision without collisions.",
    playSurface: "A rotating central target with visible safe gaps and thrown objects.",
    controlModel: "Tap to throw; mode cards choose rotation speed and target count.",
    assetDirection: "Neo-themed target medallion, polished projectiles, hit sparks, and miss recoil.",
    antiAbuse: [
      "Validate angular position from deterministic time.",
      "Reject duplicate timestamps.",
      "Keep collision radius consistent between client and verifier.",
    ],
    modeTemplates: DEFAULT_MODES,
    implementationNotes: [
      "Small asset surface, strong game feel requirement.",
      "Needs tight animation timing and clear near-miss feedback.",
    ],
  },
  {
    id: "color-reflex",
    name: "Color Reflex",
    familiarPattern: "Color switch and reaction gates",
    coreVerb: "match",
    sessionSeconds: [20, 60],
    verification: "Replay gate seed, current color, and input timing.",
    gamefiFit: "high",
    primarySkillSignal: "Fast matching and reaction under changing constraints.",
    playSurface: "A single character or token passing through large color gates.",
    controlModel: "Tap or swipe to match; no parameter grid.",
    assetDirection: "Bright color gates, clean motion trails, and immediate pass/fail effects.",
    antiAbuse: [
      "Record every color switch input.",
      "Verify gate order from seeded chart.",
      "Apply a latency tolerance window consistently.",
    ],
    modeTemplates: DEFAULT_MODES,
    implementationNotes: [
      "Can extend Color Clash into a more native arcade game.",
      "Best when the main canvas teaches the rule visually.",
    ],
  },
  {
    id: "falling-catch",
    name: "Falling Catch",
    familiarPattern: "Catch good objects and avoid bad ones",
    coreVerb: "dodge",
    sessionSeconds: [30, 60],
    verification: "Replay falling object seed and player x-position samples.",
    gamefiFit: "high",
    primarySkillSignal: "Positioning, prioritization, and avoidance.",
    playSurface: "A bright catch lane with the player object at the bottom.",
    controlModel: "Drag left/right; difficulty changes spawn speed and mix.",
    assetDirection: "Casual collectible items, danger objects, pickup bursts, and score combo effects.",
    antiAbuse: [
      "Clamp x-position velocity.",
      "Sample movement at fixed intervals.",
      "Score only verifier-replayed catches and collisions.",
    ],
    modeTemplates: DEFAULT_MODES,
    implementationNotes: [
      "Good family-friendly candidate for a warm, bright visual style.",
      "Works well with achievements and streak stats.",
    ],
  },
  {
    id: "tap-endurance",
    name: "Tap Endurance",
    familiarPattern: "Fixed-window tap challenge",
    coreVerb: "tap",
    sessionSeconds: [10, 15],
    verification: "Verify tap timestamps, cadence, and session window.",
    gamefiFit: "medium",
    primarySkillSignal: "High-speed but human-plausible repeated tapping.",
    playSurface: "A single physical-feeling target with progress ring and combo effects.",
    controlModel: "Tap the target; no keyboard or external controls.",
    assetDirection: "Big tactile button, hit ripples, heat meter, and final score burst.",
    antiAbuse: [
      "Reject autoclick-like intervals.",
      "Cap score by plausible physical cadence.",
      "Require focus/visibility during the active window.",
    ],
    modeTemplates: DEFAULT_MODES,
    implementationNotes: [
      "Useful but weaker than pattern/avoidance games because anti-autoclick policy is central.",
      "Should probably be practice-first until the verifier is strict.",
    ],
  },
  {
    id: "piano-sprint",
    name: "Piano Sprint",
    familiarPattern: "Rhythm / piano tile tapping",
    coreVerb: "tap",
    sessionSeconds: [20, 45],
    verification: "Replay note chart, tap timestamps, and hit-window accuracy.",
    gamefiFit: "high",
    primarySkillSignal: "Rhythm timing, misses, and perfect-hit streaks.",
    playSurface: "A vertical note highway where playable notes are the dominant scene object.",
    controlModel: "Tap lane notes as they cross the judgment line; no route form.",
    assetDirection: "Polished note gems, lane glow, combo bursts, and clear miss effects.",
    antiAbuse: [
      "Use TEE-seeded note charts.",
      "Apply deterministic hit windows with latency tolerance.",
      "Reject impossible simultaneous lane clusters and autoclick cadence.",
    ],
    modeTemplates: DEFAULT_MODES,
    implementationNotes: [
      "Distinct from White Tile Rush because timing windows matter, not only tile order.",
      "Needs visible calibration and forgiving easy mode before paid play.",
    ],
  },
  {
    id: "traffic-dash",
    name: "Traffic Dash",
    familiarPattern: "Frogger / crossing road lane challenge",
    coreVerb: "swipe",
    sessionSeconds: [30, 60],
    verification: "Replay lane hazard seed and movement inputs against crossing checkpoints.",
    gamefiFit: "high",
    primarySkillSignal: "Route planning, timing, and clean lane transitions.",
    playSurface: "A readable road or river crossing with the avatar and hazards occupying the hero area.",
    controlModel: "Swipe one tile per move; difficulty changes speed and lane density.",
    assetDirection: "Bright lane art, character states, passing hazards, checkpoint flags, and collision bursts.",
    antiAbuse: [
      "Clamp moves to legal adjacent lanes.",
      "Replay seeded hazards at fixed ticks.",
      "Validate checkpoint order and collision boxes server-side.",
    ],
    modeTemplates: DEFAULT_MODES,
    implementationNotes: [
      "Good candidate when we want a recognizable arcade skill game with more path planning.",
      "Secondary stats should stay in the drawer; the road must remain the main UI.",
    ],
  },
  {
    id: "memory-chain",
    name: "Memory Chain",
    familiarPattern: "Simon-style memory sequence",
    coreVerb: "tap",
    sessionSeconds: [20, 60],
    verification: "Replay generated sequence and user input order.",
    gamefiFit: "high",
    primarySkillSignal: "Memory depth and input accuracy under short time pressure.",
    playSurface: "Four to six large animated pads with sequence playback as the central object.",
    controlModel: "Tap pads in the revealed order; round state advances visually.",
    assetDirection: "Gem pads, light trails, sequence pulse, mistake shake, and verified-streak badge.",
    antiAbuse: [
      "Reveal sequence from TEE seed only after game start.",
      "Record every pad press timestamp.",
      "Reject presses before playback completes.",
    ],
    modeTemplates: DEFAULT_MODES,
    implementationNotes: [
      "Can evolve Color Clash into a more obviously game-like memory challenge.",
      "Works well for achievements around streak length and perfect rounds.",
    ],
  },
  {
    id: "jump-rope-rush",
    name: "Jump Rope Rush",
    familiarPattern: "Rhythm jump / rope timing challenge",
    coreVerb: "tap",
    sessionSeconds: [20, 45],
    verification: "Replay rope phase seed and jump timestamps against collision windows.",
    gamefiFit: "high",
    primarySkillSignal: "Timing consistency across accelerating rope cycles.",
    playSurface: "A character centered on the playfield with the rope motion and score ring as the hero.",
    controlModel: "Tap to jump; difficulty changes rope phase, acceleration, and combo target.",
    assetDirection: "Character poses, rope sweep frames, landing dust, combo stars, and countdown effects.",
    antiAbuse: [
      "Compute rope phase deterministically from seed and elapsed time.",
      "Validate jump cooldown and airtime.",
      "Reject hidden-tab or focus-lost paid attempts unless paused by framework policy.",
    ],
    modeTemplates: DEFAULT_MODES,
    implementationNotes: [
      "Small asset surface but high animation quality requirement.",
      "Strong fit for a warm casual game theme without exposing financial controls in the canvas.",
    ],
  },
] as const satisfies readonly MicrogameArchetype[];

export function microgameArchetypeById(id: string): MicrogameArchetype | undefined {
  return MICROGAME_ARCHETYPES.find((candidate) => candidate.id === id);
}

export function recommendedMicrogameArchetypes(limit = 5): MicrogameArchetype[] {
  return MICROGAME_ARCHETYPES
    .filter((candidate) => candidate.gamefiFit === "high")
    .slice(0, Math.max(0, limit));
}

export function validateMicrogameArchetype(candidate: MicrogameArchetype): string[] {
  const issues: string[] = [];
  if (candidate.sessionSeconds[0] < 10 || candidate.sessionSeconds[1] > 90) {
    issues.push("session length must stay between 10 and 90 seconds");
  }
  if (!candidate.playSurface || /form|questionnaire/i.test(candidate.playSurface)) {
    issues.push("play surface must be a game scene, not a form");
  }
  if (!candidate.controlModel || /form field|textarea|select/i.test(candidate.controlModel)) {
    issues.push("control model must use game controls, not form controls");
  }
  if (candidate.antiAbuse.length < 2) {
    issues.push("at least two anti-abuse checks are required");
  }
  if (candidate.modeTemplates.length < 1) {
    issues.push("at least one mode template is required");
  }
  return issues;
}
