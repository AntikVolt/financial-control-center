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
  // KEY DAYS
  // ===================================================

  const todayData = result.days[0];

  const day30 =
    result.days[Math.min(29, result.days.length - 1)];

  const day60 =
    result.days[Math.min(59, result.days.length - 1)];

  const day90 =
    result.days[result.days.length - 1];


  // ===================================================
  // LOWEST BALANCE
  // ===================================================

  let minimum = result.days[0];
  let minimumIndex = 0;

  result.days.forEach(function(day, index) {

    if (day.balance < minimum.balance) {
      minimum = day;
      minimumIndex = index;
    }

  });


  // ===================================================
  // CHART SETTINGS
  // ===================================================

  const width = 900;
  const height = 300;

  const left = 65;
  const right = 25;
  const top = 25;
  const bottom = 45;

  const balances =
    result.days.map(function(day) {
      return Number(day.balance || 0);
    });

  let minBalance =
    Math.min.apply(null, balances);

  let maxBalance =
    Math.max.apply(null, balances);

  const range =
    Math.max(
      500,
      maxBalance - minBalance
    );

  minBalance -= range * 0.08;
  maxBalance += range * 0.08;


  function chartX(index) {

    return (
      left +
      (
        index /
        (result.days.length - 1)
      ) *
      (
        width -
        left -
        right
      )
    );

  }


  function chartY(balance) {

    return (
      top +
      (
        (maxBalance - balance) /
        (maxBalance - minBalance)
      ) *
      (
        height -
        top -
        bottom
      )
    );

  }


  const points =
    result.days.map(function(day, index) {

      return (
        chartX(index) +
        "," +
        chartY(day.balance)
      );

    }).join(" ");


  // ===================================================
  // ZERO LINE
  // ===================================================

  let zeroLine = "";

  if (
    minBalance <= 0 &&
    maxBalance >= 0
  ) {

    const zeroY =
      chartY(0);

    zeroLine = `
      <line
        x1="${left}"
        y1="${zeroY}"
        x2="${width - right}"
        y2="${zeroY}"
        stroke="#dc2626"
        stroke-width="2"
        stroke-dasharray="7 6"
      />

      <text
        x="${left - 8}"
        y="${zeroY - 7}"
        text-anchor="end"
        font-size="12"
        fill="#dc2626"
      >
        $0
      </text>
    `;

  }


  // ===================================================
  // SAFETY BUFFER
  // ===================================================

  const bufferInput =
    document.getElementById("buffer");

  const buffer =
    Number(bufferInput?.value || 500);

  let bufferLine = "";

  if (
    buffer >= minBalance &&
    buffer <= maxBalance
  ) {

    const bufferY =
      chartY(buffer);

    bufferLine = `
      <line
        x1="${left}"
        y1="${bufferY}"
        x2="${width - right}"
        y2="${bufferY}"
        stroke="#f59e0b"
        stroke-width="2"
        stroke-dasharray="6 6"
      />

      <text
        x="${left - 8}"
        y="${bufferY - 7}"
        text-anchor="end"
        font-size="12"
        fill="#d97706"
      >
        Buffer
      </text>
    `;

  }


  // ===================================================
  // MINIMUM POINT
  // ===================================================

  const minimumX =
    chartX(minimumIndex);

  const minimumY =
    chartY(minimum.balance);


  // ===================================================
  // UPCOMING EVENTS
  // ===================================================

  const upcomingEvents = [];

  result.days.forEach(function(day) {

    if (day.date === result.startDate) {
      return;
    }

    day.items.forEach(function(item) {

      upcomingEvents.push({
        date: day.date,
        description: item.description,
        amount: Number(item.amount || 0)
      });

    });

  });


  const visibleEvents =
    upcomingEvents.slice(0, 6);


  let eventsHTML = "";

  if (!visibleEvents.length) {

    eventsHTML =
      `
        <p style="
          margin:0;
          padding:14px;
          color:#6b7280;
        ">
          No scheduled cash-flow events in the next 90 days.
        </p>
      `;

  } else {

    visibleEvents.forEach(function(event) {

      const amountClass =
        event.amount >= 0
          ? "income"
          : "expense";

      const amountText =
        (event.amount >= 0 ? "+" : "") +
        money(event.amount);

      eventsHTML += `
        <div
          style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:15px;
            padding:11px 14px;
            border-bottom:1px solid #e5e7eb;
          "
        >

          <div style="min-width:0;">

            <strong
              style="
                display:block;
                overflow:hidden;
                text-overflow:ellipsis;
                white-space:nowrap;
              "
            >
              ${escapeHTML(event.description)}
            </strong>

            <small
              style="
                display:block;
                color:#6b7280;
                margin-top:3px;
              "
            >
              ${escapeHTML(event.date)}
            </small>

          </div>

          <strong
            class="${amountClass}"
            style="
              flex-shrink:0;
              white-space:nowrap;
            "
          >
            ${amountText}
          </strong>

        </div>
      `;

    });

  }


  // ===================================================
  // OUTPUT
  // ===================================================

  container.innerHTML = `

    <style>

      .forecast-summary {
        display:grid;
        grid-template-columns:
          repeat(4, minmax(130px, 1fr));
        gap:12px;
        margin-bottom:20px;
      }

      .forecast-card {
        box-sizing:border-box;
        padding:14px;
        border-radius:10px;
        min-width:0;
      }

      .forecast-card small {
        display:block;
        color:#4b5563;
      }

      .forecast-card strong {
        display:block;
        margin-top:5px;
        font-size:1.3rem;
      }

      .forecast-chart {
        width:100%;
        overflow:hidden;
        border:1px solid #e5e7eb;
        border-radius:12px;
        background:#fafafa;
      }

      .forecast-chart svg {
        display:block;
        width:100%;
        height:auto;
      }

      .forecast-legend {
        display:flex;
        flex-wrap:wrap;
        gap:16px;
        margin:10px 2px 22px;
        font-size:.85rem;
        color:#4b5563;
      }

      .forecast-event-list {
        border:1px solid #e5e7eb;
        border-radius:10px;
        overflow:hidden;
        background:#fff;
      }


      /* TABLET */

      @media (max-width:700px) {

        .forecast-summary {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }

      }


      /* PHONE */

      @media (max-width:430px) {

        .forecast-summary {
          grid-template-columns:1fr 1fr;
          gap:8px;
        }

        .forecast-card {
          padding:11px;
        }

        .forecast-card strong {
          font-size:1.05rem;
        }

        .forecast-chart svg {
          min-height:190px;
        }

        .forecast-legend {
          gap:10px;
          font-size:.78rem;
        }

      }

    </style>


    <!-- =========================================
         FOUR SUMMARY CARDS
         ========================================= -->

    <div class="forecast-summary">

      <div
        class="forecast-card"
        style="
          background:#eff6ff;
          border:1px solid #bfdbfe;
        "
      >
        <small>Today</small>

        <strong style="color:#2563eb;">
          ${money(todayData.balance)}
        </strong>
      </div>


      <div
        class="forecast-card"
        style="
          background:#f0fdf4;
          border:1px solid #bbf7d0;
        "
      >
        <small>30 Days</small>

        <strong style="color:#16a34a;">
          ${money(day30.balance)}
        </strong>
      </div>


      <div
        class="forecast-card"
        style="
          background:#fff7ed;
          border:1px solid #fed7aa;
        "
      >
        <small>60 Days</small>

        <strong style="color:#ea580c;">
          ${money(day60.balance)}
        </strong>
      </div>


      <div
        class="forecast-card"
        style="
          background:#f5f3ff;
          border:1px solid #ddd6fe;
        "
      >
        <small>90 Days</small>

        <strong style="color:#7c3aed;">
          ${money(day90.balance)}
        </strong>
      </div>

    </div>


    <!-- =========================================
         LOWEST BALANCE
         ========================================= -->

    <div
      style="
        margin-bottom:12px;
      "
    >

      <small
        style="
          font-weight:700;
          letter-spacing:.04em;
        "
      >
        LOWEST PROJECTED BALANCE
      </small>

      <strong
        style="
          display:block;
          margin-top:3px;
          font-size:1.5rem;
          color:${minimum.balance <= 0 ? "#dc2626" : "#ea580c"};
        "
      >
        ${money(minimum.balance)}
      </strong>

      <small>
        Expected on ${escapeHTML(minimum.date)}
      </small>

    </div>


    <!-- =========================================
         GRAPH
         ========================================= -->

    <div class="forecast-chart">

      <svg
        viewBox="0 0 ${width} ${height}"
        preserveAspectRatio="xMidYMid meet"
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


        <!-- TODAY -->

        <circle
          cx="${chartX(0)}"
          cy="${chartY(todayData.balance)}"
          r="6"
          fill="#2563eb"
        />


        <!-- MINIMUM -->

        <circle
          cx="${minimumX}"
          cy="${minimumY}"
          r="8"
          fill="#dc2626"
          stroke="#ffffff"
          stroke-width="3"
        />


        <text
          x="${minimumX}"
          y="${minimumY - 16}"
          text-anchor="middle"
          font-size="12"
          font-weight="bold"
          fill="#dc2626"
        >
          ${money(minimum.balance)}
        </text>


        <!-- DATES -->

        <text
          x="${left}"
          y="${height - 12}"
          font-size="12"
          fill="#6b7280"
        >
          Today
        </text>


        <text
          x="${chartX(29)}"
          y="${height - 12}"
          text-anchor="middle"
          font-size="12"
          fill="#6b7280"
        >
          30d
        </text>


        <text
          x="${chartX(59)}"
          y="${height - 12}"
          text-anchor="middle"
          font-size="12"
          fill="#6b7280"
        >
          60d
        </text>


        <text
          x="${width - right}"
          y="${height - 12}"
          text-anchor="end"
          font-size="12"
          fill="#6b7280"
        >
          90d
        </text>

      </svg>

    </div>


    <!-- =========================================
         LEGEND
         ========================================= -->

    <div class="forecast-legend">

      <span>
        <span
          style="
            display:inline-block;
            width:18px;
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
            width:18px;
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
            width:18px;
            height:4px;
            background:#dc2626;
            vertical-align:middle;
            margin-right:5px;
          "
        ></span>
        Zero balance
      </span>

    </div>


    <!-- =========================================
         EVENTS
         ========================================= -->

    <div>

      <h3
        style="
          margin:0 0 8px;
        "
      >
        Upcoming Cash-Flow Events
      </h3>

      <div class="forecast-event-list">
        ${eventsHTML}
      </div>

    </div>

  `;

}
```



  // ===================================================
  // RENDER FORECAST
  // ===================================================

  container.innerHTML = `

    <!-- SUMMARY -->

    <div
      style="
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:12px;
        margin-bottom:18px;
      "
    >

      <div
        style="
          background:#eff6ff;
          border:1px solid #bfdbfe;
          border-radius:10px;
          padding:14px;
        "
      >
        <small>Today</small>

        <strong
          style="
            display:block;
            margin-top:5px;
            font-size:1.3rem;
            color:#2563eb;
          "
        >
          ${money(todayData.balance)}
        </strong>
      </div>


      <div
        style="
          background:#f0fdf4;
          border:1px solid #bbf7d0;
          border-radius:10px;
          padding:14px;
        "
      >
        <small>30 Days</small>

        <strong
          style="
            display:block;
            margin-top:5px;
            font-size:1.3rem;
            color:#16a34a;
          "
        >
          ${money(day30.balance)}
        </strong>
      </div>


      <div
        style="
          background:#fff7ed;
          border:1px solid #fed7aa;
          border-radius:10px;
          padding:14px;
        "
      >
        <small>60 Days</small>

        <strong
          style="
            display:block;
            margin-top:5px;
            font-size:1.3rem;
            color:#ea580c;
          "
        >
          ${money(day60.balance)}
        </strong>
      </div>


      <div
        style="
          background:#f5f3ff;
          border:1px solid #ddd6fe;
          border-radius:10px;
          padding:14px;
        "
      >
        <small>90 Days</small>

        <strong
          style="
            display:block;
            margin-top:5px;
            font-size:1.3rem;
            color:#7c3aed;
          "
        >
          ${money(day90.balance)}
        </strong>
      </div>

    </div>


    <!-- LOWEST BALANCE -->

    <div
      style="
        display:flex;
        justify-content:space-between;
        align-items:end;
        margin-bottom:10px;
        gap:20px;
      "
    >

      <div>

        <small
          style="
            font-weight:700;
            letter-spacing:.04em;
          "
        >
          LOWEST PROJECTED BALANCE
        </small>

        <strong
          style="
            display:block;
            font-size:1.5rem;
            margin-top:3px;
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
          ${escapeHTML(minimum.date)}
        </small>

      </div>

    </div>


    <!-- CHART -->

    <div
      style="
        width:100%;
        border:1px solid #e5e7eb;
        border-radius:12px;
        background:#ffffff;
        overflow:hidden;
      "
    >

      <svg
        viewBox="0 0 ${width} ${height}"
        width="100%"
        height="280"
        preserveAspectRatio="none"
      >

        <!-- chart background -->

        <rect
          x="0"
          y="0"
          width="${width}"
          height="${height}"
          fill="#fafafa"
        />


        <!-- grid lines -->

        <line
          x1="${left}"
          y1="${top}"
          x2="${left}"
          y2="${height - bottom}"
          stroke="#d1d5db"
        />

        <line
          x1="${left}"
          y1="${height - bottom}"
          x2="${width - right}"
          y2="${height - bottom}"
          stroke="#d1d5db"
        />


        ${zeroLine}

        ${bufferLine}


        <!-- balance line -->

        <polyline
          points="${points}"
          fill="none"
          stroke="#2563eb"
          stroke-width="4"
          stroke-linejoin="round"
          stroke-linecap="round"
        />


        <!-- starting point -->

        <circle
          cx="${x(0)}"
          cy="${y(todayData.balance)}"
          r="5"
          fill="#2563eb"
        />


        <!-- minimum point -->

        <circle
          cx="${minimumX}"
          cy="${minimumY}"
          r="8"
          fill="#dc2626"
          stroke="#ffffff"
          stroke-width="3"
        />


        <text
          x="${minimumX}"
          y="${minimumY - 16}"
          text-anchor="middle"
          font-size="12"
          font-weight="bold"
          fill="#dc2626"
        >
          ${money(minimum.balance)}
        </text>


        <!-- date labels -->

        <text
          x="${left}"
          y="${height - 12}"
          font-size="12"
          fill="#6b7280"
        >
          ${escapeHTML(result.startDate)}
        </text>


        <text
          x="${x(29)}"
          y="${height - 12}"
          text-anchor="middle"
          font-size="12"
          fill="#6b7280"
        >
          30d
        </text>


        <text
          x="${x(59)}"
          y="${height - 12}"
          text-anchor="middle"
          font-size="12"
          fill="#6b7280"
        >
          60d
        </text>


        <text
          x="${width - right}"
          y="${height - 12}"
          text-anchor="end"
          font-size="12"
          fill="#6b7280"
        >
          90d
        </text>

      </svg>

    </div>


    <!-- LEGEND -->

    <div
      style="
        display:flex;
        flex-wrap:wrap;
        gap:18px;
        margin:10px 2px 22px;
        font-size:.85rem;
        color:#4b5563;
      "
    >

      <span>
        <span
          style="
            display:inline-block;
            width:18px;
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
            width:18px;
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
            width:18px;
            height:4px;
            background:#dc2626;
            vertical-align:middle;
            margin-right:5px;
          "
        ></span>
        Zero balance
      </span>

    </div>


    <!-- EVENTS -->

    <div>

      <h3
        style="
          margin:0 0 8px;
        "
      >
        Upcoming Cash-Flow Events
      </h3>

      <div
        style="
          border:1px solid #e5e7eb;
          border-radius:10px;
          overflow:hidden;
          background:#ffffff;
        "
      >
        ${eventsHTML}
      </div>

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
