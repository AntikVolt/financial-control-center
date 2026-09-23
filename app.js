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
  const d = new Date();

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function parseDate(dateString) {
  const [year, month, day] =
    dateString.split("-").map(Number);

  return new Date(
    Date.UTC(year, month - 1, day)
  );
}


function formatDate(date) {
  return date.toISOString().slice(0, 10);
}


function addDays(dateString, days) {
  const date = parseDate(dateString);

  date.setUTCDate(
    date.getUTCDate() + days
  );

  return formatDate(date);
}


function daysBetween(startDate, endDate) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  return Math.round(
    (end - start) / 86400000
  );
}


function isLeapYear(year) {
  return (
    year % 4 === 0 &&
    (year % 100 !== 0 || year % 400 === 0)
  );
}


function daysInMonth(year, month) {
  const days = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31
  ];

  return days[month - 1];
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
    .order("date", {
      ascending: false
    });

  if (error) {
    console.error("Transactions error:", error);
    return [];
  }

  return data || [];
}


// =====================================================
// RECURRING DATA
// =====================================================

async function getRecurring() {

  const { data, error } = await db
    .from("recurring")
    .select("*")
    .order("start_date", {
      ascending: true
    });

  if (error) {
    console.error("Recurring error:", error);
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
    Number(
      document.getElementById("eventAmount").value
    );


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

    console.error(
      "Add transaction error:",
      error
    );

    alert(
      "Could not save transaction. Check the browser console."
    );

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

    console.error(
      "Delete error:",
      error
    );

    alert(
      "Could not delete transaction."
    );

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


  const events =
    await getTransactions();


  if (!events.length) {

    container.innerHTML =
      "<p>No financial events yet.</p>";

    return;
  }


  container.innerHTML =
    events.map(event => {

      const amount =
        Number(event.amount || 0);


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

  const accounts =
    await getAccounts();

  const transactions =
    await getTransactions();


  let cash =
    accounts.reduce(
      (sum, account) =>
        sum + Number(account.balance || 0),
      0
    );


  const currentDate =
    today();


  const pastAndToday =
    transactions.filter(
      transaction =>
        transaction.date <= currentDate
    );


  cash +=
    pastAndToday.reduce(
      (sum, transaction) =>
        sum + Number(transaction.amount || 0),
      0
    );


  return cash;
}


// =====================================================
// RECURRING OCCURRENCES
// =====================================================

function getRecurringOccurrences(
  recurringItem,
  startDate,
  endDate
) {

  const occurrences = [];

  let current =
    recurringItem.start_date;


  if (!current) {
    return occurrences;
  }


  while (current < startDate) {

    current =
      nextRecurringDate(
        current,
        recurringItem.frequency
      );

    if (!current) {
      break;
    }
  }


  while (current <= endDate) {

    if (current >= startDate) {

      occurrences.push({
        date: current,
        amount:
          Number(recurringItem.amount || 0),
        description:
          recurringItem.description,
        recurringId:
          recurringItem.id
      });
    }


    current =
      nextRecurringDate(
        current,
        recurringItem.frequency
      );


    if (!current) {
      break;
    }
  }


  return occurrences;
}


function nextRecurringDate(
  dateString,
  frequency
) {

  const date =
    parseDate(dateString);


  if (frequency === "weekly") {

    date.setUTCDate(
      date.getUTCDate() + 7
    );

    return formatDate(date);
  }


  if (frequency === "biweekly") {

    date.setUTCDate(
      date.getUTCDate() + 14
    );

    return formatDate(date);
  }


  if (frequency === "monthly") {

    const originalDay =
      date.getUTCDate();

    const nextMonth =
      date.getUTCMonth() + 1;

    const year =
      date.getUTCFullYear() +
      Math.floor(nextMonth / 12);

    const month =
      nextMonth % 12;


    const lastDay =
      daysInMonth(
        year,
        month + 1
      );


    date.setUTCFullYear(year);
    date.setUTCMonth(month);
    date.setUTCDate(
      Math.min(
        originalDay,
        lastDay
      )
    );


    return formatDate(date);
  }


  return null;
}


// =====================================================
// BUILD 90-DAY FORECAST
// =====================================================

async function buildForecast() {

  const currentDate =
    today();

  const endDate =
    addDays(
      currentDate,
      89
    );


  const currentCash =
    await calculateCash();


  const transactions =
    await getTransactions();


  const recurring =
    await getRecurring();


  const forecast = [];


  for (
    let i = 0;
    i < 90;
    i++
  ) {

    const date =
      addDays(
        currentDate,
        i
      );


    let change = 0;

    const items = [];


    // ---------------------------------------------
    // ONE-TIME FUTURE TRANSACTIONS
    // ---------------------------------------------

    transactions
      .filter(
        transaction =>
          transaction.date === date &&
          transaction.date >= currentDate
      )
      .forEach(
        transaction => {

          const amount =
            Number(
              transaction.amount || 0
            );


          change += amount;


          items.push({
            description:
              transaction.description,
            amount: amount
          });
        }
      );


    // ---------------------------------------------
    // RECURRING TRANSACTIONS
    // ---------------------------------------------

    recurring.forEach(
      recurringItem => {

        const occurrences =
          getRecurringOccurrences(
            recurringItem,
            date,
            date
          );


        occurrences.forEach(
          occurrence => {

            change +=
              occurrence.amount;


            items.push({
              description:
                occurrence.description,
              amount:
                occurrence.amount
            });
          }
        );
      }
    );


    forecast.push({
      date: date,
      change: change,
      items: items
    });
  }


  // ---------------------------------------------
  // CALCULATE RUNNING BALANCE
  // ---------------------------------------------

  let balance =
    currentCash;


  forecast.forEach(
    day => {

      balance += day.change;

      day.balance = balance;
    }
  );


  return {
    currentCash,
    startDate: currentDate,
    endDate,
    days: forecast
  };
}


// =====================================================
// RENDER FORECAST
// =====================================================
```js
async function renderForecast() {

  const container =
    document.getElementById("forecast");

  if (!container) return;

  const result =
    await buildForecast();

  if (!result.days.length) {
    container.innerHTML =
      "<p>No forecast data.</p>";
    return;
  }


  // ===================================================
  // SUMMARY POINTS
  // ===================================================

  const todayData =
    result.days[0];

  const day30 =
    result.days[Math.min(29, result.days.length - 1)];

  const day60 =
    result.days[Math.min(59, result.days.length - 1)];

  const day90 =
    result.days[result.days.length - 1];


  // ===================================================
  // MINIMUM
  // ===================================================

  let minimum =
    result.days[0];

  result.days.forEach(day => {

    if (day.balance < minimum.balance) {
      minimum = day;
    }

  });


  // ===================================================
  // CHART DIMENSIONS
  // ===================================================

  const width = 900;
  const height = 260;

  const paddingLeft = 55;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 35;

  const balances =
    result.days.map(day =>
      Number(day.balance || 0)
    );

  let minBalance =
    Math.min(...balances);

  let maxBalance =
    Math.max(...balances);


  // Give the chart some breathing room.

  const range =
    Math.max(
      100,
      maxBalance - minBalance
    );

  minBalance -= range * 0.08;
  maxBalance += range * 0.08;


  function chartX(index) {

    return (
      paddingLeft +
      (
        index /
        (result.days.length - 1)
      ) *
      (
        width -
        paddingLeft -
        paddingRight
      )
    );

  }


  function chartY(balance) {

    return (
      paddingTop +
      (
        (maxBalance - balance) /
        (maxBalance - minBalance)
      ) *
      (
        height -
        paddingTop -
        paddingBottom
      )
    );

  }


  // ===================================================
  // LINE
  // ===================================================

  const points =
    result.days.map(
      (day, index) =>
        `${chartX(index)},${chartY(day.balance)}`
    ).join(" ");


  // ===================================================
  // ZERO LINE
  // ===================================================

  let zeroLine = "";

  if (
    minBalance < 0 &&
    maxBalance > 0
  ) {

    const zeroY =
      chartY(0);

    zeroLine = `
      <line
        x1="${paddingLeft}"
        y1="${zeroY}"
        x2="${width - paddingRight}"
        y2="${zeroY}"
        stroke="#dc2626"
        stroke-width="1.5"
        stroke-dasharray="6 5"
        opacity="0.8"
      />

      <text
        x="${paddingLeft - 8}"
        y="${zeroY - 6}"
        text-anchor="end"
        font-size="11"
        fill="#dc2626"
      >
        $0
      </text>
    `;

  }


  // ===================================================
  // SAFETY BUFFER LINE
  // ===================================================

  const bufferInput =
    document.getElementById("buffer");

  const buffer =
    Number(
      bufferInput?.value || 500
    );

  let bufferLine = "";

  if (
    buffer >= minBalance &&
    buffer <= maxBalance
  ) {

    const bufferY =
      chartY(buffer);

    bufferLine = `
      <line
        x1="${paddingLeft}"
        y1="${bufferY}"
        x2="${width - paddingRight}"
        y2="${bufferY}"
        stroke="#f59e0b"
        stroke-width="1.5"
        stroke-dasharray="5 5"
        opacity="0.9"
      />

      <text
        x="${paddingLeft - 8}"
        y="${bufferY - 6}"
        text-anchor="end"
        font-size="11"
        fill="#d97706"
      >
        Buffer
      </text>
    `;

  }


  // ===================================================
  // MINIMUM POINT
  // ===================================================

  const minimumIndex =
    result.days.findIndex(
      day =>
        day.date === minimum.date
    );

  const minimumX =
    chartX(minimumIndex);

  const minimumY =
    chartY(minimum.balance);


  // ===================================================
  // DATE LABELS
  // ===================================================

  const firstDate =
    result.days[0].date;

  const lastDate =
    result.days[result.days.length - 1].date;


  // ===================================================
  // UPCOMING EVENTS
  // ===================================================

  const upcomingEvents = [];

  result.days.forEach(day => {

    if (
      day.date === result.startDate
    ) {
      return;
    }

    if (!day.items.length) {
      return;
    }

    day.items.forEach(item => {

      upcomingEvents.push({
        date: day.date,
        description: item.description,
        amount: Number(item.amount || 0)
      });

    });

  });


  const visibleEvents =
    upcomingEvents.slice(0, 8);


  let eventsHTML = "";

  if (!visibleEvents.length) {

    eventsHTML =
      "<p>No scheduled cash-flow events in the next 90 days.</p>";

  } else {

    eventsHTML =
      visibleEvents.map(event => {

        const amount =
          event.amount;

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

            <strong
              class="${
                amount >= 0
                  ? "income"
                  : "expense"
              }"
            >
              ${amount >= 0 ? "+" : ""}
              ${money(amount)}
            </strong>

          </div>
        `;

      }).join("");

  }


  if (
    upcomingEvents.length > 8
  ) {

    eventsHTML += `
      <small>
        Showing the next 8 scheduled events.
      </small>
    `;

  }


  // ===================================================
  // RENDER
  // ===================================================

  container.innerHTML = `

    <div
      style="
        display:grid;
        grid-template-columns:repeat(4,1fr);
        gap:12px;
        margin-bottom:20px;
      "
    >

      <div
        style="
          padding:14px;
          border-radius:10px;
          background:#eff6ff;
          border:1px solid #bfdbfe;
        "
      >
        <small>Today</small>
        <strong
          style="
            display:block;
            font-size:1.35rem;
            color:#2563eb;
          "
        >
          ${money(todayData.balance)}
        </strong>
      </div>


      <div
        style="
          padding:14px;
          border-radius:10px;
          background:#f0fdf4;
          border:1px solid #bbf7d0;
        "
      >
        <small>30 Days</small>
        <strong
          style="
            display:block;
            font-size:1.35rem;
            color:#16a34a;
          "
        >
          ${money(day30.balance)}
        </strong>
      </div>


      <div
        style="
          padding:14px;
          border-radius:10px;
          background:#fff7ed;
          border:1px solid #fed7aa;
        "
      >
        <small>60 Days</small>
        <strong
          style="
            display:block;
            font-size:1.35rem;
            color:#ea580c;
          "
        >
          ${money(day60.balance)}
        </strong>
      </div>


      <div
        style="
          padding:14px;
          border-radius:10px;
          background:#f5f3ff;
          border:1px solid #ddd6fe;
        "
      >
        <small>90 Days</small>
        <strong
          style="
            display:block;
            font-size:1.35rem;
            color:#7c3aed;
          "
        >
          ${money(day90.balance)}
        </strong>
      </div>

    </div>


    <div
      style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        margin-bottom:12px;
        gap:20px;
        flex-wrap:wrap;
      "
    >

      <div>

        <small>
          LOWEST PROJECTED BALANCE
        </small>

        <strong
          style="
            display:block;
            font-size:1.5rem;
            color:${
              minimum.balance <= 0
                ? "#dc2626"
                : "#ea580c"
            };
          "
        >
          ${money(minimum.balance)}
        </strong>

        <small>
          Expected on ${escapeHTML(minimum.date)}
        </small>

      </div>

    </div>


    <div
      style="
        width:100%;
        overflow:hidden;
        border:1px solid #e5e7eb;
        border-radius:12px;
        background:#ffffff;
        margin-bottom:20px;
      "
    >

      <svg
        viewBox="0 0 ${width} ${height}"
        width="100%"
        height="260"
        preserveAspectRatio="none"
        role="img"
        aria-label="90 day projected cash balance"
      >

        ${zeroLine}

        ${bufferLine}


        <polyline
          points="${points}"
          fill="none"
          stroke="#2563eb"
          stroke-width="4"
          stroke-linejoin="round"
          stroke-linecap="round"
        />


        <circle
          cx="${minimumX}"
          cy="${minimumY}"
          r="7"
          fill="#dc2626"
          stroke="#ffffff"
          stroke-width="3"
        />


        <text
          x="${minimumX}"
          y="${minimumY - 14}"
          text-anchor="middle"
          font-size="12"
          font-weight="bold"
          fill="#dc2626"
        >
          ${money(minimum.balance)}
        </text>


        <text
          x="${paddingLeft}"
          y="${height - 10}"
          font-size="11"
          fill="#6b7280"
        >
          ${escapeHTML(firstDate)}
        </text>


        <text
          x="${width - paddingRight}"
          y="${height - 10}"
          text-anchor="end"
          font-size="11"
          fill="#6b7280"
        >
          ${escapeHTML(lastDate)}
        </text>

      </svg>

    </div>


    <div
      style="
        display:flex;
        gap:18px;
        flex-wrap:wrap;
        margin-bottom:20px;
        font-size:0.85rem;
      "
    >

      <span>
        <span
          style="
            display:inline-block;
            width:12px;
            height:4px;
            background:#2563eb;
            vertical-align:middle;
            margin-right:5px;
          "
        ></span>
        Projected balance
      </span>


      <span>
        <span
          style="
            display:inline-block;
            width:12px;
            height:4px;
            background:#f59e0b;
            vertical-align:middle;
            margin-right:5px;
          "
        ></span>
        Safety buffer
      </span>


      <span>
        <span
          style="
            display:inline-block;
            width:12px;
            height:4px;
            background:#dc2626;
            vertical-align:middle;
            margin-right:5px;
          "
        ></span>
        $0 level
      </span>

    </div>


    <div>

      <h3
        style="
          margin-top:0;
          margin-bottom:10px;
        "
      >
        Upcoming Cash-Flow Events
      </h3>

      ${eventsHTML}

    </div>

  `;
}

// =====================================================
// MINIMUM 90-DAY BALANCE
// =====================================================

async function calculate90DayMinimum() {

  const result =
    await buildForecast();


  if (!result.days.length) {

    return {
      balance:
        result.currentCash,
      date:
        result.startDate
    };
  }


  let minimum =
    result.currentCash;

  let minimumDate =
    result.startDate;


  result.days.forEach(
    day => {

      if (
        day.balance <
        minimum
      ) {

        minimum =
          day.balance;

        minimumDate =
          day.date;
      }
    }
  );


  return {
    balance: minimum,
    date: minimumDate
  };
}


// =====================================================
// ANALYTICS
// =====================================================

async function renderAnalytics() {

  const cash =
    await calculateCash();


  const minimum =
    await calculate90DayMinimum();


  const cashElement =
    document.getElementById("cash");


  if (cashElement) {

    cashElement.textContent =
      money(cash);
  }


  const minimumElement =
    document.getElementById("min90");


  const minimumDateElement =
    document.getElementById("min90Date");


  if (minimumElement) {

    minimumElement.textContent =
      money(minimum.balance);
  }


  if (minimumDateElement) {

    minimumDateElement.textContent =
      `Expected on ${minimum.date}`;
  }


  const bufferInput =
    document.getElementById("buffer");


  const buffer =
    Number(
      bufferInput?.value || 500
    );


  // ---------------------------------------------
  // SAFE TO SPEND
  // ---------------------------------------------

  const futureDifference =
    minimum.balance - cash;


  let safe =
    cash - buffer;


  if (futureDifference < 0) {

    safe += futureDifference;
  }


  safe =
    Math.max(
      0,
      safe
    );


  const safeElement =
    document.getElementById(
      "safeToSpend"
    );


  if (safeElement) {

    safeElement.textContent =
      money(safe);
  }


  const safeTextElement =
    document.getElementById(
      "safeToSpendText"
    );


  if (safeTextElement) {

    if (minimum.balance < buffer) {

      safeTextElement.textContent =
        "Future cash flow falls below your safety buffer.";

    } else if (
      minimum.balance < cash
    ) {

      safeTextElement.textContent =
        "Future commitments reduce your available cash.";

    } else {

      safeTextElement.textContent =
        "No projected cash-flow drop below current cash.";
    }
  }


  // ---------------------------------------------
  // STATUS
  // ---------------------------------------------

  const statusElement =
    document.getElementById("status");


  const statusTextElement =
    document.getElementById(
      "statusText"
    );


  if (
    minimum.balance <= 0
  ) {

    if (statusElement)
      statusElement.textContent =
        "CRITICAL";


    if (statusTextElement)
      statusTextElement.textContent =
        "Cash is projected to reach zero or below within 90 days.";

  } else if (
    minimum.balance < buffer
  ) {

    if (statusElement)
      statusElement.textContent =
        "WARNING";


    if (statusTextElement)
      statusTextElement.textContent =
        "Projected cash falls below your safety buffer.";

  } else {

    if (statusElement)
      statusElement.textContent =
        "OK";


    if (statusTextElement)
      statusTextElement.textContent =
        "Projected cash remains above your safety buffer.";
  }


  // ---------------------------------------------
  // SAFE DETAILS
  // ---------------------------------------------

  const safeDetails =
    document.getElementById(
      "safeDetails"
    );


  if (safeDetails) {

    safeDetails.innerHTML = `
      <small>
        Current cash: ${money(cash)}
      </small>
      <small>
        Safety buffer: ${money(buffer)}
      </small>
      <small>
        90-day minimum: ${money(minimum.balance)}
      </small>
    `;
  }


  // ---------------------------------------------
  // ACTION CENTER
  // ---------------------------------------------

  renderActions(
    cash,
    minimum,
    buffer
  );
}


// =====================================================
// ACTION CENTER
// =====================================================

function renderActions(
  cash,
  minimum,
  buffer
) {

  const container =
    document.getElementById(
      "actions"
    );


  if (!container) return;


  const actions = [];


  if (minimum.balance <= 0) {

    actions.push(
      "Projected cash reaches zero or below within 90 days."
    );

  } else if (
    minimum.balance < buffer
  ) {

    actions.push(
      "Projected cash falls below your safety buffer."
    );
  }


  if (
    minimum.balance < cash
  ) {

    actions.push(
      `Future cash-flow commitments reduce available cash by ${money(cash - minimum.balance)}.`
    );
  }


  if (!actions.length) {

    actions.push(
      "No immediate cash-flow warning."
    );
  }


  container.innerHTML =
    actions.map(
      action =>
        `<p>${escapeHTML(action)}</p>`
    ).join("");
}


// =====================================================
// RESET DEMO
// =====================================================

async function resetDemo() {

  const confirmed =
    confirm(
      "Reset the cloud database to the demo data?"
    );


  if (!confirmed) return;


  // ---------------------------------------------
  // REMOVE TRANSACTIONS
  // ---------------------------------------------

  const {
    error: deleteError
  } = await db
    .from("transactions")
    .delete()
    .neq("id", 0);


  if (deleteError) {

    console.error(
      deleteError
    );

    alert(
      "Could not reset transactions."
    );

    return;
  }


  // ---------------------------------------------
  // REMOVE ACCOUNTS
  // ---------------------------------------------

  const {
    error: accountDeleteError
  } = await db
    .from("accounts")
    .delete()
    .neq("id", 0);


  if (accountDeleteError) {

    console.error(
      accountDeleteError
    );

    alert(
      "Could not reset accounts."
    );

    return;
  }


  // ---------------------------------------------
  // INSERT DEMO ACCOUNTS
  // ---------------------------------------------

  const {
    error: insertError
  } = await db
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

    console.error(
      insertError
    );

    alert(
      "Could not create demo accounts."
    );

    return;
  }


  await render();
}


// =====================================================
// RECURRING DISPLAY
// =====================================================

async function renderRecurring() {

  const container =
    document.getElementById(
      "recurring"
    );


  if (!container) return;


  const data =
    await getRecurring();


  if (!data.length) {

    container.innerHTML =
      "<p>No recurring transactions yet.</p>";

    return;
  }


  container.innerHTML = "";


  data.forEach(
    item => {

      const row =
        document.createElement(
          "div"
        );


      row.className =
        "event-row";


      const amount =
        Number(
          item.amount || 0
        );


      row.innerHTML = `
        <div>
          <strong>
            ${escapeHTML(item.description)}
          </strong>

          <small>
            ${escapeHTML(item.start_date)}
            ·
            ${escapeHTML(item.frequency)}
          </small>
        </div>

        <strong class="${
          amount >= 0
            ? "income"
            : "expense"
        }">
          ${amount >= 0 ? "+" : ""}
          ${money(amount)}
        </strong>

        <button
          type="button"
        >
          Delete
        </button>
      `;


      row
        .querySelector("button")
        .addEventListener(
          "click",
          async () => {

            const {
              error
            } = await db
              .from("recurring")
              .delete()
              .eq(
                "id",
                item.id
              );


            if (error) {

              console.error(
                "Delete recurring error:",
                error
              );

              alert(
                "Could not delete recurring transaction."
              );

              return;
            }


            await render();
          }
        );


      container.appendChild(
        row
      );
    }
  );
}


// =====================================================
// ADD RECURRING
// =====================================================

function setupRecurringForm() {

  const form =
    document.getElementById(
      "recForm"
    );


  if (!form) return;


  form.addEventListener(
    "submit",
    async function(event) {

      event.preventDefault();


      const description =
        document
          .getElementById("recDesc")
          .value
          .trim();


      const amount =
        Number(
          document
            .getElementById("recAmount")
            .value
        );


      const frequency =
        document
          .getElementById("recFreq")
          .value;


      const startDate =
        document
          .getElementById("recStart")
          .value;


      if (!description) {

        alert(
          "Please enter a description."
        );

        return;
      }


      if (isNaN(amount)) {

        alert(
          "Please enter a valid amount."
        );

        return;
      }


      if (!startDate) {

        alert(
          "Please enter a start date."
        );

        return;
      }


      const {
        error
      } = await db
        .from("recurring")
        .insert({
          description:
            description,

          amount:
            amount,

          frequency:
            frequency,

          start_date:
            startDate
        });


      if (error) {

        console.error(
          "Add recurring error:",
          error
        );

        alert(
          "Could not save recurring transaction."
        );

        return;
      }


      form.reset();


      await render();
    }
  );
}


// =====================================================
// EVENT FORM
// =====================================================

function setupEventForm() {

  const form =
    document.getElementById(
      "eventForm"
    );


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
    document.getElementById(
      "resetDemo"
    );


  if (!button) return;


  button.addEventListener(
    "click",
    resetDemo
  );
}


// =====================================================
// BUFFER
// =====================================================

function setupBuffer() {

  const input =
    document.getElementById(
      "buffer"
    );


  if (!input) return;


  input.addEventListener(
    "change",
    async function() {

      await renderAnalytics();
    }
  );
}


// =====================================================
// MAIN RENDER
// =====================================================

async function render() {

  await renderEvents();

  await renderRecurring();

  await renderForecast();

  await renderAnalytics();
}


// =====================================================
// START
// =====================================================

document.addEventListener(
  "DOMContentLoaded",
  async function() {

    setupEventForm();

    setupRecurringForm();

    setupResetButton();

    setupBuffer();

    await render();

  }
);


// =====================================================
// GLOBAL
// =====================================================

window.deleteEvent =
  deleteEvent;

window.resetDemo =
  resetDemo;
