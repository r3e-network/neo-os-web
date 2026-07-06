# GameFi Microgame Backlog

This backlog records small, recognizable challenge games that fit the shared
Reward Game SDK model. The target is not to copy UI mechanically; each game
should feel like its genre, use real game assets, and keep chain/TEE/settlement
work behind the framework.

## Selection Criteria

- Short round length: 10 to 90 seconds.
- One core verb: tap, hold, dodge, match, merge, aim, swipe, or survive.
- Deterministic verification: the TEE can replay inputs and validate outcome.
- Clear skill signal: score is not pure luck.
- Simple settlement: entry GAS, fixed or tiered reward, expire, finalize,
  withdraw credit.
- Mobile-first controls: one hand, no keyboard dependency.
- Low parameter surface: difficulty should be a route/mode choice, not a form.

## Candidate Games

| Candidate | Familiar Pattern | Core Verb | TEE Verification | GameFi Fit | Notes |
| --- | --- | --- | --- | --- | --- |
| White Tile Rush | Don't Tap The White Tile | Tap safe tiles in order | Replay tile sequence and tap timestamps | High | Strong fit for 10-30s skill challenge. Use VRF/TEE generated tile lane sequence. |
| Ten Second Stand | "If you are a man, survive 10 seconds" style avoidance game | Dodge moving hazards | Replay hazard seed and player movement samples | High | Good hard-mode challenge. Reward by survival time threshold. |
| Piano Sprint | Rhythm / piano tile tapping | Tap timed notes | Replay note chart and tap accuracy | High | Needs strict latency tolerance and visible calibration. |
| Knife Timing | Knife hit / rotating target | Tap to throw | Replay rotation seed and throw timestamps | High | Very compact, high feedback, easy to theme with Neo/GAS targets. |
| Stack Tower | Stack block timing | Tap to drop blocks | Replay drop timestamps and block overlap | High | Easy mobile control; strong visual progression. |
| Bottle Flip | Flip timing challenge | Hold/release power | Replay release power and physics seed | Medium | Needs deterministic physics config. |
| Rope Cut Timing | Cut at exact timing | Tap/cut | Replay cut timestamps and target path | Medium | Works if physics is deterministic and bounded. |
| Traffic Dash | Frogger / crossing road | Swipe lanes | Replay lane hazards and movement inputs | High | Good for 30-60s route challenge. |
| Color Reflex | Color switch / reaction gates | Tap to pass matching color | Replay gate seed and input timing | High | Good fit for existing color-clash assets and rules. |
| Memory Chain | Simon-style memory sequence | Repeat sequence | Replay generated sequence and inputs | High | Already close to Color Clash; can become a polished template. |
| Tile Merge Sprint | 2048 variant | Swipe/merge | Replay board seed and moves | High | Existing 2048/merge-kingdom can share balance model. |
| Tap Endurance | Tap count in fixed window | Tap rapidly | Verify timestamps and rate limits | Medium | Needs anti-autoclick thresholds and input cadence checks. |
| Balance Beam | Keep pointer in safe zone | Hold/release or tilt-like drag | Replay moving safe zone and samples | Medium | Similar to Aim Master, but continuous. |
| Falling Fruit | Catch / avoid falling objects | Move basket | Replay object seed and x-position samples | High | Works well with bright casual art and short rounds. |
| Maze Blitz | Navigate a small maze | Swipe/drag | Replay maze seed and path samples | Medium | More implementation cost, but good skill signal. |

## Standard GameFi Design

Each candidate should use the same product structure:

1. Lobby: one primary game object, one mode picker, one start action.
2. Start: `ctx.framework.game.reward(...).start(...)` pays entry or consumes
   existing credit.
3. TEE seed: framework opens a confidential session and stores the sealed
   op-log under an app-scoped key.
4. Gameplay: Phaser records compact actions only, not arbitrary UI state.
5. Submit: framework finalizes with sealed op-log and polls settlement.
6. Recovery: reload should recover active game, op-log, credit, and status.
7. Results: show payout, score, verified badge, and retry. Secondary stats go
   to the drawer/sidebar.

## Balance Defaults

Use three modes unless the game has a strong reason not to:

| Mode | Round Length | Entry | Reward | Target |
| --- | ---: | ---: | ---: | --- |
| Easy | 20-45s | 0.02 GAS | 0.10 GAS | 60-70% success for practiced users |
| Medium | 30-60s | 0.10 GAS | 0.50 GAS | 30-45% success |
| Hard | 45-90s | 0.20 GAS | 1.00 GAS | 10-20% success |

Rewards must be covered by the free reward pool before the start button is
enabled. If the pool is low, the primary canvas action should be disabled with a
short secondary hint; the main visual should not become an error form.

## Implementation Priority

1. White Tile Rush: strongest fit for "famous, small, challenge" GameFi.
2. Ten Second Stand: compact survival game with clear skill expression.
3. Stack Tower: very visual, easy to understand, good reward tension.
4. Knife Timing: high-feedback timing game with small asset surface.
5. Falling Fruit: bright casual game that can reuse score/reward settlement.

## Non-Negotiable UI Rules

- No questionnaire-style route forms in the play surface.
- No text/emoji/SVG placeholders for the main game object.
- One primary action per state.
- Difficulty selection must look like mode cards or in-world objects.
- Gameplay object, board, route, or character must occupy the primary visual
  area.
- Rules, fairness, tx ids, oracle details, and raw commitment data belong in a
  drawer or secondary panel.
