// Simple localStorage helpers
const STORAGE_KEY = "rewardsCalculatorState_v2";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// Default model
const defaultState = {
  cards: {
    sbi: {
      holderName: "YOUR NAME",
      last4: "1234",
      network: "MASTERCARD",
      limit: 252000,
      comfortPercent: 30,
      cycleSpendUsed: 0
    },
    kiwi: {
      holderName: "YOUR NAME",
      last4: "5678",
      network: "RUPAY",
      limit: 91000,
      comfortPercent: 30,
      cycleSpendUsed: 0,
      neonStartDate: "2025-08-02",
      neonTargetAnnualSpend: 150000,
      neonYtdEligibleSpend: 94644
    }
  },
  methods: [
    {
      id: "kiwi_neon_upi",
      label: "Kiwi UPI (Neon)",
      cardKey: "kiwi",
      baseCardPercent: null, // dynamic
      monthlyRewardCap: 1800,
      rewardUsedThisCycle: 0,
      active: true,
      showVoucherPortal: false
    },
    {
      id: "sbi_10x",
      label: "SBI SimplyCLICK – 10X / SimplyCLICK GyFTR",
      cardKey: "sbi",
      baseCardPercent: 2.5,
      monthlyRewardCap: 2500,
      rewardUsedThisCycle: 0,
      active: true,
      showVoucherPortal: true
    },
    {
      id: "sbi_5x",
      label: "SBI SimplyCLICK – other online (5X)",
      cardKey: "sbi",
      baseCardPercent: 1.25,
      monthlyRewardCap: 2500,
      rewardUsedThisCycle: 0,
      active: true,
      showVoucherPortal: true
    },
    {
      id: "sbi_offline",
      label: "SBI – offline / other (1X)",
      cardKey: "sbi",
      baseCardPercent: 0.25,
      monthlyRewardCap: 999999, // effectively uncapped
      rewardUsedThisCycle: 0,
      active: false,
      showVoucherPortal: false
    }
  ]
};

let appState = loadState() || defaultState;

// DOM references
let methodsTbody;
let advMethodsTbody;
let resultsContainer;

// Render methods table in main view
function renderMethodsTable() {
  methodsTbody.innerHTML = "";
  appState.methods.forEach((m) => {
    const tr = document.createElement("tr");

    // Active toggle
    const tdActive = document.createElement("td");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = m.active;
    cb.addEventListener("change", () => {
      m.active = cb.checked;
      saveState(appState);
    });
    tdActive.appendChild(cb);
    tr.appendChild(tdActive);

    // Method label
    const tdLabel = document.createElement("td");
    tdLabel.textContent = m.label;
    tr.appendChild(tdLabel);

    // Voucher %
    const tdVoucher = document.createElement("td");
    if (m.showVoucherPortal) {
      const inp = document.createElement("input");
      inp.type = "number";
      inp.step = "0.1";
      inp.value = 0;
      inp.className = "voucher-input";
      inp.dataset.methodId = m.id;
      tdVoucher.appendChild(inp);
    } else {
      tdVoucher.textContent = "—";
    }
    tr.appendChild(tdVoucher);

    // Portal %
    const tdPortal = document.createElement("td");
    if (m.showVoucherPortal) {
      const inp = document.createElement("input");
      inp.type = "number";
      inp.step = "0.1";
      inp.value = 0;
      inp.className = "portal-input";
      inp.dataset.methodId = m.id;
      tdPortal.appendChild(inp);
    } else {
      tdPortal.textContent = "—";
    }
    tr.appendChild(tdPortal);

    // Card %
    const tdCard = document.createElement("td");
    if (m.id === "kiwi_neon_upi") {
      tdCard.textContent = "Auto (Neon 5%/2%)";
    } else {
      tdCard.textContent = `${m.baseCardPercent.toFixed(2)}%`;
    }
    tr.appendChild(tdCard);

    // Notes
    const tdNotes = document.createElement("td");
    if (m.id === "kiwi_neon_upi") {
      tdNotes.textContent = "Kiwi Neon Scan & Pay only; no voucher/portal layer here.";
    } else {
      tdNotes.textContent = "";
    }
    tr.appendChild(tdNotes);

    methodsTbody.appendChild(tr);
  });
}

// Advanced: methods table for caps & base Card %
function renderAdvancedMethodsTable() {
  advMethodsTbody.innerHTML = "";
  appState.methods.forEach((m) => {
    const tr = document.createElement("tr");

    const tdLabel = document.createElement("td");
    tdLabel.textContent = m.label;
    tr.appendChild(tdLabel);

    const tdCap = document.createElement("td");
    const inpCap = document.createElement("input");
    inpCap.type = "number";
    inpCap.value = m.monthlyRewardCap;
    inpCap.addEventListener("change", () => {
      m.monthlyRewardCap = Number(inpCap.value) || 0;
      saveState(appState);
    });
    tdCap.appendChild(inpCap);
    tr.appendChild(tdCap);

    const tdCard = document.createElement("td");
    if (m.id === "kiwi_neon_upi") {
      tdCard.textContent = "Auto (Neon)";
    } else {
      const inpCard = document.createElement("input");
      inpCard.type = "number";
      inpCard.step = "0.1";
      inpCard.value = m.baseCardPercent;
      inpCard.addEventListener("change", () => {
        m.baseCardPercent = Number(inpCard.value) || 0;
        saveState(appState);
      });
      tdCard.appendChild(inpCard);
    }
    tr.appendChild(tdCard);

    advMethodsTbody.appendChild(tr);
  });
}

// Utilisation helpers
function utilisationPercent(card, extraSpend = 0) {
  if (!card.limit || card.limit <= 0) return 0;
  return ((card.cycleSpendUsed + extraSpend) / card.limit) * 100;
}

function utilisationClass(pct) {
  if (pct <= 30) return "util-green";
  if (pct <= 60) return "util-amber";
  if (pct <= 90) return "util-orange";
  return "util-red";
}

// Kiwi Neon effective % including crossing milestone
function getKiwiEffectivePercent(amount) {
  const kiwi = appState.cards.kiwi;
  const target = kiwi.neonTargetAnnualSpend || 150000;
  const ytd = kiwi.neonYtdEligibleSpend || 0;

  const baseAfter = 2; // %
  const baseBefore = 5;

  if (amount <= 0) return baseBefore;

  if (ytd >= target) {
    return baseAfter;
  }
  if (ytd + amount <= target) {
    return baseBefore;
  }

  // Part of txn before milestone, part after
  const partBefore = target - ytd;
  const partAfter = amount - partBefore;

  const rewardBefore = (baseBefore / 100) * partBefore;
  const rewardAfter = (baseAfter / 100) * partAfter;
  const totalReward = rewardBefore + rewardAfter;

  return (totalReward / amount) * 100;
}

// Reward cap logic: approximate, applies to total method %
function applyRewardCap(m, effectivePercent, amount) {
  if (!m.monthlyRewardCap || m.monthlyRewardCap <= 0) {
    return { effectivePercent, capped: false, partiallyCapped: false };
  }

  const potentialReward = (effectivePercent / 100) * amount;
  const remainingCap = m.monthlyRewardCap - m.rewardUsedThisCycle;

  if (remainingCap <= 0) {
    return { effectivePercent: 0, capped: true, partiallyCapped: false };
  }

  if (potentialReward <= remainingCap) {
    return { effectivePercent, capped: false, partiallyCapped: false };
  }

  // Partially capped: some of the reward is at full %, rest at 0
  const blendedReward = remainingCap;
  const blendedPercent = (blendedReward / amount) * 100;

  return { effectivePercent: blendedPercent, capped: false, partiallyCapped: true };
}

// Utilisation penalty for ranking
function utilisationPenalty(card, projectedPct) {
  const comfort = card.comfortPercent || 30;
  if (projectedPct <= comfort) return 0;
  if (projectedPct <= comfort * 2) return 0.5;
  if (projectedPct <= 90) return 1;
  return 5;
}

// Read voucher/portal % from table for a method
function getVoucherPortalPercents() {
  const result = {};
  document.querySelectorAll(".voucher-input").forEach((inp) => {
    const id = inp.dataset.methodId;
    result[id] = result[id] || { voucher: 0, portal: 0 };
    result[id].voucher = Number(inp.value) || 0;
  });
  document.querySelectorAll(".portal-input").forEach((inp) => {
    const id = inp.dataset.methodId;
    result[id] = result[id] || { voucher: 0, portal: 0 };
    result[id].portal = Number(inp.value) || 0;
  });
  return result;
}

// Calculate best options
function calculateOptions() {
  const brand = document.getElementById("brandInput").value.trim();
  const amount = Number(document.getElementById("amountInput").value) || 0;

  if (amount <= 0) {
    resultsContainer.innerHTML =
      '<p class="warning">Enter a valid amount in rupees first.</p>';
    return;
  }

  const vp = getVoucherPortalPercents();
  const candidates = [];

  appState.methods.forEach((m) => {
    if (!m.active) return;

    const card = appState.cards[m.cardKey];
    if (!card) return;

    const voucher = vp[m.id]?.voucher || 0;
    const portal = vp[m.id]?.portal || 0;

    let cardPercent;
    if (m.id === "kiwi_neon_upi") {
      cardPercent = getKiwiEffectivePercent(amount);
    } else {
      cardPercent = m.baseCardPercent || 0;
    }

    let effectivePercent = voucher + portal + cardPercent;
    let capInfo = applyRewardCap(m, effectivePercent, amount);
    effectivePercent = capInfo.effectivePercent;

    const projectedUtilPct = utilisationPercent(card, amount);
    const utilPctCurrent = utilisationPercent(card, 0);
    const penalty = utilisationPenalty(card, projectedUtilPct);
    const score = effectivePercent - penalty;

    const rewardValue = (effectivePercent / 100) * amount;

    candidates.push({
      method: m,
      brand,
      amount,
      voucher,
      portal,
      cardPercent,
      rewardValue,
      effectivePercent,
      score,
      card,
      utilPctCurrent,
      projectedUtilPct,
      capInfo
    });
  });

  if (candidates.length === 0) {
    resultsContainer.innerHTML =
      '<p class="warning">No active methods. Enable at least one in the table above.</p>';
    return;
  }

  candidates.sort((a, b) => b.score - a.score);

  const best = candidates[0];
  const nextBest = candidates[1];

  renderResults(best, nextBest);
}

// Render best / next-best cards
function renderResults(best, nextBest) {
  resultsContainer.innerHTML = "";

  [best, nextBest].forEach((item, idx) => {
    if (!item) return;
    const div = document.createElement("div");
    div.className = "result-card";

    const title = document.createElement("div");
    title.className = "result-title";
    title.textContent = idx === 0 ? "Best option" : "Next best option";
    div.appendChild(title);

    const l1 = document.createElement("div");
    l1.className = "result-line";
    l1.textContent = `${item.method.label} – Effective ~${item.effectivePercent.toFixed(
      2
    )}% ⇒ ~₹${item.rewardValue.toFixed(0)} back on ₹${item.amount.toFixed(0)}.`;
    div.appendChild(l1);

    const l2 = document.createElement("div");
    l2.className = "result-line";
    l2.textContent = `Break-up: Voucher ${item.voucher.toFixed(
      1
    )}%, Portal ${item.portal.toFixed(1)}%, Card ${item.cardPercent.toFixed(2)}%.`;
    div.appendChild(l2);

    const utilMsg = document.createElement("div");
    utilMsg.className = "result-line";
    utilMsg.textContent = `${item.method.cardKey.toUpperCase()} utilisation: currently ${item.utilPctCurrent.toFixed(
      1
    )}% → projected ${item.projectedUtilPct.toFixed(1)}% of limit.`;
    div.appendChild(utilMsg);

    if (item.capInfo.capped) {
      const capWarn = document.createElement("div");
      capWarn.className = "warning";
      capWarn.textContent =
        "This method’s monthly reward cap is already fully used. Treat this as 0% for the remainder of the cycle.";
      div.appendChild(capWarn);
    } else if (item.capInfo.partiallyCapped) {
      const capWarn = document.createElement("div");
      capWarn.className = "warning";
      capWarn.textContent =
        "This transaction will partially cross the monthly reward cap; effective % shown is blended for this amount.";
      div.appendChild(capWarn);
    }

    if (item.projectedUtilPct > item.card.comfortPercent) {
      const utilWarn = document.createElement("div");
      utilWarn.className = "warning";
      utilWarn.textContent =
        "Warning: This transaction pushes this card above your utilisation comfort level.";
      div.appendChild(utilWarn);
    }

    const actions = document.createElement("div");
    actions.className = "result-actions";

    const btnUse = document.createElement("button");
    btnUse.className = "secondary-btn";
    btnUse.textContent = "I used this";
    btnUse.addEventListener("click", () => markUsed(item));
    actions.appendChild(btnUse);

    div.appendChild(actions);
    resultsContainer.appendChild(div);
  });
}

// When user confirms they used a method
function markUsed(result) {
  const { method, amount, card, rewardValue } = result;

  // Update card utilisation (cycle spend)
  card.cycleSpendUsed += amount;

  // Update method reward-used count
  method.rewardUsedThisCycle += rewardValue;

  // Update Kiwi Neon YTD if relevant
  if (method.id === "kiwi_neon_upi") {
    appState.cards.kiwi.neonYtdEligibleSpend += amount;
  }

  saveState(appState);
  renderCardTiles();
  calculateOptions();
}

// Render card tiles
function renderCardTiles() {
  const sbi = appState.cards.sbi;
  const kiwi = appState.cards.kiwi;

  // Holder names for tiles
  const holderSbi = document.getElementById("advCardholderNameSbi").value || sbi.holderName;
  const holderKiwi =
    document.getElementById("advCardholderNameKiwi").value || kiwi.holderName;

  // SBI tile
  document.getElementById("sbiLast4").textContent = sbi.last4;
  document.getElementById("cardHolderName").textContent = holderSbi || "YOUR NAME";
  document.getElementById("sbiProductName").textContent = "SimplyCLICK";
  const sbiPct = utilisationPercent(sbi);
  const sbiBar = document.getElementById("sbiUtilBar");
  sbiBar.style.width = `${Math.min(100, sbiPct).toFixed(1)}%`;
  sbiBar.className = `util-bar-fill ${utilisationClass(sbiPct)}`;
  const sbiLimit = sbi.limit || 0;
  document.getElementById(
    "sbiUtilLabel"
  ).textContent = `₹${sbi.cycleSpendUsed.toFixed(0)} / ₹${sbiLimit.toFixed(
    0
  )} (${sbiPct.toFixed(1)}% of limit)`;

  // Kiwi tile
  document.getElementById("kiwiLast4").textContent = kiwi.last4;
  document.getElementById("cardHolderNameKiwi").textContent = holderKiwi || "YOUR NAME";
  document.getElementById("kiwiProductName").textContent = "KIWI";
  const kiwiPct = utilisationPercent(kiwi);
  const kiwiBar = document.getElementById("kiwiUtilBar");
  kiwiBar.style.width = `${Math.min(100, kiwiPct).toFixed(1)}%`;
  kiwiBar.className = `util-bar-fill ${utilisationClass(kiwiPct)}`;
  const kiwiLimit = kiwi.limit || 0;
  document.getElementById(
    "kiwiUtilLabel"
  ).textContent = `₹${kiwi.cycleSpendUsed.toFixed(0)} / ₹${kiwiLimit.toFixed(
    0
  )} (${kiwiPct.toFixed(1)}% of limit)`;
}

// Load advanced settings into inputs
function populateAdvancedInputs() {
  const sbi = appState.cards.sbi;
  const kiwi = appState.cards.kiwi;

  document.getElementById("advCardholderNameSbi").value = sbi.holderName;
  document.getElementById("advLast4Sbi").value = sbi.last4;
  document.getElementById("advNetworkSbi").value = sbi.network;
  document.getElementById("advLimitSbi").value = sbi.limit;
  document.getElementById("advComfortSbi").value = sbi.comfortPercent;
  document.getElementById("advCycleSpendSbi").value = sbi.cycleSpendUsed;

  document.getElementById("advCardholderNameKiwi").value = kiwi.holderName;
  document.getElementById("advLast4Kiwi").value = kiwi.last4;
  document.getElementById("advNetworkKiwi").value = kiwi.network;
  document.getElementById("advLimitKiwi").value = kiwi.limit;
  document.getElementById("advComfortKiwi").value = kiwi.comfortPercent;
  document.getElementById("advCycleSpendKiwi").value = kiwi.cycleSpendUsed;
  document.getElementById("advNeonStart").value = kiwi.neonStartDate || "";
  document.getElementById("advNeonTarget").value = kiwi.neonTargetAnnualSpend || 150000;
  document.getElementById("advNeonYtd").value = kiwi.neonYtdEligibleSpend || 0;
}

// Save advanced settings back to state
function saveAdvancedFromInputs() {
  const sbi = appState.cards.sbi;
  const kiwi = appState.cards.kiwi;

  sbi.holderName = document.getElementById("advCardholderNameSbi").value || sbi.holderName;
  sbi.last4 = document.getElementById("advLast4Sbi").value || sbi.last4;
  sbi.network =
    document.getElementById("advNetworkSbi").value || sbi.network || "MASTERCARD";
  sbi.limit = Number(document.getElementById("advLimitSbi").value) || sbi.limit;
  sbi.comfortPercent =
    Number(document.getElementById("advComfortSbi").value) || sbi.comfortPercent;
  sbi.cycleSpendUsed =
    Number(document.getElementById("advCycleSpendSbi").value) || sbi.cycleSpendUsed;

  kiwi.holderName =
    document.getElementById("advCardholderNameKiwi").value || kiwi.holderName;
  kiwi.last4 = document.getElementById("advLast4Kiwi").value || kiwi.last4;
  kiwi.network =
    document.getElementById("advNetworkKiwi").value || kiwi.network || "RUPAY";
  kiwi.limit =
    Number(document.getElementById("advLimitKiwi").value) || kiwi.limit;
  kiwi.comfortPercent =
    Number(document.getElementById("advComfortKiwi").value) || kiwi.comfortPercent;
  kiwi.cycleSpendUsed =
    Number(document.getElementById("advCycleSpendKiwi").value) || kiwi.cycleSpendUsed;
  kiwi.neonStartDate = document.getElementById("advNeonStart").value || kiwi.neonStartDate;
  kiwi.neonTargetAnnualSpend =
    Number(document.getElementById("advNeonTarget").value) ||
    kiwi.neonTargetAnnualSpend ||
    150000;
  kiwi.neonYtdEligibleSpend =
    Number(document.getElementById("advNeonYtd").value) || kiwi.neonYtdEligibleSpend;

  saveState(appState);
  renderCardTiles();
}

// Init
document.addEventListener("DOMContentLoaded", () => {
  methodsTbody = document.getElementById("methodsTbody");
  advMethodsTbody = document.getElementById("advMethodsTbody");
  resultsContainer = document.getElementById("resultsContainer");

  renderMethodsTable();
  renderAdvancedMethodsTable();
  populateAdvancedInputs();
  renderCardTiles();

  document
    .getElementById("calculateBtn")
    .addEventListener("click", calculateOptions);

  document
    .getElementById("saveAdvancedBtn")
    .addEventListener("click", saveAdvancedFromInputs);
});
