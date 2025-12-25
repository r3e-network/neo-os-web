/**
 * Secret Vote - Privacy Voting MiniApp
 * Uses NEO governance + TEE privacy for anonymous voting
 */
const APP_ID = "builtin-secret-vote";

// Sample proposals
const PROPOSALS = [
  { id: 1, title: "Increase Staking Rewards", desc: "Raise NEO staking APY from 3% to 5%", status: "active" },
  { id: 2, title: "Community Fund Allocation", desc: "Allocate 100,000 GAS to developer grants", status: "active" },
  { id: 3, title: "Protocol Upgrade v2.0", desc: "Approve mainnet upgrade with new features", status: "ended" },
];

// State
let currentProposal = null;
let userAddress = null;
let voteResults = {};

const elements = {};

function init() {
  elements.btnYes = document.getElementById("btn-yes");
  elements.btnNo = document.getElementById("btn-no");
  elements.neoInput = document.getElementById("neo-amount");
  elements.status = document.getElementById("status");
  elements.sdkNote = document.getElementById("sdk-note");
  elements.proposalList = document.getElementById("proposal-list");
  elements.results = document.getElementById("results");

  elements.btnYes.addEventListener("click", () => castVote(true));
  elements.btnNo.addEventListener("click", () => castVote(false));

  loadProposals();
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
    const addrEl = document.getElementById("address");
    if (addrEl) addrEl.textContent = `${userAddress.slice(0, 8)}...`;
    setStatus("Ready to vote!", "info");
  } catch (e) {
    setStatus("Connect wallet to vote", "warning");
  }
}

function loadProposals() {
  if (!elements.proposalList) return;

  elements.proposalList.innerHTML = PROPOSALS.map(
    (p) => `
    <div class="proposal-item ${p.status}" data-id="${p.id}" onclick="selectProposal(${p.id})">
      <div class="proposal-header">
        <span class="proposal-id">#${p.id}</span>
        <span class="proposal-status ${p.status}">${p.status}</span>
      </div>
      <div class="proposal-title">${p.title}</div>
      <div class="proposal-desc">${p.desc}</div>
    </div>
  `,
  ).join("");

  selectProposal(1);
}

function selectProposal(id) {
  currentProposal = PROPOSALS.find((p) => p.id === id);
  if (!currentProposal) return;

  document.querySelectorAll(".proposal-item").forEach((el) => {
    el.classList.toggle("selected", el.dataset.id == id);
  });

  const isActive = currentProposal.status === "active";
  elements.btnYes.disabled = !isActive;
  elements.btnNo.disabled = !isActive;

  updateResults();
  setStatus(isActive ? "Cast your vote" : "Voting ended", "info");
}

async function castVote(support) {
  if (!currentProposal || currentProposal.status !== "active") {
    setStatus("Voting not active", "warning");
    return;
  }

  const sdk = getSDK();
  if (!sdk) {
    setStatus("SDK not available", "error");
    return;
  }

  const neoAmount = parseInt(elements.neoInput.value);
  if (isNaN(neoAmount) || neoAmount < 1 || neoAmount > 100) {
    setStatus("NEO amount must be 1-100", "error");
    return;
  }

  elements.btnYes.disabled = true;
  elements.btnNo.disabled = true;
  setStatus("Submitting vote to TEE...", "info");

  try {
    const result = await sdk.governance.vote(APP_ID, currentProposal.id, neoAmount, support);

    // Record local vote (TEE keeps it private)
    const key = `vote-${currentProposal.id}`;
    if (!voteResults[key]) {
      voteResults[key] = { yes: 0, no: 0, total: 0 };
    }
    if (support) {
      voteResults[key].yes += neoAmount;
    } else {
      voteResults[key].no += neoAmount;
    }
    voteResults[key].total += neoAmount;
    saveVotes();
    updateResults();

    const voteType = support ? "YES" : "NO";
    setStatus(`Vote cast: ${voteType} with ${neoAmount} NEO`, "success");
  } catch (err) {
    setStatus(`Error: ${err.message || err}`, "error");
  } finally {
    elements.btnYes.disabled = false;
    elements.btnNo.disabled = false;
  }
}

function updateResults() {
  if (!elements.results || !currentProposal) return;

  const key = `vote-${currentProposal.id}`;
  const votes = voteResults[key] || { yes: 0, no: 0, total: 0 };
  const yesPercent = votes.total > 0 ? (votes.yes / votes.total) * 100 : 50;

  elements.results.innerHTML = `
    <div class="results-bar">
      <div class="yes-bar" style="width: ${yesPercent}%"></div>
    </div>
    <div class="results-text">
      <span class="yes-text">YES: ${votes.yes} NEO</span>
      <span class="no-text">NO: ${votes.no} NEO</span>
    </div>
  `;
}

function saveVotes() {
  try {
    localStorage.setItem(`${APP_ID}-votes`, JSON.stringify(voteResults));
  } catch (e) {}
}

function loadVotes() {
  try {
    const saved = localStorage.getItem(`${APP_ID}-votes`);
    if (saved) voteResults = JSON.parse(saved);
  } catch (e) {}
}

// Make selectProposal global
window.selectProposal = selectProposal;

loadVotes();
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
