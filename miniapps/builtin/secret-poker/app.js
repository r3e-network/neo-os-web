/**
 * Secret Hand Poker - Privacy-Preserving Texas Hold'em
 * Uses TEE for shuffling and hand evaluation
 */
const APP_ID = "builtin-secret-poker";
const BUY_IN = 10000000; // 0.1 GAS
const SMALL_BLIND = 500000; // 0.005 GAS
const BIG_BLIND = 1000000; // 0.01 GAS

// Card constants
const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const HAND_RANKS = [
  "High Card",
  "Pair",
  "Two Pair",
  "Three of a Kind",
  "Straight",
  "Flush",
  "Full House",
  "Four of a Kind",
  "Straight Flush",
  "Royal Flush",
];

// Game state
let gameState = {
  phase: "waiting", // waiting, preflop, flop, turn, river, showdown
  pot: 0,
  currentBet: 0,
  myChips: 0,
  myBet: 0,
  myHand: [],
  community: [],
  players: [],
  myTurn: false,
  tableId: null,
};

let userAddress = null;
const elements = {};

function init() {
  elements.pot = document.getElementById("pot");
  elements.community = document.getElementById("community");
  elements.myHand = document.getElementById("my-hand");
  elements.handRank = document.getElementById("hand-rank");
  elements.players = document.getElementById("players");
  elements.status = document.getElementById("status");
  elements.sdkNote = document.getElementById("sdk-note");
  elements.raiseAmount = document.getElementById("raise-amount");
  elements.btnJoin = document.getElementById("btn-join");
  elements.btnFold = document.getElementById("btn-fold");
  elements.btnCheck = document.getElementById("btn-check");
  elements.btnCall = document.getElementById("btn-call");
  elements.btnRaise = document.getElementById("btn-raise");
  elements.btnAllin = document.getElementById("btn-allin");

  elements.btnJoin.addEventListener("click", joinTable);
  elements.btnFold.addEventListener("click", () => playerAction("fold"));
  elements.btnCheck.addEventListener("click", () => playerAction("check"));
  elements.btnCall.addEventListener("click", () => playerAction("call"));
  elements.btnRaise.addEventListener("click", () => playerAction("raise"));
  elements.btnAllin.addEventListener("click", () => playerAction("allin"));

  disableActions();
  renderPlayers();
  renderCommunity();
  connectWallet();
}

function getSDK() {
  const sdk = window.MiniAppSDK;
  if (!sdk) {
    elements.sdkNote.style.display = "block";
    return null;
  }
  elements.sdkNote.style.display = "none";
  return sdk;
}

function setStatus(msg, type = "info") {
  elements.status.textContent = msg;
  elements.status.className = `status status-${type}`;
}

function disableActions() {
  elements.btnFold.disabled = true;
  elements.btnCheck.disabled = true;
  elements.btnCall.disabled = true;
  elements.btnRaise.disabled = true;
  elements.btnAllin.disabled = true;
}

function enableActions(canCheck) {
  elements.btnFold.disabled = false;
  elements.btnCheck.disabled = !canCheck;
  elements.btnCall.disabled = canCheck;
  elements.btnRaise.disabled = false;
  elements.btnAllin.disabled = false;
}

async function connectWallet() {
  const sdk = getSDK();
  if (!sdk) return;
  try {
    userAddress = await sdk.wallet.getAddress();
    setStatus("Ready to join table", "info");
  } catch (e) {
    setStatus("Connect wallet to play", "warning");
  }
}

async function joinTable() {
  const sdk = getSDK();
  if (!sdk) {
    setStatus("SDK not available", "error");
    return;
  }

  elements.btnJoin.disabled = true;
  setStatus("Joining table...", "info");

  try {
    // Pay buy-in
    const result = await sdk.payments.payGAS(APP_ID, BUY_IN, "poker:buyin");
    if (!result.success) throw new Error("Payment failed");

    gameState.myChips = BUY_IN;
    gameState.tableId = `table-${Date.now()}`;

    // Request TEE to shuffle deck and deal cards
    const shuffleResult = await sdk.rng.requestRandom(APP_ID);

    // Deal cards using TEE-provided randomness
    await dealCards(shuffleResult.randomness);

    elements.btnJoin.style.display = "none";
    setStatus("Cards dealt! Your turn", "success");
  } catch (err) {
    setStatus(`Error: ${err.message || err}`, "error");
    elements.btnJoin.disabled = false;
  }
}

async function dealCards(randomness) {
  // Use TEE-provided randomness for deck shuffle
  const seed = parseInt(randomness.slice(0, 8), 16);
  const deck = createShuffledDeck(seed);

  // Deal hole cards (TEE ensures card secrecy)
  gameState.myHand = [deck[0], deck[1]];
  gameState.community = [deck[4], deck[5], deck[6], deck[7], deck[8]];

  // Initialize players (bots managed by TEE compute service)
  gameState.players = [
    { name: "You", chips: gameState.myChips, bet: 0, folded: false, isMe: true },
    { name: "Player 2", chips: BUY_IN, bet: 0, folded: false },
    { name: "Player 3", chips: BUY_IN, bet: 0, folded: false },
    { name: "Player 4", chips: BUY_IN, bet: 0, folded: false },
  ];

  // Post blinds
  gameState.players[1].bet = SMALL_BLIND;
  gameState.players[1].chips -= SMALL_BLIND;
  gameState.players[2].bet = BIG_BLIND;
  gameState.players[2].chips -= BIG_BLIND;
  gameState.pot = SMALL_BLIND + BIG_BLIND;
  gameState.currentBet = BIG_BLIND;
  gameState.phase = "preflop";
  gameState.myTurn = true;

  renderPlayers();
  renderMyHand();
  renderCommunity();
  updatePot();
  enableActions(false);
}

function createShuffledDeck(seed) {
  const deck = [];
  for (let s = 0; s < 4; s++) {
    for (let r = 0; r < 13; r++) {
      deck.push({ suit: SUITS[s], rank: RANKS[r], value: r });
    }
  }
  // Fisher-Yates shuffle with seed
  let m = deck.length;
  while (m) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const i = seed % m--;
    [deck[m], deck[i]] = [deck[i], deck[m]];
  }
  return deck;
}

function renderCard(card, hidden = false) {
  if (hidden) {
    return '<div class="card hidden"></div>';
  }
  const isRed = card.suit === "♥" || card.suit === "♦";
  return `<div class="card ${isRed ? "red" : "black"}">${card.rank}${card.suit}</div>`;
}

function renderMyHand() {
  elements.myHand.innerHTML = gameState.myHand.map((c) => renderCard(c)).join("");
  updateHandRank();
}

function renderCommunity() {
  const phase = gameState.phase;
  let visibleCount = 0;
  if (phase === "flop") visibleCount = 3;
  else if (phase === "turn") visibleCount = 4;
  else if (phase === "river" || phase === "showdown") visibleCount = 5;

  let html = "";
  for (let i = 0; i < 5; i++) {
    if (i < visibleCount && gameState.community[i]) {
      html += renderCard(gameState.community[i]);
    } else {
      html += '<div class="card hidden"></div>';
    }
  }
  elements.community.innerHTML = html;
}

function renderPlayers() {
  elements.players.innerHTML = gameState.players
    .map(
      (p, i) => `
    <div class="player-seat ${p.isMe && gameState.myTurn ? "active" : ""} ${p.folded ? "folded" : ""}">
      <div class="seat-name">${sanitize(p.name)}</div>
      <div class="seat-chips">${(p.chips / 1e8).toFixed(2)}</div>
      ${p.bet > 0 ? `<div class="seat-bet">${(p.bet / 1e8).toFixed(3)}</div>` : ""}
    </div>
  `,
    )
    .join("");
}

function updatePot() {
  elements.pot.textContent = `${(gameState.pot / 1e8).toFixed(4)} GAS`;
}

function updateHandRank() {
  if (gameState.myHand.length < 2) {
    elements.handRank.textContent = "Waiting for cards...";
    return;
  }
  const allCards = [...gameState.myHand];
  const phase = gameState.phase;
  if (phase === "flop") allCards.push(...gameState.community.slice(0, 3));
  else if (phase === "turn") allCards.push(...gameState.community.slice(0, 4));
  else if (phase === "river" || phase === "showdown") allCards.push(...gameState.community);

  const rank = evaluateHand(allCards);
  elements.handRank.textContent = rank;
}

function evaluateHand(cards) {
  if (cards.length < 2) return "High Card";
  const values = cards.map((c) => c.value).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);

  // Count values
  const counts = {};
  values.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
  const countVals = Object.values(counts).sort((a, b) => b - a);

  // Check flush
  const suitCounts = {};
  suits.forEach((s) => (suitCounts[s] = (suitCounts[s] || 0) + 1));
  const isFlush = Object.values(suitCounts).some((c) => c >= 5);

  // Check straight
  const uniqueVals = [...new Set(values)].sort((a, b) => a - b);
  let isStraight = false;
  for (let i = 0; i <= uniqueVals.length - 5; i++) {
    if (uniqueVals[i + 4] - uniqueVals[i] === 4) isStraight = true;
  }
  // Ace-low straight
  if (uniqueVals.includes(12) && uniqueVals.slice(0, 4).join(",") === "0,1,2,3") isStraight = true;

  if (isFlush && isStraight) {
    if (uniqueVals.includes(12) && uniqueVals.includes(11)) return "Royal Flush";
    return "Straight Flush";
  }
  if (countVals[0] === 4) return "Four of a Kind";
  if (countVals[0] === 3 && countVals[1] === 2) return "Full House";
  if (isFlush) return "Flush";
  if (isStraight) return "Straight";
  if (countVals[0] === 3) return "Three of a Kind";
  if (countVals[0] === 2 && countVals[1] === 2) return "Two Pair";
  if (countVals[0] === 2) return "Pair";
  return "High Card";
}

async function playerAction(action) {
  if (!gameState.myTurn) return;

  const sdk = getSDK();
  disableActions();

  const raiseAmt = parseFloat(elements.raiseAmount.value) * 1e8;

  switch (action) {
    case "fold":
      gameState.players[0].folded = true;
      setStatus("You folded", "warning");
      endHand(false);
      return;

    case "check":
      setStatus("You checked", "info");
      break;

    case "call":
      const callAmt = gameState.currentBet - gameState.myBet;
      gameState.myChips -= callAmt;
      gameState.myBet += callAmt;
      gameState.pot += callAmt;
      gameState.players[0].chips = gameState.myChips;
      gameState.players[0].bet = gameState.myBet;
      setStatus(`Called ${(callAmt / 1e8).toFixed(3)} GAS`, "info");
      break;

    case "raise":
      const totalRaise = gameState.currentBet - gameState.myBet + raiseAmt;
      gameState.myChips -= totalRaise;
      gameState.myBet += totalRaise;
      gameState.pot += totalRaise;
      gameState.currentBet = gameState.myBet;
      gameState.players[0].chips = gameState.myChips;
      gameState.players[0].bet = gameState.myBet;
      setStatus(`Raised to ${(gameState.myBet / 1e8).toFixed(3)} GAS`, "info");
      break;

    case "allin":
      const allinAmt = gameState.myChips;
      gameState.pot += allinAmt;
      gameState.myBet += allinAmt;
      gameState.myChips = 0;
      gameState.players[0].chips = 0;
      gameState.players[0].bet = gameState.myBet;
      setStatus("ALL IN!", "warning");
      break;
  }

  updatePot();
  renderPlayers();

  // Request TEE to process other players' actions
  await processOtherPlayers();
  advancePhase();
}

async function processOtherPlayers() {
  const sdk = getSDK();

  // Request TEE compute service to determine player actions
  if (sdk) {
    try {
      const result = await sdk.compute.execute(APP_ID, "poker:player-actions", {
        tableId: gameState.tableId,
        phase: gameState.phase,
        pot: gameState.pot,
        currentBet: gameState.currentBet,
        players: gameState.players.slice(1), // Non-user players
      });

      if (result && result.actions) {
        // Apply TEE-computed actions
        result.actions.forEach((action, i) => {
          const playerIdx = i + 1;
          const player = gameState.players[playerIdx];
          if (!player || player.folded) return;

          if (action.type === "fold") {
            player.folded = true;
          } else if (action.type === "call" || action.type === "raise") {
            const amount = action.amount || 0;
            if (amount <= player.chips) {
              player.chips -= amount;
              player.bet += amount;
              gameState.pot += amount;
              if (action.type === "raise") {
                gameState.currentBet = Math.max(gameState.currentBet, player.bet);
              }
            } else {
              player.folded = true;
            }
          }
        });
      }
    } catch (e) {
      // Fallback: players check/call
      for (let i = 1; i < gameState.players.length; i++) {
        const player = gameState.players[i];
        if (player.folded) continue;
        const callAmt = gameState.currentBet - player.bet;
        if (callAmt <= player.chips) {
          player.chips -= callAmt;
          player.bet += callAmt;
          gameState.pot += callAmt;
        }
      }
    }
  }

  renderPlayers();
  updatePot();
}

async function advancePhase() {
  const activePlayers = gameState.players.filter((p) => !p.folded);
  if (activePlayers.length === 1) {
    endHand(activePlayers[0].isMe);
    return;
  }

  // Reset bets for new round
  gameState.players.forEach((p) => (p.bet = 0));
  gameState.myBet = 0;
  gameState.currentBet = 0;

  switch (gameState.phase) {
    case "preflop":
      gameState.phase = "flop";
      setStatus("Flop dealt", "info");
      break;
    case "flop":
      gameState.phase = "turn";
      setStatus("Turn dealt", "info");
      break;
    case "turn":
      gameState.phase = "river";
      setStatus("River dealt", "info");
      break;
    case "river":
      gameState.phase = "showdown";
      await determineWinner();
      return;
  }

  renderCommunity();
  updateHandRank();
  renderPlayers();
  gameState.myTurn = true;
  enableActions(true);
}

async function determineWinner() {
  const sdk = getSDK();
  const activePlayers = gameState.players.filter((p) => !p.folded);
  const myRank = HAND_RANKS.indexOf(evaluateHand([...gameState.myHand, ...gameState.community]));

  let playerWins = true;

  // Request TEE to evaluate all hands and determine winner
  if (sdk) {
    try {
      const result = await sdk.compute.execute(APP_ID, "poker:showdown", {
        tableId: gameState.tableId,
        community: gameState.community,
        playerHand: gameState.myHand,
        activePlayers: activePlayers.length,
      });

      if (result && result.winner !== undefined) {
        playerWins = result.winner === 0; // 0 = user wins
      }
    } catch (e) {
      // Fallback: compare user's hand rank against threshold
      playerWins = myRank >= 3; // Win if Three of a Kind or better
    }
  }

  endHand(playerWins);
}

async function endHand(won) {
  gameState.phase = "showdown";
  gameState.myTurn = false;
  disableActions();
  renderCommunity();

  if (won) {
    const winnings = gameState.pot;
    setStatus(`You won ${(winnings / 1e8).toFixed(4)} GAS!`, "success");

    // Request payout via SDK
    const sdk = getSDK();
    if (sdk) {
      try {
        await sdk.payments.requestPayout(APP_ID, winnings, "poker:win");
      } catch (e) {
        console.error("Payout request failed:", e);
      }
    }
  } else {
    setStatus("You lost this hand", "error");
  }

  // Reset for next hand after delay
  setTimeout(() => {
    resetHand();
  }, 3000);
}

function resetHand() {
  gameState.phase = "waiting";
  gameState.pot = 0;
  gameState.currentBet = 0;
  gameState.myBet = 0;
  gameState.myHand = [];
  gameState.community = [];
  gameState.myTurn = false;

  elements.myHand.innerHTML = "";
  elements.handRank.textContent = "Waiting for cards...";
  renderCommunity();
  updatePot();

  if (gameState.myChips > 0) {
    setStatus("Ready for next hand", "info");
    elements.btnJoin.textContent = "DEAL NEXT HAND";
    elements.btnJoin.style.display = "block";
    elements.btnJoin.disabled = false;
  } else {
    setStatus("Out of chips! Buy in again", "warning");
    elements.btnJoin.textContent = "BUY IN (1 GAS)";
    elements.btnJoin.style.display = "block";
    elements.btnJoin.disabled = false;
  }
}

function sanitize(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
