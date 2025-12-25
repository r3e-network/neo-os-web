/**
 * Micro Prediction - 60-Second High-Frequency Binary Options
 * Uses TEE Datafeed with 0.1% price sensitivity
 */
const APP_ID = "builtin-micro-predict";
const ROUND_DURATION = 60;
const SYMBOLS = ["BTCUSD", "ETHUSD", "NEOUSD", "GASUSD"];

let state = {
  symbol: "BTCUSD",
  currentPrice: 0,
  previousPrice: 0,
  priceHistory: [],
  countdown: ROUND_DURATION,
  activeBet: null,
  history: [],
};

let userAddress = null;
let countdownInterval = null;
let priceInterval = null;
const elements = {};

function init() {
  elements.symbolTabs = document.getElementById("symbol-tabs");
  elements.currentPrice = document.getElementById("current-price");
  elements.priceChange = document.getElementById("price-change");
  elements.countdownText = document.getElementById("countdown-text");
  elements.countdownCircle = document.getElementById("countdown-circle");
  elements.chart = document.getElementById("price-chart");
  elements.activeBet = document.getElementById("active-bet");
  elements.betDirection = document.getElementById("bet-direction");
  elements.entryPrice = document.getElementById("entry-price");
  elements.betAmount = document.getElementById("bet-amount");
  elements.betInput = document.getElementById("bet-input");
  elements.btnUp = document.getElementById("btn-up");
  elements.btnDown = document.getElementById("btn-down");
  elements.status = document.getElementById("status");
  elements.sdkNote = document.getElementById("sdk-note");
  elements.historyList = document.getElementById("history-list");

  renderSymbolTabs();
  elements.btnUp.addEventListener("click", () => placeBet("up"));
  elements.btnDown.addEventListener("click", () => placeBet("down"));

  loadHistory();
  connectWallet();
  startPriceUpdates();
  startCountdown();
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

async function connectWallet() {
  const sdk = getSDK();
  if (!sdk) return;
  try {
    userAddress = await sdk.wallet.getAddress();
    setStatus("Ready to predict!", "info");
  } catch (e) {
    setStatus("Connect wallet to play", "info");
  }
}

function renderSymbolTabs() {
  elements.symbolTabs.innerHTML = SYMBOLS.map(
    (s) =>
      `<button class="symbol-tab ${s === state.symbol ? "active" : ""}"
              onclick="selectSymbol('${s}')">${s.replace("USD", "")}</button>`,
  ).join("");
}

function selectSymbol(symbol) {
  state.symbol = symbol;
  state.priceHistory = [];
  renderSymbolTabs();
  fetchPrice();
}
window.selectSymbol = selectSymbol;

async function startPriceUpdates() {
  await fetchPrice();
  priceInterval = setInterval(fetchPrice, 2000);
}

async function fetchPrice() {
  const sdk = getSDK();
  if (!sdk) {
    setStatus("SDK required for price data", "error");
    return;
  }

  try {
    const data = await sdk.datafeed.getPrice(state.symbol);
    if (data && data.price !== undefined) {
      updatePrice(data.price);
    } else if (data && data.value !== undefined) {
      updatePrice(data.value);
    }
  } catch (e) {
    console.error("Price fetch failed:", e);
    setStatus("Price feed unavailable", "error");
  }
}

function updatePrice(price) {
  state.previousPrice = state.currentPrice;
  state.currentPrice = price;
  state.priceHistory.push({ time: Date.now(), price });
  if (state.priceHistory.length > 60) state.priceHistory.shift();

  elements.currentPrice.textContent = formatPrice(price);

  if (state.previousPrice) {
    const change = ((price - state.previousPrice) / state.previousPrice) * 100;
    const isUp = change >= 0;
    elements.priceChange.textContent = `${isUp ? "+" : ""}${change.toFixed(3)}%`;
    elements.priceChange.className = `price-change ${isUp ? "up" : "down"}`;
  }

  drawChart();
}

function formatPrice(price) {
  if (price >= 1000) return `$${price.toFixed(2)}`;
  if (price >= 1) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(6)}`;
}

function drawChart() {
  const canvas = elements.chart;
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * 2;
  canvas.height = rect.height * 2;
  ctx.scale(2, 2);

  const w = rect.width;
  const h = rect.height;
  const data = state.priceHistory;

  ctx.clearRect(0, 0, w, h);
  if (data.length < 2) return;

  const prices = data.map((d) => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  ctx.beginPath();
  ctx.strokeStyle = state.currentPrice >= state.previousPrice ? "#4caf50" : "#f44336";
  ctx.lineWidth = 2;

  data.forEach((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((d.price - min) / range) * (h - 20) - 10;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Entry price line
  if (state.activeBet) {
    const entryY = h - ((state.activeBet.entryPrice - min) / range) * (h - 20) - 10;
    ctx.beginPath();
    ctx.strokeStyle = "#ffd700";
    ctx.setLineDash([5, 5]);
    ctx.moveTo(0, entryY);
    ctx.lineTo(w, entryY);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function startCountdown() {
  countdownInterval = setInterval(() => {
    state.countdown--;
    updateCountdownUI();

    if (state.countdown <= 0) {
      settleRound();
      state.countdown = ROUND_DURATION;
    }
  }, 1000);
}

function updateCountdownUI() {
  elements.countdownText.textContent = state.countdown;
  const progress = (state.countdown / ROUND_DURATION) * 220;
  elements.countdownCircle.style.strokeDashoffset = 220 - progress;
}

async function placeBet(direction) {
  if (state.activeBet) {
    setStatus("Wait for current round to settle", "info");
    return;
  }

  const sdk = getSDK();
  if (!sdk) {
    setStatus("SDK not available", "error");
    return;
  }

  const amount = parseFloat(elements.betInput.value);
  if (isNaN(amount) || amount < 0.05 || amount > 1) {
    setStatus("Amount must be 0.05-1 GAS", "error");
    return;
  }

  elements.btnUp.disabled = true;
  elements.btnDown.disabled = true;
  setStatus("Placing prediction...", "info");

  try {
    const amountRaw = Math.floor(amount * 1e8);
    const result = await sdk.payments.payGAS(APP_ID, amountRaw, `predict:${direction}:${state.symbol}`);

    if (!result.success) throw new Error("Payment failed");

    state.activeBet = {
      direction,
      entryPrice: state.currentPrice,
      amount: amountRaw,
      symbol: state.symbol,
      timestamp: Date.now(),
    };

    elements.activeBet.classList.add("show");
    elements.betDirection.textContent = direction.toUpperCase();
    elements.betDirection.className = `bet-direction ${direction}`;
    elements.entryPrice.textContent = formatPrice(state.activeBet.entryPrice);
    elements.betAmount.textContent = `${amount} GAS`;

    setStatus(`Predicted ${direction.toUpperCase()} from ${formatPrice(state.activeBet.entryPrice)}`, "success");
  } catch (err) {
    setStatus(`Error: ${err.message || err}`, "error");
    elements.btnUp.disabled = false;
    elements.btnDown.disabled = false;
  }
}

async function settleRound() {
  if (!state.activeBet) {
    elements.btnUp.disabled = false;
    elements.btnDown.disabled = false;
    return;
  }

  const bet = state.activeBet;
  const exitPrice = state.currentPrice;
  const priceUp = exitPrice > bet.entryPrice;
  const won = (bet.direction === "up" && priceUp) || (bet.direction === "down" && !priceUp);

  const result = {
    symbol: bet.symbol,
    direction: bet.direction,
    entryPrice: bet.entryPrice,
    exitPrice,
    amount: bet.amount,
    won,
    payout: won ? bet.amount * 1.9 : 0,
    timestamp: Date.now(),
  };

  state.history.unshift(result);
  if (state.history.length > 10) state.history.pop();
  saveHistory();
  renderHistory();

  if (won) {
    setStatus(`WIN! +${((result.payout - bet.amount) / 1e8).toFixed(4)} GAS`, "success");
    const sdk = getSDK();
    if (sdk) {
      try {
        await sdk.payments.requestPayout(APP_ID, result.payout, "predict:win");
      } catch (e) {
        console.error("Payout failed:", e);
      }
    }
  } else {
    setStatus(`LOSS: Price went ${priceUp ? "UP" : "DOWN"}`, "error");
  }

  state.activeBet = null;
  elements.activeBet.classList.remove("show");
  elements.btnUp.disabled = false;
  elements.btnDown.disabled = false;
}

function renderHistory() {
  elements.historyList.innerHTML = state.history
    .map(
      (h) => `
    <div class="history-item ${h.won ? "win" : "loss"}">
      <span>${h.symbol} ${h.direction.toUpperCase()}</span>
      <span>${h.won ? "+" : "-"}${((h.won ? h.payout - h.amount : h.amount) / 1e8).toFixed(4)} GAS</span>
    </div>
  `,
    )
    .join("");
}

function saveHistory() {
  try {
    localStorage.setItem(`${APP_ID}-history`, JSON.stringify(state.history));
  } catch (e) {}
}

function loadHistory() {
  try {
    const saved = localStorage.getItem(`${APP_ID}-history`);
    if (saved) {
      state.history = JSON.parse(saved);
      renderHistory();
    }
  } catch (e) {}
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
