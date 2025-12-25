/**
 * Guardian Policy - Multi-sig Security Guardian
 * TEE-enforced transaction rules
 */
const APP_ID = "builtin-guardian-policy";

let state = {
  rules: [],
  whitelist: [],
  settings: { dailyLimit: 100, txLimit: 50 },
};

const RULE_TEMPLATES = [
  { name: "Daily Limit", desc: "Block transfers exceeding daily limit" },
  { name: "Whitelist Only", desc: "Only allow transfers to whitelisted addresses" },
  { name: "Time Lock", desc: "Require delay for large transfers" },
];

let userAddress = null;
const elements = {};

function init() {
  elements.status = document.getElementById("status");
  elements.sdkNote = document.getElementById("sdk-note");
  elements.rulesList = document.getElementById("rules-list");
  elements.whitelist = document.getElementById("whitelist");

  loadState();
  connectWallet();
  renderRules();
  renderWhitelist();
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
    setStatus("Guardian active");
  } catch (e) {
    setStatus("Connect wallet to configure");
  }
}

function renderRules() {
  if (state.rules.length === 0) {
    elements.rulesList.innerHTML = '<div style="text-align:center;color:#666;padding:15px">No rules configured</div>';
    return;
  }
  elements.rulesList.innerHTML = state.rules
    .map(
      (r, i) => `
    <div class="rule-item">
      <div class="rule-header">
        <span class="rule-name">${r.name}</span>
        <span class="rule-status ${r.active ? "active" : "inactive"}">${r.active ? "Active" : "Inactive"}</span>
      </div>
      <div class="rule-desc">${r.desc}</div>
      <div style="margin-top:8px;display:flex;gap:6px">
        <button class="btn btn-sm ${r.active ? "btn-danger" : "btn-success"}" onclick="toggleRule(${i})">${r.active ? "Disable" : "Enable"}</button>
        <button class="btn btn-sm btn-danger" onclick="removeRule(${i})">Remove</button>
      </div>
    </div>`,
    )
    .join("");
}

function renderWhitelist() {
  if (state.whitelist.length === 0) {
    elements.whitelist.innerHTML = '<div style="text-align:center;color:#666;padding:10px">No addresses</div>';
    return;
  }
  elements.whitelist.innerHTML = state.whitelist
    .map(
      (addr, i) => `
    <div class="whitelist-item">
      <span>${addr.slice(0, 8)}...${addr.slice(-6)}</span>
      <button class="btn btn-sm btn-danger" onclick="removeWhitelist(${i})">×</button>
    </div>`,
    )
    .join("");
}

function addRule() {
  const template = RULE_TEMPLATES[state.rules.length % RULE_TEMPLATES.length];
  state.rules.push({ ...template, active: true, id: Date.now() });
  saveState();
  renderRules();
  setStatus(`Added rule: ${template.name}`);
}
window.addRule = addRule;

function toggleRule(index) {
  state.rules[index].active = !state.rules[index].active;
  saveState();
  renderRules();
}
window.toggleRule = toggleRule;

function removeRule(index) {
  state.rules.splice(index, 1);
  saveState();
  renderRules();
}
window.removeRule = removeRule;

function addWhitelist() {
  const addr = document.getElementById("new-address").value.trim();
  if (!addr || !addr.startsWith("N")) {
    setStatus("Invalid address");
    return;
  }
  if (!state.whitelist.includes(addr)) {
    state.whitelist.push(addr);
    saveState();
    renderWhitelist();
    setStatus("Address added");
  }
  document.getElementById("new-address").value = "";
}
window.addWhitelist = addWhitelist;

function removeWhitelist(index) {
  state.whitelist.splice(index, 1);
  saveState();
  renderWhitelist();
}
window.removeWhitelist = removeWhitelist;

function saveSettings() {
  state.settings.dailyLimit = parseFloat(document.getElementById("daily-limit").value) || 100;
  state.settings.txLimit = parseFloat(document.getElementById("tx-limit").value) || 50;
  saveState();
  setStatus("Settings saved");
}
window.saveSettings = saveSettings;

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
