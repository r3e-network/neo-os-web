/**
 * Gas Spin - Lucky Wheel MiniApp
 * Uses TEE VRF for provably fair randomness + GAS micropayments
 */
const APP_ID = "builtin-gas-spin";

// Wheel segments with multipliers and colors
const SEGMENTS = [
  { label: "2x", multiplier: 2.0, color: "#4CAF50" },
  { label: "0.5x", multiplier: 0.5, color: "#FF9800" },
  { label: "1.5x", multiplier: 1.5, color: "#2196F3" },
  { label: "💀", multiplier: 0, color: "#9E9E9E" },
  { label: "3x", multiplier: 3.0, color: "#8BC34A" },
  { label: "0.25x", multiplier: 0.25, color: "#FF5722" },
  { label: "1x", multiplier: 1.0, color: "#00BCD4" },
  { label: "🎰 5x", multiplier: 5.0, color: "#E91E63" },
];

// State
let isSpinning = false;
let userAddress = null;
let spinHistory = [];
let totalWagered = 0;
let totalWon = 0;

// DOM Elements
const elements = {};

function init() {
  elements.wheel = document.getElementById("wheel");
  elements.btnSpin = document.getElementById("btn-spin");
  elements.betInput = document.getElementById("bet");
  elements.status = document.getElementById("status");
  elements.sdkNote = document.getElementById("sdk-note");
  elements.history = document.getElementById("history");
  elements.stats = document.getElementById("stats");
  elements.address = document.getElementById("address");

  elements.btnSpin.addEventListener("click", spin);
  elements.betInput.addEventListener("input", updateBetDisplay);

  drawWheel();
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
    const addr = await sdk.wallet.getAddress();
    userAddress = addr;
    elements.address.textContent = `${addr.slice(0, 8)}...${addr.slice(-6)}`;
    setStatus("Wallet connected. Ready to spin!", "success");
  } catch (err) {
    setStatus("Connect wallet to play", "warning");
  }
}

function drawWheel() {
  const canvas = document.getElementById("wheel-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = Math.min(centerX, centerY) - 10;
  const segmentAngle = (2 * Math.PI) / SEGMENTS.length;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  SEGMENTS.forEach((seg, i) => {
    const startAngle = i * segmentAngle - Math.PI / 2;
    const endAngle = startAngle + segmentAngle;

    // Draw segment
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw label
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(startAngle + segmentAngle / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px Arial";
    ctx.fillText(seg.label, radius - 20, 6);
    ctx.restore();
  });

  // Draw center circle
  ctx.beginPath();
  ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI);
  ctx.fillStyle = "#333";
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Draw pointer
  ctx.beginPath();
  ctx.moveTo(centerX, 10);
  ctx.lineTo(centerX - 15, 40);
  ctx.lineTo(centerX + 15, 40);
  ctx.closePath();
  ctx.fillStyle = "#FFD700";
  ctx.fill();
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function updateBetDisplay() {
  const bet = parseFloat(elements.betInput.value) || 0;
  const maxWin = bet * 5;
  document.getElementById("max-win").textContent = maxWin.toFixed(2);
}

async function spin() {
  if (isSpinning) return;

  const sdk = getSDK();
  if (!sdk) {
    setStatus("SDK not available", "error");
    return;
  }

  const bet = parseFloat(elements.betInput.value);
  if (isNaN(bet) || bet < 0.05 || bet > 1.0) {
    setStatus("Bet must be 0.05-1.0 GAS", "error");
    return;
  }

  isSpinning = true;
  elements.btnSpin.disabled = true;
  elements.btnSpin.textContent = "🎰 Spinning...";
  setStatus("Processing payment...", "info");

  try {
    // Step 1: Pay GAS
    const memo = `gas-spin:${Date.now()}:${Math.floor(bet * 1e8)}`;
    const payResult = await sdk.payments.payGAS(APP_ID, bet, memo);
    setStatus("Payment confirmed. Getting random...", "info");

    // Step 2: Request TEE VRF random
    const rngResult = await sdk.rng.requestRandom(APP_ID);
    const randomHex = rngResult.randomness || rngResult.random || rngResult.value;
    const randomValue = parseInt(randomHex.slice(0, 8), 16);

    // Step 3: Calculate result
    const segmentIndex = randomValue % SEGMENTS.length;
    const winningSegment = SEGMENTS[segmentIndex];
    const winAmount = bet * winningSegment.multiplier;

    // Step 4: Animate wheel
    setStatus("Spinning the wheel...", "info");
    await animateWheel(segmentIndex, randomValue);

    // Step 5: Record result
    const result = {
      timestamp: Date.now(),
      bet,
      multiplier: winningSegment.multiplier,
      won: winAmount,
      txHash: payResult.txHash || payResult.requestId,
      attestation: rngResult.attestationHash,
    };

    spinHistory.unshift(result);
    if (spinHistory.length > 20) spinHistory.pop();
    saveHistory();

    totalWagered += bet;
    totalWon += winAmount;
    updateStats();
    updateHistoryDisplay();

    // Step 6: Show result
    if (winAmount > 0) {
      if (winningSegment.multiplier >= 3) {
        setStatus(`🎉 BIG WIN! ${winAmount.toFixed(4)} GAS (${winningSegment.label})`, "success");
      } else {
        setStatus(`Won ${winAmount.toFixed(4)} GAS (${winningSegment.label})`, "success");
      }
    } else {
      setStatus("💀 Better luck next time!", "warning");
    }
  } catch (err) {
    console.error("Spin error:", err);
    setStatus(`Error: ${err.message || err}`, "error");
  } finally {
    isSpinning = false;
    elements.btnSpin.disabled = false;
    elements.btnSpin.textContent = "🎰 SPIN";
  }
}

async function animateWheel(targetSegment, randomValue) {
  const canvas = document.getElementById("wheel-canvas");
  if (!canvas) return;

  const segmentAngle = 360 / SEGMENTS.length;
  const targetAngle = targetSegment * segmentAngle + segmentAngle / 2;
  const spins = 5 + (randomValue % 3);
  const finalRotation = spins * 360 + (360 - targetAngle);

  return new Promise((resolve) => {
    canvas.style.transition = "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)";
    canvas.style.transform = `rotate(${finalRotation}deg)`;

    setTimeout(() => {
      canvas.style.transition = "none";
      canvas.style.transform = `rotate(${finalRotation % 360}deg)`;
      resolve();
    }, 4000);
  });
}

function updateStats() {
  const profit = totalWon - totalWagered;
  const profitClass = profit >= 0 ? "profit-positive" : "profit-negative";
  elements.stats.innerHTML = `
    <span>Wagered: ${totalWagered.toFixed(2)} GAS</span>
    <span>Won: ${totalWon.toFixed(2)} GAS</span>
    <span class="${profitClass}">P/L: ${profit >= 0 ? "+" : ""}${profit.toFixed(2)} GAS</span>
  `;
}

function updateHistoryDisplay() {
  if (!elements.history) return;

  elements.history.innerHTML = spinHistory
    .slice(0, 10)
    .map((h) => {
      const resultClass = h.multiplier >= 1 ? "win" : "loss";
      return `<div class="history-item ${resultClass}">
      <span>${new Date(h.timestamp).toLocaleTimeString()}</span>
      <span>${h.bet.toFixed(2)} GAS → ${h.won.toFixed(2)} GAS</span>
      <span>${h.multiplier}x</span>
    </div>`;
    })
    .join("");
}

function saveHistory() {
  try {
    localStorage.setItem(`${APP_ID}-history`, JSON.stringify(spinHistory.slice(0, 20)));
    localStorage.setItem(`${APP_ID}-stats`, JSON.stringify({ totalWagered, totalWon }));
  } catch (e) {}
}

function loadHistory() {
  try {
    const saved = localStorage.getItem(`${APP_ID}-history`);
    if (saved) spinHistory = JSON.parse(saved);

    const stats = localStorage.getItem(`${APP_ID}-stats`);
    if (stats) {
      const { totalWagered: tw, totalWon: twon } = JSON.parse(stats);
      totalWagered = tw || 0;
      totalWon = twon || 0;
    }

    updateStats();
    updateHistoryDisplay();
  } catch (e) {}
}

// Initialize on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
