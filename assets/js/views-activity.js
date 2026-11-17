/* Dhan — activity: search, filter and edit every entry. */
(function (root) {
  "use strict";
  const Dhan = root.Dhan = root.Dhan || {};
  const ui = Dhan.ui;
  const money = Dhan.money;
  const date = Dhan.date;

  const view = {
    q: "",
    quick: "all",
    fy: date.fyOf(date.todayISO()),
    month: "all",
    category: "all",
    account: "all",
    from: "",
    to: "",
    advanced: false,
    limit: 50
  };
  let bound = false;

  function activeFilterCount() {
    let n = 0;
    if (view.category !== "all") n++;
    if (view.account !== "all") n++;
    if (view.from) n++;
    if (view.to) n++;
    return n;
  }

  function filtered(state) {
    let list = state.transactions.slice();
    if (view.from || view.to) {
      const from = view.from || "0000-01-01";
      const to = view.to || "9999-12-31";
      list = list.filter((t) => t.date >= from && t.date <= to);
    } else {
      const range = Dhan.date.fyRange(view.fy);
      list = list.filter((t) => t.date >= range.start && t.date <= range.end);
      if (view.month !== "all") list = list.filter((t) => t.date.slice(0, 7) === view.month);
    }
    if (view.quick !== "all") list = list.filter((t) => t.type === view.quick);
    if (view.account !== "all") {
      list = list.filter((t) => t.accountId === view.account || (t.type === "transfer" && t.toAccountId === view.account));
    }
    if (view.category !== "all") list = list.filter((t) => t.categoryId === view.category);
    const q = view.q.trim().toLowerCase();
    if (q) {
      list = list.filter((t) => {
        const cat = Dhan.categoryById(state, t.categoryId);
        const hay = [
          t.note || "",
          cat ? cat.name : "uncategorised",
          Dhan.accountName(state, t.accountId),
          t.type === "transfer" ? Dhan.accountName(state, t.toAccountId) : "",
          t.date,
          date.fmtDate(t.date),
          money.plain(t.amountPaise),
          money.fmt(t.amountPaise)
        ].join(" ").toLowerCase();
        return hay.includes(q);
      });
    }
    return Dhan.sortBy(list, (t) => t.date + " " + (t.createdAt || ""), "desc");
  }

  function summary(txs) {
    const income = Dhan.sum(txs.filter((t) => t.type === "income"), (t) => t.amountPaise);
    const expense = Dhan.sum(txs.filter((t) => t.type === "expense"), (t) => t.amountPaise);
    const transfers = txs.filter((t) => t.type === "transfer").length;
    const net = income - expense;
    const incomeCount = txs.filter((t) => t.type === "income").length;
    const expenseCount = txs.filter((t) => t.type === "expense").length;
    return '<div class="activity-summary" id="activity-summary">' +
      '<div class="metric"><div class="metric-label">MONEY IN</div><div class="metric-value positive">+' + esc(money.fmt(income)) + "</div><div class=\"metric-note\">" + incomeCount + " " + ui.plural(incomeCount, "entry", "entries") + "</div></div>" +
      '<div class="metric"><div class="metric-label">MONEY OUT</div><div class="metric-value negative">−' + esc(money.fmt(expense)) + "</div><div class=\"metric-note\">" + expenseCount + " " + ui.plural(expenseCount, "entry", "entries") + "</div></div>" +
      '<div class="metric"><div class="metric-label">NET</div><div class="metric-value ' + (net < 0 ? "negative" : "positive") + '">' + (net < 0 ? "−" : "+") + esc(money.fmt(Math.abs(net))) + "</div><div class=\"metric-note\">" + (income > 0 ? Math.round(Dhan.pct(net, income)) + "% of income kept" : "No income in this view") + "</div></div>" +
      '<div class="metric"><div class="metric-label">ENTRIES</div><div class="metric-value">' + txs.length + "</div><div class=\"metric-note\">" + (transfers ? transfers + " " + ui.plural(transfers, "transfer") : "No transfers") + "</div></div>" +
    "</div>";
  }

  function results(state, txs) {
    const shown = txs.slice(0, view.limit);
    const left = txs.length - shown.length;
    const hasFilters = view.q || view.quick !== "all" || view.category !== "all" || view.account !== "all" || view.from || view.to || view.month !== "all";
    let body;
    if (!state.transactions.length) {
      body = ui.empty({
        icon: "receipt",
        title: "No entries yet",
        message: "Your first entry can be a salary, a chai, or a transfer between accounts.",
        actions: [{ label: "Add first entry", action: "add-tx", variant: "btn-primary", icon: "plus" }]
      });
    } else if (!txs.length) {
      body = ui.empty({
        icon: "search",
        title: "Nothing matches those filters",
        message: "Try a wider date range or clear a filter or two.",
        actions: [
          { label: "Clear filters", variant: "btn-primary", attrs: 'data-activity-action="reset"' },
          { label: "Add entry", action: "add-tx", icon: "plus" }
        ]
      });
    } else {
      body = '<div class="tx-list activity-list">' + ui.txGroups(state, shown) + "</div>" +
        (left > 0 ? '<div class="load-more"><button type="button" class="btn btn-secondary" data-activity-action="load-more">Show ' + Math.min(50, left) + " more · " + left + " left</button></div>" : "");
    }
    return '<div class="activity-toolbar"><span class="result-meta">' +
        (txs.length ? "Showing " + shown.length + " of " + txs.length + " " + ui.plural(txs.length, "entry", "entries") : "No entries to show") +
        (hasFilters ? " · filtered" : "") +
      "</span>" +
      '<div class="row gap-2"><button type="button" class="btn btn-secondary btn-sm" data-activity-action="export">' + ui.icon("download") + "Export this view</button>" +
      '<button type="button" class="btn btn-primary btn-sm" data-action="add-tx">' + ui.icon("plus") + "Add entry</button></div></div>" +
      '<section class="panel activity-panel">' + body + "</section>";
  }

  function advancedPanel(state) {
    if (!view.advanced) return "";
    const accounts = state.accounts.slice();
    const catOptions = ui.categoryOptions(state, view.category, { allowAll: true, allowArchived: true });
    const accountOptions = '<option value="all">All accounts</option>' + accounts.map((a) =>
      '<option value="' + esc(a.id) + '"' + (a.id === view.account ? " selected" : "") + ">" + esc(a.name) + (a.archived ? " (archived)" : "") + "</option>"
    ).join("");
    return '<div class="filter-panel">' +
      '<div class="filter-panel-grid">' +
        '<div class="field"><label class="field-label" for="filter-category">Category</label><div class="select-wrap"><select class="input" id="filter-category" data-activity-filter="category">' + catOptions + "</select>" + ui.icon("chevron-down") + "</div></div>" +
        '<div class="field"><label class="field-label" for="filter-account">Account</label><div class="select-wrap"><select class="input" id="filter-account" data-activity-filter="account">' + accountOptions + "</select>" + ui.icon("chevron-down") + "</div></div>" +
        '<div class="field"><label class="field-label" for="filter-from">From</label><input class="input" id="filter-from" type="date" data-activity-filter="from" value="' + esc(view.from) + '"></div>' +
        '<div class="field"><label class="field-label" for="filter-to">To</label><input class="input" id="filter-to" type="date" data-activity-filter="to" value="' + esc(view.to) + '"></div>' +
      "</div>" +
      '<div class="filter-panel-foot"><span class="field-hint">Custom dates replace the FY and month filters. Transfers match either account.</span>' +
        '<div class="row gap-2"><button type="button" class="btn btn-ghost btn-sm" data-activity-action="reset">Clear all</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-activity-action="toggle-advanced">Done</button></div></div>' +
    "</div>";
  }

  function chips(state) {
    const types = [
      { id: "all", label: "Everything" },
      { id: "expense", label: "Money out" },
      { id: "income", label: "Money in" },
      { id: "transfer", label: "Transfers" }
    ];
    const activeChips = [];
    if (view.category !== "all") activeChips.push({ key: "category", label: Dhan.categoryName(state, view.category) });
    if (view.account !== "all") activeChips.push({ key: "account", label: Dhan.accountName(state, view.account) });
    if (view.from || view.to) activeChips.push({ key: "dates", label: (view.from || "start") + " → " + (view.to || "today") });
    return '<div class="chip-row" style="width:100%;margin-top:2px">' +
      types.map((t) => '<button type="button" class="chip' + (view.quick === t.id ? " is-active" : "") + '" data-activity-action="quick" data-quick="' + t.id + '" aria-pressed="' + (view.quick === t.id) + '">' + esc(t.label) + "</button>").join("") +
      activeChips.map((c) => '<button type="button" class="chip is-active" data-activity-action="remove-chip" data-chip="' + c.key + '" aria-label="Remove filter ' + esc(c.label) + '">' + esc(c.label) + " " + ui.icon("close") + "</button>").join("") +
    "</div>";
  }

  function render(state) {
    if (!state.transactions.some((t) => date.fyOf(t.date) === view.fy)) {
      const current = date.fyOf(date.todayISO());
      const available = Dhan.unique(state.transactions.map((t) => date.fyOf(t.date)));
      if (available.length && !available.includes(view.fy)) view.fy = available.sort().slice(-1)[0] || current;
    }
    const txs = filtered(state);
    const fcount = activeFilterCount();
    return '<div class="page" data-view="activity">' +
      '<header class="page-head">' +
        '<div class="page-head-copy"><div class="eyebrow">THE LEDGER · ' + esc(date.fyLabel(view.fy)) + "</div>" +
          "<h1>Every entry, accounted for.</h1>" +
          '<p class="lede">Search it, filter it, fix a typo. This is the full record behind every number.</p></div>' +
        '<div class="head-actions">' +
          '<button type="button" class="btn btn-secondary" data-activity-action="export">' + ui.icon("download") + "Export</button>" +
          '<button type="button" class="btn btn-primary js-desktop-add" data-action="add-tx">' + ui.icon("plus") + "Add entry</button>" +
        "</div>" +
      "</header>" +

      summary(txs) +

      '<div class="filter-bar">' +
        '<label class="search-field" for="activity-search">' + ui.icon("search") +
          '<input class="input" id="activity-search" type="search" placeholder="Search notes, categories, accounts, amounts…" value="' + esc(view.q) + '" autocomplete="off">' +
        "</label>" +
        '<div class="filter-select"><div class="select-wrap"><select class="input" data-activity-filter="fy" aria-label="Financial year">' + ui.fyOptionsHtml(view.fy, 8) + "</select>" + ui.icon("chevron-down") + "</div></div>" +
        '<div class="filter-select"><div class="select-wrap"><select class="input" data-activity-filter="month" aria-label="Month">' + ui.monthOptions(state, view.fy, view.month) + "</select>" + ui.icon("chevron-down") + "</div></div>" +
        '<button type="button" class="btn btn-secondary" data-activity-action="toggle-advanced">' + ui.icon("filter") + "Filters" +
          (fcount ? '<span class="badge">' + fcount + "</span>" : "") + "</button>" +
        chips(state) +
      "</div>" +
      advancedPanel(state) +
      '<div id="activity-results">' + results(state, txs) + "</div>" +
    "</div>";
  }

  function updateResults() {
    const state = Dhan.app.state;
    const box = document.getElementById("activity-results");
    if (!box) return;
    const txs = filtered(state);
    box.innerHTML = results(state, txs);
    const summaryBox = document.getElementById("activity-summary");
    if (summaryBox) summaryBox.outerHTML = summary(txs);
  }

  function reset() {
    Object.assign(view, {
      q: "", quick: "all", fy: date.fyOf(date.todayISO()), month: "all",
      category: "all", account: "all", from: "", to: "", advanced: false, limit: 50
    });
    Dhan.app.render();
  }

  function init() {
    if (bound) return;
    bound = true;
    document.addEventListener("input", Dhan.ui.debounce((e) => {
      const input = e.target.closest && e.target.closest("#activity-search");
      if (!input) return;
      view.q = input.value;
      view.limit = 50;
      updateResults();
    }, 170));

    document.addEventListener("change", (e) => {
      const el = e.target.closest && e.target.closest("[data-activity-filter]");
      if (!el) return;
      const key = el.getAttribute("data-activity-filter");
      if (key === "from" && view.to && el.value && el.value > view.to) {
        ui.toast("The start date is after the end date.", "error");
        el.value = view.from;
        return;
      }
      if (key === "to" && view.from && el.value && el.value < view.from) {
        ui.toast("The end date is before the start date.", "error");
        el.value = view.to;
        return;
      }
      view[key] = el.value;
      if (key === "fy") {
        view.month = "all";
        if (!Dhan.date.fyMonths(el.value).includes(view.month)) view.month = "all";
      }
      view.limit = 50;
      Dhan.app.render();
    });

    document.addEventListener("click", (e) => {
      const action = e.target.closest && e.target.closest("[data-activity-action]");
      if (!action) return;
      e.preventDefault();
      const kind = action.getAttribute("data-activity-action");
      if (kind === "toggle-advanced") {
        view.advanced = !view.advanced;
        Dhan.app.render();
      } else if (kind === "quick") {
        view.quick = action.getAttribute("data-quick") || "all";
        view.limit = 50;
        Dhan.app.render();
      } else if (kind === "reset") {
        reset();
      } else if (kind === "remove-chip") {
        const chip = action.getAttribute("data-chip");
        if (chip === "dates") { view.from = ""; view.to = ""; }
        else view[chip] = "all";
        Dhan.app.render();
      } else if (kind === "load-more") {
        view.limit += 50;
        updateResults();
      } else if (kind === "export") {
        const rows = filtered(Dhan.app.state);
        if (!rows.length) { ui.toast("There is nothing to export in this view.", "error"); return; }
        ui.download("dhan-activity-" + date.todayISO() + ".csv", Dhan.transactionsCSV(Dhan.app.state, rows), "text/csv;charset=utf-8");
        ui.toast(rows.length + " " + ui.plural(rows.length, "entry", "entries") + " exported.", "success");
      }
    });
  }

  function esc(value) { return Dhan.esc(value); }

  Dhan.views = Dhan.views || {};
  Dhan.views.activity = {
    id: "activity",
    title: "Activity",
    render: render,
    init: init
  };
})(typeof window !== "undefined" ? window : globalThis);
