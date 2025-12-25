/**
 * NFT Evolve - Dynamic Pet Evolution Engine
 * Time-based evolution with automation service
 */
const APP_ID = "builtin-nft-evolve";

const EVOLUTIONS = [
  { level: 1, avatar: "🥚", name: "Egg" },
  { level: 2, avatar: "🐣", name: "Hatchling" },
  { level: 3, avatar: "🐥", name: "Chick" },
  { level: 4, avatar: "🐤", name: "Bird" },
  { level: 5, avatar: "🦅", name: "Eagle" },
  { level: 6, avatar: "🐉", name: "Dragon" },
];

let state = {
  hasPet: false,
  pet: { level: 1, xp: 0, health: 100, hunger: 100, happiness: 100, name: "Egg" },
};

let tickInterval = null;
const elements = {};

function init() {
  elements.sdkNote = document.getElementById("sdk-note");
  elements.petAvatar = document.getElementById("pet-avatar");
  elements.petName = document.getElementById("pet-name");
  elements.petLevel = document.getElementById("pet-level");
  elements.statsCard = document.getElementById("stats-card");
  elements.actions = document.getElementById("actions");
  elements.mintBtn = document.getElementById("mint-btn");
  elements.status = document.getElementById("status");
  elements.evolutionHint = document.getElementById("evolution-hint");

  loadState();
  connectWallet();
  updateUI();
  if (state.hasPet) startWorldTick();
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
    setStatus("Connect wallet");
  }
}

async function mintPet() {
  const sdk = getSDK();
  if (sdk) {
    try {
      await sdk.payments.payGAS(APP_ID, 10000000, `nft:mint:${Date.now()}`);
    } catch (e) {
      setStatus("Mint failed: " + e.message);
      return;
    }
  }

  state.hasPet = true;
  state.pet = { level: 1, xp: 0, health: 100, hunger: 100, happiness: 100, name: "Egg" };
  saveState();
  updateUI();
  startWorldTick();
  setStatus("Pet minted!");
}
window.mintPet = mintPet;

async function feedPet() {
  if (!state.hasPet) return;
  const sdk = getSDK();
  if (sdk) {
    try {
      await sdk.payments.payGAS(APP_ID, 1000000, `nft:feed:${Date.now()}`);
    } catch (e) {
      setStatus("Feed failed");
      return;
    }
  }
  state.pet.hunger = Math.min(100, state.pet.hunger + 30);
  state.pet.xp += 5;
  checkEvolution();
  saveState();
  updateUI();
  setStatus("Pet fed!");
}
window.feedPet = feedPet;

async function playPet() {
  if (!state.hasPet) return;
  const sdk = getSDK();
  if (sdk) {
    try {
      await sdk.payments.payGAS(APP_ID, 1000000, `nft:play:${Date.now()}`);
    } catch (e) {
      setStatus("Play failed");
      return;
    }
  }
  state.pet.happiness = Math.min(100, state.pet.happiness + 25);
  state.pet.xp += 10;
  checkEvolution();
  saveState();
  updateUI();
  setStatus("Pet played!");
}
window.playPet = playPet;

function startWorldTick() {
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(() => worldTick(), 5000);
}

function worldTick() {
  if (!state.hasPet) return;
  state.pet.hunger = Math.max(0, state.pet.hunger - 2);
  state.pet.happiness = Math.max(0, state.pet.happiness - 1);
  if (state.pet.hunger < 20) state.pet.health = Math.max(0, state.pet.health - 3);
  if (state.pet.happiness < 20) state.pet.health = Math.max(0, state.pet.health - 1);
  if (state.pet.hunger > 50 && state.pet.happiness > 50) {
    state.pet.health = Math.min(100, state.pet.health + 1);
  }
  saveState();
  updateUI();
}

function checkEvolution() {
  const xpNeeded = state.pet.level * 100;
  if (state.pet.xp >= xpNeeded && state.pet.level < EVOLUTIONS.length) {
    state.pet.level++;
    state.pet.xp = 0;
    const evo = EVOLUTIONS[state.pet.level - 1];
    state.pet.name = evo.name;
    setStatus(`Evolved to ${evo.name}!`);
  }
}

function updateUI() {
  if (!state.hasPet) {
    elements.petAvatar.textContent = "🥚";
    elements.petName.textContent = "No Pet";
    elements.petLevel.textContent = "Mint to start";
    elements.statsCard.style.display = "none";
    elements.actions.style.display = "none";
    elements.mintBtn.style.display = "block";
    return;
  }

  const evo = EVOLUTIONS[state.pet.level - 1];
  elements.petAvatar.textContent = evo.avatar;
  elements.petName.textContent = state.pet.name;
  elements.petLevel.textContent = `Level ${state.pet.level} ${evo.name}`;
  elements.statsCard.style.display = "block";
  elements.actions.style.display = "grid";
  elements.mintBtn.style.display = "none";

  document.getElementById("health-val").textContent = state.pet.health;
  document.getElementById("health-bar").style.width = `${state.pet.health}%`;
  document.getElementById("hunger-val").textContent = state.pet.hunger;
  document.getElementById("hunger-bar").style.width = `${state.pet.hunger}%`;
  document.getElementById("happiness-val").textContent = state.pet.happiness;
  document.getElementById("happiness-bar").style.width = `${state.pet.happiness}%`;

  const xpNeeded = state.pet.level * 100;
  document.getElementById("xp-val").textContent = `${state.pet.xp}/${xpNeeded}`;
  document.getElementById("xp-bar").style.width = `${(state.pet.xp / xpNeeded) * 100}%`;

  const nextEvo = EVOLUTIONS[state.pet.level];
  elements.evolutionHint.textContent = nextEvo ? `Next: ${nextEvo.name} at ${xpNeeded} XP` : "Max evolution reached!";
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
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
