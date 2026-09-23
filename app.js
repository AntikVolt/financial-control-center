const SUPABASE_URL = "https://vvwrjabmetrifporzubu.supabase.co";
const SUPABASE_KEY = "sb_publishable_mADOLEV3fjhhyyX_pSLBxg_rrmcDwRi";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);


// =====================================================
// HELPERS
// =====================================================

function money(value) {
  return Number(value || 0).toLocaleString("en-CA", {
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


// =====================================================
// ACCOUNTS
// =====================================================

async function getAccounts() {
  const { data, error } = await db
    .from("accounts")
    .select("*")
    .order("id");

  if (error) {
    console.error("Accounts error:", error);
    return [];
  }

  return data || [];
}


// =====================================================
// TRANSACTIONS
// =====================================================

async function getTransactions() {
  const { data, error } = await db
    .from("transactions")
    .select("*")
    .order("date", { ascending: false });

  if (error) {
    console.error("Transactions error:", error);
    return [];
  }

  return data || [];
}


// =====================================================
// ADD TRANSACTION
// =====================================================

async function addEvent() {

  const date =
    document.getElementById("eventDate").value;

  const description =
    document.getElementById("eventDesc").value.trim();

  const amount =
    Number(document.getElementById("eventAmount").value);

  if (!date) {
    alert("Please enter a date.");
    return;
  }

  if (!description) {
    alert("Please enter a description.");
    return;
  }

  if (isNaN(amount)) {
    alert("Please enter a valid amount.");
    return;
  }

  const { error } = await db
    .from("transactions")
    .insert({
      date: date,
      description: description,
      amount: amount
    });

  if (error) {
    console.error("Add transaction error:", error);
    alert("Could not save transaction. Check the browser console.");
    return;
  }

  document.getElementById("eventDesc").value = "";
  document.getElementById("eventAmount").value = "";

  await render();
}


// =====================================================
// DELETE TRANSACTION
// =====================================================

async function deleteEvent(id) {

  const { error } = await db
    .from("transactions")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Delete error:", error);
    alert("Could not delete transaction.");
    return;
  }

  await render();
}


// =====================================================
// DISPLAY TRANSACTIONS
// =====================================================

async function renderEvents() {

  const container =
    document.getElementById("events");

  if (!container) return;

  const events = await getTransactions();

  if (!events.length) {
    container.innerHTML =
      "<p>No financial events yet.</p>";
    return;
  }

  container.innerHTML = events.map(event => {

    const amount = Number(event.amount || 0);

    return `
      <div class="event-row">

        <div>
          <strong>
            ${escapeHTML(event.description)}
          </strong>

          <small>
            ${escapeHTML(event.date)}
          </small>
        </div>

        <strong class="${amount >= 0 ? "income" : "expense"}">
          ${amount >= 0 ? "+" : ""}
          ${money(amount)}
        </strong>

        <button
          type="button"
          onclick="deleteEvent(${event.id})"
        >
          Delete
        </button>

      </div>
    `;

  }).join("");
}


// =====================================================
// CURRENT CASH
// =====================================================

async function calculateCash() {

  const accounts = await getAccounts();
  const transactions = await getTransactions();

  let cash = accounts.reduce(
    (sum, account) =>
      sum + Number(account.balance || 0),
    0
  );

  cash += transactions.reduce(
    (sum, transaction) =>
      sum + Number(transaction.amount || 0),
    0
  );

  return cash;
}


// =====================================================
// ANALYTICS
// =====================================================

async function renderAnalytics() {

  const cash = await calculateCash();

  const cashElement =
    document.getElementById("cash");

  if (cashElement) {
    cashElement.textContent = money(cash);
  }

  const bufferInput =
    document.getElementById("buffer");

  const buffer =
    Number(bufferInput?.value || 500);

  const safe =
    Math.max(0, cash - buffer);

  const safeElement =
    document.getElementById("safeToSpend");

  if (safeElement) {
    safeElement.textContent = money(safe);
  }


  const statusElement =
    document.getElementById("status");

  const statusTextElement =
    document.getElementById("statusText");

  if (cash <= 0) {

    if (statusElement)
      statusElement.textContent = "CRITICAL";

    if (statusTextElement)
      statusTextElement.textContent =
        "Cash is at or below zero.";

  } else if (cash < buffer) {

    if (statusElement)
      statusElement.textContent = "WARNING";

    if (statusTextElement)
      statusTextElement.textContent =
        "Cash is below your safety buffer.";

  } else {

    if (statusElement)
      statusElement.textContent = "OK";

    if (statusTextElement)
      statusTextElement.textContent =
        "Cash is above your safety buffer.";
  }
}


// =====================================================
// RESET DEMO
// =====================================================

async function resetDemo() {

  const confirmed = confirm(
    "Reset the cloud database to the demo data?"
  );

  if (!confirmed) return;


  // Remove existing transactions
  const { error: deleteError } =
    await db
      .from("transactions")
      .delete()
      .neq("id", 0);

  if (deleteError) {
    console.error(deleteError);
    alert("Could not reset transactions.");
    return;
  }


  // Remove existing accounts
  const { error: accountDeleteError } =
    await db
      .from("accounts")
      .delete()
      .neq("id", 0);

  if (accountDeleteError) {
    console.error(accountDeleteError);
    alert("Could not reset accounts.");
    return;
  }


  // Insert demo accounts
  const { error: insertError } =
    await db
      .from("accounts")
      .insert([
        {
          name: "Chequing",
          balance: 3200
        },
        {
          name: "Savings",
          balance: 850
        }
      ]);

  if (insertError) {
    console.error(insertError);
    alert("Could not create demo accounts.");
    return;
  }

  await render();
}


// =====================================================
// RECURRING
// =====================================================

async function renderRecurring() {

  const container =
    document.getElementById("recurring");

  if (!container) return;

  /*
    Recurring will be connected to the database
    in the next step.
  */

  container.innerHTML =
    "<p>Recurring transactions will be connected next.</p>";
}


// =====================================================
// MAIN RENDER
// =====================================================

async function render() {

  await renderEvents();
  await renderRecurring();
  await renderAnalytics();
}


// =====================================================
// EVENT FORM
// =====================================================

function setupEventForm() {

  const form =
    document.getElementById("eventForm");

  if (!form) return;

  form.addEventListener(
    "submit",
    async function(event) {

      event.preventDefault();

      await addEvent();
    }
  );
}


// =====================================================
// RESET BUTTON
// =====================================================

function setupResetButton() {

  const button =
    document.getElementById("resetDemo");

  if (!button) return;

  button.addEventListener(
    "click",
    resetDemo
  );
}


// =====================================================
// START
// =====================================================

document.addEventListener(
  "DOMContentLoaded",
  async function() {

    setupEventForm();
    setupResetButton();

    await render();

  }
);


// =====================================================
// GLOBAL
// =====================================================

window.deleteEvent = deleteEvent;
window.resetDemo = resetDemo;
