// Rewards Optimizer v2
// - Kiwi Neon milestone-aware, back-loaded planning
// - SBI SimplyCLICK 10X / 5X / 1X routes
// - Per-method monthly cap tracking with "I used this" button
// All persistent data stored in localStorage. [web:554][web:567]

const METHODS_KEY = "rewardMethods_v2";
const STATE_KEY = "rewardAppState_v1";

// --- Default methods (routes) ---
// Card % is fixed per route except Kiwi Neon, which is dynamic.
const defaultMethods = [
  {
    id: "kiwi_neon",
    name: "Kiwi UPI (Neon) – eligible spends",
    active: true,
    type: "kiwi_neon",
    // You normally won't change these per transaction:
    voucherDiscountPct: 0,
    extraPortalRewardPct: 0,
    cardRewardPct: 0, // computed dynamically
    floatBenefitPct: 0,
    // Approx monthly cashback cap ≈ 2% of 91,000 limit ≈ 1,800. Adjust if real data differs. [web:392][web:698]
    monthlyCapValue: 1800,
    utilisationLimitPct: 30,
    currentUtilisationPct: 15
  },
  {
    id: "sbi_10x_online",
    name: "SBI SimplyCLICK – 10X online / SimplyCLICK GyFTR",
    active: true,
    type: "sbi_10x",
    voucherDiscountPct: 0,
    extraPortalRewardPct: 0,
    // 10 RP/₹100, 1 RP ≈ ₹0.25 → 2.5% effective. [web:742][web:749]
    cardRewardPct: 2.5,
    floatBenefitPct: 0,
    // 10,000 bonus RPs/month ≈ ₹2,500 value (approx cap for 10X bucket). [web:616][web:744][web:749]
    monthlyCapValue: 2500,
    utilisationLimitPct: 30,
    currentUtilisationPct: 10
  },
  {
    id: "sbi_5x_online",
    name: "SBI SimplyCLICK – 5X other online (incl. SBI Card GyFTR)",
    active: true,
    type: "sbi_5x",
    voucherDiscountPct: 0,
    extraPortalRewardPct: 0,
    // 5 RP/₹100 → 1.25% effective. [web:742][web:749]
    cardRewardPct: 1.25,
    floatBenefitPct: 0,
    // 10,000 bonus RPs/month ≈ ₹2,500 for 5X bucket. [web:616][web:744][web:749]
    monthlyCapValue: 2500,
    utilisationLimitPct: 30,
    currentUtilisationPct: 10
  },
  {
    id: "sbi_1x_offline",
    name: "SBI SimplyCLICK – 1X offline / other",
    active: true,
    type: "sbi_1x",
    voucherDiscountPct: 0,
    extraPortalRewardPct: 0,
    // 1 RP/₹100 → 0.25%. [web:744][web:749]
    cardRewardPct: 0.25,
    floatBenefitPct: 0,
    monthlyCapValue: 0, // no practical cap
    utilisationLimitPct: 30,
    currentUtilisationPct: 10
  }
  // Future routes (Amex PT, Marriott HDFC etc.) can be added later with active:false.
];

// --- Global app state (caps, Kiwi Neon, etc.) ---
const defaultState = {
  // Per-method monthly reward usage in ₹ (against monthlyCapValue)
  methodRewardUsed: {},

  // Kiwi Neon planning
  neonYearStart: "2025-08-02", // your Neon start date [web:704][memory:734]
  kiwiNeonTargetAnnualSpend: 150000, // ₹1.5L target
  kiwiNeonYtdSpend: 94644, // starting from your current eligible Neon spends [memory:734]

  // For resetting monthly caps
  lastMonthKey: null
};

// --- localStorage helpers --- [web:554][web:567]

function loadMethods() {
  try {
    const raw = localStorage.getItem(METHODS_KEY);
    if (!raw) return defaultMethods;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultMethods;
    return parsed;
  } catch (e) {
    console.warn("Failed to load methods, using defaults", e);
    return defaultMethods;
  }
}

function saveMethods(methods) {
  try {
    localStorage.setItem(METHODS_KEY, JSON.stringify(methods));
  } catch (e) {
    console.warn("Failed to save methods", e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return { ...defaultState };
    const parsed = JSON.parse(raw);
    return { ...defaultState, ...parsed };
  } catch (e) {
    console.warn("Failed to load state, using defaults", e);
    return { ...defaultState };
  }
}

function saveState() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(appState));
  } catch (e) {
    console.warn("Failed to save state", e);
  }
}

// --- Month / Neon-year resets ---

function getCurrentMonthKey() {
  const now = new Date();
  return now.getFullYear() + "-" + (now.getMonth() + 1);
}

function ensureMonthlyReset() {
  const currentKey = getCurrentMonthKey();
  if (appState.lastMonthKey !== currentKey) {
    // New month → reset per-method monthly reward usage
    appState.methodRewardUsed = {};
    appState.lastMonthKey = currentKey;
    saveState();
  }
}

function ensureNeonYearRollover() {
  const start = new Date(appState.neonYearStart || defaultState.neonYearStart);
  const now = new Date();
  const nextStart = new Date(start.getTime());
  nextStart.setFullYear(start.getFullYear() + 1);

  if (now >= nextStart) {
    // Start a new Neon year from this year's same date
    const newStart = new Date(nextStart.getFullYear(), start.getMonth(), start.getDate());
    appState.neonYearStart = newStart.toISOString().slice(0, 10);
    appState.kiwiNeonYtdSpend = 0;
    saveState();
  }
}

// --- In-memory data ---

let methods = loadMethods();
let appState = loadState();
ensureMonthlyReset();
ensureNeonYearRollover();

let lastResults = [];

// --- Methods table (settings) UI ---

function renderMethodsTable() {
  const container = document.getElementById("methodsTableContainer");
  container.innerHTML = "";

  const table = document.createElement("table");
  table.className = "methods-table";

  const headerRow = document.createElement("tr");
  headerRow.innerHTML = `
    <th>Active</th>
    <th>Method</th>
    <th>Voucher %</th>
    <th>Portal %</th>
    <th>Card %</th>
    <th>Float %</th>
    <th>Monthly cap (₹)</th>
    <th>Util. limit %</th>
    <th>Current util. %</th>
  `;
  table.appendChild(headerRow);

  methods.forEach((m, index) => {
    const row = document.createElement("tr");

    // Active checkbox
    const activeCell = document.createElement("td");
    const activeInput = document.createElement("input");
    activeInput.type = "checkbox";
    activeInput.checked = !!m.active;
    activeInput.addEventListener("change", () => {
      methods[index].active = activeInput.checked;
      saveMethods(methods);
    });
    activeCell.appendChild(activeInput);
    row.appendChild(activeCell);

    // Name (read-only)
    const nameCell = document.createElement("td");
    nameCell.textContent = m.name;
    row.appendChild(nameCell);

    // Numeric editable cells
    function makeNumberCell(field, step = "0.1") {
      const cell = document.createElement("td");
      const input = document.createElement("input");
      input.type = "number";
      input.step = step;
      input.value = m[field] != null ? m[field] : 0;
      input.addEventListener("change", () => {
        const val = parseFloat(input.value) || 0;
        methods[index][field] = val;
        saveMethods(methods);
      });
      cell.appendChild(input);
      return cell;
    }

    row.appendChild(makeNumberCell("voucherDiscountPct"));
    row.appendChild(makeNumberCell("extraPortalRewardPct"));

    // Card %: for Kiwi Neon, this is not used but you can override if you want
    row.appendChild(makeNumberCell("cardRewardPct"));

    row.appendChild(makeNumberCell("floatBenefitPct"));
    row.appendChild(makeNumberCell("monthlyCapValue", "1"));
    row.appendChild(makeNumberCell("utilisationLimitPct"));
    row.appendChild(makeNumberCell("currentUtilisationPct"));

    table.appendChild(row);
  });

  container.appendChild(table);
}

// --- Kiwi Neon effective % (with milestone & back-loaded pacing) ---

function computeKiwiEffectivePct(amount) {
  const baseLow = 2; // post-milestone base on eligible UPI [web:378][web:725]
  const high = 5;    // effective on first ₹1.5L (2% instant + 3% milestone) [web:378][web:706]
  const target = appState.kiwiNeonTargetAnnualSpend || 150000;
  const ytd = appState.kiwiNeonYtdSpend || 0;

  const remainingAtHigh = Math.max(0, target - ytd);
  let pctBase;

  if (remainingAtHigh <= 0) {
    pctBase = baseLow;
  } else if (amount <= remainingAtHigh) {
    pctBase = high;
  } else {
    const partHigh = remainingAtHigh;
    const partLow = amount - remainingAtHigh;
    const reward =
      (high / 100) * partHigh + (baseLow / 100) * partLow;
    pctBase = (reward / amount) * 100;
  }

  // Back-loaded pacing: slow early, faster later. [web:730][web:724]
  const start = new Date(appState.neonYearStart || defaultState.neonYearStart);
  const now = new Date();
  const end = new Date(start.getTime());
  end.setFullYear(start.getFullYear() + 1);

  const totalMs = Math.max(1, end - start);
  const elapsedMs = Math.min(Math.max(0, now - start), totalMs);
  const frac = elapsedMs / totalMs; // 0..1
  const idealYtd = target * (frac * frac); // back-loaded curve

  const tolerance = 0.2; // 20% ahead of ideal allowed before we penalise
  if (ytd > idealYtd * (1 + tolerance)) {
    // Ahead of plan: soften Kiwi a bit but never below baseLow
    const scaled = pctBase * 0.8;
    pctBase = Math.max(baseLow, scaled);
  }

  return pctBase;
}

// --- Core calculation logic ---

function calculateForAmount(amount, brand) {
  const candidates = [];

  methods.forEach((m) => {
    if (!m.active) return;

    // Determine card % for this transaction
    let cardPct;
    if (m.type === "kiwi_neon") {
      cardPct = computeKiwiEffectivePct(amount);
    } else {
      cardPct = m.cardRewardPct || 0;
    }

    const voucherPct = m.voucherDiscountPct || 0;
    const portalPct = m.extraPortalRewardPct || 0;
    const floatPct = m.floatBenefitPct || 0;

    const effectivePctRaw = voucherPct + portalPct + cardPct + floatPct;
    if (effectivePctRaw <= 0) return;

    const cap = m.monthlyCapValue || 0;
    const used = appState.methodRewardUsed[m.id] || 0;
    let rewardValue = (effectivePctRaw / 100) * amount;
    let capped = false;

    if (cap > 0) {
      const headroom = cap - used;
      if (headroom <= 0) {
        // Cap fully used: only discount/portal/float matter, card reward ignored
        const nonCardPct = voucherPct + portalPct + floatPct;
        rewardValue = (nonCardPct / 100) * amount;
        capped = true;
      } else if (headroom < rewardValue) {
        rewardValue = headroom;
        capped = true;
      }
    }

    const effectivePct = amount > 0 ? (rewardValue / amount) * 100 : 0;
    const utilisationLimit = m.utilisationLimitPct || 100;
    const currentUtil = m.currentUtilisationPct || 0;
    const utilisationWarning = currentUtil >= utilisationLimit;

    candidates.push({
      method: m,
      brand,
      amount,
      rewardValue,
      effectivePct,
      capped,
      utilisationWarning
    });
  });

  candidates.sort((a, b) => b.rewardValue - a.rewardValue);
  lastResults = candidates;
  return candidates;
}

function formatMoney(x) {
  return "₹" + x.toFixed(0);
}

// --- Mark a result as "used" so caps/milestones update ---

function markResultUsed(index) {
  if (!lastResults || !lastResults[index]) return;
  const res = lastResults[index];
  const m = res.method;

  // Update per-method monthly reward usage
  const prevUsed = appState.methodRewardUsed[m.id] || 0;
  appState.methodRewardUsed[m.id] = prevUsed + res.rewardValue;

  // Update Kiwi Neon YTD spend when Kiwi route actually used
  if (m.type === "kiwi_neon") {
    appState.kiwiNeonYtdSpend =
      (appState.kiwiNeonYtdSpend || 0) + res.amount;
  }

  saveState();
  renderMethodsTable();
  // Optional: simple acknowledgement in results
  const resultsArea = document.getElementById("resultsArea");
  const note = document.createElement("p");
  note.className = "small";
  note.textContent =
    "Recorded this transaction for caps/milestones. Future calculations will account for it.";
  resultsArea.appendChild(note);
}

// expose for inline onclick
window.markResultUsed = markResultUsed;

// --- Render results UI ---

function renderResults() {
  const brandInput = document.getElementById("brandInput");
  const amountInput = document.getElementById("amountInput");
  const resultsArea = document.getElementById("resultsArea");

  const brand = brandInput.value.trim() || "This brand";
  const amount = parseFloat(amountInput.value);

  if (!amount || amount <= 0) {
    resultsArea.innerHTML = "<p>Please enter a valid amount.</p>";
    return;
  }

  const results = calculateForAmount(amount, brand);

  if (!results || results.length === 0) {
    resultsArea.innerHTML =
      "<p>No active methods with positive reward %. Check your settings.</p>";
    return;
  }

  const best = results[0];
  const second = results[1];
  const third = results[2];

  let html = "";

  function resultBlock(label, res, idx) {
    if (!res) return "";
    let block = `<p><strong>${label}:</strong><br>
      ${brand} – ${formatMoney(res.amount)}<br>
      Use <strong>${res.method.name}</strong><br>
      Estimated benefit: <strong>${formatMoney(
        res.rewardValue
      )}</strong> (~${res.effectivePct.toFixed(2)}%)`;
    if (res.capped) {
      block += ` <span class="warning">(partially / fully capped)</span>`;
    }
    if (res.utilisationWarning) {
      block += ` <span class="warning">(utilisation at/above your limit)</span>`;
    }
    block += `<br><button onclick="markResultUsed(${idx})">I used this</button>`;
    block += `</p>`;
    return block;
  }

  html += resultBlock("Best option", best, 0);
  html += resultBlock("Next best", second, 1);
  html += resultBlock("Third option", third, 2);

  html += `<p class="small">
    After you actually use a method, click "I used this" on that option.
    The app will update monthly caps and Kiwi Neon progress automatically,
    so future recommendations stay accurate.
  </p>`;

  resultsArea.innerHTML = html;
}

// --- Wire up on load ---

window.addEventListener("DOMContentLoaded", () => {
  ensureMonthlyReset();
  ensureNeonYearRollover();
  renderMethodsTable();
  const btn = document.getElementById("calculateBtn");
  btn.addEventListener("click", renderResults);
});
