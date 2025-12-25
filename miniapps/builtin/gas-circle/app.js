/**
 * GAS Circle - Daily Savings & Lottery Pool (SocialFi)
 * Uses Automation for daily draws, VRF for random selection
 */
const APP_ID = "builtin-gas-circle";
const DAILY_AMOUNT = 10000000; // 0.1 GAS

let state = {
  circle: null,
  isMember: false,
  history: [],
};

let userAddress = null;
const elements = {};

function init() {
  elements.status = document.getElementById("status");
  elements.sdkNote = document.getElementById("sdk-note");
  elements.circleName = document.getElementById("circle-name");
  elements.membersCount = document.getElementById("members-count");
  elements.poolAmount = document.getElementById("pool-amount");
  elements.dayCount = document.getElementById("day-count");
  elements.countdown = document.getElementById("countdown");
  elements.membersList = document.getElementById("members-list");
  elements.btnJoin = document.getElementById("btn-join");
  elements.btnDeposit = document.getElementById("btn-deposit");
  elements.btnCreate = document.getElementById("btn-create");
  elements.historyList = document.getElementById("history-list");

  elements.btnJoin.addEventListener("click", joinCircle);
  elements.btnDeposit.addEventListener("click", dailyDeposit);
  elements.btnCreate.addEventListener("click", createCircle);

  loadState();
  connectWallet();
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
    checkMembership();
    setStatus("Ready!", "info");
  } catch (e) {
    setStatus("Connect wallet", "info");
  }
}

function switchTab(tab) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  event.target.classList.add("active");
  document.getElementById("view-active").style.display = tab === "active" ? "block" : "none";
  document.getElementById("view-create").style.display = tab === "create" ? "block" : "none";
  document.getElementById("view-history").style.display = tab === "history" ? "block" : "none";
  if (tab === "history") renderHistory();
}
window.switchTab = switchTab;

function checkMembership() {
  if (!state.circle || !userAddress) return;
  state.isMember = state.circle.members.some((m) => m.address === userAddress);
  updateUI();
}

function updateUI() {
  if (!state.circle) {
    elements.btnJoin.style.display = "block";
    elements.btnDeposit.style.display = "none";
    return;
  }
  elements.circleName.textContent = state.circle.name;
  elements.membersCount.textContent = `${state.circle.members.length}/${state.circle.maxMembers}`;
  elements.poolAmount.textContent = (state.circle.pool / 1e8).toFixed(2);
  elements.dayCount.textContent = state.circle.day;

  if (state.isMember) {
    elements.btnJoin.style.display = "none";
    elements.btnDeposit.style.display = "block";
    const deposited = state.circle.members.find((m) => m.address === userAddress)?.depositedToday;
    elements.btnDeposit.disabled = deposited;
    elements.btnDeposit.textContent = deposited
      ? "✓ Deposited Today"
      : `Daily Deposit (${(DAILY_AMOUNT / 1e8).toFixed(1)} GAS)`;
  } else {
    elements.btnJoin.style.display = state.circle.members.length < state.circle.maxMembers ? "block" : "none";
    elements.btnDeposit.style.display = "none";
  }
  renderMembers();
}

function renderMembers() {
  if (!state.circle) return;
  elements.membersList.innerHTML = state.circle.members
    .map(
      (m) => `
      <div class="member ${m.isWinner ? "winner" : ""} ${m.address === userAddress ? "you" : ""}">
        <span>${m.address.slice(0, 8)}...${m.address === userAddress ? " (You)" : ""}</span>
        <span>${m.depositedToday ? "✓" : "○"} ${m.isWinner ? "🏆" : ""}</span>
      </div>
    `,
    )
    .join("");
}

async function joinCircle() {
  const sdk = getSDK();
  if (!sdk) return;
  elements.btnJoin.disabled = true;
  setStatus("Joining circle...", "info");
  try {
    const result = await sdk.payments.payGAS(APP_ID, DAILY_AMOUNT, "circle:join");
    if (!result.success) throw new Error("Payment failed");
    if (!state.circle) initDefaultCircle();
    state.circle.members.push({ address: userAddress, depositedToday: true, isWinner: false });
    state.circle.pool += DAILY_AMOUNT;
    state.isMember = true;
    saveState();
    updateUI();
    setStatus("Joined circle!", "success");
  } catch (err) {
    setStatus(`Error: ${err.message}`, "error");
  } finally {
    elements.btnJoin.disabled = false;
  }
}

async function dailyDeposit() {
  const sdk = getSDK();
  if (!sdk) return;
  elements.btnDeposit.disabled = true;
  setStatus("Depositing...", "info");
  try {
    const result = await sdk.payments.payGAS(APP_ID, DAILY_AMOUNT, "circle:deposit");
    if (!result.success) throw new Error("Payment failed");
    const member = state.circle.members.find((m) => m.address === userAddress);
    if (member) member.depositedToday = true;
    state.circle.pool += DAILY_AMOUNT;
    saveState();
    updateUI();
    setStatus("Deposit complete!", "success");
  } catch (err) {
    setStatus(`Error: ${err.message}`, "error");
  } finally {
    elements.btnDeposit.disabled = false;
  }
}

async function createCircle() {
  const sdk = getSDK();
  if (!sdk) return;
  const amount = parseFloat(document.getElementById("create-amount").value) * 1e8;
  const maxMembers = parseInt(document.getElementById("create-members").value);
  elements.btnCreate.disabled = true;
  setStatus("Creating circle...", "info");
  try {
    const result = await sdk.payments.payGAS(APP_ID, amount, "circle:create");
    if (!result.success) throw new Error("Payment failed");
    state.circle = {
      name: `GAS Circle #${Date.now() % 1000}`,
      maxMembers,
      dailyAmount: amount,
      members: [{ address: userAddress, depositedToday: true, isWinner: false }],
      pool: amount,
      day: 1,
      nextDraw: getNextDrawTime(),
    };
    state.isMember = true;
    saveState();
    updateUI();
    setStatus("Circle created!", "success");
  } catch (err) {
    setStatus(`Error: ${err.message}`, "error");
  } finally {
    elements.btnCreate.disabled = false;
  }
}

function initDefaultCircle() {
  state.circle = {
    name: "Daily GAS Circle #1",
    maxMembers: 10,
    dailyAmount: DAILY_AMOUNT,
    members: [],
    pool: 0,
    day: 1,
    nextDraw: getNextDrawTime(),
  };
}

function getNextDrawTime() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime();
}

function startCountdown() {
  setInterval(() => {
    if (!state.circle) {
      elements.countdown.textContent = "--:--:--";
      return;
    }
    const now = Date.now();
    const diff = state.circle.nextDraw - now;
    if (diff <= 0) {
      doDailyDraw();
      return;
    }
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    elements.countdown.textContent = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }, 1000);
}

async function doDailyDraw() {
  if (!state.circle || state.circle.members.length === 0) return;
  const sdk = getSDK();
  if (!sdk) return;
  try {
    const rng = await sdk.rng.requestRandom(APP_ID);
    const seed = parseInt(rng.randomness.slice(0, 8), 16);
    const winnerIdx = seed % state.circle.members.length;
    const winner = state.circle.members[winnerIdx];
    winner.isWinner = true;
    state.history.unshift({
      day: state.circle.day,
      winner: winner.address,
      amount: state.circle.pool,
      timestamp: Date.now(),
    });
    state.circle.members.forEach((m) => {
      m.depositedToday = false;
      m.isWinner = false;
    });
    winner.isWinner = true;
    state.circle.day++;
    state.circle.pool = 0;
    state.circle.nextDraw = getNextDrawTime();
    saveState();
    updateUI();
    setStatus(`Day ${state.circle.day - 1} winner: ${winner.address.slice(0, 8)}...`, "success");
  } catch (e) {
    console.error("Draw failed:", e);
  }
}

function renderHistory() {
  elements.historyList.innerHTML =
    state.history
      .slice(0, 10)
      .map(
        (h) => `
    <div class="member winner">
      <span>Day ${h.day}: ${h.winner.slice(0, 8)}...</span>
      <span>${(h.amount / 1e8).toFixed(2)} GAS</span>
    </div>
  `,
      )
      .join("") || "<div style='text-align:center;color:#90caf9'>No history</div>";
}

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
  updateUI();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
