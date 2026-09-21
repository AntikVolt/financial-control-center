const KEY = "fcc-v04";

const demo = {
  cash: 4050,
  events: [],
  recurring: [
    {
      id: 1,
      desc: "Salary",
      amount: 2000,
      frequency: "biweekly",
      start: "2026-09-24"
    },
    {
      id: 2,
      desc: "Consumer proposal",
      amount: -500,
      frequency: "monthly",
      start: "2026-09-28"
    },
    {
      id: 3,
      desc: "Rent",
      amount: -1200,
      frequency: "monthly",
      start: "2026-10-01"
    }
  ],
  buffer: 500
};


// ===============================
// STORAGE
// ===============================

function loadData() {
  const saved = localStorage.getItem(KEY);

  if (!saved) {
    const copy = JSON.parse(JSON.stringify(demo));
    localStorage.setItem(KEY, JSON.stringify(copy));
    return copy;
  }

  try {
    return JSON.parse(saved);
  } catch (error) {
    console.error("Could not read saved data:", error);

    const copy = JSON.parse(JSON.stringify(demo));
    localStorage.setItem(KEY, JSON.stringify(copy));
    return copy;
  }
}


function saveData(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}


// ===============================
// HELPERS
// ===============================

function money(amount) {
  return Number(amount || 0).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD"
  });
}


function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function today() {
  return new Date().toISOString().slice(0, 10);
}


// ===============================
// CURRENT CASH
// ===============================

function calculateCash(data) {
  let cash = Number(data.cash || 0);

  for (const event of data.events) {
    cash += Number(event.amount || 0);
  }

  return cash;
}


// ===============================
// ADD EVENT
// ===============================

function addEvent(event) {
  const data = loadData();

  data.events.push(event);

  saveData(data);

  render();
}


// ===============================
// DELETE EVENT
// ===============================

function deleteEvent(id) {
  const data = loadData();

  data.events = data.events.filter(
    event => String(event.id) !== String(id)
  );

  saveData(data);

  render();
}


// ===============================
// EVENT FORM
// ===============================

function setupEventForm() {
  const form = document.getElementById("eventForm");

  if (!form) {
    console.error("eventForm not found");
    return;
  }

  form.addEventListener("submit", function(e) {
    e.preventDefault();

    const date = document.getElementById("eventDate").value;
    const desc = document.getElementById("eventDesc").value.trim();
    const amount = Number(
      document.getElementById("eventAmount").value
    );

    if (!date) {
      alert("Please enter a date.");
      return;
    }

    if (!desc) {
      alert("Please enter a description.");
      return;
    }

    if (isNaN(amount)) {
      alert("Please enter a valid amount.");
      return;
    }

    addEvent({
      id: Date.now(),
      date: date,
      desc: desc,
      amount: amount
    });

    document.getElementById("eventDesc").value = "";
    document.getElementById("eventAmount").value = "";
  });
}


// ===============================
// DISPLAY EVENTS
// ===============================

function renderEvents() {
  const container = document.getElementById("events");

  if (!container) return;

  const data = loadData();

  if (!data.events.length) {
    container.innerHTML = "<p>No financial events yet.</p>";
    return;
  }

  const events = [...data.events].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  container.innerHTML = events.map(event => {

    const amount = Number(event.amount || 0);

    return `
      <div class="event-row">

        <div>
          <strong>${escapeHTML(event.desc)}</strong>
          <small>${escapeHTML(event.date)}</small>
        </div>

        <strong class="${amount >= 0 ? "income" : "expense"}">
          ${amount >= 0 ? "+" : ""}${money(amount)}
        </strong>

        <button
          type="button"
          onclick="deleteEvent('${event.id}')"
        >
          Delete
        </button>

      </div>
    `;

  }).join("");
}


// ===============================
// RECURRING
// ===============================

function addRecurring(item) {
  const data = loadData();

  data.recurring.push(item);

  saveData(data);

  render();
}


function deleteRecurring(id) {
  const data = loadData();

  data.recurring = data.recurring.filter(
    item => String(item.id) !== String(id)
  );

  saveData(data);

  render();
}


function setupRecurringForm() {
  const form = document.getElementById("recForm");

  if (!form) return;

  form.addEventListener("submit", function(e) {
    e.preventDefault();

    const desc = document.getElementById("recDesc").value.trim();
    const amount = Number(
      document.getElementById("recAmount").value
    );
    const frequency =
      document.getElementById("recFreq").value;
    const start =
      document.getElementById("recStart").value;

    if (!desc || isNaN(amount) || !start) {
      alert("Please complete all recurring fields.");
      return;
    }

    addRecurring({
      id: Date.now(),
      desc: desc,
      amount: amount,
      frequency: frequency,
      start: start
    });

    document.getElementById("recDesc").value = "";
    document.getElementById("recAmount").value = "";
  });
}


function renderRecurring() {
  const container = document.getElementById("recurring");

  if (!container) return;

  const data = loadData();

  if (!data.recurring.length) {
    container.innerHTML = "<p>No recurring transactions.</p>";
    return;
  }

  container.innerHTML = data.recurring.map(item => {

    const amount = Number(item.amount || 0);

    return `
      <div class="event-row">

        <div>
          <strong>${escapeHTML(item.desc)}</strong>
          <small>
            ${escapeHTML(item.frequency)}
            · ${escapeHTML(item.start)}
          </small>
        </div>

        <strong class="${amount >= 0 ? "income" : "expense"}">
          ${amount >= 0 ? "+" : ""}${money(amount)}
        </strong>

        <button
          type="button"
          onclick="deleteRecurring('${item.id}')"
        >
          Delete
        </button>

      </div>
    `;

  }).join("");
}


// ===============================
// FORECAST
// ===============================

function recurringAmountForDate(data, date) {
  let total = 0;

  const target = new Date(date + "T00:00:00");

  for (const item of data.recurring) {

    const start = new Date(item.start + "T00:00:00");

    if (target < start) continue;

    const days =
      Math.floor(
        (target - start) / 86400000
      );

    if (item.frequency === "weekly" && days % 7 === 0) {
      total += Number(item.amount);
    }

    if (
      item.frequency === "biweekly" &&
      days % 14 === 0
    ) {
      total += Number(item.amount);
    }

    if (
      item.frequency === "monthly" &&
      target.getDate() === start.getDate()
    ) {
      total += Number(item.amount);
    }
  }

  return total;
}


function renderForecast() {
  const container = document.getElementById("forecast");

  if (!container) return;

  const data = loadData();

  let balance = calculateCash(data);
  let minimum = balance;
  let minimumDate = today();

  let html = "";

  for (let i = 0; i < 90; i++) {

    const dateObj = new Date();
    dateObj.setDate(dateObj.getDate() + i);

    const date =
      dateObj.toISOString().slice(0, 10);

    const events = data.events
      .filter(event => event.date === date)
      .reduce(
        (sum, event) => sum + Number(event.amount),
        0
      );

    const recurring =
      recurringAmountForDate(data, date);

    balance += events + recurring;

    if (balance < minimum) {
      minimum = balance;
      minimumDate = date;
    }

    if (i === 0 || i % 7 === 0 || i === 89) {
      html += `
        <div class="forecast-row">
          <span>${date}</span>
          <strong>${money(balance)}</strong>
        </div>
      `;
    }
  }

  container.innerHTML = html;

  const min90 = document.getElementById("min90");
  const min90Date = document.getElementById("min90Date");

  if (min90) {
    min90.textContent = money(minimum);
  }

  if (min90Date) {
    min90Date.textContent = minimumDate;
  }
}


// ===============================
// ANALYTICS
// ===============================

function renderAnalytics() {
  const data = loadData();

  const cash = calculateCash(data);
  const buffer = Number(data.buffer || 0);

  const safe = Math.max(0, cash - buffer);

  const cashElement = document.getElementById("cash");
  const safeElement =
    document.getElementById("safeToSpend");

  const safeText =
    document.getElementById("safeToSpendText");

  if (cashElement) {
    cashElement.textContent = money(cash);
  }

  if (safeElement) {
    safeElement.textContent = money(safe);
  }

  if (safeText) {
    safeText.textContent =
      ` after maintaining a ${money(buffer)} safety buffer`;
  }


  let status = "OK";
  let statusText =
    "Cash position is above the safety buffer.";

  if (cash <= 0) {
    status = "CRITICAL";
    statusText =
      "Current cash is at or below zero.";
  } else if (cash < buffer) {
    status = "WARNING";
    statusText =
      "Current cash is below the safety buffer.";
  }

  const statusElement =
    document.getElementById("status");

  const statusTextElement =
    document.getElementById("statusText");

  if (statusElement) {
    statusElement.textContent = status;
  }

  if (statusTextElement) {
    statusTextElement.textContent = statusText;
  }
}


// ===============================
// ACTION CENTER
// ===============================

function renderActions() {
  const container = document.getElementById("actions");

  if (!container) return;

  const data = loadData();

  const cash = calculateCash(data);
  const buffer = Number(data.buffer || 0);

  let actions = [];

  if (cash < 0) {
    actions.push(
      "Cash is negative. Review upcoming expenses."
    );
  }

  if (cash >= 0 && cash < buffer) {
    actions.push(
      "Cash is below your safety buffer."
    );
  }

  if (cash >= buffer) {
    actions.push(
      "No immediate cash-buffer action required."
    );
  }

  container.innerHTML = actions.map(
    action => `<p>${escapeHTML(action)}</p>`
  ).join("");
}


// ===============================
// BUFFER SETTING
// ===============================

function setupBuffer() {
  const input = document.getElementById("buffer");

  if (!input) return;

  const data = loadData();

  input.value = Number(data.buffer || 0);

  input.addEventListener("change", function() {

    const updated = loadData();

    updated.buffer = Number(input.value || 0);

    saveData(updated);

    render();
  });
}


// ===============================
// RESET DEMO
// ===============================

function resetDemo() {

  if (
    !confirm(
      "Reset all data to the demo data?"
    )
  ) {
    return;
  }

  const copy =
    JSON.parse(JSON.stringify(demo));

  saveData(copy);

  render();
}


// ===============================
// RENDER
// ===============================

function render() {
  renderEvents();
  renderRecurring();
  renderForecast();
  renderAnalytics();
  renderActions();

  const data = loadData();

  const buffer =
    document.getElementById("buffer");

  if (
    buffer &&
    document.activeElement !== buffer
  ) {
    buffer.value = Number(data.buffer || 0);
  }
}


// ===============================
// START APP
// ===============================

document.addEventListener(
  "DOMContentLoaded",
  function() {

    setupEventForm();
    setupRecurringForm();
    setupBuffer();

    const resetButton =
      document.getElementById("resetDemo");

    if (resetButton) {
      resetButton.addEventListener(
        "click",
        resetDemo
      );
    }

    render();
  }
);


// ===============================
// GLOBAL BUTTON FUNCTIONS
// ===============================

window.deleteEvent = deleteEvent;
window.deleteRecurring = deleteRecurring;
window.resetDemo = resetDemo;
