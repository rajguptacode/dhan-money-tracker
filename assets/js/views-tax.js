/* Dhan — tax & ITR: a readable working paper, clearly labelled as an estimate. */
(function (root) {
  "use strict";
  const Dhan = root.Dhan = root.Dhan || {};
  const ui = Dhan.ui;
  const money = Dhan.money;
  const date = Dhan.date;

  const view = { fy: date.fyOf(date.todayISO()) };
  let bound = false;

  const BUCKET_ICONS = {
    salary: "briefcase",
    business: "laptop",
    savings_interest: "percent",
    other_interest: "coins",
    other: "plus",
    exempt: "gift"
  };

  function header(state) {
    return '<header class="page-head">' +
      '<div class="page-head-copy"><div class="eyebrow">TAX &amp; ITR · ' + esc(date.fyLabel(view.fy)) + "</div>" +
        "<h1>A working paper, not a verdict.</h1>" +
        '<p class="lede">Your income heads, deductions and a slab-wise estimate — organised so future ITR filing is less of a scavenger hunt.</p></div>' +
      '<div class="head-actions">' +
        '<div class="filter-select"><div class="select-wrap"><select class="input" data-tax-fy aria-label="Financial year">' + ui.fyOptionsHtml(view.fy, 6) + "</select>" + ui.icon("chevron-down") + "</div></div>" +
        '<button type="button" class="btn btn-secondary" data-tax-action="export-summary">' + ui.icon("download") + "ITR summary</button>" +
      "</div>" +
    "</header>";
  }

  function summaryPanel(state, t, comp) {
    const balance = t.balancePaise;
    const note = !t.income.totalIncome
      ? "No income is recorded for this financial year yet. Add income entries and the estimate will build itself."
      : balance > 0
        ? "After TDS and advance tax, <strong>" + esc(money.fmt(balance)) + "</strong> may still be payable."
        : balance < 0
          ? "TDS and advance tax are higher than the estimate, so a refund of <strong>" + esc(money.fmt(-balance)) + "</strong> may be due."
          : "TDS and advance tax cover the estimate exactly. Nothing appears due.";
    return '<section class="tax-summary" aria-label="Estimated tax for this financial year">' +
      '<div class="tax-summary-top"><div><div class="tax-summary-label">ESTIMATED TAX · ' + (t.regime === "new" ? "NEW REGIME" : "OLD REGIME") + "</div>" +
        "<h2>" + esc(date.fyLabel(view.fy)) + " at a glance</h2></div>" +
        '<div class="stamp"><span>ESTIMATE</span><strong>' + esc(t.assumed ? "ASSUMED" : "4% CESS") + "</strong></div>" +
      "</div>" +
      '<div class="tax-amount">' + esc(money.fmt(t.totalTaxPaise)) + "<small>estimated tax</small></div>" +
      '<div class="tax-summary-sub">' + (t.income.grossTaxable > 0 ? "Effective rate " + t.effectiveRate.toFixed(1) + "% on gross taxable income" : "Nothing taxable recorded yet") + "</div>" +
      '<div class="seg" role="group" aria-label="Tax regime">' +
        '<label><input type="radio" name="regime" value="new"' + (t.regime === "new" ? " checked" : "") + ' data-tax-regime><span>New regime</span></label>' +
        '<label><input type="radio" name="regime" value="old"' + (t.regime === "old" ? " checked" : "") + ' data-tax-regime><span>Old regime</span></label>' +
      "</div>" +
      '<div class="tax-figures">' +
        '<div class="fig"><div class="label">GROSS TAXABLE</div><div class="value">' + esc(money.fmt(t.income.grossTaxable, { compact: true })) + "</div></div>" +
        '<div class="fig"><div class="label">DEDUCTIONS</div><div class="value">' + esc(money.fmt(t.totalDeductionsPaise, { compact: true })) + "</div></div>" +
        '<div class="fig"><div class="label">TAXABLE INCOME</div><div class="value">' + esc(money.fmt(t.taxablePaise, { compact: true })) + "</div></div>" +
      "</div>" +
      '<div class="tax-compare">' +
        '<span class="tax-compare-chip' + (comp.best === "new" ? " is-best" : "") + '">New <strong>' + esc(money.fmt(comp.new.totalTaxPaise, { compact: true })) + "</strong>" + (comp.best === "new" ? " · best" : "") + "</span>" +
        '<span class="tax-compare-chip' + (comp.best === "old" ? " is-best" : "") + '">Old <strong>' + esc(money.fmt(comp.old.totalTaxPaise, { compact: true })) + "</strong>" + (comp.best === "old" ? " · best" : "") + "</span>" +
        '<span class="tax-compare-chip">Saving <strong>' + esc(money.fmt(comp.savingPaise, { compact: true })) + "</strong></span>" +
      "</div>" +
      '<div class="tax-summary-note">' + note +
        (t.surchargeIgnored ? " Surcharge above ₹50 lakh is <strong>not</strong> modelled here." : "") +
        (t.assumed ? " FY 2026–27 slabs are assumed to match FY 2025–26." : "") +
      "</div>" +
    "</section>";
  }

  function incomePanel(t) {
    const rows = t.income.buckets.filter((b) => b.id !== "exempt");
    const visible = rows.filter((b) => b.amountPaise > 0);
    const list = visible.length ? visible.map((b) =>
      '<div class="income-row"><div class="name" style="--cat-color:var(--cat-emerald)">' + ui.icon(BUCKET_ICONS[b.id] || "plus") +
        "<span>" + esc(b.label) + "</span></div>" +
        '<div class="val">' + esc(money.fmt(b.amountPaise)) + "<small>" + b.count + " " + ui.plural(b.count, "entry", "entries") + "</small></div></div>"
    ).join("") : '<div class="tax-empty-fy">No taxable income entries in this FY. Add salary, freelance or interest income to start the working paper.</div>';

    const exempt = t.income.exempt > 0
      ? '<div class="income-row"><div class="name" style="--cat-color:var(--cat-slate)">' + ui.icon("gift") + "<span>Exempt / non-taxable</span></div>" +
        '<div class="val">' + esc(money.fmt(t.income.exempt)) + "<small>not in taxable income</small></div></div>"
      : "";

    return '<section class="tax-panel">' +
      '<div class="tax-panel-head"><div><h2>Income heads</h2><p class="panel-sub">Mapped from your categories — no re-typing.</p></div>' +
        '<a class="link-arrow" href="#/activity">Open ledger ' + ui.icon("arrow-right") + "</a></div>" +
      '<div>' + list +
        '<div class="income-row is-total"><div class="name">Gross taxable income</div><div class="val">' + esc(money.fmt(t.income.grossTaxable)) + "</div></div>" +
        exempt +
      "</div>" +
      '<div class="itr-note">Every income category is assigned an ITR head in Settings. Edit a category to move it between salary, business, interest, other or exempt.</div>' +
    "</section>";
  }

  function paidPanel(t) {
    return '<section class="tax-panel">' +
      '<div class="tax-panel-head"><div><h2>Tax already paid</h2><p class="panel-sub">TDS from salary and any advance tax challans.</p></div></div>' +
      '<form data-form="tax-paid">' +
        '<div class="tax-paid">' +
          '<h3>Keep the receipts</h3><p>Form 26AS and AIS are the final word. Enter what has actually been deducted or paid.</p>' +
          '<div class="tax-paid-form">' +
            '<div class="field"><label class="field-label" for="tax-tds">TDS</label><input class="input num" id="tax-tds" name="tds" type="text" inputmode="decimal" placeholder="0" value="' + esc(money.input(t.tdsPaise)) + '"></div>' +
            '<div class="field"><label class="field-label" for="tax-advance">Advance tax</label><input class="input num" id="tax-advance" name="advance" type="text" inputmode="decimal" placeholder="0" value="' + esc(money.input(t.advancePaise)) + '"></div>' +
            '<button type="submit" class="btn btn-secondary">Save</button>' +
          "</div>" +
          '<div class="tax-paid-summary"><span>Total paid <strong>' + esc(money.fmt(t.paidPaise)) + "</strong></span>" +
            "<span>" + (t.balancePaise > 0 ? "Payable <strong>" + esc(money.fmt(t.balancePaise)) + "</strong>" : t.balancePaise < 0 ? "Refund <strong>" + esc(money.fmt(-t.balancePaise)) + "</strong>" : "Settled") + "</span></div>" +
        "</div>" +
      "</form>" +
    "</section>";
  }

  function deductionPanel(state, t) {
    const entries = Dhan.sortBy(state.deductions.filter((d) => d.fy === view.fy), (d) => d.section, "asc");
    const autoRows =
      '<div class="tax-auto-row"><span class="deduction-code">STD</span><span class="deduction-main"><strong>Standard deduction</strong><span>Applied automatically on salary income · ' + esc(money.fmt(t.standardPaise)) + "</span></span>" +
        '<span class="badge is-positive">AUTO</span><span class="deduction-amount">' + esc(money.fmt(t.standardPaise)) + "</span></div>" +
      (t.regime === "old"
        ? '<div class="tax-auto-row"><span class="deduction-code">80TTA</span><span class="deduction-main"><strong>Savings bank interest</strong><span>Capped at ₹10,000 in the old regime · ' + esc(money.fmt(t.ttaPaise)) + "</span></span>" +
          '<span class="badge is-positive">AUTO</span><span class="deduction-amount">' + esc(money.fmt(t.ttaPaise)) + "</span></div>"
        : '<div class="tax-auto-row"><span class="deduction-code">80TTA</span><span class="deduction-main"><strong>Savings bank interest</strong><span>The new regime does not allow 80TTA.</span></span>' +
          '<span class="badge">NOT APPLIED</span><span class="deduction-amount">' + esc(money.fmt(0)) + "</span></div>");

    const manual = entries.length ? entries.map((d) =>
      '<div class="deduction-row"><span class="deduction-code">' + esc(d.section) + "</span>" +
        '<span class="deduction-main"><strong>' + esc(d.label || d.section) + "</strong><span>" +
          (t.regime === "old" ? "Counted in the old-regime estimate" : "Recorded for ITR · not applied in the new regime") + "</span></span>" +
        '<span class="deduction-amount">' + esc(money.fmt(d.amountPaise)) + "</span>" +
        '<span class="deduction-actions"><button type="button" class="icon-btn" data-action="edit-deduction" data-id="' + esc(d.id) + '" aria-label="Edit deduction">' + ui.icon("pencil") + "</button></span></div>"
    ).join("") : '<div class="tax-empty-fy">No manual deductions recorded for this FY. Add 80C, 80D, home loan interest or anything else your CA confirms.</div>';

    return '<section class="tax-panel">' +
      '<div class="tax-panel-head"><div><h2>Deductions &amp; exemptions</h2><p class="panel-sub">Automatic rules first, your proofs after.</p></div>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-action="add-deduction" data-fy="' + esc(view.fy) + '">' + ui.icon("plus") + "Add deduction</button></div>" +
      '<div class="deduction-list">' + autoRows + manual + "</div>" +
      '<div class="itr-note">Caps are applied automatically: 80C ₹1.5 lakh, 80CCD(1B) ₹50,000, home loan interest under 24(b) ₹2 lakh. Keep proofs for 80D, 80E, 80G and HRA. The new regime allows the standard deduction but no Chapter VI-A deductions.</div>' +
      (t.regime === "new" && entries.length ? ui.callout("Your manual deductions are stored and will be used the moment you switch to the old regime. They do not reduce tax in the new regime.", "info") : "") +
    "</section>";
  }

  function checklist(state, t) {
    const fyTxs = Dhan.txsInRange(state, date.fyRange(view.fy).start, date.fyRange(view.fy).end, "income");
    const uncategorised = fyTxs.filter((tx) => !Dhan.categoryById(state, tx.categoryId) || !Dhan.categoryById(state, tx.categoryId).bucket).length;
    const items = [
      { done: Boolean(fyTxs.length), text: "<strong>Income entries recorded.</strong> " + fyTxs.length + " " + ui.plural(fyTxs.length, "income entry", "income entries") + " for " + esc(date.fyLabel(view.fy)) + "." },
      { done: uncategorised === 0 && fyTxs.length > 0, text: "<strong>Every income entry has a tax head.</strong> " + (uncategorised ? uncategorised + " still need a category bucket." : "All mapped through their categories.") },
      { done: state.deductions.some((d) => d.fy === view.fy), text: "<strong>Deduction proofs entered.</strong> Add them as you invest, not in a March panic." },
      { done: t.paidPaise > 0, text: "<strong>TDS / advance tax entered.</strong> Reconcile with Form 26AS and AIS before filing." },
      { done: false, info: true, text: "<strong>PAN and AIS check.</strong> Once your PAN is issued, match the name and PAN on bank accounts, investments and the income-tax portal." }
    ];
    return '<div class="tax-checklist">' + items.map((i) =>
      '<div class="tax-check-item"><span class="tax-check-mark" style="' + (!i.done ? "background:var(--marigold-soft);color:var(--warning)" : "") + '" aria-hidden="true">' +
        ui.icon(i.done ? "check" : "info") + "</span><div>" + i.text + "</div></div>"
    ).join("") + "</div>";
  }

  function itrPack(state, t) {
    return '<section class="tax-panel">' +
      '<div class="tax-panel-head"><div><h2>ITR working papers</h2><p class="panel-sub">Plain files you can keep or hand to a CA.</p></div></div>' +
      '<div style="margin-bottom:16px">' + checklist(state, t) + "</div>" +
      '<div class="itr-pack">' +
        '<button type="button" class="btn btn-secondary btn-sm" data-tax-action="export-summary">' + ui.icon("file") + "ITR summary (CSV)</button>" +
        '<button type="button" class="btn btn-secondary btn-sm" data-tax-action="export-tx">' + ui.icon("receipt") + "Every entry this FY (CSV)</button>" +
        '<button type="button" class="btn btn-secondary btn-sm" data-tax-action="export-monthly">' + ui.icon("chart") + "Month-by-month (CSV)</button>" +
        '<button type="button" class="btn btn-secondary btn-sm" data-tax-action="print">' + ui.icon("print") + "Print this working paper</button>" +
      "</div>" +
      '<div class="itr-note">The CSV is a working summary, not an official return. Verify every number with your CA, Form 26AS, AIS and the latest Finance Act before filing.</div>' +
    "</section>";
  }

  function disclaimer(t) {
    return '<div class="tax-disclaimer">' + ui.icon("alert") +
      "<div><strong>An estimate, not tax advice.</strong> Dhan uses the " + esc(date.fyLabel(view.fy)) + " slab rules" +
      (t.assumed ? " (assumed to match FY 2025–26)" : "") + ", standard deduction, rebate, 4% cess and the deductions you enter. " +
      "Surcharge, capital gains special rates, deductions under 80GG and other edge cases are not modelled. Filing status, residency and income composition can change the answer. Confirm with a CA or the income-tax portal.</div>" +
    "</div>";
  }

  function render(state) {
    const t = Dhan.computeTax(state, view.fy);
    const comp = Dhan.compareRegimes(state, view.fy);
    const noIncome = t.income.totalIncome === 0;
    return '<div class="page" data-view="tax">' +
      header(state) +
      (noIncome ? ui.banner("No income is recorded for <strong>" + esc(date.fyLabel(view.fy)) + "</strong>. This working paper will fill in as soon as you add income entries.", "info", "info") : "") +
      '<div class="tax-layout">' +
        '<div class="stack gap-4">' + summaryPanel(state, t, comp) + deductionPanel(state, t) + "</div>" +
        '<div class="stack gap-4">' + incomePanel(t) + paidPanel(t) + "</div>" +
      "</div>" +
      '<div class="grid section">' +
        '<div class="span-7">' + itrPack(state, t) + "</div>" +
        '<div class="span-5">' +
          '<section class="tax-panel">' +
            '<div class="tax-panel-head"><div><h2>What normal looks like</h2><p class="panel-sub">A few reminders before March.</p></div></div>' +
            '<div class="tax-checklist">' +
              '<div class="tax-check-item"><span class="tax-check-mark">' + ui.icon("check") + '</span><div><strong>One bucket per income source.</strong> Salary, freelance, savings interest and FD interest are separate heads.</div></div>' +
              '<div class="tax-check-item"><span class="tax-check-mark">' + ui.icon("check") + '</span><div><strong>Interest is income.</strong> Bank and FD interest usually arrives without TDS — it still belongs in your return.</div></div>' +
              '<div class="tax-check-item"><span class="tax-check-mark">' + ui.icon("check") + '</span><div><strong>Keep proofs as you go.</strong> 80C receipts, insurance policies, rent agreement and home-loan interest certificate.</div></div>' +
              '<div class="tax-check-item"><span class="tax-check-mark">' + ui.icon("check") + '</span><div><strong>Reconcile, then file.</strong> AIS and 26AS should match Dhan before you copy a single number.</div></div>' +
            "</div>" +
            '<div class="itr-note">Dhan never uploads your tax data anywhere unless you explicitly connect your own Google Sheet and press push.</div>' +
          "</section>" +
        "</div>" +
      "</div>" +
      disclaimer(t) +
    "</div>";
  }

  function savePaid(form) {
    const state = Dhan.app.state;
    const tds = ui.readAmount(form, "tds");
    const advance = ui.readAmount(form, "advance");
    if (tds == null || tds < 0) {
      if (String(form.elements.tds.value || "").trim() !== "") {
        ui.fieldError(form.elements.tds, "Enter a valid TDS amount, or leave it blank.");
        return;
      }
    }
    if (advance == null || advance < 0) {
      if (String(form.elements.advance.value || "").trim() !== "") {
        ui.fieldError(form.elements.advance, "Enter a valid advance tax amount, or leave it blank.");
        return;
      }
    }
    const existing = state.taxSettings[view.fy] || {};
    state.taxSettings[view.fy] = {
      regime: existing.regime === "old" ? "old" : "new",
      tdsPaise: tds || 0,
      advancePaise: advance || 0
    };
    Dhan.app.commit("Tax paid updated");
    ui.toast("Tax paid updated for " + date.fyLabel(view.fy) + ".", "success");
  }

  function saveRegime(value) {
    const state = Dhan.app.state;
    const existing = state.taxSettings[view.fy] || {};
    state.taxSettings[view.fy] = {
      regime: value === "old" ? "old" : "new",
      tdsPaise: Math.max(0, Number(existing.tdsPaise) || 0),
      advancePaise: Math.max(0, Number(existing.advancePaise) || 0)
    };
    Dhan.app.commit("Tax regime updated");
  }

  function exportFile(kind) {
    const state = Dhan.app.state;
    const label = view.fy;
    if (kind === "summary") {
      ui.download("dhan-itr-summary-" + label + ".csv", Dhan.itrSummaryCSV(state, view.fy), "text/csv;charset=utf-8");
      ui.toast("ITR working summary downloaded.", "success");
    } else if (kind === "tx") {
      const range = date.fyRange(view.fy);
      const txs = Dhan.txsInRange(state, range.start, range.end);
      if (!txs.length) { ui.toast("There are no entries in this FY to export.", "info"); return; }
      ui.download("dhan-entries-" + label + ".csv", Dhan.transactionsCSV(state, txs), "text/csv;charset=utf-8");
      ui.toast(txs.length + " " + ui.plural(txs.length, "entry", "entries") + " exported.", "success");
    } else if (kind === "monthly") {
      ui.download("dhan-months-" + label + ".csv", Dhan.monthlyCSV(state, view.fy), "text/csv;charset=utf-8");
      ui.toast("Monthly summary downloaded.", "success");
    } else if (kind === "print") {
      window.print();
    }
  }

  function init() {
    if (bound) return;
    bound = true;

    document.addEventListener("change", (e) => {
      const fySelect = e.target.closest && e.target.closest("[data-tax-fy]");
      if (fySelect) {
        view.fy = fySelect.value;
        Dhan.app.render();
        return;
      }
      const regime = e.target.closest && e.target.closest("[data-tax-regime]");
      if (regime) saveRegime(regime.value);
    });

    document.addEventListener("submit", (e) => {
      const form = e.target.closest && e.target.closest('[data-form="tax-paid"]');
      if (!form) return;
      e.preventDefault();
      savePaid(form);
    });

    document.addEventListener("click", (e) => {
      const btn = e.target.closest && e.target.closest("[data-tax-action]");
      if (!btn) return;
      const kind = btn.getAttribute("data-tax-action");
      exportFile(kind);
    });
  }

  function esc(value) { return Dhan.esc(value); }

  Dhan.views = Dhan.views || {};
  Dhan.views.tax = { id: "tax", title: "Tax & ITR", render, init };
})(typeof window !== "undefined" ? window : globalThis);
