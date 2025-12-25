/**
 * Gov Booster - NEO Governance Optimization
 * Uses Datafeed for APR, Automation for auto-compound
 */
const APP_ID = "builtin-gov-booster";
const VOTE_COST = 1000000; // 0.01 GAS

let state = {
  neoBalance: 0,
  gasBalance: 0,
  unclaimedGas: 0,
  apr: 5.0,
  votedCandidate: null,
  settings: { compound: false, reminder: true, alerts: false },
};

const candidates = [
  { id: "neo-council-1", name: "NeoFoundation", votes: 12500000 },
  { id: "neo-council-2", name: "COZ", votes: 8200000 },
  { id: "neo-council-3", name: "NeoSPCC", votes: 6800000 },
  { id: "neo-council-4", name: "AxLabs", votes: 5100000 },
  { id: "neo-council-5", name: "NGD Enterprise", votes: 4500000 },
];

let userAddress = null;
const elements = {};

function init() {
  elements.status = document.getElementById("status");
  elements.sdkNote = document.getElementById("sdk-note");
  elements.neoBalance = document.getElementById("neo-balance");
  elements.gasBalance = document.getElementById("gas-balance");
  elements.unclaimedGas = document.getElementById("unclaimed-gas");
  elements.apr = document.getElementById("apr");
  elements.candidatesList = document.getElementById("candidates-list");
  elements.btnClaim = document.getElementById("btn-claim");
  elements.btnStake = document.getElementById("btn-stake");
  elements.btnUnstake = document.getElementById("btn-unstake");

  elements.btnClaim.addEventListener("click", claimGas);
  elements.btnStake.addEventListener("click", stakeNeo);
  elements.btnUnstake.addEventListener("click", unstakeNeo);

  loadState();
  connectWallet();
  renderCandidates();
  fetchDatafeed();
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
    await fetchBalances();
    setStatus("Ready!");
  } catch (e) {
    setStatus("Connect wallet to start");
  }
}

async function fetchBalances() {
  const sdk = getSDK();
  if (!sdk || !userAddress) return;

  try {
    // Query real balances from chain via SDK
    const balances = await sdk.wallet.getBalances(userAddress);
    if (balances) {
      state.neoBalance = balances.NEO || 0;
      state.gasBalance = (balances.GAS || 0).toFixed(2);
    }

    // Query unclaimed GAS from governance
    const unclaimed = await sdk.governance.getUnclaimedGas(userAddress);
    if (unclaimed !== undefined) {
      state.unclaimedGas = unclaimed.toFixed(4);
    }
  } catch (e) {
    console.error("Failed to fetch balances:", e);
  }

  updateUI();
}

async function fetchDatafeed() {
  const sdk = getSDK();
  if (!sdk) return;
  try {
    const feed = await sdk.datafeed.getPrice("neo-apr");
    if (feed && feed.value) {
      state.apr = parseFloat(feed.value);
    }
  } catch (e) {
    // Use default APR
  }
  updateUI();
}

function updateUI() {
  elements.neoBalance.textContent = state.neoBalance;
  elements.gasBalance.textContent = state.gasBalance;
  elements.unclaimedGas.textContent = state.unclaimedGas;
  elements.apr.textContent = `~${state.apr.toFixed(1)}%`;
}

function renderCandidates() {
  elements.candidatesList.innerHTML = candidates
    .map(
      (c) => `
    <div class="candidate ${state.votedCandidate === c.id ? "voted" : ""}">
      <div class="candidate-info">
        <div class="candidate-name">${c.name}</div>
        <div class="candidate-votes">${(c.votes / 1e6).toFixed(1)}M votes</div>
      </div>
      <button class="btn btn-vote" onclick="voteFor('${c.id}')"
        ${state.votedCandidate === c.id ? "disabled" : ""}>
        ${state.votedCandidate === c.id ? "✓" : "Vote"}
      </button>
    </div>
  `,
    )
    .join("");
}

async function voteFor(candidateId) {
  const sdk = getSDK();
  if (!sdk) return;
  setStatus("Submitting vote...");
  try {
    await sdk.governance.vote(APP_ID, candidateId);
    state.votedCandidate = candidateId;
    saveState();
    renderCandidates();
    setStatus("Vote submitted!");
  } catch (e) {
    setStatus(`Error: ${e.message}`);
  }
}
window.voteFor = voteFor;

async function claimGas() {
  const sdk = getSDK();
  if (!sdk) return;
  elements.btnClaim.disabled = true;
  setStatus("Claiming GAS...");
  try {
    await sdk.governance.claim(APP_ID);
    state.gasBalance = (parseFloat(state.gasBalance) + parseFloat(state.unclaimedGas)).toFixed(2);
    state.unclaimedGas = "0.0000";
    saveState();
    updateUI();
    setStatus("GAS claimed!");
  } catch (e) {
    setStatus(`Error: ${e.message}`);
  } finally {
    elements.btnClaim.disabled = false;
  }
}

async function stakeNeo() {
  const sdk = getSDK();
  if (!sdk) return;
  const amount = parseInt(document.getElementById("stake-amount").value);
  if (!amount || amount < 1) {
    setStatus("Enter valid amount");
    return;
  }
  elements.btnStake.disabled = true;
  setStatus("Staking NEO...");
  try {
    await sdk.governance.stake(APP_ID, amount);
    state.neoBalance -= amount;
    saveState();
    updateUI();
    setStatus(`Staked ${amount} NEO!`);
  } catch (e) {
    setStatus(`Error: ${e.message}`);
  } finally {
    elements.btnStake.disabled = false;
  }
}

async function unstakeNeo() {
  const sdk = getSDK();
  if (!sdk) return;
  const amount = parseInt(document.getElementById("unstake-amount").value);
  if (!amount || amount < 1) {
    setStatus("Enter valid amount");
    return;
  }
  elements.btnUnstake.disabled = true;
  setStatus("Unstaking NEO...");
  try {
    await sdk.governance.unstake(APP_ID, amount);
    state.neoBalance += amount;
    saveState();
    updateUI();
    setStatus(`Unstaked ${amount} NEO!`);
  } catch (e) {
    setStatus(`Error: ${e.message}`);
  } finally {
    elements.btnUnstake.disabled = false;
  }
}

function switchTab(tab) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  event.target.classList.add("active");
  document.getElementById("view-vote").style.display = tab === "vote" ? "block" : "none";
  document.getElementById("view-stake").style.display = tab === "stake" ? "block" : "none";
  document.getElementById("view-auto").style.display = tab === "auto" ? "block" : "none";
}
window.switchTab = switchTab;

function toggleSetting(setting) {
  state.settings[setting] = !state.settings[setting];
  document.getElementById(`toggle-${setting}`).classList.toggle("active", state.settings[setting]);
  saveState();
  setStatus(`${setting} ${state.settings[setting] ? "enabled" : "disabled"}`);
}
window.toggleSetting = toggleSetting;

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
}

// Initialize on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
