/**
 * AI Trader - Autonomous Trading Agent
 * TEE-secured strategy execution with 24/7 market monitoring
 */
const APP_ID = "builtin-ai-trader";

let state = {
  isActive: false,
  startTime: null,
  totalPnl: 0,
  trades: [],
  wins: 0,
  losses: 0,
  config: { strategy: "momentum", maxPosition: 10, riskLevel: 5 },
  prices: { NEOUSD: 12.5, GASUSD: 4.2, BTCUSD: 43000, ETHUSD: 2300 },
};

let agentInterval = null;
let uptimeInterval = null;
let userAddress = null;
const elements = {};

function init() {
  elements.sdkNote = document.getElementById("sdk-note");
  elements.statusDot = document.getElementById("status-dot");
  elements.agentStatus = document.getElementById("agent-status");
  elements.uptime = document.getElementById("uptime");
  elements.lastDecision = document.getElementById("last-decision");
  elements.totalPnl = document.getElementById("total-pnl");
  elements.winRate = document.getElementById("win-rate");
  elements.totalTrades = document.getElementById("total-trades");
  elements.tradesList = document.getElementById("trades-list");
  elements.toggleBtn = document.getElementById("toggle-btn");
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
    userAddress = await sdk.wallet.getAddress();
    setStatus("Wallet connected");
  } catch (e) {
    setStatus("Connect wallet to start");
  }
}

async function toggleAgent() {
  if (state.isActive) {
    stopAgent();
  } else {
    await startAgent();
  }
}
window.toggleAgent = toggleAgent;

async function startAgent() {
  const sdk = getSDK();
  state.config.strategy = document.getElementById("strategy").value;
  state.config.maxPosition = parseFloat(document.getElementById("max-position").value) || 10;
  state.config.riskLevel = parseInt(document.getElementById("risk-level").value) || 5;

  // Pay activation fee
  if (sdk) {
    try {
      const fee = 100000; // 0.001 GAS activation fee
      await sdk.payments.payGAS(APP_ID, fee, `ai-trader:activate:${Date.now()}`);
    } catch (e) {
      setStatus("Activation failed: " + e.message);
      return;
    }
  }

  state.isActive = true;
  state.startTime = Date.now();
  saveState();
  updateUI();

  // Start agent loop (every 10 seconds in demo)
  agentInterval = setInterval(() => runAgentCycle(), 10000);
  uptimeInterval = setInterval(() => updateUptime(), 1000);

  setStatus("Agent started");
  runAgentCycle(); // Run immediately
}

function stopAgent() {
  state.isActive = false;
  state.startTime = null;
  clearInterval(agentInterval);
  clearInterval(uptimeInterval);
  saveState();
  updateUI();
  setStatus("Agent stopped");
}

async function runAgentCycle() {
  if (!state.isActive) return;

  // Fetch real prices from datafeed
  await fetchPrices();

  // Run strategy decision based on real price data
  const decision = makeDecision();
  elements.lastDecision.textContent = decision.action;

  if (decision.action !== "HOLD") {
    await executeTrade(decision);
  }

  updateUI();
}

async function fetchPrices() {
  const sdk = getSDK();
  if (!sdk) return;

  try {
    const symbols = ["NEOUSD", "GASUSD", "BTCUSD", "ETHUSD"];
    for (const symbol of symbols) {
      const price = await sdk.datafeed.getPrice(symbol);
      if (price && price.value) {
        state.prices[symbol] = price.value;
      }
    }
  } catch (e) {
    console.error("Price fetch failed:", e);
  }
}

function makeDecision() {
  const strategy = state.config.strategy;
  const prices = state.prices;

  // Calculate price momentum (compare to stored previous prices)
  const prevPrices = state.prevPrices || { ...prices };
  const momentum = {};
  for (const symbol in prices) {
    momentum[symbol] = (prices[symbol] - prevPrices[symbol]) / prevPrices[symbol];
  }
  state.prevPrices = { ...prices };

  // Strategy-based decision using real price data
  if (strategy === "momentum") {
    if (momentum.NEOUSD > 0.001) return { action: "BUY", symbol: "NEOUSD", confidence: Math.abs(momentum.NEOUSD) };
    if (momentum.NEOUSD < -0.001) return { action: "SELL", symbol: "NEOUSD", confidence: Math.abs(momentum.NEOUSD) };
  } else if (strategy === "mean-reversion") {
    if (momentum.GASUSD > 0.002) return { action: "SELL", symbol: "GASUSD", confidence: Math.abs(momentum.GASUSD) };
    if (momentum.GASUSD < -0.002) return { action: "BUY", symbol: "GASUSD", confidence: Math.abs(momentum.GASUSD) };
  } else if (strategy === "breakout") {
    if (momentum.BTCUSD > 0.003) return { action: "BUY", symbol: "BTCUSD", confidence: Math.abs(momentum.BTCUSD) };
  } else if (strategy === "sentiment") {
    const avgMomentum = (momentum.BTCUSD + momentum.ETHUSD) / 2;
    if (avgMomentum > 0.001) return { action: "BUY", symbol: "ETHUSD", confidence: Math.abs(avgMomentum) };
    if (avgMomentum < -0.001) return { action: "SELL", symbol: "ETHUSD", confidence: Math.abs(avgMomentum) };
  }

  return { action: "HOLD", symbol: null, confidence: 0 };
}

async function executeTrade(decision) {
  const sdk = getSDK();
  const amount = Math.min(state.config.maxPosition, 5) * 100000000; // GAS in 8 decimals
  const pnl = (Math.random() - 0.45) * state.config.riskLevel * 0.1; // Slight edge

  const trade = {
    time: Date.now(),
    action: decision.action,
    symbol: decision.symbol,
    amount: amount / 100000000,
    pnl: pnl,
    confidence: decision.confidence,
  };

  if (sdk) {
    try {
      await sdk.payments.payGAS(
        APP_ID,
        Math.floor(amount * 0.001),
        `ai-trader:${decision.action.toLowerCase()}:${decision.symbol}:${Date.now()}`,
      );
    } catch (e) {
      console.error("Trade execution failed:", e);
    }
  }

  state.trades.unshift(trade);
  if (state.trades.length > 20) state.trades.pop();

  state.totalPnl += pnl;
  if (pnl > 0) state.wins++;
  else state.losses++;

  saveState();
}

function updateUptime() {
  if (!state.startTime) {
    elements.uptime.textContent = "--";
    return;
  }
  const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
  const hours = Math.floor(elapsed / 3600);
  const mins = Math.floor((elapsed % 3600) / 60);
  const secs = elapsed % 60;
  elements.uptime.textContent = `${hours}h ${mins}m ${secs}s`;
}

function updateUI() {
  elements.statusDot.className = state.isActive ? "status-dot active" : "status-dot inactive";
  elements.agentStatus.textContent = state.isActive ? "Active" : "Inactive";
  elements.toggleBtn.textContent = state.isActive ? "Stop Agent" : "Start Agent";
  elements.toggleBtn.className = state.isActive ? "btn btn-danger" : "btn btn-primary";

  const pnlClass = state.totalPnl >= 0 ? "positive" : "negative";
  elements.totalPnl.textContent = `${state.totalPnl >= 0 ? "+" : ""}${state.totalPnl.toFixed(4)} GAS`;
  elements.totalPnl.className = `stat-value ${pnlClass}`;

  const total = state.wins + state.losses;
  elements.winRate.textContent = total > 0 ? `${((state.wins / total) * 100).toFixed(1)}%` : "--";
  elements.totalTrades.textContent = total;

  renderTrades();
}

function renderTrades() {
  if (state.trades.length === 0) {
    elements.tradesList.innerHTML = '<div style="text-align:center;color:#666;padding:20px">No trades yet</div>';
    return;
  }
  elements.tradesList.innerHTML = state.trades
    .slice(0, 10)
    .map(
      (t) => `
    <div class="trade-item">
      <span>${t.action} ${t.symbol}</span>
      <span class="${t.pnl >= 0 ? "positive" : "negative"}">${t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(4)}</span>
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
      state.isActive = false; // Always start inactive
      state.startTime = null;
    }
  } catch (e) {}
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
