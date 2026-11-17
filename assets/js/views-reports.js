/* Dhan — reports: the year, its months, and the shape of your spending. */
(function (root) {
  "use strict";
  const Dhan = root.Dhan = root.Dhan || {};
  const ui = Dhan.ui;
  const money = Dhan.money;
  const date = Dhan.date;
  const charts = Dhan.charts;

  const view = { fy: date.fyOf(date.todayISO()) };
  let bound = false;

  function header() {
    return '<header class="page-head">' +
      '<div class="page-head-copy"><div class="eyebrow">REPORTS · ' + esc(date.fyLabel(view.fy)) + "</div>" +
        "<h1>The year, in numbers.</h1>" +
        '<p class="lede">Cashflow month by month, the categories doing the damage, and what your net worth did along the way.</p></div>' +
      '<div class="head-actions">' +
        '<div class="filter-select"><div class="select-wrap"><select class="input" data-report-fy aria-label="Financial year">' + ui.fyOptionsHtml(view.fy, 8) + "</select>" + ui.icon("chevron-down") + "</div></div>" +
        '<button type="button" class="btn btn-secondary" data-report-action="export-tx">' + ui.icon("download") + "Export CSV</button>" +
        '<button type="button" class="btn btn-primary" data-report-action="print">' + ui.icon("print") + "Print</button>" +
      "</div>" +
    "</header>";
  }

  function kpiPanel(state, stats, months) {
    const activeMonths = months.filter((m) => m.income || m.expense);
    const avgSpend = activeMonths.length ? stats.expense / activeMonths.length : 0;
    const best = months.slice().sort((a, b) => b.savings - a.savings)[0];
    const overTarget = stats.rate >= (state.settings.savingsTargetPct || 0);
    return '<section class="report-panel">' +
      '<div class="report-panel-head"><div><h2>The year in numbers</h2><p>Income, spending and what stayed.</p></div></div>' +
      '<div class="report-kpi">' +
        '<div class="kpi"><span>MONEY IN</span><strong class="positive">' + esc(money.fmt(stats.income, { compact: true })) + "</strong></div>" +
        '<div class="kpi"><span>MONEY OUT</span><strong class="negative">' + esc(money.fmt(stats.expense, { compact: true })) + "</strong></div>" +
        '<div class="kpi"><span>KEPT</span><strong class="' + (stats.savings < 0 ? "negative" : "positive") + '">' + esc(money.fmt(stats.savings, { compact: true })) + "</strong></div>" +
        '<div class="kpi"><span>SAVINGS RATE</span><strong>' + Math.round(stats.rate) + "%</strong></div>" +
      "</div>" +
      '<div class="callout">' + ui.icon(overTarget ? "check" : "info") + '<div class="grow">' +
        (stats.income
          ? (overTarget
            ? "You kept <strong>" + Math.round(stats.rate) + "%</strong> this year — at or above your " + Math.round(state.settings.savingsTargetPct || 0) + "% target."
            : "You kept <strong>" + Math.round(stats.rate) + "%</strong> this year. Your target is " + Math.round(state.settings.savingsTargetPct || 0) + "% — even a small gap compounds.")
          : "No income recorded for this year yet. Add entries and the picture will build itself.") +
      "</div></div>" +
      '<div class="report-table-note">' +
        (activeMonths.length ? "Average spend across " + activeMonths.length + " active " + ui.plural(activeMonths.length, "month") + ": <strong>" + esc(money.fmt(avgSpend)) + "</strong>." : "No active months yet.") +
        (best && best.savings > 0 ? " Best month: <strong>" + esc(date.fmtMonth(best.month)) + "</strong>." : "") +
      "</div>" +
    "</section>";
  }

  function cashflowPanel(state) {
    return '<section class="report-panel">' +
      '<div class="report-panel-head"><div><h2>Cashflow</h2><p>Income against spending, month by month.</p></div>' +
        '<div class="chart-legend"><span class="legend-item"><span class="legend-swatch" style="--swatch:var(--cat-emerald)"></span>Money in</span>' +
        '<span class="legend-item"><span class="legend-swatch is-striped" style="--swatch:var(--cat-terra)"></span>Money out</span></div></div>' +
      charts.cashflowChart(state, view.fy) +
    "</section>";
  }

  function tablePanel(state) {
    const months = Dhan.monthlySummary(state, view.fy);
    const total = months.reduce((acc, m) => {
      acc.income += m.income; acc.expense += m.expense; acc.savings += m.savings;
      return acc;
    }, { income: 0, expense: 0, savings: 0 });
    const rows = months.map((m) =>
      '<tr><td class="row-title">' + esc(m.labelLong) + "</td>" +
        '<td class="num">' + (m.income ? esc(money.fmt(m.income, { compact: true })) : "—") + "</td>" +
        '<td class="num">' + (m.expense ? esc(money.fmt(m.expense, { compact: true })) : "—") + "</td>" +
        '<td class="num ' + (m.savings < 0 ? "negative" : m.savings > 0 ? "positive" : "") + '">' + (m.income || m.expense ? esc(money.fmt(m.savings, { compact: true })) : "—") + "</td>" +
        '<td class="num savings-rate">' + (m.income ? Math.round(m.rate) + "%" : "—") + "</td></tr>"
    ).join("");
    return '<section class="report-panel">' +
      '<div class="report-panel-head"><div><h2>Month by month</h2><p>Twelve months from April to March.</p></div></div>' +
      '<div class="table-wrap report-table-wrap"><table class="data-table report-table" aria-label="Monthly income, expense and savings">' +
        "<thead><tr><th>Month</th><th class=\"num\">In</th><th class=\"num\">Out</th><th class=\"num\">Kept</th><th class=\"num\">Rate</th></tr></thead>" +
        "<tbody>" + rows + "</tbody>" +
        '<tfoot><tr><td class="row-title is-strong">Full year</td><td class="num is-strong">' + esc(money.fmt(total.income, { compact: true })) +
        '</td><td class="num is-strong">' + esc(money.fmt(total.expense, { compact: true })) +
        '</td><td class="num is-strong ' + (total.savings < 0 ? "negative" : "positive") + '">' + esc(money.fmt(total.savings, { compact: true })) +
        '</td><td class="num is-strong">' + (total.income ? Math.round(Dhan.pct(total.savings, total.income)) + "%" : "—") + "</td></tr></tfoot>" +
      "</table></div>" +
    "</section>";
  }

  function categoryPanel(state, stats) {
    const rows = Dhan.categorySpend(state, Dhan.txsInRange(state, date.fyRange(view.fy).start, date.fyRange(view.fy).end));
    const total = stats.expense;
    const top = rows.slice(0, 8);
    return '<section class="report-panel">' +
      '<div class="report-panel-head"><div><h2>Where it went</h2><p>Expenses by category for the full year.</p></div>' +
        '<a class="link-arrow" href="#/activity">Open ledger ' + ui.icon("arrow-right") + "</a></div>" +
      (top.length
        ? '<div class="rank-list">' + top.map((r) =>
            '<div class="rank-row" style="--cat-color:var(--cat-' + esc(r.color) + ')">' +
              '<div class="rank-name">' + ui.icon(r.icon) + "<span>" + esc(r.name) + "</span></div>" +
              '<div class="rank-bar"><span style="--w:' + Dhan.pct(r.amountPaise, total).toFixed(1) + '%"></span></div>' +
              '<div class="rank-val">' + esc(money.fmt(r.amountPaise, { compact: true })) + "<small>" + Math.round(Dhan.pct(r.amountPaise, total)) + "%</small></div>" +
            "</div>"
          ).join("") + "</div>" +
          (rows.length > top.length ? '<div class="report-table-note">+ ' + (rows.length - top.length) + " smaller " + ui.plural(rows.length - top.length, "category", "categories") + ".</div>" : "")
        : ui.empty({ icon: "chart", title: "No expenses yet", message: "Once spending is recorded, the ranking appears here.", tight: true })) +
    "</section>";
  }

  function trendPanel(state) {
    return '<section class="report-panel">' +
      '<div class="report-panel-head"><div><h2>Net worth trend</h2><p>The last twelve months, including today.</p></div></div>' +
      charts.trendChart(state, 12) +
      '<div class="report-table-note">Net worth is opening balances plus all income, minus all expenses. Transfers cancel out. Archived accounts keep their history but leave the active total.</div>' +
    "</section>";
  }

  function exportPanel() {
    return '<section class="report-panel export-panel">' +
      '<div class="report-panel-head"><div><h2>Take it with you</h2><p>Plain files, no lock-in.</p></div></div>' +
      '<button type="button" class="btn btn-secondary btn-sm" data-report-action="export-tx">' + ui.icon("receipt") + "Every entry this FY (CSV)</button>" +
      '<button type="button" class="btn btn-secondary btn-sm" data-report-action="export-monthly">' + ui.icon("chart") + "Monthly totals (CSV)</button>" +
      '<button type="button" class="btn btn-secondary btn-sm" data-report-action="print">' + ui.icon("print") + "Print or save as PDF</button>" +
      '<div class="report-table-note">A JSON backup with every setting and snapshot lives in Settings. CSV files open cleanly in Google Sheets and Excel.</div>' +
    "</section>";
  }

  function render(state) {
    const stats = Dhan.fyStats(state, view.fy);
    const months = Dhan.monthlySummary(state, view.fy);
    const fyTxs = Dhan.txsInRange(state, date.fyRange(view.fy).start, date.fyRange(view.fy).end);
    return '<div class="page" data-view="reports">' +
      header() +
      (!fyTxs.length ? ui.banner("No entries are recorded in <strong>" + esc(date.fyLabel(view.fy)) + "</strong>. The report is ready — it just needs a few entries.", "info", "info") : "") +
      '<div class="report-grid">' +
        '<div class="stack">' + cashflowPanel(state) + tablePanel(state) + "</div>" +
        '<div class="stack">' + kpiPanel(state, stats, months) + categoryPanel(state, stats) + trendPanel(state) + exportPanel() + "</div>" +
      "</div>" +
    "</div>";
  }

  function exportFile(kind) {
    const state = Dhan.app.state;
    if (kind === "export-tx") {
      const range = date.fyRange(view.fy);
      const txs = Dhan.txsInRange(state, range.start, range.end);
      if (!txs.length) { ui.toast("There are no entries in this FY to export.", "info"); return; }
      ui.download("dhan-report-" + view.fy + ".csv", Dhan.transactionsCSV(state, txs), "text/csv;charset=utf-8");
      ui.toast(txs.length + " " + ui.plural(txs.length, "entry", "entries") + " exported.", "success");
    } else if (kind === "export-monthly") {
      ui.download("dhan-monthly-" + view.fy + ".csv", Dhan.monthlyCSV(state, view.fy), "text/csv;charset=utf-8");
      ui.toast("Monthly totals downloaded.", "success");
    } else if (kind === "print") {
      window.print();
    }
  }

  function init() {
    if (bound) return;
    bound = true;
    document.addEventListener("change", (e) => {
      const select = e.target.closest && e.target.closest("[data-report-fy]");
      if (!select) return;
      view.fy = select.value;
      Dhan.app.render();
    });
    document.addEventListener("click", (e) => {
      const btn = e.target.closest && e.target.closest("[data-report-action]");
      if (!btn) return;
      exportFile(btn.getAttribute("data-report-action"));
    });
  }

  function esc(value) { return Dhan.esc(value); }

  Dhan.views = Dhan.views || {};
  Dhan.views.reports = { id: "reports", title: "Reports", render, init };
})(typeof window !== "undefined" ? window : globalThis);
