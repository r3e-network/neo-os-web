/**
 * IL Guard - Impermanent Loss Protection
 * Uses 0.1% Datafeed to monitor LP positions
 */
const APP_ID = "builtin-il-guard";

let state = {
  positions: [],
  settings: { threshold: 5, autoWithdraw: true, alerts: true },
};

const SAMPLE_PAIRS = [
  { pair: "NEO/GAS", token0: "NEO", token1: "GAS" },
  { pair: "NEO/USDT", token0: "NEO", token1: "USDT" },
  { pair: "GAS/USDT", token0: "GAS", token1: "USDT" },
];

let userAddress = null;
const elements = {};

function init() {
  elements.status = document.getElementById("status");
  elements.sdkNote = document.getElementById("sdk-note");
  elements.positionsList = document.getElementById("positions-list");
  elements.alertBox = document.getElementById("alert-box");
  elements.threshold = document.getElementById("threshold");

  loadState();
  connectWallet();
  startMonitoring();
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
    setStatus("Monitoring active");
  } catch (e) {
    setStatus("Connect wallet to monitor");
  }
}

function startMonitoring() {
  setInterval(async () => {
    await updatePrices();
    checkThresholds();
    renderPositions();
  }, 2000);
}

async function updatePrices() {
  const sdk = getSDK();
  for (const pos of state.positions) {
    if (sdk) {
      try {
        const feed = await sdk.datafeed.getPrice(`${pos.token0}USD`);
        if (feed) pos.currentPrice = parseFloat(feed.price);
      } catch (e) {
        pos.currentPrice *= 1 + (Math.random() - 0.5) * 0.01;
      }
    } else {
      pos.currentPrice *= 1 + (Math.random() - 0.5) * 0.01;
    }
    pos.il = calculateIL(pos.entryPrice, pos.currentPrice);
  }
}

function calculateIL(entryPrice, currentPrice) {
  const ratio = currentPrice / entryPrice;
  const il = (2 * Math.sqrt(ratio)) / (1 + ratio) - 1;
  return Math.abs(il * 100);
}

function checkThresholds() {
  const threshold = parseFloat(elements.threshold.value) || 5;
  state.settings.threshold = threshold;
  for (const pos of state.positions) {
    if (pos.il >= threshold && pos.status === "active") {
      if (state.settings.alerts) {
        showAlert(`⚠️ ${pos.pair} IL reached ${pos.il.toFixed(2)}%!`);
      }
      if (state.settings.autoWithdraw) {
        pos.status = "withdrawn";
        setStatus(`Auto-withdrew ${pos.pair}`);
      }
    }
  }
  saveState();
}

function showAlert(msg) {
  elements.alertBox.textContent = msg;
  elements.alertBox.style.display = "block";
  setTimeout(() => {
    elements.alertBox.style.display = "none";
  }, 5000);
}

function renderPositions() {
  if (state.positions.length === 0) {
    elements.positionsList.innerHTML =
      '<div style="text-align:center;color:#666;padding:20px">No positions monitored</div>';
    return;
  }
  const threshold = state.settings.threshold;
  elements.positionsList.innerHTML = state.positions
    .map((p) => {
      const ilClass = p.il < threshold * 0.5 ? "safe" : p.il < threshold ? "warning" : "danger";
      return `
      <div class="position-item">
        <div class="position-header">
          <span class="position-pair">${p.pair}</span>
          <span class="position-value">$${p.value.toFixed(2)}</span>
        </div>
        <div class="position-stats">
          <span>Entry: $${p.entryPrice.toFixed(4)}</span>
          <span>Current: $${p.currentPrice.toFixed(4)}</span>
          <span>${p.status === "withdrawn" ? "🔒 Withdrawn" : "🟢 Active"}</span>
        </div>
        <div class="il-indicator">
          <div class="il-bar"><div class="il-fill ${ilClass}" style="width:${Math.min(p.il * 10, 100)}%"></div></div>
          <span class="il-value ${ilClass}">${p.il.toFixed(2)}% IL</span>
        </div>
      </div>`;
    })
    .join("");
}

function addPosition() {
  const pair = SAMPLE_PAIRS[state.positions.length % SAMPLE_PAIRS.length];
  const entryPrice = 10 + Math.random() * 5;
  state.positions.push({
    id: Date.now(),
    pair: pair.pair,
    token0: pair.token0,
    token1: pair.token1,
    entryPrice,
    currentPrice: entryPrice,
    value: 100 + Math.random() * 400,
    il: 0,
    status: "active",
  });
  saveState();
  renderPositions();
  setStatus(`Added ${pair.pair} position`);
}
window.addPosition = addPosition;

function toggleAuto() {
  state.settings.autoWithdraw = !state.settings.autoWithdraw;
  document.getElementById("toggle-auto").classList.toggle("active", state.settings.autoWithdraw);
  saveState();
}
window.toggleAuto = toggleAuto;

function toggleAlerts() {
  state.settings.alerts = !state.settings.alerts;
  document.getElementById("toggle-alerts").classList.toggle("active", state.settings.alerts);
  saveState();
}
window.toggleAlerts = toggleAlerts;

function saveState() {
  try {
    localStorage.setItem(`${APP_ID}-state`, JSON.stringify(state));
  } catch (e) {}
}

function loadState() {
  try {
    const saved = localStorage.getItem(`${APP_ID}-state`);
    if (saved) Object.assign(state, JSON.parse(saved));
  } catch (e) {}
  renderPositions();
}

// Initialize on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
