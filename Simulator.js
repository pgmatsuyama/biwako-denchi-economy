// simulator.js
const ENERGY_PER_SLOT = 1.0;
const PUMP_EFFICIENCY = 0.7;
const GENERATE_EFFICIENCY = 0.9;
const PRICE_DATA_URL = "data/spot_price_kansai_2024_2025.json";
const KWH_PER_GWH = 1000000;
const SLOT_HOURS = 0.5;

let strategy = Array(7).fill().map(() => Array(48).fill("idle"));
let priceData = {};
let profitChart;
let waterChart;
let startingCapital = parseFloat(localStorage.getItem("bankedMoney")) || 0;

function getDynamicWeekdays(baseDateStr) {
  const baseDate = new Date(baseDateStr);
  return [...Array(7)].map((_, i) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i);
    const label = "日月火水木金土"[d.getDay()];
    return `${label}
${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
  });
});
}

function getIcon(state) {
  const mode = document.getElementById("iconMode")?.value || "emoji";
  if (mode === "emoji") return { pumped: "💧", generated: "⚡", idle: "□" }[state];
  if (mode === "arrow") return { pumped: "↓", generated: "↑", idle: "□" }[state];
  return ""; // color only
}

function createGrid() {
  runSimulation(); // グリッド描画後にチャート更新
  const container = document.getElementById("week-grid");
  container.innerHTML = '';
  const baseDateStr = document.getElementById("startDate").value;
  const days = getDynamicWeekdays(baseDateStr);

  days.forEach((day, d) => {
    const label = document.createElement("div");
    label.textContent = day;
    container.appendChild(label);
    const bar = document.createElement("div");
    bar.className = "price-day-bar";
    bar.id = `price-day-${d}`;
    container.appendChild(bar);
    const row = document.createElement("div");
    row.className = "grid";
    for (let h = 0; h < 48; h++) {
      const cell = document.createElement("div");
      const s = strategy[d][h];
      cell.className = "slot " + s;
      cell.innerHTML = getIcon(s);
      cell.dataset.day = d;
      cell.dataset.hour = h;
      cell.onclick = () => toggleState(cell);
      row.appendChild(cell);
    }
    container.appendChild(row);
  });
}

function toggleState(cell) {
  const d = +cell.dataset.day;
  const h = +cell.dataset.hour;
  const current = strategy[d][h];
  const next = ["idle", "pumped", "generated"][( ["idle", "pumped", "generated"].indexOf(current) + 1 ) % 3];
  strategy[d][h] = next;
  cell.className = "slot " + next;
  cell.innerHTML = getIcon(next);
  runSimulation();
}

function setAll(state) {
  document.querySelectorAll(".slot").forEach(cell => {
    cell.className = "slot " + state;
    const d = +cell.dataset.day;
    const h = +cell.dataset.hour;
    strategy[d][h] = state;
    cell.innerHTML = getIcon(state);
  });
}

function saveStrategy() {
  localStorage.setItem("weeklyStrategy", JSON.stringify(strategy));
  alert("戦略を保存しました。");
}

function loadStrategy() {
  const saved = localStorage.getItem("weeklyStrategy");
  if (saved) {
    strategy = JSON.parse(saved);
    createGrid();
    runSimulation();
    alert("戦略を復元しました。");
  } else {
    alert("保存された戦略が見つかりません。");
  }
    alert("戦略を復元しました。");
  } else {
    alert("保存された戦略が見つかりません。");
  }
}

function bankMoney() {
  const lastTotal = window.lastSimulatedTotal || 0;
  localStorage.setItem("bankedMoney", lastTotal);
  alert(`貯金しました！ ${lastTotal.toLocaleString()} 円を金庫に保存しました。`);
}

function renderPriceIndicators(priceList) {
  for (let d = 0; d < 7; d++) {
    const dailyPrices = priceList.slice(d * 48, (d + 1) * 48);
    const bar = document.getElementById(`price-day-${d}`);
    const min = Math.min(...dailyPrices);
    const max = Math.max(...dailyPrices);
    bar.innerHTML = "";
    dailyPrices.forEach(p => {
      const seg = document.createElement("div");
      const ratio = (p - min) / (max - min + 0.0001);
      const hue = 240 - ratio * 240;
      seg.style.backgroundColor = `hsl(${hue}, 100%, 50%)`;
      bar.appendChild(seg);
    });
  }
}

async function runSimulation() {
  const start = new Date(document.getElementById("startDate").value);
  const priceList = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const y = date.getFullYear();
    const m = ('0' + (date.getMonth() + 1)).slice(-2);
    const d = ('0' + date.getDate()).slice(-2);
    const key = `${y}/${m}/${d}`;
    const dayPrices = priceData[key] || Array(48).fill({ price: 10 });
    priceList.push(...dayPrices.map(p => p.price));
  }

  renderPriceIndicators(priceList);

  const data = [];
  const water = [];
  let total = startingCapital;
  let volume = 0;
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 48; h++) {
      const s = strategy[d][h];
      const price = priceList[d * 48 + h] || 0;
      let delta = 0;
      if (s === "pumped") {
        delta = -price / PUMP_EFFICIENCY * ENERGY_PER_SLOT * KWH_PER_GWH * SLOT_HOURS;
        volume += ENERGY_PER_SLOT;
      }
      if (s === "generated") {
        delta = price * GENERATE_EFFICIENCY * ENERGY_PER_SLOT * KWH_PER_GWH * SLOT_HOURS;
        volume -= ENERGY_PER_SLOT;
      }
      total += delta;
      data.push(total / 10000);
      water.push(Math.max(0, volume));
    }
  }
  window.lastSimulatedTotal = total;
  showCharts(data, water);
}

function showCharts(data, water) {
  const ctx1 = document.getElementById("profitChart").getContext("2d");
  const ctx2 = document.getElementById("waterChart").getContext("2d");
  if (profitChart) profitChart.destroy();
  if (waterChart) waterChart.destroy();
  profitChart = new Chart(ctx1, {
    type: 'line',
    data: {
      labels: Array.from({ length: data.length }, (_, i) => i),
      datasets: [{
        label: '資産（万円）',
        data,
        borderColor: 'green',
        tension: 0.1,
        fill: false
      }]
    },
    options: {
      scales: {
        x: { title: { display: true, text: "時間スロット" } },
        y: { title: { display: true, text: "累積資産 (万円)" } }
      }
    }
  });　
  waterChart = new Chart(ctx2, {
    type: 'line',
    data: {
      labels: Array.from({ length: water.length }, (_, i) => i),
      datasets: [{
        label: '上池水量（GWh）',
        data: water,
        borderColor: 'blue',
        tension: 0.1,
        fill: false
      }]
    },
    options: {
      scales: {
        x: { title: { display: true, text: "時間スロット" } },
        y: { title: { display: true, text: "水量 (GWh)" } }
      }
    }
  });
}

async function loadPriceData() {
  const res = await fetch(PRICE_DATA_URL);
  priceData = await res.json();
}

loadPriceData().then(() => {
  createGrid();
  setTimeout(runSimulation, 100);
  createGrid();
  runSimulation(); // 初期表示時に自動実行
});
