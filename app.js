const KEY = "fcc-v04";

const demo = {
  accounts: [
    {
      id: 1,
      name: "Chequing",
      balance: 3200
    },
    {
      id: 2,
      name: "Savings",
      balance: 850
    }
  ],

  transactions: [],

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
  ]
};


// =====================================================
// STORAGE
// =====================================================

function getData() {
  try {
    const saved = localStorage.getItem(KEY);

    if (!saved) {
      return structuredClone(demo);
    }

    const data = JSON.parse(saved);

    return {
      accounts: Array.isArray(data.accounts) ? data.accounts : [],
      transactions: Array.isArray(data.transactions)
        ? data.transactions
        : [],
      recurring: Array.isArray(data.recurring)
        ? data.recurring
        : []
    };

  } catch (error) {
    console.error("Storage error:", error);
    return structuredClone(demo);
  }
}


function saveData(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}


// =====================================================
// MONEY
// =====================================================

function money(value) {
  return Number(value || 0).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD"
  });
}


// =====================================================
// ACCOUNTS
// =====================================================

function getAccounts() {
  return getData().accounts;
}


function accountBalance(account) {
  const transactions = getData().transactions;

  const transactionTotal = transactions
    .filter(t => String(t.accountId) === String(account.id))
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  return Number(account.balance || 0) + transactionTotal;
}


function totalBalance() {
  return getAccounts().reduce(
    (sum, account) => sum + accountBalance(account),
    0
  );
}


// =====================================================
// TRANSACTIONS
// =====================================================

function getTransactions() {
  return getData().transactions;
}


function addTransaction() {

  const descriptionInput =
    document.getElementById("transactionDescription");

  const amountInput =
    document.getElementById("transactionAmount");

  const accountInput =
    document.getElementById("transactionAccount");

  const dateInput =
    document.getElementById("transactionDate");

  if (!descriptionInput || !amountInput) {
    alert("Transaction form fields were not found.");
    return;
  }

  const description = descriptionInput.value.trim();
  const amount = Number(amountInput.value);

  if (!description) {
    alert("Enter a transaction description.");
    return;
  }

  if (!amount || isNaN(amount)) {
    alert("Enter a valid amount.");
    return;
  }

  const data = getData();

  let accountId = accountInput
    ? accountInput.value
    : data.accounts[0]?.id;

  const transaction = {
    id: Date.now(),
    description: description,
    amount: amount,
    accountId: accountId,
    date: dateInput?.value || new Date().toISOString().slice(0, 10)
  };

  data.transactions.push(transaction);

  saveData(data);

  descriptionInput.value = "";
  amountInput.value = "";

  render();
}


// =====================================================
// DELETE TRANSACTION
// =====================================================

function deleteTransaction(id) {

  const data = getData();

  data.transactions = data.transactions.filter(
    transaction =>
      String(transaction.id) !== String(id)
  );

  saveData(data);

  render();
}


// =====================================================
// TRANSACTION LIST
// =====================================================

function renderTransactions() {

  const container =
    document.getElementById("transactions") ||
    document.getElementById("transactionList");

  if (!container) return;

  const transactions = getTransactions();

  if (transactions.length === 0) {

    container.innerHTML = `
      <div class="empty-state">
        No transactions yet.
      </div>
    `;

    return;
  }

  const sorted = [...transactions].sort(
    (a, b) =>
      new Date(b.date) - new Date(a.date)
  );

  container.innerHTML = sorted.map(transaction => {

    const amount = Number(transaction.amount || 0);

    const account =
      getAccounts().find(
        a => String(a.id) === String(transaction.accountId)
      );

    return `
      <div class="transaction-row">

        <div class="transaction-date">
          ${escapeHTML(transaction.date)}
        </div>

        <div class="transaction-description">
          <strong>
            ${escapeHTML(transaction.description)}
          </strong>

          <small>
            ${escapeHTML(account?.name || "Account")}
          </small>
        </div>

        <div class="transaction-amount ${
          amount >= 0 ? "income" : "expense"
        }">
          ${amount >= 0 ? "+" : ""}${money(amount)}
        </div>

        <button
          type="button"
          onclick="deleteTransaction('${transaction.id}')"
        >
          Delete
        </button>

      </div>
    `;

  }).join("");
}


// =====================================================
// ACCOUNT LIST
// =====================================================

function renderAccounts() {

  const container =
    document.getElementById("accounts") ||
    document.getElementById("accountList");

  if (!container) return;

  const accounts = getAccounts();

  container.innerHTML = accounts.map(account => {

    const balance = accountBalance(account);

    return `
      <div class="account-row">

        <div class="account-name">
          ${escapeHTML(account.name)}
        </div>

        <div class="account-balance">
          ${money(balance)}
        </div>

      </div>
    `;

  }).join("");
}


// =====================================================
// ACCOUNT SELECTOR
// =====================================================

function renderAccountSelector() {

  const selector =
    document.getElementById("transactionAccount");

  if (!selector) return;

  const accounts = getAccounts();

  selector.innerHTML = accounts.map(account => `
    <option value="${account.id}">
      ${escapeHTML(account.name)}
    </option>
  `).join("");
}


// =====================================================
// RECURRING
// =====================================================

function renderRecurring() {

  const container =
    document.getElementById("recurring") ||
    document.getElementById("recurringList");

  if (!container) return;

  const recurring = getData().recurring;

  if (!recurring.length) {

    container.innerHTML = `
      <div class="empty-state">
        No recurring transactions.
      </div>
    `;

    return;
  }

  container.innerHTML = recurring.map(item => {

    const amount = Number(item.amount || 0);

    return `
      <div class="recurring-row">

        <div>
          <strong>
            ${escapeHTML(item.desc)}
          </strong>

          <small>
            ${escapeHTML(item.frequency)}
            · ${escapeHTML(item.start)}
          </small>
        </div>

        <div class="${
          amount >= 0 ? "income" : "expense"
        }">
          ${amount >= 0 ? "+" : ""}${money(amount)}
        </div>

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


function deleteRecurring(id) {

  const data = getData();

  data.recurring = data.recurring.filter(
    item =>
      String(item.id) !== String(id)
  );

  saveData(data);

  render();
}


// =====================================================
// SUMMARY
// =====================================================

function renderSummary() {

  const balance = totalBalance();

  const balanceElement =
    document.getElementById("currentBalance") ||
    document.getElementById("balance");

  if (balanceElement) {
    balanceElement.textContent = money(balance);
  }


  const transactions = getTransactions();

  const income = transactions
    .filter(t => Number(t.amount) > 0)
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const expenses = transactions
    .filter(t => Number(t.amount) < 0)
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);


  const incomeElement =
    document.getElementById("income") ||
    document.getElementById("transactionIncome");

  const expenseElement =
    document.getElementById("expenses") ||
    document.getElementById("transactionExpenses");


  if (incomeElement) {
    incomeElement.textContent = money(income);
  }

  if (expenseElement) {
    expenseElement.textContent = money(expenses);
  }
}


// =====================================================
// RESET
// =====================================================

function resetDemo() {

  const confirmed = confirm(
    "Reset the Financial Control Centre to the demo data?"
  );

  if (!confirmed) return;

  localStorage.setItem(
    KEY,
    JSON.stringify(structuredClone(demo))
  );

  render();
}


// =====================================================
// HTML SAFETY
// =====================================================

function escapeHTML(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


// =====================================================
// FORM
// =====================================================

function setupTransactionForm() {

  const form =
    document.getElementById("transactionForm");

  if (!form) return;

  form.addEventListener("submit", function(event) {

    event.preventDefault();

    addTransaction();

  });
}


// =====================================================
// RESET BUTTON
// =====================================================

function setupResetButton() {

  const button =
    document.getElementById("resetDemo");

  if (!button) return;

  button.addEventListener("click", resetDemo);
}


// =====================================================
// RENDER EVERYTHING
// =====================================================

function render() {

  renderAccounts();

  renderAccountSelector();

  renderTransactions();

  renderRecurring();

  renderSummary();
}


// =====================================================
// START
// =====================================================

document.addEventListener(
  "DOMContentLoaded",
  function() {

    render();

    setupTransactionForm();

    setupResetButton();

  }
);


// =====================================================
// MAKE FUNCTIONS AVAILABLE TO HTML
// =====================================================

window.addTransaction = addTransaction;
window.deleteTransaction = deleteTransaction;
window.deleteRecurring = deleteRecurring;
window.resetDemo = resetDemo;
window.render = render;        : []
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
