/* Dhan — dashboard: the month at a glance. */
(function (root) {
  "use strict";
  const Dhan = root.Dhan = root.Dhan || {};
  const ui = Dhan.ui;
  const money = Dhan.money;
  const date = Dhan.date;
  const charts = Dhan.charts;

  function goalSpot(state) {
    const goals = state.goals.filter((g) => !g.archived);
    if (!goals.length) {
      return '<aside class="goal-spot">' +
        '<div class="goal-spot-head"><span class="mono">A GOAL IN FOCUS</span><span class="badge">Plan</span></div>' +
        '<div class="goal-spot-title"><span class="goal-icon" aria-hidden="true">' + ui.icon("target") + "</span>" +
          "<div><h2>Give every rupee a job.</h2><div class=\"goal-sub\">A goal turns saving into a countdown.</div></div></div>" +
        '<div class="goal-spot-cta">' +
          '<button type="button" class="btn btn-primary btn-block" data-action="add-goal">' + ui.icon("plus") + "Create your first goal</button>" +
          '<p class="goal-pace" style="margin-top:10px">Try “New car · ₹22,00,000 · 3 years”.</p>' +
        "</div>" +
      "</aside>";
    }
    const goal = goals.find((g) => !Dhan.goalProgress(state, g).done) || goals[0];
    const p = Dhan.goalProgress(state, goal);
    const monthly = p.monthlyNeeded;
    const pace = p.done
      ? "Goal reached. <strong>Well done.</strong>"
      : p.monthsLeft > 0
        ? "Set aside <strong>" + esc(money.fmt(monthly, { decimals: 0 })) + "</strong> a month to get there on time."
        : "The target date has passed — adjust the date or add what you can.";
    return '<aside class="goal-spot">' +
      '<svg class="goal-spot-watermark icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-' + esc(goal.icon) + '"></use></svg>' +
      '<div class="goal-spot-head"><span class="mono">GOAL IN FOCUS</span><a class="link-arrow" href="#/goals">All goals ' + ui.icon("arrow-right") + "</a></div>" +
      '<div class="goal-spot-title"><span class="goal-icon" aria-hidden="true">' + ui.icon(goal.icon) + "</span>" +
        "<div><h2>" + esc(goal.name) + "</h2><div class=\"goal-sub\">" + esc(date.fmtDate(goal.targetDate)) +
        (p.monthsLeft > 0 && !p.done ? " · " + p.monthsLeft + " " + ui.plural(p.monthsLeft, "month") + " left" : "") + "</div></div></div>" +
      '<div class="goal-spot-amounts"><div class="goal-saved">' + esc(money.fmt(p.saved)) + "<small>saved</small></div>" +
        '<div class="goal-target">of ' + esc(money.fmt(goal.targetPaise)) + "</div></div>" +
      '<div class="goal-bar"><div class="goal-bar-fill" style="width:' + Math.min(100, p.progress).toFixed(1) + '%"></div></div>' +
      '<div class="goal-bar-ticks"><span>₹0</span><span>' + Math.round(p.progress) + "%</span><span>" + esc(money.compact(goal.targetPaise)) + "</span></div>" +
      '<div class="goal-spot-foot"><p class="goal-pace">' + pace + '</p>' +
        (p.done
          ? '<button type="button" class="btn btn-secondary btn-sm" data-action="goal-detail" data-id="' + esc(goal.id) + '">View goal</button>'
          : '<button type="button" class="btn btn-primary btn-sm" data-action="contribute-goal" data-id="' + esc(goal.id) + '">' + ui.icon("plus") + "Add money</button>") +
      "</div>" +
    "</aside>";
  }

  function hero(state, stats) {
    const points = Dhan.netWorthSeries(state, 6);
    const net = Dhan.netWorth(state);
    const accounts = Dhan.activeAccounts(state).length;
    const spark = charts.sparkline(points, "Net worth over the last six months");
    const monthLabel = date.fmtMonthLong(date.currentMonth());
    return '<section class="hero" aria-label="Net worth this month">' +
      '<div class="hero-top">' +
        '<div>' +
          '<div class="hero-label">' + ui.icon("lock") + "NET WORTH · ONLY ON THIS DEVICE</div>" +
          '<div class="hero-amount">' + esc(money.fmt(net)) + "</div>" +
          '<div class="hero-sub"><span>' + accounts + " " + ui.plural(accounts, "account") + "</span><span class=\"dot\"></span>" +
            '<span class="' + (stats.savings < 0 ? "hero-delta is-down" : "hero-delta") + '">' +
            (stats.savings >= 0 ? "+" : "−") + esc(money.fmt(Math.abs(stats.savings))) + " kept in " + esc(date.fmtMonth(date.currentMonth())) + "</span></div>" +
        "</div>" +
        (spark ? '<div class="hero-spark">' + spark + '<div class="spark-label"><span>6 months ago</span><span>now</span></div></div>' : "") +
      "</div>" +
      '<div class="hero-stats">' +
        '<div class="hero-stat"><div class="hero-stat-label">' + ui.icon("arrow-left") + "MONEY IN</div>" +
          '<div class="hero-stat-value">' + esc(money.fmt(stats.income, { compact: true })) + '</div><div class="hero-stat-note">' + esc(monthLabel) + "</div></div>" +
        '<div class="hero-stat"><div class="hero-stat-label">' + ui.icon("arrow-right") + "MONEY OUT</div>" +
          '<div class="hero-stat-value">' + esc(money.fmt(stats.expense, { compact: true })) + '</div><div class="hero-stat-note">' +
          (stats.income > 0 ? Math.round(Dhan.pct(stats.expense, stats.income)) + "% of income" : "No income yet") + "</div></div>" +
        '<div class="hero-stat"><div class="hero-stat-label">' + ui.icon("trend") + "SAVINGS RATE</div>" +
          '<div class="hero-stat-value">' + Math.round(stats.rate) + '%</div><div class="hero-stat-note">Target ' + Math.round(state.settings.savingsTargetPct || 0) + "%</div></div>" +
      "</div>" +
      '<div class="hero-foot"><span>Cashflow, budgets and goals for ' + esc(date.fyLabel(date.fyOf(date.todayISO()))) + "</span>" +
        '<a href="#/reports">Open reports ' + ui.icon("arrow-right") + "</a></div>" +
    "</section>";
  }

  function render(state) {
    const month = date.currentMonth();
    const stats = Dhan.monthStats(state, month);
    const fy = date.fyOf(date.todayISO());
    const recent = Dhan.sortBy(state.transactions, (t) => t.date + " " + (t.createdAt || ""), "desc").slice(0, 6);
    const spendRows = Dhan.categorySpend(state, stats.txs);
    const budgets = Dhan.budgetLines(state, month);
    const totalBudget = Dhan.sum(budgets, (b) => b.budget.amountPaise);
    const budgetSpent = Dhan.sum(budgets, (b) => b.spent);
    const budgetPct = Dhan.pct(budgetSpent, totalBudget);
    const totalSavedGoals = Dhan.sum(state.goals.filter((g) => !g.archived), (g) => Dhan.goalProgress(state, g).saved);
    const budgetMini = budgets.slice(0, 4);

    const budgetPanel = budgets.length ?
      '<div class="budget-pulse-total"><strong>' + esc(money.fmt(totalBudget)) + "</strong><span>" + esc(money.fmt(budgetSpent)) + " spent · " + esc(money.fmt(Math.max(0, totalBudget - budgetSpent))) + " left</span></div>" +
      '<div class="progress"><div class="progress-fill ' + (budgetPct > 100 ? "is-negative" : budgetPct > 85 ? "is-warning" : "") + '" style="width:' + Math.min(100, budgetPct).toFixed(1) + '%"></div></div>' +
      '<div class="budget-mini-list">' + budgetMini.map((line) =>
        '<div class="budget-mini' + (line.over ? " is-over" : "") + '">' +
          '<div class="budget-mini-head" style="--cat-color:var(--cat-' + esc(line.color) + ')">' + ui.icon(line.icon) + "<span>" + esc(line.name) + "</span></div>" +
          '<div class="budget-mini-val">' + esc(money.fmt(line.spent, { compact: true })) + " / " + esc(money.fmt(line.budget.amountPaise, { compact: true })) + "</div>" +
          '<div class="progress"><div class="progress-fill ' + (line.over ? "is-negative" : line.progress > 85 ? "is-warning" : "") + '" style="width:' + Math.min(100, line.progress).toFixed(1) + '%"></div></div>' +
        "</div>"
      ).join("") + "</div>" +
      '<div class="budget-pulse-foot"><span>' + budgets.length + " " + ui.plural(budgets.length, "budget") + " this month</span><a class=\"link-arrow\" href=\"#/budgets\">Tune budgets " + ui.icon("arrow-right") + "</a></div>" :
      ui.empty({
        icon: "target",
        title: "No budgets this month",
        message: "Pick the two or three categories that tend to surprise you.",
        tight: true,
        actions: [{ label: "Set a budget", action: "add-budget", variant: "btn-primary", icon: "plus" }]
      });

    const recentPanel = recent.length ?
      '<div class="tx-list recent-list">' + ui.txGroups(state, recent) + '</div>' +
        '<div class="recent-foot"><a class="link-arrow" href="#/activity">See every entry ' + ui.icon("arrow-right") + "</a></div>" :
      ui.empty({
        icon: "receipt",
        title: "Your khata is waiting",
        message: "Add your first income or expense. Everything stays in this browser.",
        actions: [
          { label: "Add first entry", action: "add-tx", variant: "btn-primary", icon: "plus" },
          { label: "Set a goal", action: "add-goal", icon: "target" }
        ]
      });

    return '<div class="page">' +
      '<header class="page-head">' +
        '<div class="page-head-copy"><div class="eyebrow">' + esc(date.fmtDay(date.todayISO())) + " · " + esc(date.fyLabel(fy)) + "</div>" +
          "<h1>Aaj ka hisaab.</h1>" +
          '<p class="lede">A clear look at this month — what came in, what went out, and what you kept.</p></div>' +
        '<div class="head-actions">' +
          '<button type="button" class="btn btn-secondary" data-action="add-transfer">' + ui.icon("swap") + "Transfer</button>" +
          '<button type="button" class="btn btn-primary js-desktop-add" data-action="add-tx">' + ui.icon("plus") + "Add entry</button>" +
        "</div>" +
      "</header>" +

      '<div class="dash-top">' + hero(state, stats) + goalSpot(state) + "</div>" +

      '<div class="grid section" aria-label="This month at a glance">' +
        '<section class="panel span-7">' +
          '<div class="chart-head"><div><h2>Cashflow</h2><p class="panel-sub">Every month of ' + esc(date.fyLabel(fy)) + ", income against spending.</p></div>" +
            '<div class="chart-legend"><span class="legend-item"><span class="legend-swatch" style="--swatch:var(--cat-emerald)"></span>Money in</span>' +
            '<span class="legend-item"><span class="legend-swatch is-striped" style="--swatch:var(--cat-terra)"></span>Money out</span></div></div>' +
          charts.cashflowChart(state, fy) +
        "</section>" +
        '<section class="panel span-5">' +
          '<div class="chart-head"><div><h2>Where it went</h2><p class="panel-sub">' + esc(date.fmtMonthLong(month)) + " · expenses by category</p></div>" +
            '<a class="link-arrow" href="#/reports">Details ' + ui.icon("arrow-right") + "</a></div>" +
          charts.donutChart(Dhan.topCategories(spendRows, 5), stats.expense, "Spent") +
        "</section>" +
      "</div>" +

      '<div class="grid section">' +
        '<section class="panel span-7">' +
          '<div class="panel-head"><div><h2>Recent activity</h2><p class="panel-sub">The last few things that moved.</p></div>' +
            '<a class="link-arrow" href="#/activity">All activity ' + ui.icon("arrow-right") + "</a></div>" +
          recentPanel +
        "</section>" +
        '<section class="panel span-5">' +
          '<div class="panel-head"><div><h2>Budget pulse</h2><p class="panel-sub">' + esc(date.fmtMonthLong(month)) + " · how the ceilings are holding</p></div>" +
            '<button type="button" class="icon-btn is-plain" data-action="add-budget" aria-label="Add budget">' + ui.icon("plus") + "</button></div>" +
          budgetPanel +
        "</section>" +
      "</div>" +

      '<div class="section">' +
        '<div class="ledger-note">' + ui.icon("lock") + '<div><strong>Private by design.</strong> This khata lives in your browser, not on a server. ' +
          (state.settings.googleSheetUrl ? "Your Google Sheet is the backup — sync from Settings whenever you switch devices." : "Take a backup from Settings before clearing browser data.") +
          " Goals hold <strong>" + esc(money.fmt(totalSavedGoals)) + "</strong> across " + state.goals.filter((g) => !g.archived).length + " " + ui.plural(state.goals.filter((g) => !g.archived).length, "plan") + ".</div></div>" +
      "</div>" +
    "</div>";
  }

  function esc(value) { return Dhan.esc(value); }

  Dhan.views = Dhan.views || {};
  Dhan.views.dashboard = {
    id: "dashboard",
    title: "Dashboard",
    render: render
  };
})(typeof window !== "undefined" ? window : globalThis);
