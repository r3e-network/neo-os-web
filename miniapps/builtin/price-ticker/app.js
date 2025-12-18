let timer = null;

function getSDK() {
  const sdk = window.MiniAppSDK;
  const note = document.getElementById("sdk-note");
  if (!sdk) {
    note.style.display = "block";
    return null;
  }
  note.style.display = "none";
  return sdk;
}

function setOut(value) {
  const out = document.getElementById("out");
  out.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

async function refresh() {
  const sdk = getSDK();
  if (!sdk) {
    setOut({ error: "MiniAppSDK not installed" });
    return;
  }

  const symbol = String(document.getElementById("symbol").value || "").trim();
  if (!symbol) {
    setOut({ error: "symbol required" });
    return;
  }

  setOut({ status: "loading", symbol });
  try {
    const res = await sdk.datafeed.getPrice(symbol);
    setOut(res);
  } catch (err) {
    setOut({ status: "error", error: String(err?.message ?? err) });
  }
}

document.getElementById("btn-refresh").addEventListener("click", refresh);
document.getElementById("symbol").addEventListener("keydown", (e) => {
  if (e.key === "Enter") refresh();
});

document.getElementById("btn-auto").addEventListener("click", () => {
  const btn = document.getElementById("btn-auto");
  if (timer) {
    clearInterval(timer);
    timer = null;
    btn.textContent = "Auto: Off";
    return;
  }
  timer = setInterval(refresh, 5000);
  btn.textContent = "Auto: 5s";
  refresh();
});

