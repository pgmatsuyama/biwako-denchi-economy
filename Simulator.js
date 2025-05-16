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
const weekDays = ['日', '月', '火', '水', '木', '金', '土'];


let weatherIcons = {};
fetch('data/weather_icon_temp_2025_0401_0515.json')
  .then(response => response.json())
  .then(data => {
    weatherIcons = data;
    renderCalendarWeather(); // 読み込み後に描画　２０２５０５１６
  });


document.addEventListener('mousedown', () => isDrawing = true);
document.addEventListener('mouseup', () => isDrawing = false);
document.addEventListener('touchstart', () => isDrawing = true);
document.addEventListener('touchend', () => isDrawing = false);

// 日付変更時に天気も再描画
document.getElementById("startDate").addEventListener("change", renderCalendarRow);

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
function getDynamicWeekdays(baseDateStr, weatherIcons) {
  const baseDate = new Date(baseDateStr);
  return [...Array(7)].map((_, i) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i);

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const ymdStr = `${y}/${m}/${day}`;

    const label = "日月火水木金土"[d.getDay()];
    const icon = weatherIcons?.[ymdStr]?.icon || "？";
    const temp = weatherIcons?.[ymdStr]?.temp !== undefined ? ` ${weatherIcons[ymdStr].temp}℃` : "";

    return `${label}<br>${m}/${day} ${icon}${temp}`;
  });
}
/*
function getDynamicWeekdays(baseDateStr) {
  const baseDate = new Date(baseDateStr);
  return [...Array(7)].map((_, i) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i);
    const label = "日月火水木金土"[d.getDay()];
    return `${label}\n${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
  });
}
*/
function renderCalendarWeather() {
  const dateCells = document.querySelectorAll('.calendar-day');
  dateCells.forEach(cell => {
    const dateStr = cell.getAttribute('data-date'); // 例: "2025/04/02"
    if (weatherIcons[dateStr]) {
      const icon = document.createElement('span');
      icon.textContent = weatherIcons[dateStr];
      icon.style.marginLeft = '0.3em';
      icon.title = '天気';
      cell.appendChild(icon);
    }
  });
}
function renderCalendarRow() {
  const row = document.getElementById("calendar-row");
  row.innerHTML = "";
  const startDateStr = document.getElementById("startDate").value;
  const startDate = new Date(startDateStr);

  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const ymdStr = `${y}/${m}/${d}`;

    const dateStr = `${m}/${d}`;
    const weekday = weekDays[date.getDay()];

    const weatherData = weatherIcons[ymdStr];
    let weatherStr = "？";

    if (weatherData) {
      weatherStr = weatherData.icon;
      if (weatherData.temp !== undefined) {
        weatherStr += ` ${weatherData.temp}℃`;
      }
    }

    const cell = document.createElement("td");
    cell.className = "calendar-day";
    cell.setAttribute("data-date", ymdStr);
    cell.textContent = `${weekday} ${dateStr} ${weatherStr}`;
    row.appendChild(cell);
  }
}
/*
function renderCalendarRow() {
  const row = document.getElementById("calendar-row");
  row.innerHTML = "";
  const startDateStr = document.getElementById("startDate").value;
  const startDate = new Date(startDateStr);

  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const ymdStr = `${y}/${m}/${d}`; // ← 正確な形式！

    const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
    const weekday = weekDays[date.getDay()];
    const icon = weatherIcons[ymdStr] || "？";

    const cell = document.createElement("td");
    cell.className = "calendar-day";
    cell.setAttribute("data-date", ymdStr);
    cell.textContent = `${weekday} ${dateStr} ${icon}`;
    row.appendChild(cell);
  }
}

function renderCalendarRow() {
  const row = document.getElementById("calendar-row");
  row.innerHTML = "";
  const startDateStr = document.getElementById("startDate").value;
  const startDate = new Date(startDateStr);

  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
    const ymdStr = date.toISOString().slice(0, 10).replace(/-/g, "/");
    const weekday = weekDays[date.getDay()];
    const icon = weatherIcons[ymdStr] || "？";

    const cell = document.createElement("td");
    cell.className = "calendar-day";
    cell.setAttribute("data-date", ymdStr);
    cell.textContent = `${weekday} ${dateStr} ${icon}`;
    row.appendChild(cell);
  }
}
*/
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
console.log("読み込んだ天気マークデータ:", weatherIcons);
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
    `貯金しました！\n${lastTotal.toLocaleString()} 円を金庫に保存しました。\n\n[OK] → ゲームをリセット\n[キャンセル] → このまま続行`
  );

  if (reset) {
    // 金庫は残して他をクリア（戦略や現在値など）
    lastTotal=0;
    startingCapital=0;
  localStorage.setItem("bankedMoney", lastTotal);
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
});


