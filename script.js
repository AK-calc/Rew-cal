// Simple rewards optimizer for your use case.
// All data is stored in localStorage under the key "rewardMethods". [web:554][web:558]

const STORAGE_KEY = "rewardMethods_v1";

// --- Default methods (you can tweak values in the UI) ---
const defaultMethods = [
  {
    id: "kiwi_upi",
    name: "Kiwi UPI (direct)",
    active: true,
    type: "upi",
    // Percentages as numbers, e.g. 3 means 3%
    voucherDiscountPct: 0,        // usually 0 for direct UPI
    extraPortalRewardPct: 0,
    cardRewardPct: 3,             // e.g. 3% effective on eligible spends
    floatBenefitPct: 0,
    monthlyCapValue: 1000,        // ₹ max cashback per month (adjust)
    usedRewardThisCycle: 0,       // ₹ used so far (edit in UI)
    utilisationLimitPct: 30,      // e.g. 30% of credit limit comfort
    currentUtilisationPct: 15     // your current approx utilisation
  },
  {
    id: "sbi_gyftr",
    name: "SBI SimplyCLICK + SBI GyFTR",
    active: true,
    type: "card+portal",
    voucherDiscountPct: 5,        // typical GyFTR discount (edit per brand)
    extraPortalRewardPct: 0,
    cardRewardPct: 4,             // your % value for SimplyCLICK points
    floatBenefitPct: 0,
    monthlyCapValue: 3000,        // optional cap you track
    usedRewardThisCycle: 0,
    utilisationLimitPct: 50,
    currentUtilisationPct: 20
  },
  {
    id: "generic_gyftr_upi",
    name: "Generic GyFTR + UPI",
    active: true,
    type: "portal+upi",
    voucherDiscountPct: 3,        // typical generic discount
    extraPortalRewardPct: 0,
    cardRewardPct: 2,             // assume ~2% via Kiwi/bank UPI if rewarded
    floatBenefitPct: 0,
    monthlyCapValue: 2000,
    usedRewardThisCycle: 0,
    utilisationLimitPct: 50,
    currentUtilisationPct: 20
  },
  {
    id: "amex_rm",
    name: "Amex PT + Reward Multiplier (future)",
    active: false,                // disabled until you get the card
    type: "card+portal",
    voucherDiscountPct: 4,        // sample; tweak later
    extraPortalRewardPct: 0,
    cardRewardPct: 6,             // includes 3X MR + milestone value per ₹
    floatBenefitPct: 0,
    monthlyCapValue: 4000,
    usedRewardThisCycle: 0,
    utilisationLimitPct: 50,
    currentUtilisationPct: 0
  },
  {
    id: "marriott_smartbuy",
    name: "Marriott HDFC + SmartBuy (future)",
    active: false,                // disabled until you get the card
    type: "card+portal",
    voucherDiscountPct: 5,        // sample discount; tweak later
    extraPortalRewardPct: 0,
    cardRewardPct: 5,             // your % valuation of Bonvoy + SmartBuy
    floatBenefitPct: 0,
    monthlyCapValue: 4000,
    usedRewardThisCycle: 0,
    utilisationLimitPct: 50,
    currentUtilisationPct: 0
  }
];

// --- Helpers to load/save methods from localStorage ---

function loadMethods() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultMethods;
    const parsed = JSON.parse(raw);
    // Basic safety: fall back if shape looks wrong
    if (!Array.isArray(parsed)) return defaultMethods;
    return parsed;
  } catch (e) {
    console.warn("Failed to load methods, using defaults", e);
    return defaultMethods;
  }
}

function saveMethods(methods) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(methods));
  } catch (e) {
    console.warn("Failed to save methods", e);
  }
}

// --- UI rendering for methods table ---

let methods = loadMethods();

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
    <th>Used this cycle (₹)</th>
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
      input.value = m[field];
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
    row.appendChild(makeNumberCell("cardRewardPct"));
    row.appendChild(makeNumberCell("floatBenefitPct"));
    row.appendChild(makeNumberCell("monthlyCapValue", "1"));
    row.appendChild(makeNumberCell("usedRewardThisCycle", "1"));
    row.appendChild(makeNumberCell("utilisationLimitPct"));
    row.appendChild(makeNumberCell("currentUtilisationPct"));

    table.appendChild(row);
  });

  container.appendChild(table);
}

// --- Core calculation logic ---

function calculateForAmount(amount, brand) {
  const candidates = [];

  methods.forEach((m) => {
    if (!m.active) return;

    const effectivePct =
      (m.voucherDiscountPct || 0) +
      (m.extraPortalRewardPct || 0) +
      (m.cardRewardPct || 0) +
      (m.floatBenefitPct || 0);

    if (effectivePct <= 0) return; // skip useless methods

    const potentialReward = (effectivePct / 100) * amount;
    const cap = m.monthlyCapValue || 0;
    const used = m.usedRewardThisCycle || 0;

    // Cap handling
    let capped = false;
    let effectiveReward = potentialReward;

    if (cap > 0 && used >= cap) {
      // fully capped, ignore this method
      return;
    } else if (cap > 0 && used + potentialReward > cap) {
      // partially capped: only remaining headroom counts
      const headroom = cap - used;
      effectiveReward = headroom;
      capped = true;
    }

    const effectivePctAfterCap =
      amount > 0 ? (effectiveReward / amount) * 100 : 0;

    // Utilisation check (soft warning)
    const utilisationLimit = m.utilisationLimitPct || 100;
    const currentUtil = m.currentUtilisationPct || 0;
    const utilisationWarning = currentUtil >= utilisationLimit;

    candidates.push({
      method: m,
      brand,
      amount,
      effectivePct: effectivePctAfterCap,
      rewardValue: effectiveReward,
      capped,
      utilisationWarning
    });
  });

  // Sort by reward value (₹) descending
  candidates.sort((a, b) => b.rewardValue - a.rewardValue);

  return candidates;
}

function formatMoney(x) {
  return "₹" + x.toFixed(0);
}

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

  if (results.length === 0) {
    resultsArea.innerHTML =
      "<p>No active methods with positive reward %. Check your settings.</p>";
    return;
  }

  const best = results[0];
  const second = results[1];
  const third = results[2];

  let html = "";

  html += `<p><strong>Best option:</strong><br>
    ${brand} – ${formatMoney(amount)}<br>
    Use <strong>${best.method.name}</strong><br>
    Estimated benefit: <strong>${formatMoney(
      best.rewardValue
    )}</strong> (~${best.effectivePct.toFixed(2)}%)`;

  if (best.capped) {
    html += ` <span class="warning">(partially capped)</span>`;
  }
  if (best.utilisationWarning) {
    html += ` <span class="warning">(utilisation at/above your limit)</span>`;
  }
  html += `</p>`;

  if (second) {
    html += `<p><strong>Next best:</strong><br>
      Use <strong>${second.method.name}</strong><br>
      Benefit: ${formatMoney(second.rewardValue)} (~${second.effectivePct.toFixed(
      2
    )}%)`;
    if (second.capped) {
      html += ` <span class="warning">(partially capped)</span>`;
    }
    if (second.utilisationWarning) {
      html += ` <span class="warning">(utilisation at/above your limit)</span>`;
    }
    html += `</p>`;
  }

  if (third) {
    html += `<p><strong>Third option:</strong><br>
      Use <strong>${third.method.name}</strong><br>
      Benefit: ${formatMoney(third.rewardValue)} (~${third.effectivePct.toFixed(
      2
    )}%)`;
    if (third.capped) {
      html += ` <span class="warning">(partially capped)</span>`;
    }
    if (third.utilisationWarning) {
      html += ` <span class="warning">(utilisation at/above your limit)</span>`;
    }
    html += `</p>`;
  }

  html += `<p class="small">
    After you actually use a method, remember to update
    the "Used this cycle (₹)" and "Current util. %" values
    in the table above so future calculations remain accurate.
  </p>`;

  resultsArea.innerHTML = html;
}

// --- Wire up events on page load ---

window.addEventListener("DOMContentLoaded", () => {
  renderMethodsTable();
  const btn = document.getElementById("calculateBtn");
  btn.addEventListener("click", renderResults);
});
