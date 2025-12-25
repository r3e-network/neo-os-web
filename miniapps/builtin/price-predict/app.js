/**
 * Price Prediction - Binary Options MiniApp
 * Uses high-frequency Datafeed + GAS payments
 */
const APP_ID = "builtin-price-predict";
const ROUND_DURATION = 60; // 60 seconds per round

// State
let currentPrice = 0;
let entryPrice = 0;
let priceHistory = [];
let activeBet = null;
let countdown = 0;
let countdownInterval = null;
let userAddress = null;

// DOM Elements
const elements = {};

function init() {
  elements.price = document.getElementById("price");
  elements.priceChange = document.getElementById("price-change");
  elements.btnUp = document.getElementById("btn-up");
  elements.btnDown = document.getElementById("btn-down");
  elements.betInput = document.getElementById("bet");
  elements.status = document.getElementById("status");
  elements.sdkNote = document.getElementById("sdk-note");
  elements.countdown = document.getElementById("countdown");
  elements.history = document.getElementById("history");
  elements.chart = document.getElementById("chart");

  elements.btnUp.addEventListener("click", () => placeBet("up"));
  elements.btnDown.addEventListener("click", () => placeBet("down"));

  connectWallet();
  updatePrice();
  setInterval(updatePrice, 3000);
  loadHistory();
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
    const addrEl = document.getElementById("address");
    if (addrEl) addrEl.textContent = `${userAddress.slice(0, 8)}...`;
    setStatus("Ready to predict!", "info");
  } catch (e) {
    setStatus("Connect wallet to play", "warning");
  }
}

async function updatePrice() {
  const sdk = getSDK();
  if (!sdk) return;

  try {
    const result = await sdk.datafeed.getPrice("GAS");
    const newPrice = parseFloat(result.price || result.value || 0);

    if (currentPrice > 0) {
      const change = ((newPrice - currentPrice) / currentPrice) * 100;
      updatePriceDisplay(newPrice, change);
    } else {
      updatePriceDisplay(newPrice, 0);
    }

    currentPrice = newPrice;
    priceHistory.push({ time: Date.now(), price: newPrice });
    if (priceHistory.length > 60) priceHistory.shift();

    drawChart();
  } catch (err) {
    elements.price.textContent = "$--";
  }
}

function updatePriceDisplay(price, change) {
  elements.price.textContent = `$${price.toFixed(4)}`;

  if (elements.priceChange) {
    const sign = change >= 0 ? "+" : "";
    elements.priceChange.textContent = `${sign}${change.toFixed(2)}%`;
    elements.priceChange.className = change >= 0 ? "change up" : "change down";
  }
}

function drawChart() {
  if (!elements.chart || priceHistory.length < 2) return;

  const canvas = elements.chart;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  const prices = priceHistory.map((p) => p.price);
  const min = Math.min(...prices) * 0.999;
  const max = Math.max(...prices) * 1.001;
  const range = max - min || 1;

  ctx.beginPath();
  ctx.strokeStyle = currentPrice >= (priceHistory[0]?.price || 0) ? "#4CAF50" : "#f44336";
  ctx.lineWidth = 2;

  priceHistory.forEach((p, i) => {
    const x = (i / (priceHistory.length - 1)) * w;
    const y = h - ((p.price - min) / range) * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();
}

async function placeBet(direction) {
  if (activeBet) {
    setStatus("Wait for current round to end", "warning");
    return;
  }

  const sdk = getSDK();
  if (!sdk) {
    setStatus("SDK not available", "error");
    return;
  }

  const bet = parseFloat(elements.betInput.value);
  if (isNaN(bet) || bet < 0.05 || bet > 0.5) {
    setStatus("Bet must be 0.05-0.5 GAS", "error");
    return;
  }

  elements.btnUp.disabled = true;
  elements.btnDown.disabled = true;
  setStatus(`Placing ${direction.toUpperCase()} bet...`, "info");

  try {
    entryPrice = currentPrice;
    const memo = `predict:${direction}:${Date.now()}:${Math.floor(entryPrice * 1e8)}`;
    await sdk.payments.payGAS(APP_ID, bet, memo);

    activeBet = { direction, amount: bet, entryPrice, timestamp: Date.now() };
    startCountdown();
    setStatus(`Bet placed! Entry: $${entryPrice.toFixed(4)}`, "success");
  } catch (err) {
    setStatus(`Error: ${err.message || err}`, "error");
    elements.btnUp.disabled = false;
    elements.btnDown.disabled = false;
  }
}

function startCountdown() {
  countdown = ROUND_DURATION;
  updateCountdownDisplay();

  countdownInterval = setInterval(() => {
    countdown--;
    updateCountdownDisplay();

    if (countdown <= 0) {
      clearInterval(countdownInterval);
      settleRound();
    }
  }, 1000);
}

function updateCountdownDisplay() {
  if (elements.countdown) {
    elements.countdown.textContent = `${countdown}s`;
    elements.countdown.style.display = activeBet ? "block" : "none";
  }
}

async function settleRound() {
  if (!activeBet) return;

  const finalPrice = currentPrice;
  const won =
    (activeBet.direction === "up" && finalPrice > activeBet.entryPrice) ||
    (activeBet.direction === "down" && finalPrice < activeBet.entryPrice);

  const winAmount = won ? activeBet.amount * 1.9 : 0;

  const result = {
    timestamp: Date.now(),
    direction: activeBet.direction,
    entryPrice: activeBet.entryPrice,
    exitPrice: finalPrice,
    bet: activeBet.amount,
    won,
    payout: winAmount,
  };

  saveBetHistory(result);
  updateHistoryDisplay();

  if (won) {
    setStatus(
      `WIN! $${activeBet.entryPrice.toFixed(4)} → $${finalPrice.toFixed(4)} (+${winAmount.toFixed(2)} GAS)`,
      "success",
    );
  } else {
    setStatus(`LOSS. $${activeBet.entryPrice.toFixed(4)} → $${finalPrice.toFixed(4)}`, "error");
  }

  activeBet = null;
  elements.btnUp.disabled = false;
  elements.btnDown.disabled = false;
  updateCountdownDisplay();
}

function saveBetHistory(result) {
  try {
    let history = JSON.parse(localStorage.getItem(`${APP_ID}-history`) || "[]");
    history.unshift(result);
    if (history.length > 20) history.pop();
    localStorage.setItem(`${APP_ID}-history`, JSON.stringify(history));
  } catch (e) {}
}

function loadHistory() {
  try {
    const saved = localStorage.getItem(`${APP_ID}-history`);
    if (saved) updateHistoryDisplay(JSON.parse(saved));
  } catch (e) {}
}

function updateHistoryDisplay(history) {
  if (!elements.history) return;
  history = history || JSON.parse(localStorage.getItem(`${APP_ID}-history`) || "[]");

  elements.history.innerHTML = history
    .slice(0, 5)
    .map((h) => {
      const icon = h.won ? "✅" : "❌";
      const arrow = h.direction === "up" ? "📈" : "📉";
      return `<div class="history-item ${h.won ? "win" : "loss"}">
      ${icon} ${arrow} $${h.entryPrice.toFixed(2)} → $${h.exitPrice.toFixed(2)}
    </div>`;
    })
    .join("");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
