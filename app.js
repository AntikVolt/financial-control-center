const KEY = "fcc-v03";

const future = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const demo = {
  accounts: [
    { name: "Chequing", balance: 3200 },
    { name: "Savings", balance: 850 }
  ],

  recurring: [
    {
      id: 1,
      desc: "Salary",
      amount: 2000,
      frequency: "biweekly",
      start: future(3)
    },
    {
      id: 2,
      desc: "Consumer proposal",
      amount: -500,
      frequency: "monthly",
      start: future(7)
    },
    {
      id: 3,
      desc: "Rent",
      amount: -1200,
      frequency: "monthly",
      start: future(10)
    }
  ],

  transactions: []
};


// -----------------------------
// STORAGE
// -----------------------------

function load() {
  try {
    const saved = localStorage.getItem(KEY);

    if (!saved) {
      return structuredClone(demo);
    }

    const data = JSON.parse(saved);

    return {
      accounts: Array.isArray(data.accounts) ? data.accounts : [],
      recurring: Array.isArray(data.recurring) ? data.recurring : [],
      transactions: Array.isArray(data.transactions)
        ? data.transactions
        : []
    };

  } catch (error) {
    console.error("Could not load saved data:", error);
    return structuredClone(demo);
  }
}


function save(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}


function getData() {
  return load();
}


// -----------------------------
// ACCOUNTS
// -----------------------------

function getAccounts() {
  return getData().accounts;
}


function saveAccounts(accounts) {
  const data = getData();
  data.accounts = accounts;
  save(data);
}


// -----------------------------
// RECURRING
// -----------------------------

function getRecurring() {
  return getData().recurring;
}


function saveRecurring(recurring) {
  const data = getData();
  data.recurring = recurring;
  save(data);
}


function removeRecurring(id) {
  const recurring = getRecurring();

  const updated = recurring.filter(item => String(item.id) !== String(id));

  saveRecurring(updated);
  render();
}


// -----------------------------
// TRANSACTIONS
// -----------------------------

function getTransactions() {
  return getData().transactions;
}


function saveTransactions(transactions) {
  const data = getData();
  data.transactions = transactions;
  save(data);
}


// -----------------------------
// DEMO RESET
// -----------------------------

function resetDemo() {
  const confirmed = confirm(
    "Reset Financial Control Centre to the demo data?"
  );

  if (!confirmed) return;

  localStorage.setItem(
    KEY,
    JSON.stringify(structuredClone(demo))
  );

  render();
}


// -----------------------------
// HELPERS
// -----------------------------

function money(value) {
  const number = Number(value) || 0;

  return number.toLocaleString("en-CA", {
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


function frequencyLabel(value) {
  const labels = {
    weekly: "Weekly",
    biweekly: "Biweekly",
    monthly: "Monthly",
    yearly: "Yearly"
  };

  return labels[value] || value;
}


// -----------------------------
// CALCULATIONS
// -----------------------------

function currentBalance() {
  const accounts = getAccounts();

  return accounts.reduce(
    (total, account) => total + Number(account.balance || 0),
    0
  );
}


function monthlyRecurringIncome() {
  return getRecurring()
    .filter(item => Number(item.amount) > 0)
    .reduce((total, item) => {
      const amount = Number(item.amount);

      switch (item.frequency) {
        case "weekly":
          return total + amount * 52 / 12;

        case "biweekly":
          return total + amount * 26 / 12;

        case "monthly":
          return total + amount;

        case "yearly":
          return total + amount / 12;

        default:
          return total;
      }
    }, 0);
}


function monthlyRecurringExpenses() {
  return getRecurring()
    .filter(item => Number(item.amount) < 0)
    .reduce((total, item) => {
      const amount = Math.abs(Number(item.amount));

      switch (item.frequency) {
        case "weekly":
          return total + amount * 52 / 12;

        case "biweekly":
          return total + amount * 26 / 12;

        case "monthly":
          return total + amount;

        case "yearly":
          return total + amount / 12;

        default:
          return total;
      }
    }, 0);
}


function monthlyNet() {
  return monthlyRecurringIncome() - monthlyRecurringExpenses();
}


// -----------------------------
// RENDER
// -----------------------------

function render() {
  const data = getData();

  renderAccounts(data.accounts);
  renderRecurring(data.recurring);
  renderSummary();
}


// -----------------------------
// ACCOUNTS UI
// -----------------------------

function renderAccounts(accounts) {
  const container =
    document.getElementById("accounts") ||
    document.getElementById("accountList");

  if (!container) return;

  if (!accounts.length) {
    container.innerHTML = "<p>No accounts.</p>";
    return;
  }

  container.innerHTML = accounts.map(account => `
    <div class="account-row">
      <div>
        <strong>${escapeHTML(account.name)}</strong>
      </div>

      <div>
        ${money(account.balance)}
      </div>
    </div>
  `).join("");
}


// -----------------------------
// RECURRING UI
// -----------------------------

function renderRecurring(recurring) {
  const container =
    document.getElementById("recurring") ||
    document.getElementById("recurringList");

  if (!container) return;

  if (!recurring.length) {
    container.innerHTML = "<p>No recurring transactions.</p>";
    return;
  }

  container.innerHTML = recurring.map(item => {
    const amount = Number(item.amount) || 0;

    return `
      <div class="recurring-row">

        <div class="recurring-info">
          <strong>${escapeHTML(item.desc)}</strong>

          <small>
            ${frequencyLabel(item.frequency)}
            · ${escapeHTML(item.start)}
          </small>
        </div>

        <div class="recurring-amount ${
          amount >= 0 ? "income" : "expense"
        }">
          ${money(amount)}
        </div>

        <button
          type="button"
          class="delete-recurring"
          onclick="removeRecurring('${String(item.id)}')"
        >
          Delete
        </button>

      </div>
    `;
  }).join("");
}


// -----------------------------
// SUMMARY UI
// -----------------------------

function renderSummary() {
  const balance = currentBalance();
  const income = monthlyRecurringIncome();
  const expenses = monthlyRecurringExpenses();
  const net = monthlyNet();

  const balanceEl =
    document.getElementById("currentBalance") ||
    document.getElementById("balance");

  const incomeEl =
    document.getElementById("monthlyIncome") ||
    document.getElementById("income");

  const expensesEl =
    document.getElementById("monthlyExpenses") ||
    document.getElementById("expenses");

  const netEl =
    document.getElementById("monthlyNet") ||
    document.getElementById("net");

  if (balanceEl) balanceEl.textContent = money(balance);
  if (incomeEl) incomeEl.textContent = money(income);
  if (expensesEl) expensesEl.textContent = money(expenses);
  if (netEl) netEl.textContent = money(net);
}


// -----------------------------
// ADD RECURRING TRANSACTION
// -----------------------------

function addRecurring(desc, amount, frequency, start) {
  const recurring = getRecurring();

  const newItem = {
    id: Date.now(),
    desc: desc,
    amount: Number(amount),
    frequency: frequency,
    start: start
  };

  recurring.push(newItem);

  saveRecurring(recurring);
  render();
}


// -----------------------------
// FORM HANDLING
// -----------------------------

function setupRecurringForm() {
  const form =
    document.getElementById("recurringForm");

  if (!form) return;

  form.addEventListener("submit", event => {
    event.preventDefault();

    const desc =
      form.querySelector('[name="desc"]')?.value.trim();

    const amount =
      form.querySelector('[name="amount"]')?.value;

    const frequency =
      form.querySelector('[name="frequency"]')?.value;

    const start =
      form.querySelector('[name="start"]')?.value;

    if (!desc || !amount || !frequency || !start) {
      alert("Please complete all fields.");
      return;
    }

    addRecurring(
      desc,
      amount,
      frequency,
      start
    );

    form.reset();
  });
}


// -----------------------------
// RESET BUTTON
// -----------------------------

function setupResetButton() {
  const button = document.getElementById("resetDemo");

  if (!button) return;

  button.onclick = resetDemo;
}


// -----------------------------
// INITIALIZATION
// -----------------------------

document.addEventListener("DOMContentLoaded", () => {
  render();
  setupRecurringForm();
  setupResetButton();
});


// Make functions available to inline HTML buttons.
window.removeRecurring = removeRecurring;
window.resetDemo = resetDemo;
window.addRecurring = addRecurring;
