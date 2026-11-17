/**
 * Dhan — optional Google Sheets bridge.
 *
 * This is a small Apps Script web app that you own. It receives a push from
 * Dhan, stores an exact copy of your khata in a hidden sheet, and rebuilds a
 * readable spreadsheet alongside it. Nothing is sent to Dhan's author.
 *
 * SETUP
 * 1. Replace PASTE_YOUR_TOKEN_HERE with the same token you use in Dhan.
 *    (The "Copy starter script" button in Dhan does this for you.)
 * 2. Deploy → New deployment → Web app.
 *    Execute as: Me. Who has access: Anyone.
 * 3. Paste the /exec URL and the token into Dhan → Settings → Google Sheets.
 *
 * The spreadsheet named "Dhan — Money Tracker" is created on the first push
 * and its ID is remembered in this project's script properties. This script
 * never reads or writes a spreadsheet ID supplied by a request.
 */

const TOKEN = "PASTE_YOUR_TOKEN_HERE";
const SPREADSHEET_NAME = "Dhan — Money Tracker";
const STATE_SHEET = "_state";
const CHUNK_SIZE = 40000;
const MAX_STATE_CHARS = 4000000;

function doGet() {
  return jsonResponse({
    ok: true,
    message: "Dhan bridge is live. Open Dhan → Settings → Google Sheets and use Test."
  });
}

function doPost(e) {
  try {
    const body = parseBody(e);
    verifyToken(body && body.token);
    const action = String((body && body.action) || "").trim();
    if (action === "ping") {
      return jsonResponse({
        ok: true,
        message: "Dhan bridge is live. Token accepted."
      });
    }
    if (action === "push") {
      const payload = body.payload;
      validateState(payload);
      scrubSettings(payload);

      const lock = LockService.getScriptLock();
      if (!lock.tryLock(30000)) {
        return jsonResponse({ ok: false, error: "The sheet is busy with another sync. Try again in a moment." });
      }
      try {
        const ss = getSpreadsheet();
        const syncedAt = new Date().toISOString();
        writeState(ss, payload, syncedAt);
        writeReadableCopy(ss, payload, syncedAt);
        SpreadsheetApp.flush();
        return jsonResponse({
          ok: true,
          syncedAt: syncedAt,
          spreadsheetUrl: ss.getUrl(),
          message: "Pushed to Google Sheets."
        });
      } finally {
        lock.releaseLock();
      }
    }
    if (action === "pull") {
      const lock = LockService.getScriptLock();
      if (!lock.tryLock(30000)) {
        return jsonResponse({ ok: false, error: "The sheet is busy with another sync. Try again in a moment." });
      }
      try {
        const ss = getSpreadsheet();
        const saved = readState(ss);
        return jsonResponse({
          ok: true,
          state: saved.state,
          syncedAt: saved.syncedAt,
          spreadsheetUrl: ss.getUrl()
        });
      } finally {
        lock.releaseLock();
      }
    }
    return jsonResponse({ ok: false, error: "Unknown action. Use ping, push or pull." });
  } catch (err) {
    return jsonResponse({ ok: false, error: friendlyError(err) });
  }
}

/* ------------------------------------------------------------------ */
/* Request helpers                                                     */
/* ------------------------------------------------------------------ */

function parseBody(e) {
  const raw = e && e.postData && e.postData.contents;
  if (!raw) throw new Error("The request was empty.");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error("The request body was not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("The request body was not a Dhan sync request.");
  }
  return parsed;
}

function verifyToken(token) {
  if (!TOKEN || TOKEN === "PASTE_YOUR_TOKEN_HERE") {
    throw new Error("Set TOKEN inside Code.gs before deploying. Use the copy button in Dhan Settings to generate a ready script.");
  }
  if (TOKEN.length < 8) {
    throw new Error("TOKEN inside Code.gs is too short. Use at least 8 characters.");
  }
  if (String(token || "") !== TOKEN) {
    throw new Error("That sync token does not match the TOKEN inside Code.gs.");
  }
}

function validateState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("The pushed khata is missing or not an object.");
  }
  const arrays = ["transactions", "accounts", "categories", "budgets", "goals", "contributions", "deductions"];
  for (let i = 0; i < arrays.length; i++) {
    if (!Array.isArray(state[arrays[i]])) {
      throw new Error("The pushed khata is missing its " + arrays[i] + " list.");
    }
  }
  if (!state.settings || typeof state.settings !== "object") {
    throw new Error("The pushed khata is missing its settings.");
  }
  if (!state.taxSettings || typeof state.taxSettings !== "object") state.taxSettings = {};
}

function scrubSettings(state) {
  state.settings.googleSheetUrl = "";
  state.settings.googleSheetToken = "";
  state.settings.lastSyncAt = null;
}

function friendlyError(err) {
  const message = err && err.message ? String(err.message) : "The bridge hit an unexpected error.";
  return message.slice(0, 500);
}

function jsonResponse(object) {
  return ContentService
    .createTextOutput(JSON.stringify(object))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------------------------------------------ */
/* Spreadsheet lifecycle                                               */
/* ------------------------------------------------------------------ */

function getSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("DHAN_SHEET_ID");
  if (id) {
    try {
      const file = DriveApp.getFileById(id);
      if (!file.isTrashed()) return SpreadsheetApp.openById(id);
    } catch (err) {
      /* The old spreadsheet was deleted or moved out of reach: make a new one. */
    }
  }
  const ss = SpreadsheetApp.create(SPREADSHEET_NAME);
  const first = ss.getSheets()[0];
  if (first && first.getName() === "Sheet1") first.setName("Summary");
  props.setProperty("DHAN_SHEET_ID", ss.getId());
  return ss;
}

function sheetFor(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

/* ------------------------------------------------------------------ */
/* Exact state: hidden _state sheet, split across cells                */
/* ------------------------------------------------------------------ */

function writeState(ss, state, syncedAt) {
  const raw = JSON.stringify(state);
  if (raw.length > MAX_STATE_CHARS) {
    throw new Error("This khata is too large for the Sheet bridge (over " + Math.round(MAX_STATE_CHARS / 1000000) + " MB of JSON). Use a JSON backup instead.");
  }
  const count = Math.max(1, Math.ceil(raw.length / CHUNK_SIZE));
  const chunks = [];
  for (let i = 0; i < count; i++) {
    chunks.push([raw.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)]);
  }
  const hash = sha256(raw);
  const sheet = sheetFor(ss, STATE_SHEET);
  sheet.clearContents();
  sheet.getRange(1, 1, 5, 2).setValues([
    ["DHAN_STATE_V1", 1],
    ["Pushed at", syncedAt],
    ["Length", raw.length],
    ["SHA-256", hash],
    ["Chunks", count]
  ]);
  sheet.getRange(7, 1, chunks.length, 1).setValues(chunks);
  sheet.hideSheet();
}

function readState(ss) {
  const sheet = ss.getSheetByName(STATE_SHEET);
  if (!sheet) throw new Error("No saved khata exists in this spreadsheet yet. Push from Dhan first.");
  const meta = sheet.getRange(1, 1, 5, 2).getValues();
  if (String(meta[0][0]) !== "DHAN_STATE_V1") {
    throw new Error("The hidden state block is not in the expected format.");
  }
  const syncedAt = String(meta[1][1]);
  const length = Number(meta[2][1]);
  const expectedHash = String(meta[3][1]);
  const count = Number(meta[4][1]);
  if (!count || count < 1) throw new Error("The hidden state block is empty.");
  const values = sheet.getRange(7, 1, count, 1).getValues();
  const raw = values.map(function (row) { return String(row[0]); }).join("");
  if (raw.length !== length) {
    throw new Error("The saved khata is incomplete. Push again from Dhan to repair it.");
  }
  if (sha256(raw) !== expectedHash) {
    throw new Error("The saved khata did not pass its checksum. Push again from Dhan.");
  }
  let state;
  try {
    state = JSON.parse(raw);
  } catch (err) {
    throw new Error("The saved khata could not be read. Push again from Dhan.");
  }
  return { state: state, syncedAt: syncedAt };
}

function sha256(value) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8);
  return bytes.map(function (b) {
    const n = (b < 0 ? b + 256 : b).toString(16);
    return n.length === 1 ? "0" + n : n;
  }).join("");
}

/* ------------------------------------------------------------------ */
/* Readable copy                                                       */
/* ------------------------------------------------------------------ */

function writeReadableCopy(ss, state, syncedAt) {
  const accounts = listById(state.accounts);
  const categories = listById(state.categories);
  const goals = listById(state.goals);
  const txs = state.transactions.slice().sort(function (a, b) {
    return String(b.date + " " + (b.createdAt || "")).localeCompare(String(a.date + " " + (a.createdAt || "")));
  });

  writeSummary(ss, state, syncedAt);

  writeTable(ss, "Transactions",
    ["Date", "Type", "Category", "Account", "To account", "Amount (INR)", "Note", "FY", "Entry ID"],
    txs.map(function (t) {
      const transfer = t.type === "transfer";
      const cat = categories[t.categoryId];
      return [
        t.date,
        transfer ? "Transfer" : t.type === "income" ? "Income" : "Expense",
        transfer ? "Transfer" : cat ? cat.name : "Uncategorised",
        accounts[t.accountId] ? accounts[t.accountId].name : "Unknown account",
        transfer && accounts[t.toAccountId] ? accounts[t.toAccountId].name : "",
        rupees(t.amountPaise),
        t.note || "",
        fyOf(t.date),
        t.id
      ];
    }),
    [100, 100, 160, 160, 160, 120, 260, 80, 150]
  );

  writeTable(ss, "Accounts",
    ["Account", "Type", "Institution", "Last 4", "Opening balance (INR)", "Current balance (INR)", "Archived", "ID"],
    state.accounts.map(function (a) {
      return [
        a.name,
        accountTypeLabel(a.type),
        a.institution || "",
        a.last4 || "",
        rupees(a.openingPaise),
        rupees(accountBalance(state, a.id)),
        a.archived ? "Yes" : "No",
        a.id
      ];
    }),
    [180, 120, 160, 70, 150, 150, 90, 160]
  );

  const goalSaved = {};
  state.contributions.forEach(function (c) {
    goalSaved[c.goalId] = (goalSaved[c.goalId] || 0) + Number(c.amountPaise || 0);
  });
  writeTable(ss, "Goals",
    ["Goal", "Target (INR)", "Target date", "Saved (INR)", "Remaining (INR)", "Progress %", "Monthly needed (INR)", "Note", "Archived"],
    state.goals.map(function (g) {
      const saved = goalSaved[g.id] || 0;
      const target = Number(g.targetPaise || 0);
      const months = Math.max(0, monthsUntil(g.targetDate));
      return [
        g.name,
        rupees(target),
        g.targetDate,
        rupees(saved),
        rupees(Math.max(0, target - saved)),
        target > 0 ? Math.round((saved / target) * 1000) / 10 : 0,
        months > 0 ? rupees(Math.max(0, target - saved) / months) : 0,
        g.note || "",
        g.archived ? "Yes" : "No"
      ];
    }),
    [180, 140, 100, 130, 140, 90, 160, 260, 90]
  );

  const budgetSpend = {};
  state.transactions.forEach(function (t) {
    if (t.type !== "expense") return;
    const key = String(t.date).slice(0, 7) + "|" + t.categoryId;
    budgetSpend[key] = (budgetSpend[key] || 0) + Number(t.amountPaise || 0);
  });
  writeTable(ss, "Budgets",
    ["Month", "Category", "Limit (INR)", "Spent (INR)", "Left (INR)", "Over budget"],
    state.budgets.slice().sort(function (a, b) {
      return String(b.month + (categories[b.categoryId] ? categories[b.categoryId].name : "")).localeCompare(String(a.month + (categories[a.categoryId] ? categories[a.categoryId].name : "")));
    }).map(function (b) {
      const spent = budgetSpend[b.month + "|" + b.categoryId] || 0;
      return [
        b.month,
        categories[b.categoryId] ? categories[b.categoryId].name : "Category",
        rupees(b.amountPaise),
        rupees(spent),
        rupees(Number(b.amountPaise || 0) - spent),
        spent > Number(b.amountPaise || 0) ? "Yes" : "No"
      ];
    }),
    [90, 180, 120, 120, 120, 100]
  );

  const usage = {};
  state.transactions.forEach(function (t) {
    if (t.categoryId) usage[t.categoryId] = (usage[t.categoryId] || 0) + 1;
  });
  writeTable(ss, "Categories",
    ["Category", "Type", "ITR head", "Entries", "Archived", "ID"],
    state.categories.map(function (c) {
      return [
        c.name,
        c.type === "income" ? "Income" : "Expense",
        c.type === "income" ? bucketLabel(c.bucket) : "",
        usage[c.id] || 0,
        c.archived ? "Yes" : "No",
        c.id
      ];
    }),
    [180, 100, 200, 80, 90, 150]
  );

  writeTable(ss, "Deductions",
    ["Financial year", "Section", "Label", "Amount (INR)"],
    state.deductions.slice().sort(function (a, b) {
      return String(b.fy + b.section).localeCompare(String(a.fy + a.section));
    }).map(function (d) {
      return [d.fy, d.section, d.label || "", rupees(d.amountPaise)];
    }),
    [120, 120, 220, 130]
  );

  writeTable(ss, "Contributions",
    ["Date", "Goal", "Amount (INR)", "From account", "Note"],
    state.contributions.slice().sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date));
    }).map(function (c) {
      return [
        c.date,
        goals[c.goalId] ? goals[c.goalId].name : "Unknown goal",
        rupees(c.amountPaise),
        c.accountId && accounts[c.accountId] ? accounts[c.accountId].name : "",
        c.note || ""
      ];
    }),
    [100, 180, 130, 180, 260]
  );

  const taxRows = Object.keys(state.taxSettings).sort().reverse().map(function (fy) {
    const t = state.taxSettings[fy] || {};
    return [
      fy,
      t.regime === "old" ? "Old regime" : "New regime",
      rupees(t.tdsPaise),
      rupees(t.advancePaise)
    ];
  });
  writeTable(ss, "Tax settings",
    ["Financial year", "Regime", "TDS (INR)", "Advance tax (INR)"],
    taxRows,
    [120, 120, 120, 150]
  );

  const stateSheet = ss.getSheetByName(STATE_SHEET);
  if (stateSheet) stateSheet.hideSheet();
}

function writeSummary(ss, state, syncedAt) {
  const sheet = sheetFor(ss, "Summary");
  sheet.clearContents();
  const activeAccounts = state.accounts.filter(function (a) { return !a.archived; });
  const netWorth = activeAccounts.reduce(function (total, a) {
    return total + accountBalance(state, a.id);
  }, 0);
  let income = 0;
  let expense = 0;
  state.transactions.forEach(function (t) {
    if (t.type === "income") income += Number(t.amountPaise || 0);
    else if (t.type === "expense") expense += Number(t.amountPaise || 0);
  });
  const goalTarget = state.goals.filter(function (g) { return !g.archived; }).reduce(function (total, g) {
    return total + Number(g.targetPaise || 0);
  }, 0);
  const goalSaved = state.contributions.reduce(function (total, c) {
    return total + Number(c.amountPaise || 0);
  }, 0);

  const rows = [
    ["Dhan — money tracker", ""],
    ["A readable copy, generated by Dhan", ""],
    ["Last pushed", syncedAt],
    ["Name", state.settings.name || "—"],
    ["Entries", state.transactions.length],
    ["Accounts", state.accounts.length],
    ["Active accounts", activeAccounts.length],
    ["Net worth (INR)", rupees(netWorth)],
    ["Income, all time (INR)", rupees(income)],
    ["Expenses, all time (INR)", rupees(expense)],
    ["Goals target (INR)", rupees(goalTarget)],
    ["Goals set aside (INR)", rupees(goalSaved)],
    ["Currency", "INR"],
    ["How to restore", "Open Dhan → Settings → Google Sheets → Pull from Sheet."],
    ["Important", "Edit this readable copy for reference only. Dhan restores from the hidden _state sheet, not from these tabs."]
  ].map(function (row) { return row.map(safeCell); });
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  sheet.getRange("A1:B2").setFontColor("#F5F0E4").setBackground("#12352A");
  sheet.getRange("A1").setFontSize(16).setFontWeight("bold");
  sheet.getRange("A2").setFontStyle("italic");
  sheet.getRange("A4:A15").setFontWeight("bold");
  sheet.setColumnWidth(1, 210);
  sheet.setColumnWidth(2, 360);
  sheet.getRange("B8:B12").setNumberFormat("#,##0.00");
  sheet.setFrozenRows(2);
  sheet.setTabColor("#12352A");
}

function writeTable(ss, name, headers, rows, widths) {
  const sheet = sheetFor(ss, name);
  sheet.clearContents();
  const header = headers.map(safeCell);
  sheet.getRange(1, 1, 1, header.length).setValues([header]);
  sheet.getRange(1, 1, 1, header.length)
    .setFontWeight("bold")
    .setFontColor("#F5F0E4")
    .setBackground("#12352A");
  if (rows.length) {
    const safeRows = rows.map(function (row) { return row.map(safeCell); });
    sheet.getRange(2, 1, safeRows.length, header.length).setValues(safeRows);
  }
  sheet.setFrozenRows(1);
  if (widths && widths.length) {
    for (let i = 0; i < widths.length; i++) sheet.setColumnWidth(i + 1, widths[i]);
  } else {
    sheet.autoResizeColumns(1, header.length);
  }
  sheet.setTabColor("#E9B949");
}

/* ------------------------------------------------------------------ */
/* Small derivations and formatting                                    */
/* ------------------------------------------------------------------ */

function listById(list) {
  const map = {};
  (list || []).forEach(function (item) {
    if (item && item.id) map[item.id] = item;
  });
  return map;
}

function rupees(paise) {
  return Math.round(Number(paise || 0)) / 100;
}

function accountBalance(state, accountId) {
  let balance = 0;
  const account = listById(state.accounts)[accountId];
  if (account) balance = Number(account.openingPaise || 0);
  state.transactions.forEach(function (t) {
    if (t.accountId === accountId) {
      if (t.type === "income") balance += Number(t.amountPaise || 0);
      else balance -= Number(t.amountPaise || 0);
    }
    if (t.type === "transfer" && t.toAccountId === accountId) {
      balance += Number(t.amountPaise || 0);
    }
  });
  return balance;
}

function accountTypeLabel(type) {
  const labels = {
    bank: "Bank account",
    cash: "Cash",
    wallet: "Wallet / UPI",
    investment: "Investment",
    credit: "Credit card",
    loan: "Loan"
  };
  return labels[type] || type || "Account";
}

function bucketLabel(bucket) {
  const labels = {
    salary: "Salary / pension",
    business: "Business / freelance",
    savings_interest: "Savings bank interest",
    other_interest: "FD / other interest",
    other: "Other taxable income",
    exempt: "Exempt / non-taxable"
  };
  return labels[bucket] || "Other taxable income";
}

function fyOf(dateString) {
  const parts = String(dateString || "").slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || !parts[0]) return "";
  const year = parts[1] >= 4 ? parts[0] : parts[0] - 1;
  return year + "-" + String((year + 1) % 100).padStart(2, "0");
}

function monthsUntil(dateString) {
  const parts = String(dateString || "").slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || !parts[0]) return 0;
  const target = new Date(parts[0], parts[1] - 1, parts[2], 12);
  const now = new Date();
  const diff = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
  if (diff < 0) return 0;
  return diff + (target.getDate() >= now.getDate() ? 1 : 0);
}

function safeCell(value) {
  if (typeof value === "string" && /^[=+\-@]/.test(value)) {
    return "'" + value;
  }
  return value;
}
