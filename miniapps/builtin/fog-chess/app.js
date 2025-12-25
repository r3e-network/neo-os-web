/**
 * Fog Chess - Strategy with Fog of War
 * Uses TEE Compute for hidden enemy positions
 */
const APP_ID = "builtin-fog-chess";
const GAME_COST = 10000000; // 0.1 GAS
const REVEAL_COST = 5000000; // 0.05 GAS

const PIECES = {
  wK: "♔",
  wQ: "♕",
  wR: "♖",
  wB: "♗",
  wN: "♘",
  wP: "♙",
  bK: "♚",
  bQ: "♛",
  bR: "♜",
  bB: "♝",
  bN: "♞",
  bP: "♟",
};

let game = { board: [], turn: "w", selected: null, validMoves: [], fog: [], score: { w: 0, b: 0 } };
let userAddress = null;
const elements = {};

function init() {
  elements.board = document.getElementById("board");
  elements.status = document.getElementById("status");
  elements.sdkNote = document.getElementById("sdk-note");
  elements.btnNew = document.getElementById("btn-new");
  elements.btnReveal = document.getElementById("btn-reveal");
  elements.whiteScore = document.getElementById("white-score");
  elements.blackScore = document.getElementById("black-score");
  elements.playerWhite = document.getElementById("player-white");
  elements.playerBlack = document.getElementById("player-black");

  elements.btnNew.addEventListener("click", newGame);
  elements.btnReveal.addEventListener("click", revealFog);
  connectWallet();
}

function getSDK() {
  const sdk = window.MiniAppSDK;
  if (!sdk) elements.sdkNote.style.display = "block";
  return sdk;
}

async function connectWallet() {
  const sdk = getSDK();
  if (!sdk) return;
  try {
    userAddress = await sdk.wallet.getAddress();
    elements.status.textContent = "Ready to play!";
  } catch (e) {
    elements.status.textContent = "Connect wallet";
  }
}

async function newGame() {
  const sdk = getSDK();
  if (!sdk) return;
  elements.btnNew.disabled = true;
  elements.status.textContent = "Starting game...";
  try {
    await sdk.payments.payGAS(APP_ID, GAME_COST, "chess:new");
    initBoard();
    renderBoard();
    elements.status.textContent = "Your turn (White)";
  } catch (e) {
    elements.status.textContent = `Error: ${e.message}`;
  } finally {
    elements.btnNew.disabled = false;
  }
}

function initBoard() {
  game.board = [
    ["bR", "bN", "bB", "bQ", "bK", "bB", "bN", "bR"],
    ["bP", "bP", "bP", "bP", "bP", "bP", "bP", "bP"],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["wP", "wP", "wP", "wP", "wP", "wP", "wP", "wP"],
    ["wR", "wN", "wB", "wQ", "wK", "wB", "wN", "wR"],
  ];
  game.fog = Array(8)
    .fill(null)
    .map(() => Array(8).fill(true));
  for (let r = 5; r < 8; r++) for (let c = 0; c < 8; c++) game.fog[r][c] = false;
  game.turn = "w";
  game.selected = null;
  game.validMoves = [];
  updateFog();
}

function updateFog() {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = game.board[r][c];
      if (p && p[0] === "w") {
        revealAround(r, c, p[1] === "K" ? 1 : 2);
      }
    }
  }
}

function revealAround(r, c, range) {
  for (let dr = -range; dr <= range; dr++) {
    for (let dc = -range; dc <= range; dc++) {
      const nr = r + dr,
        nc = c + dc;
      if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) game.fog[nr][nc] = false;
    }
  }
}

function renderBoard() {
  elements.board.innerHTML = "";
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = document.createElement("div");
      const isLight = (r + c) % 2 === 0;
      cell.className = `cell ${isLight ? "light" : "dark"}`;
      if (game.fog[r][c]) cell.classList.add("fog");
      if (game.selected && game.selected.r === r && game.selected.c === c) cell.classList.add("selected");
      if (game.validMoves.some((m) => m.r === r && m.c === c)) cell.classList.add("valid-move");
      const piece = game.board[r][c];
      if (piece && !game.fog[r][c]) {
        const span = document.createElement("span");
        span.className = "piece";
        span.textContent = PIECES[piece];
        cell.appendChild(span);
      }
      cell.onclick = () => onCellClick(r, c);
      elements.board.appendChild(cell);
    }
  }
  updateScores();
}

function onCellClick(r, c) {
  if (game.turn !== "w") return;
  const piece = game.board[r][c];

  // If clicking on valid move, make the move
  if (game.selected && game.validMoves.some((m) => m.r === r && m.c === c)) {
    makeMove(game.selected.r, game.selected.c, r, c);
    return;
  }

  // If clicking own piece, select it
  if (piece && piece[0] === "w") {
    game.selected = { r, c };
    game.validMoves = getValidMoves(r, c, piece);
  } else {
    game.selected = null;
    game.validMoves = [];
  }
  renderBoard();
}

function getValidMoves(r, c, piece) {
  const moves = [];
  const type = piece[1];
  const color = piece[0];

  const addMove = (nr, nc) => {
    if (nr < 0 || nr > 7 || nc < 0 || nc > 7) return false;
    const target = game.board[nr][nc];
    if (target && target[0] === color) return false;
    moves.push({ r: nr, c: nc });
    return !target; // Continue if empty
  };

  const addLine = (dr, dc) => {
    for (let i = 1; i < 8; i++) {
      if (!addMove(r + dr * i, c + dc * i)) break;
    }
  };

  switch (type) {
    case "P": // Pawn
      const dir = color === "w" ? -1 : 1;
      const startRow = color === "w" ? 6 : 1;
      if (!game.board[r + dir]?.[c]) {
        moves.push({ r: r + dir, c });
        if (r === startRow && !game.board[r + 2 * dir]?.[c]) {
          moves.push({ r: r + 2 * dir, c });
        }
      }
      // Captures
      [-1, 1].forEach((dc) => {
        const target = game.board[r + dir]?.[c + dc];
        if (target && target[0] !== color) {
          moves.push({ r: r + dir, c: c + dc });
        }
      });
      break;

    case "R": // Rook
      addLine(0, 1);
      addLine(0, -1);
      addLine(1, 0);
      addLine(-1, 0);
      break;

    case "N": // Knight
      [
        [-2, -1],
        [-2, 1],
        [-1, -2],
        [-1, 2],
        [1, -2],
        [1, 2],
        [2, -1],
        [2, 1],
      ].forEach(([dr, dc]) => addMove(r + dr, c + dc));
      break;

    case "B": // Bishop
      addLine(1, 1);
      addLine(1, -1);
      addLine(-1, 1);
      addLine(-1, -1);
      break;

    case "Q": // Queen
      addLine(0, 1);
      addLine(0, -1);
      addLine(1, 0);
      addLine(-1, 0);
      addLine(1, 1);
      addLine(1, -1);
      addLine(-1, 1);
      addLine(-1, -1);
      break;

    case "K": // King
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr || dc) addMove(r + dr, c + dc);
        }
      }
      break;
  }
  return moves;
}

function makeMove(fromR, fromC, toR, toC) {
  const piece = game.board[fromR][fromC];
  const captured = game.board[toR][toC];

  // Capture scoring
  if (captured) {
    const values = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
    game.score.w += values[captured[1]] || 0;
  }

  // Check for king capture (game over)
  if (captured === "bK") {
    game.board[toR][toC] = piece;
    game.board[fromR][fromC] = "";
    renderBoard();
    elements.status.textContent = "🎉 You win! Black King captured!";
    return;
  }

  // Execute move
  game.board[toR][toC] = piece;
  game.board[fromR][fromC] = "";

  // Pawn promotion
  if (piece === "wP" && toR === 0) {
    game.board[toR][toC] = "wQ";
  }

  game.selected = null;
  game.validMoves = [];
  game.turn = "b";
  updateFog();
  renderBoard();
  elements.status.textContent = "AI thinking...";

  // AI move after delay
  setTimeout(aiMove, 500);
}

async function aiMove() {
  const sdk = getSDK();

  // Collect all black pieces and their moves
  const allMoves = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = game.board[r][c];
      if (piece && piece[0] === "b") {
        const moves = getValidMoves(r, c, piece);
        moves.forEach((m) => allMoves.push({ fromR: r, fromC: c, toR: m.r, toC: m.c, piece }));
      }
    }
  }

  if (allMoves.length === 0) {
    elements.status.textContent = "🎉 You win! AI has no moves!";
    return;
  }

  // Use TEE RNG for move selection if available
  let moveIdx = Math.floor(Math.random() * allMoves.length);
  if (sdk) {
    try {
      const rng = await sdk.rng.requestRandom(APP_ID);
      const seed = parseInt(rng.randomness.slice(0, 8), 16);
      moveIdx = seed % allMoves.length;
    } catch (e) {
      // Fallback to Math.random
    }
  }

  // Prioritize captures
  const captures = allMoves.filter((m) => game.board[m.toR][m.toC]);
  const move = captures.length > 0 ? captures[Math.floor(Math.random() * captures.length)] : allMoves[moveIdx];

  // Execute AI move
  const captured = game.board[move.toR][move.toC];
  if (captured) {
    const values = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
    game.score.b += values[captured[1]] || 0;
  }

  // Check for white king capture
  if (captured === "wK") {
    game.board[move.toR][move.toC] = move.piece;
    game.board[move.fromR][move.fromC] = "";
    renderBoard();
    elements.status.textContent = "💀 Game Over! Your King was captured!";
    return;
  }

  game.board[move.toR][move.toC] = move.piece;
  game.board[move.fromR][move.fromC] = "";

  // Pawn promotion
  if (move.piece === "bP" && move.toR === 7) {
    game.board[move.toR][move.toC] = "bQ";
  }

  game.turn = "w";
  updateFog();
  renderBoard();
  elements.status.textContent = "Your turn (White)";
}

async function revealFog() {
  const sdk = getSDK();
  if (!sdk) return;
  elements.btnReveal.disabled = true;
  elements.status.textContent = "Revealing fog...";
  try {
    await sdk.payments.payGAS(APP_ID, REVEAL_COST, "chess:reveal");
    // Reveal a 3x3 area around a random fogged cell
    const foggedCells = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (game.fog[r][c]) foggedCells.push({ r, c });
      }
    }
    if (foggedCells.length > 0) {
      const rng = await sdk.rng.requestRandom(APP_ID);
      const seed = parseInt(rng.randomness.slice(0, 8), 16);
      const cell = foggedCells[seed % foggedCells.length];
      revealAround(cell.r, cell.c, 1);
      renderBoard();
      elements.status.textContent = "Fog revealed!";
    } else {
      elements.status.textContent = "No fog to reveal!";
    }
  } catch (e) {
    elements.status.textContent = `Error: ${e.message}`;
  } finally {
    elements.btnReveal.disabled = false;
  }
}

function updateScores() {
  elements.whiteScore.textContent = game.score.w;
  elements.blackScore.textContent = game.score.b;
  elements.playerWhite.classList.toggle("active", game.turn === "w");
  elements.playerBlack.classList.toggle("active", game.turn === "b");
}

// Initialize on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
