const LS_KEY = "ctj_trades_v3";

const form = document.getElementById("tradeForm");
const tradesBody = document.getElementById("tradesBody");
const searchEl = document.getElementById("search");
const filterSideEl = document.getElementById("filterSide");
const chartModeEl = document.getElementById("chartMode");

const periodModeEl = document.getElementById("periodMode");
const periodMetricEl = document.getElementById("periodMetric");

const elTotalPnl = document.getElementById("totalPnl");
const elWinrate = document.getElementById("winrate");
const elTradesCount = document.getElementById("tradesCount");
const elProfitFactor = document.getElementById("profitFactor");
const elAvgResult = document.getElementById("avgResult");
const elTotalResult = document.getElementById("totalResult");

const btnClearAll = document.getElementById("btnClearAll");
const btnExport = document.getElementById("btnExport");
const fileImport = document.getElementById("fileImport");

let equityChart, sideChart, periodChart;
let trades = loadTrades();

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function formatMoney(x) {
  const sign = x < 0 ? "-" : "";
  return `${sign}$${Math.abs(x).toFixed(2)}`;
}

function formatPct(x) {
  if (x == null) return "—";
  const sign = x < 0 ? "-" : "";
  return `${sign}${Math.abs(x).toFixed(2)}%`;
}

function formatDT(v) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("uk-UA", {
    year: "2-digit", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit"
  });
}

function computeNotional(t) {
  const entry = n(t.entry);
  const size = n(t.size);
  if (entry == null || size == null) return null;
  const notional = entry * size;
  return notional > 0 ? notional : null;
}

function computePnl(t) {
  const entry = n(t.entry);
  const exit = n(t.exit);
  const size = n(t.size);
  const fee = n(t.fee) ?? 0;

  if (entry == null || exit == null || size == null) return null;

  const dir = t.side === "SHORT" ? -1 : 1;
  const raw = (exit - entry) * size * dir;
  return raw - fee;
}

function computeResultPct(t) {
  const pnl = computePnl(t);
  const notional = computeNotional(t);
  if (pnl == null || notional == null) return null;
  return (pnl / notional) * 100;
}

function loadTrades() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveTrades() {
  localStorage.setItem(LS_KEY, JSON.stringify(trades));
}

function getFilteredTrades() {
  const q = (searchEl.value || "").trim().toLowerCase();
  const side = filterSideEl.value;

  return trades.filter(t => {
    if (side !== "ALL" && t.side !== side) return false;
    if (!q) return true;

    const hay = [t.symbol, t.side, t.strategy, t.exchange, t.notes]
      .filter(Boolean).join(" ").toLowerCase();

    return hay.includes(q);
  });
}

function renderTable() {
  const list = getFilteredTrades()
    .slice()
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  tradesBody.innerHTML = "";

  if (list.length === 0) {
    tradesBody.innerHTML = `
      <tr>
        <td colspan="7" class="muted">Поки пусто. Додай першу позицію 👇</td>
      </tr>`;
    return;
  }

  for (const t of list) {
    const pnl = computePnl(t);
    const resPct = computeResultPct(t);

    const pnlTxt = pnl == null ? "—" : formatMoney(pnl);
    const pnlClass = pnl == null ? "muted" : (pnl >= 0 ? "pnlPos" : "pnlNeg");

    const resTxt = resPct == null ? "—" : formatPct(resPct);
    const resClass = resPct == null ? "muted" : (resPct >= 0 ? "pnlPos" : "pnlNeg");

    const badgeClass = t.side === "SHORT" ? "badge short" : "badge long";
    const entryExit = `${n(t.entry) ?? "—"} → ${n(t.exit) ?? "—"}`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div style="font-weight:900">${escapeHtml(t.symbol || "")}</div>
        <div class="small">${escapeHtml(t.exchange || "")}</div>
      </td>
      <td><span class="${badgeClass}">${t.side}</span></td>
      <td class="right ${pnlClass}">${pnlTxt}</td>
      <td class="right ${resClass}">${resTxt}</td>
      <td class="muted">
        <div>${entryExit}</div>
        <div class="small">${formatDT(t.entryTime)} ${t.entryTime && t.exitTime ? "→" : ""} ${formatDT(t.exitTime)}</div>
      </td>
      <td class="muted">
        <div>${escapeHtml(t.strategy || "")}</div>
        <div class="small">${escapeHtml((t.notes || "").slice(0, 60))}${(t.notes||"").length>60?"…":""}</div>
      </td>
      <td>
        <div class="actions">
          <button class="iconBtn" data-act="dup" data-id="${t.id}">⎘</button>
          <button class="iconBtn del" data-act="del" data-id="${t.id}">✕</button>
        </div>
      </td>
    `;
    tradesBody.appendChild(tr);
  }
}

function calcStats() {
  const computed = trades
    .map(t => ({
      ...t,
      pnl: computePnl(t),
      notional: computeNotional(t),
      resPct: computeResultPct(t)
    }))
    .filter(x => x.pnl != null);

  const totalPnl = computed.reduce((a, x) => a + x.pnl, 0);

  const wins = computed.filter(x => x.pnl > 0);
  const losses = computed.filter(x => x.pnl < 0);

  const winrate = computed.length ? (wins.length / computed.length) * 100 : 0;

  const grossProfit = wins.reduce((a, x) => a + x.pnl, 0);
  const grossLossAbs = Math.abs(losses.reduce((a, x) => a + x.pnl, 0));
  const pf = grossLossAbs === 0 ? (grossProfit > 0 ? Infinity : 0) : grossProfit / grossLossAbs;

  const resVals = computed.map(x => x.resPct).filter(v => v != null);
  const avgRes = resVals.length ? (resVals.reduce((a, v) => a + v, 0) / resVals.length) : 0;

  const sumNotional = computed
    .map(x => x.notional)
    .filter(v => v != null)
    .reduce((a, v) => a + v, 0);

  const totalRes = sumNotional > 0 ? (totalPnl / sumNotional) * 100 : 0;

  elTotalPnl.textContent = formatMoney(totalPnl);
  elTradesCount.textContent = String(computed.length);
  elWinrate.textContent = `${winrate.toFixed(0)}%`;
  elProfitFactor.textContent = (pf === Infinity ? "∞" : pf.toFixed(2));
  elAvgResult.textContent = `${avgRes.toFixed(2)}%`;
  elTotalResult.textContent = `${totalRes.toFixed(2)}%`;

  elTotalPnl.className = (totalPnl >= 0 ? "v pnlPos" : "v pnlNeg");
  elAvgResult.className = (avgRes >= 0 ? "v pnlPos" : "v pnlNeg");
  elTotalResult.className = (totalRes >= 0 ? "v pnlPos" : "v pnlNeg");
}

/* ====== Period (Day/Week) Aggregation ====== */

function parseTradeDateKey(t, mode) {
  // беремо дату виходу; якщо нема — дату входу; якщо нема — createdAt
  const src = t.exitTime || t.entryTime || (t.createdAt ? new Date(t.createdAt).toISOString() : "");
  const d = new Date(src);
  if (Number.isNaN(d.getTime())) return null;

  if (mode === "day") {
    return isoDateKey(d); // YYYY-MM-DD
  }
  if (mode === "week") {
    const w = isoWeekKey(d); // YYYY-Www
    return w;
  }
  return isoDateKey(d);
}

function isoDateKey(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ISO week: Monday-start, week 01 = week with first Thursday
function isoWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  const yyyy = d.getUTCFullYear();
  return `${yyyy}-W${String(weekNo).padStart(2, "0")}`;
}

function buildPeriodSeries() {
  const mode = periodModeEl.value;      // day | week
  const metric = periodMetricEl.value;  // pnl | pct

  const items = trades
    .map(t => ({
      t,
      pnl: computePnl(t),
      notional: computeNotional(t),
      resPct: computeResultPct(t),
      key: parseTradeDateKey(t, mode)
    }))
    .filter(x => x.key && x.pnl != null);

  // group by key
  const map = new Map();
  for (const x of items) {
    if (!map.has(x.key)) {
      map.set(x.key, { pnl: 0, notional: 0 });
    }
    const g = map.get(x.key);
    g.pnl += x.pnl;
    if (x.notional != null) g.notional += x.notional;
  }

  // sort by time
  const keys = Array.from(map.keys()).sort((a, b) => {
    // for week keys use synthetic date: year-week -> approximate
    if (mode === "week") return a.localeCompare(b);
    return a.localeCompare(b);
  });

  const labels = keys.map(k => mode === "week" ? k : k.slice(5)); // MM-DD for day, YYYY-Wxx for week
  const data = keys.map(k => {
    const g = map.get(k);
    if (metric === "pnl") return Number(g.pnl.toFixed(2));
    // weighted result % by notional
    if (g.notional > 0) return Number(((g.pnl / g.notional) * 100).toFixed(2));
    return 0;
  });

  return { labels, data, metric, mode };
}

/* ====== Charts ====== */

function buildEquitySeries() {
  const valid = trades
    .map(t => ({ ...t, pnl: computePnl(t) }))
    .filter(x => x.pnl != null)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  const labels = valid.map((x, i) => x.symbol ? `${i + 1} ${x.symbol}` : `${i + 1}`);

  if (chartModeEl.value === "pertrade") {
    return { labels, data: valid.map(x => x.pnl) };
  }

  let cum = 0;
  const data = valid.map(x => (cum += x.pnl));
  return { labels, data };
}

function buildSideCounts() {
  let long = 0, short = 0;
  for (const t of trades) {
    if (t.side === "LONG") long++;
    if (t.side === "SHORT") short++;
  }
  return { long, short };
}

function renderCharts() {
  const ctx1 = document.getElementById("equityChart").getContext("2d");
  const ctx2 = document.getElementById("sideChart").getContext("2d");
  const ctx3 = document.getElementById("periodChart").getContext("2d");

  if (equityChart) equityChart.destroy();
  if (sideChart) sideChart.destroy();
  if (periodChart) periodChart.destroy();

  // Equity
  const eq = buildEquitySeries();
  equityChart = new Chart(ctx1, {
    type: "line",
    data: {
      labels: eq.labels,
      datasets: [{
        label: chartModeEl.value === "pertrade" ? "P&L per trade ($)" : "Equity ($)",
        data: eq.data,
        tension: 0.25,
        pointRadius: 2
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } },
      scales: { x: { ticks: { maxRotation: 0 } } }
    }
  });

  // Period (Day/Week)
  const p = buildPeriodSeries();
  periodChart = new Chart(ctx3, {
    type: "bar",
    data: {
      labels: p.labels,
      datasets: [{
        label: p.metric === "pnl"
          ? (p.mode === "day" ? "Daily P&L ($)" : "Weekly P&L ($)")
          : (p.mode === "day" ? "Daily Result (%)" : "Weekly Result (%)"),
        data: p.data
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } },
      scales: { x: { ticks: { maxRotation: 0 } } }
    }
  });

  // Sides
  const sides = buildSideCounts();
  sideChart = new Chart(ctx2, {
    type: "doughnut",
    data: {
      labels: ["LONG", "SHORT"],
      datasets: [{ data: [sides.long, sides.short] }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom" } }
    }
  });
}

function rerenderAll() {
  saveTrades();
  renderTable();
  calcStats();
  renderCharts();
}

/* ====== Events ====== */

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const t = {
    id: uid(),
    symbol: document.getElementById("symbol").value.trim().toUpperCase(),
    side: document.getElementById("side").value,
    entryTime: document.getElementById("entryTime").value || "",
    exitTime: document.getElementById("exitTime").value || "",
    entry: document.getElementById("entry").value,
    exit: document.getElementById("exit").value,
    size: document.getElementById("size").value,
    fee: document.getElementById("fee").value || "0",
    strategy: document.getElementById("strategy").value.trim(),
    exchange: document.getElementById("exchange").value.trim(),
    notes: document.getElementById("notes").value.trim(),
    createdAt: Date.now()
  };

  if (!t.symbol) return;

  trades.push(t);
  form.reset();
  document.getElementById("fee").value = "0";
  rerenderAll();
});

tradesBody.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const act = btn.dataset.act;
  const id = btn.dataset.id;

  if (act === "del") {
    trades = trades.filter(t => t.id !== id);
    rerenderAll();
  }

  if (act === "dup") {
    const src = trades.find(t => t.id === id);
    if (!src) return;
    trades.push({ ...src, id: uid(), createdAt: Date.now() });
    rerenderAll();
  }
});

searchEl.addEventListener("input", renderTable);
filterSideEl.addEventListener("change", renderTable);

chartModeEl.addEventListener("change", () => renderCharts());
periodModeEl.addEventListener("change", () => renderCharts());
periodMetricEl.addEventListener("change", () => renderCharts());

btnClearAll.addEventListener("click", () => {
  const ok = confirm("Точно очистити ВСІ позиції? Це не можна відмінити.");
  if (!ok) return;
  trades = [];
  rerenderAll();
});

btnExport.addEventListener("click", () => {
  const payload = {
    version: 3,
    exportedAt: new Date().toISOString(),
    trades
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "trading-journal.json";
  a.click();

  URL.revokeObjectURL(url);

  setTimeout(() => {
    const wantImport = confirm("Хочеш імпорт/відновлення з JSON? Натисни OK і вибери файл.");
    if (wantImport) fileImport.click();
  }, 150);
});

fileImport.addEventListener("change", async () => {
  const f = fileImport.files?.[0];
  if (!f) return;
  try {
    const text = await f.text();
    const json = JSON.parse(text);
    if (!json || !Array.isArray(json.trades)) throw new Error("Bad file");
    trades = json.trades;
    rerenderAll();
    alert("Імпорт успішний ✅");
  } catch {
    alert("Не вдалося імпортувати файл 😕");
  } finally {
    fileImport.value = "";
  }
});

/* Init */
rerenderAll();
