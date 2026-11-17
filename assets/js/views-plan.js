/* Dhan — plan: goals with dates, budgets with limits. */
(function (root) {
  "use strict";
  const Dhan = root.Dhan = root.Dhan || {};
  const ui = Dhan.ui;
  const money = Dhan.money;
  const date = Dhan.date;

  const view = {
    tab: "goals",
    month: date.currentMonth()
  };
  let bound = false;

  function tabs(state) {
    const goalCount = state.goals.filter((g) => !g.archived).length;
    const budgetCount = state.budgets.filter((b) => b.month === view.month).length;
    return '<nav class="view-tabs" aria-label="Planning views">' +
      '<a class="view-tab' + (view.tab === "goals" ? " is-active" : "") + '" href="#/goals" data-plan-tab="goals"' + (view.tab === "goals" ? ' aria-current="page"' : "") + '>Goals<span class="count">' + goalCount + "</span></a>" +
      '<a class="view-tab' + (view.tab === "budgets" ? " is-active" : "") + '" href="#/budgets" data-plan-tab="budgets"' + (view.tab === "budgets" ? ' aria-current="page"' : "") + '>Budgets<span class="count">' + budgetCount + "</span></a>" +
    "</nav>";
  }

  function summary(state) {
    const goals = state.goals.filter((g) => !g.archived);
    const rows = goals.map((g) => ({ goal: g, p: Dhan.goalProgress(state, g) }));
    const target = Dhan.sum(rows, (r) => r.goal.targetPaise);
    const saved = Dhan.sum(rows, (r) => r.p.saved);
    const remaining = Dhan.sum(rows, (r) => r.p.remaining);
    const monthly = Dhan.sum(rows, (r) => r.p.monthlyNeeded);
    const done = rows.filter((r) => r.p.done).length;
    return '<div class="plan-summary">' +
      '<div class="metric"><div class="metric-label">TOTAL TARGETS</div><div class="metric-value">' + esc(money.fmt(target, { compact: true })) + '</div><div class="metric-note">' + goals.length + " " + ui.plural(goals.length, "goal") + "</div></div>" +
      '<div class="metric"><div class="metric-label">SET ASIDE</div><div class="metric-value positive">' + esc(money.fmt(saved, { compact: true })) + '</div><div class="metric-note">' + (done ? done + " " + ui.plural(done, "goal") + " complete" : "Tracking only") + "</div></div>" +
      '<div class="metric"><div class="metric-label">STILL NEEDED</div><div class="metric-value">' + esc(money.fmt(remaining, { compact: true })) + '</div><div class="metric-note">Across active goals</div></div>' +
      '<div class="metric"><div class="metric-label">MONTHLY NEEDED</div><div class="metric-value">' + esc(money.fmt(monthly, { compact: true })) + '</div><div class="metric-note">To stay on time</div></div>' +
    "</div>";
  }

  function goalCard(state, goal) {
    const p = Dhan.goalProgress(state, goal);
    const pace = p.done
      ? "<strong>Goal reached</strong>Well done. Keep it or start the next one."
      : p.monthsLeft > 0
        ? "<strong>" + esc(money.fmt(p.monthlyNeeded, { decimals: 0 })) + " / month</strong>To get there by " + esc(date.fmtDate(goal.targetDate))
        : "<strong>Target date has passed</strong>Edit the goal to set a new date.";
    const progressNote = p.done
      ? '<span class="badge is-positive">' + ui.icon("check") + "Complete</span>"
      : "<span><strong>" + Math.round(p.progress) + "%</strong> funded</span>";
    const timeNote = p.done ? "" : "<span>" + (p.monthsLeft > 0 ? p.monthsLeft + " " + ui.plural(p.monthsLeft, "month") + " left" : "Date passed") + "</span>";
    return '<article class="goal-card' + (p.done ? " is-done" : "") + '">' +
      '<div class="goal-card-top">' +
        '<div class="goal-card-id"><span class="goal-icon" aria-hidden="true">' + ui.icon(goal.icon) + "</span>" +
          "<div><h3>" + esc(goal.name) + "</h3><p>" + esc(date.fmtDate(goal.targetDate)) + (goal.note ? " · " + esc(goal.note) : "") + "</p></div></div>" +
        '<button type="button" class="icon-btn goal-card-edit" data-action="edit-goal" data-id="' + esc(goal.id) + '" aria-label="Edit ' + esc(goal.name) + '">' + ui.icon("pencil") + "</button>" +
      "</div>" +
      '<div class="goal-card-figures"><span class="saved">' + esc(money.fmt(p.saved)) + '</span><span class="of">of ' + esc(money.fmt(goal.targetPaise)) + "</span></div>" +
      '<div class="goal-bar"><div class="goal-bar-fill" style="width:' + Math.min(100, p.progress).toFixed(1) + '%"></div></div>' +
      '<div class="goal-card-progress">' + progressNote + timeNote + "</div>" +
      '<div class="goal-card-foot"><div class="goal-card-pace">' + pace + "</div>" +
        '<div class="goal-card-actions">' +
          '<button type="button" class="btn btn-secondary btn-sm" data-action="goal-detail" data-id="' + esc(goal.id) + '">History</button>' +
          (p.done ? "" : '<button type="button" class="btn btn-primary btn-sm" data-action="contribute-goal" data-id="' + esc(goal.id) + '">' + ui.icon("plus") + "Add money</button>") +
        "</div>" +
      "</div>" +
    "</article>";
  }

  function goalsPanel(state) {
    const goals = state.goals.filter((g) => !g.archived);
    if (!goals.length) {
      const templates = Object.entries(Dhan.modals.goalTemplates).map(([key, t]) =>
        '<button type="button" class="template-chip" data-action="add-goal-template" data-template="' + esc(key) + '">' +
          ui.icon(t.icon) + esc(t.name) + " · " + esc(money.compact(t.target * 100)) + "</button>"
      ).join("");
      return '<div class="section" style="margin-top:16px">' +
        '<div class="empty">' +
          '<span class="empty-icon" aria-hidden="true">' + ui.icon("target") + "</span>" +
          "<h3>Give every rupee a job.</h3>" +
          "<p>A goal with a target and a date tells you exactly what to set aside each month. Start with the car fund.</p>" +
          '<div class="empty-actions"><button type="button" class="btn btn-primary" data-action="add-goal">' + ui.icon("plus") + "Create your first goal</button></div>" +
          '<div class="goal-templates">' + templates + "</div>" +
        "</div>" +
      "</div>";
    }
    return '<div class="goal-grid">' + goals.map((g) => goalCard(state, g)).join("") +
      '<button type="button" class="account-add" style="min-height:200px" data-action="add-goal">' + ui.icon("plus") + "Add another goal</button>" +
    "</div>";
  }

  function monthBar(state) {
    const prevBudgets = state.budgets.filter((b) => b.month === date.addMonths(view.month, -1)).length;
    return '<div class="row between wrap gap-3" style="margin-top:14px">' +
      '<div class="row gap-2">' +
        '<button type="button" class="icon-btn" data-plan-action="prev-month" aria-label="Previous month">' + ui.icon("arrow-left") + "</button>" +
        '<strong style="font-size:0.95rem;min-width:130px;text-align:center">' + esc(date.fmtMonthLong(view.month)) + "</strong>" +
        '<button type="button" class="icon-btn" data-plan-action="next-month" aria-label="Next month">' + ui.icon("arrow-right") + "</button>" +
        (view.month !== date.currentMonth() ? '<button type="button" class="btn btn-ghost btn-sm" data-plan-action="this-month">This month</button>' : "") +
      "</div>" +
      (prevBudgets ? '<button type="button" class="btn btn-secondary btn-sm" data-plan-action="copy-last">' + ui.icon("copy") + "Copy " + esc(date.fmtMonth(date.addMonths(view.month, -1))) + " budgets</button>" : "") +
    "</div>";
  }

  function budgetPanel(state) {
    const lines = Dhan.budgetLines(state, view.month);
    const total = Dhan.sum(lines, (l) => l.budget.amountPaise);
    const spent = Dhan.sum(lines, (l) => l.spent);
    const left = total - spent;
    const over = lines.filter((l) => l.over).length;
    const pct = Dhan.pct(spent, total);
    const unbudgeted = Dhan.unbudgetedSpend(state, view.month);
    const unbudgetedTotal = Dhan.sum(unbudgeted, (u) => u.amountPaise);
    const prevMonth = date.addMonths(view.month, -1);
    const prevCount = state.budgets.filter((b) => b.month === prevMonth).length;

    const overview = lines.length
      ? '<div class="budget-overview">' +
          '<div class="budget-overview-main">' +
            '<div class="metric-label">MONTHLY CEILING</div>' +
            '<div class="amount">' + esc(money.fmt(total)) + "</div>" +
            '<div class="progress"><div class="progress-fill ' + (pct > 100 ? "is-negative" : pct > 85 ? "is-warning" : "") + '" style="width:' + Math.min(100, pct).toFixed(1) + '%"></div></div>' +
            '<div class="foot"><span>' + Math.round(pct) + "% used</span><span>" + esc(date.fmtMonthLong(view.month)) + "</span></div>" +
          "</div>" +
          '<div class="metric"><div class="metric-label">SPENT</div><div class="metric-value">' + esc(money.fmt(spent, { compact: true })) + '</div><div class="metric-note">' + lines.length + " budgeted " + ui.plural(lines.length, "category", "categories") + "</div></div>" +
          '<div class="metric"><div class="metric-label">' + (left < 0 ? "OVER BY" : "LEFT") + '</div><div class="metric-value ' + (left < 0 ? "negative" : "positive") + '">' + esc(money.fmt(Math.abs(left), { compact: true })) + '</div><div class="metric-note">' + (left < 0 ? "Over the ceiling" : "Still available") + "</div></div>" +
          '<div class="metric"><div class="metric-label">OVER BUDGET</div><div class="metric-value">' + over + '</div><div class="metric-note">' + (over ? ui.plural(over, "category") + " crossed" : "All within limits") + "</div></div>" +
        "</div>" +
        '<div class="budget-list">' + lines.map((l) =>
          '<div class="budget-row' + (l.over ? " is-over" : "") + '">' +
            '<div class="budget-cat"><span class="tx-icon" style="--cat-color:var(--cat-' + esc(l.color) + ')" aria-hidden="true">' + ui.icon(l.icon) + "</span>" +
              "<div><strong>" + esc(l.name) + "</strong><span>" + (l.over ? "Over by " + esc(money.fmt(Math.abs(l.remaining))) : Math.round(l.progress) + "% of limit used") + "</span></div></div>" +
            '<div class="budget-bar-wrap"><div class="progress"><div class="progress-fill ' + (l.over ? "is-negative" : l.progress > 85 ? "is-warning" : "") + '" style="width:' + Math.min(100, l.progress).toFixed(1) + '%"></div></div>' +
              '<div class="hint"><span>' + esc(money.fmt(l.spent)) + " spent</span><span>" + esc(money.fmt(l.budget.amountPaise)) + " limit</span></div></div>" +
            '<div class="budget-values">' + esc(money.fmt(l.remaining)) + "<small>left</small></div>" +
            '<button type="button" class="icon-btn budget-edit" data-action="edit-budget" data-id="' + esc(l.budget.id) + '" aria-label="Edit ' + esc(l.name) + ' budget">' + ui.icon("pencil") + "</button>" +
          "</div>"
        ).join("") + "</div>"
      : ui.empty({
          icon: "target",
          title: "No budgets for " + date.fmtMonthLong(view.month),
          message: "Pick the two or three categories that tend to surprise you. A budget is a fence, not a punishment.",
          tight: true,
          actions: [
            { label: "Set a budget", action: "add-budget", variant: "btn-primary", icon: "plus", attrs: 'data-month="' + esc(view.month) + '"' }
          ]
        });

    const unbudgetedBlock = unbudgeted.length
      ? '<div class="unbudgeted"><h3>Not budgeted yet</h3><p>' + esc(money.fmt(unbudgetedTotal)) + " went to categories without a ceiling this month.</p>" +
        '<div class="unbudgeted-list">' + unbudgeted.slice(0, 8).map((u) =>
          '<button type="button" class="unbudgeted-item" data-action="add-budget-category" data-category="' + esc(u.categoryId) + '" data-month="' + esc(view.month) + '" style="--cat-color:var(--cat-' + esc(u.color) + ')" title="Set a budget for ' + esc(u.name) + '">' +
          ui.icon(u.icon) + esc(u.name) + " <strong>" + esc(money.fmt(u.amountPaise, { compact: true })) + "</strong></button>"
        ).join("") + "</div></div>"
      : "";

    return overview + unbudgetedBlock +
      '<div class="budget-actions">' +
        (prevCount ? '<button type="button" class="btn btn-secondary" data-plan-action="copy-last">' + ui.icon("copy") + "Copy last month</button>" : "") +
        '<button type="button" class="btn btn-primary" data-action="add-budget" data-month="' + esc(view.month) + '">' + ui.icon("plus") + "Add budget</button>" +
      "</div>";
  }

  function render(state) {
    const route = String(location.hash || "").replace(/^#\/?/, "").split("/")[0];
    if (route === "budgets") view.tab = "budgets";
    else if (route === "goals" || route === "plan") view.tab = "goals";
    const isGoals = view.tab !== "budgets";
    const head = isGoals
      ? { eyebrow: "PLAN · GOALS", title: "Plans with a finish line.", lede: "A car, a home, an emergency fund. Set the target and the date — Dhan works out the monthly number." }
      : { eyebrow: "PLAN · BUDGETS", title: "Ceilings that keep you honest.", lede: "Give the categories that surprise you a monthly limit. Spending is measured against it automatically." };
    return '<div class="page" data-view="plan">' +
      '<header class="page-head">' +
        '<div class="page-head-copy"><div class="eyebrow">' + esc(head.eyebrow) + "</div><h1>" + esc(head.title) + "</h1>" +
          '<p class="lede">' + esc(head.lede) + "</p></div>" +
        '<div class="head-actions">' +
          (isGoals
            ? '<button type="button" class="btn btn-primary" data-action="add-goal">' + ui.icon("plus") + "Add goal</button>"
            : '<button type="button" class="btn btn-primary" data-action="add-budget" data-month="' + esc(view.month) + '">' + ui.icon("plus") + "Add budget</button>") +
        "</div>" +
      "</header>" +
      tabs(state) +
      (isGoals ? summary(state) + goalsPanel(state) : '<div class="section">' + monthBar(state) + budgetPanel(state) + "</div>") +
    "</div>";
  }

  function init() {
    if (bound) return;
    bound = true;
    document.addEventListener("click", (e) => {
      const btn = e.target.closest && e.target.closest("[data-plan-action]");
      if (!btn) return;
      const kind = btn.getAttribute("data-plan-action");
      if (kind === "prev-month") {
        view.month = date.addMonths(view.month, -1);
        Dhan.app.render();
      } else if (kind === "next-month") {
        view.month = date.addMonths(view.month, 1);
        Dhan.app.render();
      } else if (kind === "this-month") {
        view.month = date.currentMonth();
        Dhan.app.render();
      } else if (kind === "copy-last") {
        copyLastMonth();
      }
    });
  }

  async function copyLastMonth() {
    const state = Dhan.app.state;
    const prev = date.addMonths(view.month, -1);
    const source = state.budgets.filter((b) => b.month === prev);
    if (!source.length) {
      ui.toast("There were no budgets in " + date.fmtMonth(prev) + " to copy.", "info");
      return;
    }
    const existing = new Set(state.budgets.filter((b) => b.month === view.month).map((b) => b.categoryId));
    const additions = source.filter((b) => !existing.has(b.categoryId));
    if (!additions.length) {
      ui.toast("Every category from " + date.fmtMonth(prev) + " already has a budget this month.", "info");
      return;
    }
    const ok = await ui.confirm({
      title: "Copy last month's budgets?",
      message: "This adds " + additions.length + " " + ui.plural(additions.length, "budget") + " to <strong>" + esc(date.fmtMonthLong(view.month)) +
        "</strong>. Existing budgets in this month are left alone.",
      confirmLabel: "Copy budgets"
    });
    if (!ok) return;
    Dhan.store.snapshot(state, "Before copying budgets");
    for (const b of additions) {
      state.budgets.push({ id: Dhan.uid("bud"), month: view.month, categoryId: b.categoryId, amountPaise: b.amountPaise });
    }
    Dhan.app.commit("Budgets copied from last month");
    ui.toast(additions.length + " " + ui.plural(additions.length, "budget") + " copied.", "success");
  }

  function esc(value) { return Dhan.esc(value); }

  Dhan.views = Dhan.views || {};
  Dhan.views.plan = { id: "plan", title: "Plan", render, init };
})(typeof window !== "undefined" ? window : globalThis);
