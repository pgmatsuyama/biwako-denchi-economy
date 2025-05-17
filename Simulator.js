// simulator.js with drag and touch support
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
let currentMode = "idle";
let isDrawing = false;

document.addEventListener('mousedown', () => isDrawing = true);
document.addEventListener('mouseup', () => isDrawing = false);
document.addEventListener('touchstart', () => isDrawing = true);
document.addEventListener('touchend', () => isDrawing = false);

document.getElementById("startDate").addEventListener("change", () => {
  createGrid();
  runSimulation();
});

function setMode(mode) {
  currentMode = mode;
  document.querySelectorAll("button[data-mode]").forEach(btn => btn.classList.remove("active"));
  const btn = document.querySelector(`button[data-mode="${mode}"]`);
  if (btn) btn.classList.add("active");
}

function createGrid() {
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

      cell.addEventListener('mouseover', () => {
        if (isDrawing) toggleState(cell);
      });

      cell.addEventListener('touchmove', e => {
        const touch = e.touches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        if (target && target.classList.contains('slot')) toggleState(target);
      });

      row.appendChild(cell);
    }
    container.appendChild(row);
  });
  runSimulation();
}

function getDynamicWeekdays(baseDateStr) {
  const baseDate = new Date(baseDateStr);
  return [...Array(7)].map((_, i) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i);
    const label = "日月火水木金土"[d.getDay()];
    return `${label}\n${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
  });
}

function getIcon(state) {
  return { pumped: "💧", generated: "⚡", idle: "□" }[state];
}

function toggleState(cell) {
  const d = +cell.dataset.day;
  const h = +cell.dataset.hour;
  strategy[d][h] = currentMode;
  cell.className = "slot " + currentMode;
  cell.innerHTML = getIcon(currentMode);
  runSimulation();
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
    alert("戦略を復元しました。");
  } else {
    alert("保存された戦略が見つかりません。");
  }
}
function bankMoney() {
  const lastTotal = window.lastSimulatedTotal || 0;
  localStorage.setItem("bankedMoney", lastTotal);

  const reset = window.confirm(
    `貯金しました！\n${lastTotal.toLocaleString()} 円を金庫に保存しました。\n\n[OK] → ゲームをリセット 貯金を０にします\n[キャンセル] → このまま続行`
  );

  if (reset) {
    // 金庫は残して他をクリア（戦略や現在値など）
  
    startingCapital=0;
    localStorage.setItem("bankedMoney", startingCapital);
    localStorage.removeItem("strategy");
    localStorage.removeItem("currentMoney");
    localStorage.removeItem("slotData"); // 他にも消すものがあれば追加
    alert("ゲームをリセットします。");
    location.reload(); // ページをリロードして初期化
  } else {
    alert("現在の状態を維持して続行します。");
  }
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
document.getElementById("totalProfitDisplay").textContent =
  `資産：${Math.round(total).toLocaleString()} 円`;
}

// Simulator with unified chart
//let profitChart;
function showCharts(data, water) {
  const ctx = document.getElementById("profitChart").getContext("2d");
  if (profitChart) profitChart.destroy();

  profitChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: Array.from({ length: data.length }, (_, i) => i),
      datasets: [
        {
          label: '資産（万円）',
          data: data,
          borderColor: 'green',
          backgroundColor: 'rgba(0,0,0,0)',
          yAxisID: 'y',
          tension: 0.1,
          fill: false,
          borderWidth: 2
        },
        {
          label: '上池水量（GWh）',
          data: water,
          borderColor: 'rgba(0, 150, 255, 0.5)',
          backgroundColor: 'rgba(0, 150, 255, 0.2)',
          yAxisID: 'y1',
          type: 'line',
          fill: 'origin',
          tension: 0.2,
          borderWidth: 1,
          pointRadius: 0
        },
        {
          label: '上池容量上限 (16GWh)',
          data: Array(data.length).fill(16),
          borderColor: 'red',
          borderDash: [5, 5],
          borderWidth: 1,
          fill: false,
          yAxisID: 'y1',
          pointRadius: 0,
          tension: 0
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'top' },
        title: {
          display: true,
          text: '資産と上池水量の推移'
        }
      },
      scales: {
        x: {
          title: { display: true, text: "時間スロット" },
          ticks: { autoSkip: true, maxTicksLimit: 24 }
        },
        y: {
          type: 'linear',
          position: 'left',
          title: { display: true, text: '累積資産 (万円)' },
          beginAtZero: true
        },
        y1: {
          type: 'linear',
          position: 'right',
          title: { display: true, text: '水量 (GWh)' },
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          suggestedMax: 17
        }
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
});
