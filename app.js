const SUPABASE_URL = "https://vvwrjabmetrifporzubu.supabase.co";
const SUPABASE_KEY = "sb_publishable_mADOLEV3fjhhyyX_pSLBxg_rrmcDwRi";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);


// ===================================================
// HELPERS
// ===================================================

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

  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate()
  );

}


function parseDate(value) {

  if (!value) return null;

  const parts = String(value).split("-");

  return new Date(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2])
  );

}


function formatDate(date) {

  if (!(date instanceof Date) || isNaN(date)) return "";

  return date.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });

}


function addDays(date, days) {

  const result = new Date(date);

  result.setDate(result.getDate() + days);

  return result;

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

  return days[month];

}


// ===================================================
// DATABASE
// ===================================================

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


// ===================================================
// TRANSACTIONS
// ===================================================

async function addEvent() {

  const date = document.getElementById("eventDate").value;
  const description = document.getElementById("eventDesc").value.trim();
  const amount = Number(
    document.getElementById("eventAmount").value
  );

  if (!date || !description || !Number.isFinite(amount)) {

    alert("Please enter date, description and amount.");

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

    alert(error.message);

    return;

  }

  document.getElementById("eventDesc").value = "";
  document.getElementById("eventAmount").value = "";

  await render();

}


async function deleteEvent(id) {

  const { error } = await db
    .from("transactions")
    .delete()
    .eq("id", id);

  if (error) {

    console.error("Delete transaction error:", error);

    alert(error.message);

    return;

  }

  await render();

}


async function renderEvents() {

  const container = document.getElementById("events");

  if (!container) return;

  const transactions = await getTransactions();

  if (!transactions.length) {

    container.innerHTML =
      "<p>No transactions yet.</p>";

    return;

  }

  container.innerHTML = transactions
    .map(item => {

      const amount = Number(item.amount || 0);

      return `
        <div class="event-row">

          <div>
            <strong>${escapeHTML(item.description)}</strong>
            <div>${formatDate(parseDate(item.date))}</div>
          </div>

          <div>
            <span style="
              color:${amount >= 0 ? "green" : "red"};
              font-weight:600;
            ">
              ${amount >= 0 ? "+" : ""}${money(amount)}
            </span>

            <button onclick="deleteEvent(${item.id})">
              Delete
            </button>
          </div>

        </div>
      `;

    })
    .join("");

}


// ===================================================
// CASH
// ===================================================

async function calculateCash() {

  const accounts = await getAccounts();
  const transactions = await getTransactions();

  let cash = accounts.reduce(
    (sum, account) =>
      sum + Number(account.balance || 0),
    0
  );

  const now = today();

  for (const transaction of transactions) {

    const transactionDate =
      parseDate(transaction.date);

    if (
      transactionDate &&
      transactionDate <= now
    ) {

      cash += Number(transaction.amount || 0);

    }

  }

  return cash;

}


// ===================================================
// RECURRING
// ===================================================

function nextRecurringDate(date, frequency) {

  const result = new Date(date);

  if (frequency === "weekly") {

    result.setDate(result.getDate() + 7);

  }

  else if (frequency === "biweekly") {

    result.setDate(result.getDate() + 14);

  }

  else if (frequency === "monthly") {

    const originalDay = result.getDate();

    result.setDate(1);

    result.setMonth(result.getMonth() + 1);

    const maxDay = daysInMonth(
      result.getFullYear(),
      result.getMonth()
    );

    result.setDate(
      Math.min(originalDay, maxDay)
    );

  }

  return result;

}


function getRecurringOccurrences(
  recurringItem,
  startDate,
  endDate
) {

  const occurrences = [];

  let current =
    parseDate(recurringItem.start_date);

  if (!current) return occurrences;

  while (current < startDate) {

    current = nextRecurringDate(
      current,
      recurringItem.frequency
    );

  }

  while (current <= endDate) {

    occurrences.push({
      date: new Date(current),
      description: recurringItem.description,
      amount: Number(recurringItem.amount || 0),
      recurringId: recurringItem.id
    });

    current = nextRecurringDate(
      current,
      recurringItem.frequency
    );

  }

  return occurrences;

}


// ===================================================
// FORECAST DATA
// ===================================================

async function buildForecast() {

  const accounts = await getAccounts();
  const transactions = await getTransactions();
  const recurring = await getRecurring();

  const start = today();
  const end = addDays(start, 89);

  let balance = accounts.reduce(
    (sum, account) =>
      sum + Number(account.balance || 0),
    0
  );

  const todayTransactions = transactions.filter(
    transaction => {

      const date = parseDate(transaction.date);

      return date && date <= start;

    }
  );

  for (const transaction of todayTransactions) {

    balance += Number(transaction.amount || 0);

  }

  const futureTransactions =
    transactions.filter(transaction => {

      const date = parseDate(transaction.date);

      return (
        date &&
        date > start &&
        date <= end
      );

    });


  const futureRecurring = [];

  for (const item of recurring) {

    futureRecurring.push(
      ...getRecurringOccurrences(
        item,
        addDays(start, 1),
        end
      )
    );

  }


  const days = [];

  let runningBalance = balance;

  for (
    let i = 0;
    i < 90;
    i++
  ) {

    const date = addDays(start, i);

    const dayTransactions =
      futureTransactions.filter(
        transaction =>
          parseDate(transaction.date)
            .getTime() === date.getTime()
      );

    const dayRecurring =
      futureRecurring.filter(
        occurrence =>
          occurrence.date.getTime() === date.getTime()
      );

    const events = [];

    for (const transaction of dayTransactions) {

      const amount =
        Number(transaction.amount || 0);

      runningBalance += amount;

      events.push({
        date,
        description: transaction.description,
        amount
      });

    }

    for (const occurrence of dayRecurring) {

      runningBalance += occurrence.amount;

      events.push({
        date,
        description: occurrence.description,
        amount: occurrence.amount
      });

    }

    days.push({
      date,
      balance: runningBalance,
      events
    });

  }

  return {
    start,
    days
  };

}


// ===================================================
// 90 DAY MINIMUM
// ===================================================

async function calculate90DayMinimum() {

  const result = await buildForecast();

  if (!result.days.length) {

    return {
      balance: 0,
      date: result.start
    };

  }

  let minimum = result.days[0];

  for (const day of result.days) {

    if (day.balance < minimum.balance) {

      minimum = day;

    }

  }

  return {
    balance: minimum.balance,
    date: minimum.date
  };

}


// ===================================================
// ANALYTICS
// ===================================================

async function renderAnalytics() {

  const cashElement =
    document.getElementById("cash");

  const min90Element =
    document.getElementById("min90");

  const min90DateElement =
    document.getElementById("min90Date");

  const safeElement =
    document.getElementById("safeToSpend");

  const safeTextElement =
    document.getElementById("safeToSpendText");

  const safeDetailsElement =
    document.getElementById("safeDetails");

  const statusElement =
    document.getElementById("status");

  const statusTextElement =
    document.getElementById("statusText");

  const bufferElement =
    document.getElementById("buffer");


  const cash = await calculateCash();

  const minimum =
    await calculate90DayMinimum();


  const buffer =
    Number(
      bufferElement?.value ||
      bufferElement?.textContent ||
      0
    );


  // -----------------------------------------------
  // CURRENT CASH
  // -----------------------------------------------

  if (cashElement) {

    cashElement.textContent =
      money(cash);

  }


  // -----------------------------------------------
  // LOWEST PROJECTED BALANCE
  // -----------------------------------------------

  if (min90Element) {

    min90Element.textContent =
      money(minimum.balance);

  }


  if (min90DateElement) {

    min90DateElement.textContent =
      formatDate(minimum.date);

  }


  // -----------------------------------------------
  // SAFE TO SPEND
  // -----------------------------------------------

  let safeToSpend =
    cash - buffer;


  const futureDifference =
    minimum.balance - cash;


  if (futureDifference < 0) {

    safeToSpend += futureDifference;

  }


  safeToSpend =
    Math.max(0, safeToSpend);


  if (safeElement) {

    safeElement.textContent =
      money(safeToSpend);

  }


  if (safeTextElement) {

    safeTextElement.textContent =
      "Amount currently available above your safety threshold.";

  }


  // -----------------------------------------------
  // STATUS
  // -----------------------------------------------

  let status = "OK";

  let statusText =
    "Projected balance remains above the safety buffer.";


  if (minimum.balance <= 0) {

    status = "CRITICAL";

    statusText =
      "Projected balance reaches zero or below.";

  }

  else if (minimum.balance < buffer) {

    status = "WARNING";

    statusText =
      "Projected balance falls below the safety buffer.";

  }


  if (statusElement) {

    statusElement.textContent =
      status;

    statusElement.classList.remove(
      "status-ok",
      "status-warning",
      "status-critical"
    );

    if (status === "OK") {

      statusElement.classList.add(
        "status-ok"
      );

    }

    else if (status === "WARNING") {

      statusElement.classList.add(
        "status-warning"
      );

    }

    else {

      statusElement.classList.add(
        "status-critical"
      );

    }

  }


  if (statusTextElement) {

    statusTextElement.textContent =
      statusText;

  }


  // -----------------------------------------------
  // ANALYTICS VISUAL DETAILS
  // -----------------------------------------------

  if (safeDetailsElement) {

    safeDetailsElement.innerHTML = `

      <div class="analytics-metric">

        <span>Current Cash</span>

        <strong>
          ${money(cash)}
        </strong>

      </div>


      <div class="analytics-metric">

        <span>Safety Buffer</span>

        <strong>
          ${money(buffer)}
        </strong>

      </div>


      <div class="analytics-metric">

        <span>Lowest Projected Balance</span>

        <strong>
          ${money(minimum.balance)}
        </strong>

        <small>
          ${formatDate(minimum.date)}
        </small>

      </div>

    `;

  }


  // -----------------------------------------------
  // ACTION CENTER
  // -----------------------------------------------

  await renderActions(
    cash,
    minimum,
    buffer
  );

}

// ===================================================
// ACTION CENTER
// ===================================================

async function renderActions(
  cash,
  minimum,
  buffer
) {

  const container =
    document.getElementById("actions");

  if (!container) return;


  const messages = [];


  if (minimum.balance <= 0) {

    messages.push(
      "Projected cash reaches zero or below within the next 90 days."
    );

  }

  else if (minimum.balance < buffer) {

    messages.push(
      "Projected cash falls below your safety buffer."
    );

  }


  if (minimum.balance < cash) {

    messages.push(
      `Projected low point: ${money(minimum.balance)} on ${formatDate(minimum.date)}.`
    );

  }


  if (!messages.length) {

    messages.push(
      "No immediate cash-flow action is indicated."
    );

  }


  container.innerHTML =
    messages
      .map(message => `<div>${escapeHTML(message)}</div>`)
      .join("");

}


// ===================================================
// FORECAST
// ===================================================

async function renderForecast() {

  const container =
    document.getElementById("forecast");

  if (!container) return;


  const result =
    await buildForecast();


  if (!result.days.length) {

    container.innerHTML =
      "<p>No forecast data available.</p>";

    return;

  }


  const todayData =
    result.days[0];

  const day30 =
    result.days[Math.min(29, result.days.length - 1)];

  const day60 =
    result.days[Math.min(59, result.days.length - 1)];

  const day90 =
    result.days[result.days.length - 1];


  let minimum =
    result.days[0];


  for (const day of result.days) {

    if (day.balance < minimum.balance) {

      minimum = day;

    }

  }


  const width = 900;
  const height = 300;

  const paddingLeft = 55;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;


  const values =
    result.days.map(day => day.balance);


  const currentCash =
    todayData.balance;


  const bufferInput =
    document.getElementById("buffer");


  const buffer =
    Number(
      bufferInput?.value ||
      bufferInput?.textContent ||
      0
    );


  const minValue =
    Math.min(
      0,
      ...values,
      buffer
    );


  const maxValue =
    Math.max(
      ...values,
      buffer,
      currentCash
    );


  const range =
    maxValue - minValue || 1;


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


  function chartY(value) {

    return (
      paddingTop +
      (
        (maxValue - value) /
        range
      ) *
      (
        height -
        paddingTop -
        paddingBottom
      )
    );

  }


  const balancePoints =
    result.days
      .map((day, index) =>
        `${chartX(index)},${chartY(day.balance)}`
      )
      .join(" ");


  const zeroLine =
    chartY(0);


  const bufferLine =
    chartY(buffer);


  const minimumIndex =
    result.days.indexOf(minimum);


  const minimumX =
    chartX(minimumIndex);


  const minimumY =
    chartY(minimum.balance);


  // -----------------------------------------------
  // KEY FORECAST POINTS
  // -----------------------------------------------

  const todayIndex = 0;
  const day30Index = Math.min(29, result.days.length - 1);
  const day60Index = Math.min(59, result.days.length - 1);
  const day90Index = result.days.length - 1;


  const todayX = chartX(todayIndex);
  const todayY = chartY(todayData.balance);

  const day30X = chartX(day30Index);
  const day30Y = chartY(day30.balance);

  const day60X = chartX(day60Index);
  const day60Y = chartY(day60.balance);

  const day90X = chartX(day90Index);
  const day90Y = chartY(day90.balance);


  // -----------------------------------------------
  // UPCOMING EVENTS
  // -----------------------------------------------

  const upcomingEvents = [];


  for (const day of result.days) {

    for (const event of day.events) {

      upcomingEvents.push(event);

    }

  }


  upcomingEvents.sort(
    (a, b) =>
      a.date.getTime() -
      b.date.getTime()
  );


  const eventsToShow =
    upcomingEvents.slice(0, 8);


  let eventsHTML = "";


  if (!eventsToShow.length) {

    eventsHTML =
      `<div class="forecast-no-events">
        No upcoming cash-flow events.
      </div>`;

  }

  else {

    eventsHTML =
      eventsToShow
        .map(event => {

          const amount =
            Number(event.amount || 0);

          return `
            <div class="forecast-event">

              <div>
                <strong>
                  ${escapeHTML(event.description)}
                </strong>

                <span>
                  ${formatDate(event.date)}
                </span>
              </div>

              <div
                class="${amount >= 0 ? "positive" : "negative"}"
              >
                ${amount >= 0 ? "+" : ""}
                ${money(amount)}
              </div>

            </div>
          `;

        })
        .join("");

  }
  container.innerHTML = `

    <style>

      .forecast-wrapper {
        width: 100%;
        box-sizing: border-box;
      }

      .forecast-summary {
        display: grid;
        grid-template-columns:
          repeat(4, minmax(0, 1fr));
        gap: 12px;
        margin-bottom: 18px;
      }

      .forecast-card {
        min-width: 0;
        box-sizing: border-box;
        padding: 14px;
        border: 1px solid #ddd;
        border-radius: 10px;
        background: #fff;
      }

      .forecast-card-label {
        font-size: 12px;
        color: #666;
        margin-bottom: 6px;
      }

      .forecast-card-value {
        font-size: 20px;
        font-weight: 700;
        overflow-wrap: anywhere;
      }

      .forecast-card-date {
        margin-top: 4px;
        font-size: 12px;
        color: #777;
      }

      .forecast-low {
        margin-bottom: 18px;
        padding: 14px;
        border-radius: 10px;
        border: 1px solid #ddd;
        background: #fff;
      }

      .forecast-low strong {
        font-size: 18px;
      }

      .forecast-chart {
        width: 100%;
        overflow: hidden;
        margin-bottom: 20px;
      }

      .forecast-chart svg {
        display: block;
        width: 100%;
        height: auto;
      }

      .forecast-events {
        margin-top: 18px;
      }

      .forecast-events h3 {
        margin-bottom: 10px;
      }

      .forecast-event-list {
        display: flex;
        flex-direction: column;
        gap: 7px;
      }

      .forecast-event {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 15px;
        padding: 9px 11px;
        border-bottom: 1px solid #eee;
      }

      .forecast-event > div:first-child {
        min-width: 0;
      }

      .forecast-event strong {
        display: block;
        overflow-wrap: anywhere;
      }

      .forecast-event span {
        display: block;
        font-size: 12px;
        color: #777;
        margin-top: 2px;
      }

      .forecast-event .positive {
        color: green;
        font-weight: 700;
        white-space: nowrap;
      }

      .forecast-event .negative {
        color: red;
        font-weight: 700;
        white-space: nowrap;
      }

      .forecast-no-events {
        padding: 12px;
        color: #666;
      }

      @media (max-width: 700px) {

        .forecast-summary {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }

        .forecast-card-value {
          font-size: 18px;
        }

      }

      @media (max-width: 430px) {

        .forecast-summary {
          grid-template-columns: 1fr;
        }

        .forecast-event {
          align-items: flex-start;
        }

      }

    </style>


    <div class="forecast-wrapper">

      <div class="forecast-summary">

        <div class="forecast-card">

          <div class="forecast-card-label">
            Today
          </div>

          <div class="forecast-card-value">
            ${money(todayData.balance)}
          </div>

          <div class="forecast-card-date">
            ${formatDate(todayData.date)}
          </div>

        </div>


        <div class="forecast-card">

          <div class="forecast-card-label">
            30 Days
          </div>

          <div class="forecast-card-value">
            ${money(day30.balance)}
          </div>

          <div class="forecast-card-date">
            ${formatDate(day30.date)}
          </div>

        </div>


        <div class="forecast-card">

          <div class="forecast-card-label">
            60 Days
          </div>

          <div class="forecast-card-value">
            ${money(day60.balance)}
          </div>

          <div class="forecast-card-date">
            ${formatDate(day60.date)}
          </div>

        </div>


        <div class="forecast-card">

          <div class="forecast-card-label">
            90 Days
          </div>

          <div class="forecast-card-value">
            ${money(day90.balance)}
          </div>

          <div class="forecast-card-date">
            ${formatDate(day90.date)}
          </div>

        </div>

      </div>


      <div class="forecast-low">

        Lowest projected balance:

        <strong>
          ${money(minimum.balance)}
        </strong>

        on

        <strong>
          ${formatDate(minimum.date)}
        </strong>

      </div>


      <div class="forecast-chart">

        <svg
          viewBox="0 0 ${width} ${height}"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="90 day cash forecast"
        >

          <!-- ZERO LINE -->

          <line
            x1="${paddingLeft}"
            y1="${zeroLine}"
            x2="${width - paddingRight}"
            y2="${zeroLine}"
            stroke="red"
            stroke-width="1"
            stroke-dasharray="5 5"
          />


          <!-- SAFETY BUFFER -->

          <line
            x1="${paddingLeft}"
            y1="${bufferLine}"
            x2="${width - paddingRight}"
            y2="${bufferLine}"
            stroke="orange"
            stroke-width="1"
            stroke-dasharray="5 5"
          />


          <!-- 30 DAY GUIDE -->

          <line
            x1="${day30X}"
            y1="${paddingTop}"
            x2="${day30X}"
            y2="${height - paddingBottom}"
            stroke="#e5e7eb"
            stroke-width="1"
            stroke-dasharray="3 5"
          />


          <!-- 60 DAY GUIDE -->

          <line
            x1="${day60X}"
            y1="${paddingTop}"
            x2="${day60X}"
            y2="${height - paddingBottom}"
            stroke="#e5e7eb"
            stroke-width="1"
            stroke-dasharray="3 5"
          />


          <!-- 90 DAY GUIDE -->

          <line
            x1="${day90X}"
            y1="${paddingTop}"
            x2="${day90X}"
            y2="${height - paddingBottom}"
            stroke="#e5e7eb"
            stroke-width="1"
            stroke-dasharray="3 5"
          />


          <!-- BALANCE LINE -->

          <polyline
            points="${balancePoints}"
            fill="none"
            stroke="blue"
            stroke-width="3"
            stroke-linejoin="round"
            stroke-linecap="round"
          />


          <!-- TODAY -->

          <circle
            cx="${todayX}"
            cy="${todayY}"
            r="5"
            fill="blue"
          >

            <title>
              Today: ${money(todayData.balance)}
              — ${formatDate(todayData.date)}
            </title>

          </circle>


          <!-- 30 DAYS -->

          <circle
            cx="${day30X}"
            cy="${day30Y}"
            r="5"
            fill="blue"
          >

            <title>
              30 days: ${money(day30.balance)}
              — ${formatDate(day30.date)}
            </title>

          </circle>


          <!-- 60 DAYS -->

          <circle
            cx="${day60X}"
            cy="${day60Y}"
            r="5"
            fill="blue"
          >

            <title>
              60 days: ${money(day60.balance)}
              — ${formatDate(day60.date)}
            </title>

          </circle>


          <!-- 90 DAYS -->

          <circle
            cx="${day90X}"
            cy="${day90Y}"
            r="5"
            fill="blue"
          >

            <title>
              90 days: ${money(day90.balance)}
              — ${formatDate(day90.date)}
            </title>

          </circle>


          <!-- LOWEST BALANCE -->

          <circle
            cx="${minimumX}"
            cy="${minimumY}"
            r="6"
            fill="red"
          >

            <title>
              Lowest balance:
              ${money(minimum.balance)}
              — ${formatDate(minimum.date)}
            </title>

          </circle>


          <!-- X-AXIS LABELS -->

          <text
            x="${todayX}"
            y="${height - 10}"
            font-size="12"
            text-anchor="middle"
          >
            Today
          </text>


          <text
            x="${day30X}"
            y="${height - 10}"
            font-size="12"
            text-anchor="middle"
          >
            30
          </text>


          <text
            x="${day60X}"
            y="${height - 10}"
            font-size="12"
            text-anchor="middle"
          >
            60
          </text>


          <text
            x="${day90X}"
            y="${height - 10}"
            font-size="12"
            text-anchor="middle"
          >
            90 days
          </text>


          <!-- ZERO LABEL -->

          <text
            x="${paddingLeft + 5}"
            y="${zeroLine - 6}"
            font-size="11"
            fill="red"
          >
            $0
          </text>


          <!-- BUFFER LABEL -->

          <text
            x="${paddingLeft + 5}"
            y="${bufferLine - 6}"
            font-size="11"
            fill="orange"
          >
            Buffer ${money(buffer)}
          </text>

        </svg>

      </div>


      <details class="forecast-events">

        <summary>
          Upcoming cash flow
        </summary>

        <div class="forecast-event-list">

          ${eventsHTML}

        </div>

      </details>

    </div>

  `;

}

// ===================================================
// RECURRING UI
// ===================================================

async function renderRecurring() {

  const container =
    document.getElementById("recurring");

  if (!container) return;

  const recurring =
    await getRecurring();


  if (!recurring.length) {

    container.innerHTML =
      "<p>No recurring items yet.</p>";

    return;

  }


  container.innerHTML =
    recurring
      .map(item => {

        const amount =
          Number(item.amount || 0);

        return `
          <div class="event-row">

            <div>

              <strong>
                ${escapeHTML(item.description)}
              </strong>

              <div>
                ${escapeHTML(item.frequency)}
                · starts
                ${formatDate(parseDate(item.start_date))}
              </div>

            </div>

            <div>

              <span style="
                color:${amount >= 0 ? "green" : "red"};
                font-weight:600;
              ">
                ${amount >= 0 ? "+" : ""}
                ${money(amount)}
              </span>

              <button
                onclick="deleteRecurring(${item.id})"
              >
                Delete
              </button>

            </div>

          </div>
        `;

      })
      .join("");

}


async function deleteRecurring(id) {

  const { error } = await db
    .from("recurring")
    .delete()
    .eq("id", id);

  if (error) {

    console.error(
      "Delete recurring error:",
      error
    );

    alert(error.message);

    return;

  }

  await render();

}


function setupRecurringForm() {

  const form =
    document.getElementById("recForm");

  if (!form) return;


  form.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      const description =
        document.getElementById("recDesc")
          .value
          .trim();


      const amount =
        Number(
          document.getElementById("recAmount")
            .value
        );


      const frequency =
        document.getElementById("recFreq")
          .value;


      const startDate =
        document.getElementById("recStart")
          .value;


      if (
        !description ||
        !Number.isFinite(amount) ||
        !frequency ||
        !startDate
      ) {

        alert(
          "Please enter all recurring fields."
        );

        return;

      }


      const { error } =
        await db
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

        alert(error.message);

        return;

      }


      document.getElementById("recDesc").value = "";
      document.getElementById("recAmount").value = "";


      await render();

    }
  );

}


// ===================================================
// EVENT FORM
// ===================================================

function setupEventForm() {

  const form =
    document.getElementById("eventForm");

  if (!form) return;


  form.addEventListener(
    "submit",
    async event => {

      event.preventDefault();

      await addEvent();

    }
  );

}


// ===================================================
// RESET
// ===================================================

function setupResetButton() {

  const button =
    document.getElementById("resetDemo");

  if (!button) return;


  button.addEventListener(
    "click",
    async () => {

      await resetDemo();

    }
  );

}


async function resetDemo() {

  const confirmed =
    confirm(
      "Reset accounts and transactions to demo data?"
    );

  if (!confirmed) return;


  const transactionDelete =
    await db
      .from("transactions")
      .delete()
      .neq("id", 0);


  if (transactionDelete.error) {

    console.error(
      "Reset transactions error:",
      transactionDelete.error
    );

    alert(transactionDelete.error.message);

    return;

  }


  const accountDelete =
    await db
      .from("accounts")
      .delete()
      .neq("id", 0);


  if (accountDelete.error) {

    console.error(
      "Reset accounts error:",
      accountDelete.error
    );

    alert(accountDelete.error.message);

    return;

  }


  const { error } =
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


  if (error) {

    console.error(
      "Reset insert error:",
      error
    );

    alert(error.message);

    return;

  }


  await render();

}


// ===================================================
// BUFFER
// ===================================================

function setupBuffer() {

  const input =
    document.getElementById("buffer");

  if (!input) return;


  input.addEventListener(
    "input",
    async () => {

      await renderAnalytics();

      await renderForecast();

    }
  );

}


// ===================================================
// RENDER
// ===================================================

async function render() {

  await renderEvents();

  await renderRecurring();

  await renderForecast();

  await renderAnalytics();

}


// ===================================================
// START
// ===================================================

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    setupEventForm();

    setupRecurringForm();

    setupResetButton();

    setupBuffer();

    await render();

  }
);


// ===================================================
// GLOBAL FUNCTIONS
// ===================================================

window.deleteEvent =
  deleteEvent;

window.deleteRecurring =
  deleteRecurring;

window.resetDemo =
  resetDemo;
