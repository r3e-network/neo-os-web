/**
 * Turbo Options - Ultra-fast Binary Options Trading
 * Uses 0.1% Datafeed sensitivity for instant price updates
 */
const APP_ID = "builtin-turbo-options";
const PAYOUT_RATE = 1.85;

let state = {
  asset: "NEO",
  duration: 30,
  currentPrice: 12.45,
  lastPrice: 12.44,
  positions: [],
  stats: { wins: 0, losses: 0, pnl: 0 },
  countdown: 30,
  roundStart: Date.now(),
};

const ASSETS = {
  NEO: { symbol: "NEOUSD", price: 12.45 },
  GAS: { symbol: "GASUSD", price: 4.82 },
  BTC: { symbol: "BTCUSD", price: 43250.0 },
};

let userAddress = null;
const elements = {};

function init() {
  elements.status = document.getElementById("status");
  elements.sdkNote = document.getElementById("sdk-note");
  elements.currentPrice = document.getElementById("current-price");
  elements.priceChange = document.getElementById("price-change");
  elements.countdown = document.getElementById("countdown");
  elements.countdownFill = document.getElementById("countdown-fill");
  elements.positionsList = document.getElementById("positions-list");
  elements.btnUp = document.getElementById("btn-up");
  elements.btnDown = document.getElementById("btn-down");
  elements.winRate = document.getElementById("win-rate");
  elements.totalTrades = document.getElementById("total-trades");
  elements.pnl = document.getElementById("pnl");

  loadState();
  connectWallet();
  startPriceFeed();
  startCountdown();
}

function getSDK() {
  const sdk = window.MiniAppSDK;
  if (!sdk) elements.sdkNote.style.display = "block";
  return sdk;
}

function setStatus(msg) {
  elements.status.textContent = msg;
}

async function connectWallet() {
  const sdk = getSDK();
  if (!sdk) return;
  try {
    userAddress = await sdk.wallet.getAddress();
    setStatus("Ready to trade!");
  } catch (e) {
    setStatus("Connect wallet to trade");
  }
}

async function startPriceFeed() {
  // Initial price fetch
  await fetchCurrentPrice();

  // Poll for price updates every second
  setInterval(async () => {
    state.lastPrice = state.currentPrice;
    await fetchCurrentPrice();
    updatePriceDisplay();
  }, 1000);
}

async function fetchCurrentPrice() {
  const sdk = getSDK();
  if (!sdk) {
    setStatus("SDK required for price data");
    return;
  }

  try {
    const feed = await sdk.datafeed.getPrice(ASSETS[state.asset].symbol);
    if (feed && feed.price !== undefined) {
      state.currentPrice = parseFloat(feed.price);
    } else if (feed && feed.value !== undefined) {
      state.currentPrice = parseFloat(feed.value);
    }
  } catch (e) {
    console.error("Price fetch failed:", e);
  }
}

function updatePriceDisplay() {
  const price = state.currentPrice;
  const change = ((price - state.lastPrice) / state.lastPrice) * 100;
  elements.currentPrice.textContent = price < 100 ? `$${price.toFixed(4)}` : `$${price.toFixed(2)}`;
  elements.priceChange.textContent = `${change >= 0 ? "+" : ""}${change.toFixed(3)}%`;
  elements.priceChange.className = `price-change ${change >= 0 ? "up" : "down"}`;
}

function startCountdown() {
  setInterval(() => {
    const elapsed = Math.floor((Date.now() - state.roundStart) / 1000);
    state.countdown = state.duration - (elapsed % state.duration);
    if (state.countdown === state.duration) {
      settlePositions();
      state.roundStart = Date.now();
    }
    elements.countdown.textContent = state.countdown;
    elements.countdownFill.style.width = `${(state.countdown / state.duration) * 100}%`;
  }, 1000);
}

function selectAsset(asset) {
  state.asset = asset;
  state.currentPrice = ASSETS[asset].price;
  document.querySelectorAll(".asset-btn").forEach((b) => b.classList.remove("active"));
  event.target.classList.add("active");
  updatePriceDisplay();
}
window.selectAsset = selectAsset;

function selectDuration(duration) {
  state.duration = duration;
  state.roundStart = Date.now();
  document.querySelectorAll(".duration-btn").forEach((b) => b.classList.remove("active"));
  event.target.classList.add("active");
}
window.selectDuration = selectDuration;

function adjustAmount(delta) {
  const input = document.getElementById("amount");
  const val = Math.max(0.1, Math.min(50, parseFloat(input.value) + delta));
  input.value = val.toFixed(1);
}
window.adjustAmount = adjustAmount;

async function placeTrade(direction) {
  const sdk = getSDK();
  if (!sdk) return;
  const amount = parseFloat(document.getElementById("amount").value);
  if (amount < 0.1) {
    setStatus("Minimum 0.1 GAS");
    return;
  }
  elements.btnUp.disabled = true;
  elements.btnDown.disabled = true;
  setStatus(`Placing ${direction.toUpperCase()} trade...`);
  try {
    const amountInt = Math.floor(amount * 1e8);
    await sdk.payments.payGAS(APP_ID, amountInt, `turbo:${direction}:${state.asset}`);
    const position = {
      id: Date.now(),
      direction,
      asset: state.asset,
      entryPrice: state.currentPrice,
      amount,
      expiry: Date.now() + state.countdown * 1000,
      status: "pending",
    };
    state.positions.unshift(position);
    renderPositions();
    saveState();
    setStatus(`${direction.toUpperCase()} position opened!`);
  } catch (e) {
    setStatus(`Error: ${e.message}`);
  } finally {
    elements.btnUp.disabled = false;
    elements.btnDown.disabled = false;
  }
}
window.placeTrade = placeTrade;

function settlePositions() {
  const now = Date.now();
  state.positions.forEach((pos) => {
    if (pos.status === "pending" && now >= pos.expiry) {
      const won =
        (pos.direction === "up" && state.currentPrice > pos.entryPrice) ||
        (pos.direction === "down" && state.currentPrice < pos.entryPrice);
      pos.status = won ? "won" : "lost";
      pos.exitPrice = state.currentPrice;
      if (won) {
        state.stats.wins++;
        state.stats.pnl += pos.amount * (PAYOUT_RATE - 1);
      } else {
        state.stats.losses++;
        state.stats.pnl -= pos.amount;
      }
    }
  });
  state.positions = state.positions.slice(0, 10);
  renderPositions();
  updateStats();
  saveState();
}

function renderPositions() {
  elements.positionsList.innerHTML =
    state.positions
      .map(
        (p) => `
    <div class="position ${p.status}">
      <span>${p.direction.toUpperCase()} ${p.asset} @ $${p.entryPrice.toFixed(4)}</span>
      <span>${p.amount} GAS ${p.status === "won" ? "✓" : p.status === "lost" ? "✗" : "⏳"}</span>
    </div>
  `,
      )
      .join("") || '<div style="text-align:center;color:#666">No positions</div>';
}

function updateStats() {
  const total = state.stats.wins + state.stats.losses;
  const winRate = total > 0 ? Math.round((state.stats.wins / total) * 100) : 52;
  elements.winRate.textContent = `${winRate}%`;
  elements.totalTrades.textContent = total;
  elements.pnl.textContent = state.stats.pnl.toFixed(2);
}

function saveState() {
  try {
    localStorage.setItem(`${APP_ID}-state`, JSON.stringify({ stats: state.stats, positions: state.positions }));
  } catch (e) {}
}

function loadState() {
  try {
    const saved = localStorage.getItem(`${APP_ID}-state`);
    if (saved) {
      const data = JSON.parse(saved);
      state.stats = data.stats || state.stats;
      state.positions = data.positions || [];
    }
  } catch (e) {}
  renderPositions();
  updateStats();
}

// Initialize on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
