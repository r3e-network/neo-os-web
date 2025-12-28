/**
 * Gas Red Envelope - WeChat-style Lucky Packets
 * Uses TEE VRF for random distribution with best luck winner
 */
const APP_ID = "builtin-red-envelope";

let state = {
  currentTab: "grab",
  envelopes: {}, // envelope data: { code: { totalAmount, packets, remaining, creator, type, createdAt, grabbers: [{address, amount, timestamp}], bestLuck: {address, amount} } }
  history: [],
  lastCreated: null,
};

let userAddress = null;
const elements = {};

function init() {
  elements.status = document.getElementById("status");
  elements.sdkNote = document.getElementById("sdk-note");
  elements.grabCode = document.getElementById("grab-code");
  elements.grabAmount = document.getElementById("grab-amount");
  elements.grabCount = document.getElementById("grab-count");
  elements.btnGrab = document.getElementById("btn-grab");
  elements.createAmount = document.getElementById("create-amount");
  elements.createCount = document.getElementById("create-count");
  elements.createType = document.getElementById("create-type");
  elements.btnCreate = document.getElementById("btn-create");
  elements.createdEnvelope = document.getElementById("created-envelope");
  elements.createdAmount = document.getElementById("created-amount");
  elements.createdCount = document.getElementById("created-count");
  elements.createdCode = document.getElementById("created-code");
  elements.historyList = document.getElementById("history-list");

  elements.btnGrab.addEventListener("click", grabEnvelope);
  elements.btnCreate.addEventListener("click", createEnvelope);

  loadHistory();
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

async function connectWallet() {
  const sdk = getSDK();
  if (!sdk) return;
  try {
    userAddress = await sdk.wallet.getAddress();
    setStatus("Ready!", "info");
  } catch (e) {
    setStatus("Connect wallet to continue", "info");
  }
}

function switchTab(tab) {
  state.currentTab = tab;
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  document.getElementById(`tab-${tab}`).classList.add("active");
  document.getElementById("view-grab").style.display = tab === "grab" ? "block" : "none";
  document.getElementById("view-create").style.display = tab === "create" ? "block" : "none";
  document.getElementById("view-history").style.display = tab === "history" ? "block" : "none";
  if (tab === "history") renderHistory();
}
window.switchTab = switchTab;

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function createEnvelope() {
  const sdk = getSDK();
  if (!sdk) {
    setStatus("SDK not available", "error");
    return;
  }

  const amount = parseFloat(elements.createAmount.value);
  const count = parseInt(elements.createCount.value);
  const type = elements.createType.value;

  if (isNaN(amount) || amount < 0.1 || amount > 100) {
    setStatus("Amount must be 0.1-100 GAS", "error");
    return;
  }
  if (isNaN(count) || count < 1 || count > 100) {
    setStatus("Count must be 1-100", "error");
    return;
  }

  elements.btnCreate.disabled = true;
  setStatus("Creating envelope...", "info");

  try {
    const amountRaw = Math.floor(amount * 1e8);
    const result = await sdk.payments.payGAS(APP_ID, amountRaw, `envelope:create:${count}`);
    if (!result.success) throw new Error("Payment failed");

    // Get VRF for random distribution
    const rngResult = await sdk.rng.requestRandom(APP_ID);
    const code = generateCode();

    // Calculate packet amounts
    const packets = distributeAmount(amountRaw, count, type, rngResult.randomness);

    const envelope = {
      code,
      totalAmount: amountRaw,
      packets,
      remaining: packets.length,
      creator: userAddress,
      type,
      createdAt: Date.now(),
      grabbers: [], // Track who grabbed what: [{address, amount, timestamp}]
      bestLuck: null, // Best luck winner: {address, amount}
    };

    state.envelopes[code] = envelope;
    state.lastCreated = code;
    saveEnvelopes();

    // Show created envelope
    elements.createdAmount.textContent = `${amount} GAS`;
    elements.createdCount.textContent = `${count} packets`;
    elements.createdCode.textContent = code;
    elements.createdEnvelope.style.display = "block";

    state.history.unshift({
      type: "created",
      code,
      amount: amountRaw,
      count,
      timestamp: Date.now(),
    });
    saveHistory();

    setStatus(`Envelope created! Code: ${code}`, "success");
  } catch (err) {
    setStatus(`Error: ${err.message || err}`, "error");
  } finally {
    elements.btnCreate.disabled = false;
  }
}

function distributeAmount(total, count, type, randomness) {
  const packets = [];
  if (type === "equal") {
    const each = Math.floor(total / count);
    for (let i = 0; i < count; i++) {
      packets.push(i === count - 1 ? total - each * (count - 1) : each);
    }
  } else {
    // Random distribution using VRF
    let remaining = total;
    const seed = parseInt(randomness.slice(0, 8), 16);
    let rng = seed;
    for (let i = 0; i < count - 1; i++) {
      rng = (rng * 1103515245 + 12345) & 0x7fffffff;
      const maxShare = Math.floor((remaining / (count - i)) * 2);
      const share = Math.max(1000, Math.floor((rng / 0x7fffffff) * maxShare));
      packets.push(Math.min(share, remaining - (count - i - 1) * 1000));
      remaining -= packets[i];
    }
    packets.push(remaining);
  }
  return packets;
}

async function grabEnvelope() {
  const sdk = getSDK();
  if (!sdk) {
    setStatus("SDK not available", "error");
    return;
  }

  const code = elements.grabCode.value.toUpperCase().trim();
  if (!code || code.length < 4) {
    setStatus("Enter a valid code", "error");
    return;
  }

  const envelope = state.envelopes[code];
  if (!envelope) {
    setStatus("Envelope not found", "error");
    return;
  }
  if (envelope.remaining <= 0) {
    setStatus("Envelope is empty", "error");
    return;
  }

  // WeChat-style: Check if user already grabbed this envelope
  if (envelope.grabbers && envelope.grabbers.some((g) => g.address === userAddress)) {
    setStatus("You already grabbed this envelope!", "error");
    return;
  }

  elements.btnGrab.disabled = true;
  setStatus("Grabbing...", "info");

  try {
    const amount = envelope.packets.pop();
    envelope.remaining--;

    // Track grabber (WeChat-style)
    if (!envelope.grabbers) envelope.grabbers = [];
    envelope.grabbers.push({
      address: userAddress,
      amount,
      timestamp: Date.now(),
    });

    // Update best luck winner
    if (!envelope.bestLuck || amount > envelope.bestLuck.amount) {
      envelope.bestLuck = { address: userAddress, amount };
    }

    saveEnvelopes();

    // Request payout
    await sdk.payments.requestPayout(APP_ID, amount, `envelope:grab:${code}`);

    elements.grabAmount.textContent = `${(amount / 1e8).toFixed(4)} GAS`;
    elements.grabCount.textContent = `${envelope.remaining} packets left`;

    state.history.unshift({
      type: "grabbed",
      code,
      amount,
      timestamp: Date.now(),
    });
    saveHistory();

    // Check if all packets claimed - show best luck winner
    if (envelope.remaining === 0 && envelope.bestLuck) {
      await showBestLuckNotification(code, envelope);
    }

    setStatus(`Lucky! You got ${(amount / 1e8).toFixed(4)} GAS`, "success");
  } catch (err) {
    setStatus(`Error: ${err.message || err}`, "error");
  } finally {
    elements.btnGrab.disabled = false;
  }
}

function shareEnvelope() {
  const code = state.lastCreated;
  if (!code) return;
  const text = `🧧 Grab my GAS Red Envelope! Code: ${code}`;
  if (navigator.share) {
    navigator.share({ title: "Gas Red Envelope", text });
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text);
    setStatus("Code copied!", "success");
  }
}
window.shareEnvelope = shareEnvelope;

/**
 * Show best luck winner notification (WeChat-style 手气最佳)
 */
async function showBestLuckNotification(code, envelope) {
  const sdk = getSDK();
  if (!sdk || !envelope.bestLuck) return;

  const bestLuckAmount = (envelope.bestLuck.amount / 1e8).toFixed(4);
  const shortAddr = envelope.bestLuck.address.slice(0, 8) + "..." + envelope.bestLuck.address.slice(-4);

  // Send platform notification for best luck winner
  try {
    await sdk.notifications?.send?.({
      type: "best_luck",
      title: "🎉 Best Luck Winner!",
      message: `${shortAddr} got the best luck with ${bestLuckAmount} GAS!`,
      data: {
        envelopeCode: code,
        winner: envelope.bestLuck.address,
        amount: envelope.bestLuck.amount,
      },
    });
  } catch (e) {
    console.log("Notification not available:", e);
  }

  // Show in-app alert
  showBestLuckModal(envelope);
}

/**
 * Display best luck modal (WeChat-style)
 */
function showBestLuckModal(envelope) {
  const modal = document.createElement("div");
  modal.className = "best-luck-modal";
  modal.innerHTML = `
    <div class="best-luck-content">
      <div class="best-luck-title">🎊 All Packets Claimed!</div>
      <div class="best-luck-winner">
        <span class="crown">👑</span>
        <span class="label">Best Luck</span>
      </div>
      <div class="best-luck-address">${envelope.bestLuck.address.slice(0, 10)}...${envelope.bestLuck.address.slice(-6)}</div>
      <div class="best-luck-amount">${(envelope.bestLuck.amount / 1e8).toFixed(4)} GAS</div>
      <div class="grabbers-list">
        <div class="grabbers-title">All Grabbers:</div>
        ${envelope.grabbers
          .sort((a, b) => b.amount - a.amount)
          .map(
            (g, i) => `
          <div class="grabber-item ${g.address === envelope.bestLuck.address ? "best" : ""}">
            <span class="rank">${i + 1}</span>
            <span class="addr">${g.address.slice(0, 6)}...${g.address.slice(-4)}</span>
            <span class="amt">${(g.amount / 1e8).toFixed(4)} GAS</span>
            ${g.address === envelope.bestLuck.address ? '<span class="badge">👑</span>' : ""}
          </div>
        `,
          )
          .join("")}
      </div>
      <button class="close-btn" onclick="this.parentElement.parentElement.remove()">Close</button>
    </div>
  `;
  document.body.appendChild(modal);
}

function renderHistory() {
  elements.historyList.innerHTML =
    state.history
      .slice(0, 20)
      .map(
        (h) => `
      <div class="history-item">
        <div class="amount">${h.type === "created" ? "📤" : "📥"} ${(h.amount / 1e8).toFixed(4)} GAS</div>
        <div class="meta">${h.type === "created" ? "Created" : "Grabbed"} • ${h.code} • ${formatTime(h.timestamp)}</div>
      </div>
    `,
      )
      .join("") || "<div style='text-align:center;color:#ffcdd2'>No history yet</div>";
}

function formatTime(ts) {
  return new Date(ts).toLocaleString();
}

function saveEnvelopes() {
  try {
    localStorage.setItem(`${APP_ID}-envelopes`, JSON.stringify(state.envelopes));
  } catch (e) {}
}

function loadEnvelopes() {
  try {
    const saved = localStorage.getItem(`${APP_ID}-envelopes`);
    if (saved) state.envelopes = JSON.parse(saved);
  } catch (e) {}
}

function saveHistory() {
  try {
    localStorage.setItem(`${APP_ID}-history`, JSON.stringify(state.history));
  } catch (e) {}
}

function loadHistory() {
  try {
    const saved = localStorage.getItem(`${APP_ID}-history`);
    if (saved) state.history = JSON.parse(saved);
  } catch (e) {}
  loadEnvelopes();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
