/**
 * Grid Trading Bot - Automated Grid Trading
 * Price-triggered order management with TEE strategy protection
 */
const APP_ID = "builtin-grid-bot";

let state = {
  isActive: false,
  currentPrice: 4.0,
  gridLevels: [],
  orders: [],
  filledOrders: [],
  profit: 0,
  config: { upper: 5.0, lower: 3.0, gridCount: 10, investment: 10 },
};

let priceInterval = null;
const elements = {};

function init() {
  elements.sdkNote = document.getElementById("sdk-note");
  elements.gridVisual = document.getElementById("grid-visual");
  elements.currentPrice = document.getElementById("current-price");
  elements.gridProfit = document.getElementById("grid-profit");
  elements.filledOrders = document.getElementById("filled-orders");
  elements.activeOrders = document.getElementById("active-orders");
  elements.ordersList = document.getElementById("orders-list");
  elements.startBtn = document.getElementById("start-btn");
  elements.stopBtn = document.getElementById("stop-btn");
  elements.status = document.getElementById("status");

  loadState();
  connectWallet();
  updateUI();
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
    await sdk.wallet.getAddress();
    setStatus("Wallet connected");
  } catch (e) {
    setStatus("Connect wallet to start");
  }
}

async function startGrid() {
  const sdk = getSDK();
  state.config.upper = parseFloat(document.getElementById("upper-price").value);
  state.config.lower = parseFloat(document.getElementById("lower-price").value);
  state.config.gridCount = parseInt(document.getElementById("grid-count").value);
  state.config.investment = parseFloat(document.getElementById("investment").value);

  if (state.config.upper <= state.config.lower) {
    setStatus("Upper price must be greater than lower");
    return;
  }

  // Pay setup fee
  if (sdk) {
    try {
      const fee = state.config.investment * 100000000 * 0.01;
      await sdk.payments.payGAS(APP_ID, Math.floor(fee), `grid:setup:${Date.now()}`);
    } catch (e) {
      setStatus("Setup failed: " + e.message);
      return;
    }
  }

  initializeGrid();
  state.isActive = true;
  saveState();
  updateUI();

  priceInterval = setInterval(() => fetchPriceAndCheck(), 3000);
  setStatus("Grid bot started");
}
window.startGrid = startGrid;

function stopGrid() {
  state.isActive = false;
  clearInterval(priceInterval);
  saveState();
  updateUI();
  setStatus("Grid bot stopped");
}
window.stopGrid = stopGrid;

function initializeGrid() {
  const { upper, lower, gridCount } = state.config;
  const step = (upper - lower) / gridCount;
  state.gridLevels = [];
  state.orders = [];

  for (let i = 0; i <= gridCount; i++) {
    const price = lower + step * i;
    state.gridLevels.push({
      price: price,
      type: price < state.currentPrice ? "buy" : "sell",
      filled: false,
    });
  }
}

async function fetchPriceAndCheck() {
  if (!state.isActive) return;

  const sdk = getSDK();
  if (sdk) {
    try {
      const priceData = await sdk.datafeed.getPrice("GASUSD");
      if (priceData && priceData.value) {
        state.currentPrice = priceData.value;
      }
    } catch (e) {
      console.error("Price fetch failed:", e);
    }
  }

  checkGridOrders();
  updateUI();
}

async function checkGridOrders() {
  const sdk = getSDK();

  for (const level of state.gridLevels) {
    if (level.filled) continue;

    const triggered =
      (level.type === "buy" && state.currentPrice <= level.price) ||
      (level.type === "sell" && state.currentPrice >= level.price);

    if (triggered) {
      level.filled = true;
      const profit = level.type === "sell" ? 0.01 : -0.005;
      state.profit += profit;

      const order = {
        time: Date.now(),
        type: level.type,
        price: level.price,
        profit: profit,
      };
      state.filledOrders.unshift(order);
      if (state.filledOrders.length > 20) state.filledOrders.pop();

      if (sdk) {
        try {
          const fee = 50000;
          await sdk.payments.payGAS(APP_ID, fee, `grid:${level.type}:${level.price.toFixed(2)}`);
        } catch (e) {
          console.error("Order failed:", e);
        }
      }

      // Flip order type
      level.type = level.type === "buy" ? "sell" : "buy";
      level.filled = false;
    }
  }
  saveState();
}

function updateUI() {
  elements.currentPrice.textContent = `$${state.currentPrice.toFixed(3)}`;
  elements.gridProfit.textContent = `${state.profit.toFixed(4)} GAS`;
  elements.filledOrders.textContent = state.filledOrders.length;
  elements.activeOrders.textContent = state.gridLevels.filter((l) => !l.filled).length;

  elements.startBtn.style.display = state.isActive ? "none" : "block";
  elements.stopBtn.style.display = state.isActive ? "block" : "none";

  renderGrid();
  renderOrders();
}

function renderGrid() {
  if (state.gridLevels.length === 0) {
    elements.gridVisual.innerHTML = "";
    return;
  }
  elements.gridVisual.innerHTML = state.gridLevels
    .slice(0, 10)
    .map((level) => {
      const isCurrent = Math.abs(level.price - state.currentPrice) < 0.1;
      const cls = isCurrent ? "current" : level.type;
      return `<div class="grid-level ${cls}">${level.price.toFixed(2)}</div>`;
    })
    .join("");
}

function renderOrders() {
  if (state.filledOrders.length === 0) {
    elements.ordersList.innerHTML = '<div style="text-align:center;color:#666;padding:15px">No orders</div>';
    return;
  }
  elements.ordersList.innerHTML = state.filledOrders
    .slice(0, 8)
    .map(
      (o) => `
    <div class="order-item">
      <span>${o.type.toUpperCase()} @ $${o.price.toFixed(2)}</span>
      <span style="color:${o.profit >= 0 ? "#00ff88" : "#ff4444"}">${o.profit >= 0 ? "+" : ""}${o.profit.toFixed(4)}</span>
    </div>
  `,
    )
    .join("");
}

function saveState() {
  try {
    localStorage.setItem(`${APP_ID}-state`, JSON.stringify(state));
  } catch (e) {}
}

function loadState() {
  try {
    const saved = localStorage.getItem(`${APP_ID}-state`);
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.assign(state, parsed);
      state.isActive = false;
    }
  } catch (e) {}
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
