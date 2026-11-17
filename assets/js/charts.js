/* Dhan — dependency-free SVG/CSS charts and accessible tooltips. */
(function (root) {
  "use strict";
  const Dhan = root.Dhan = root.Dhan || {};
  const esc = Dhan.esc;
  const money = Dhan.money;
  const charts = {};

  const COLORS = {
    emerald: "var(--cat-emerald)",
    terra: "var(--cat-terra)",
    ochre: "var(--cat-ochre)",
    teal: "var(--cat-teal)",
    plum: "var(--cat-plum)",
    olive: "var(--cat-olive)",
    rose: "var(--cat-rose)",
    slate: "var(--cat-slate)"
  };

  function cashflowChart(state, fy) {
    const months = Dhan.monthlySummary(state, fy);
    if (!months.some((m) => m.income || m.expense)) {
      return emptyChart("No cashflow yet", "Add income or spending for this financial year and the month-by-month chart appears here.");
    }
    const max = Math.max(1, ...months.map((m) => Math.max(m.income, m.expense)));
    const ticks = [max, max * 0.66, max * 0.33, 0];
    const current = Dhan.date.currentMonth();
    const bars = months.map((m) => {
      const incomeH = m.income > 0 ? Math.max(2, (m.income / max) * 100) : 0;
      const expenseH = m.expense > 0 ? Math.max(2, (m.expense / max) * 100) : 0;
      const active = m.month === current;
      const tipTitle = Dhan.date.fmtMonthLong(m.month);
      const tipBody = "In " + money.fmt(m.income, { compact: true }) + " · Out " + money.fmt(m.expense, { compact: true }) + " · Kept " + money.fmt(m.savings, { compact: true });
      return '<button type="button" class="cash-col' + (active ? " is-current" : "") + '" aria-label="' + esc(tipTitle + ". Income " + money.fmt(m.income) + ". Expense " + money.fmt(m.expense) + ". Saved " + money.fmt(m.savings) + ".") + '" data-tip-title="' + esc(tipTitle) + '" data-tip-body="' + esc(tipBody) + '">' +
        '<span class="cash-bars" aria-hidden="true">' +
          '<span class="cash-bar is-income' + (incomeH === 0 ? " is-zero" : "") + '" style="--h:' + incomeH.toFixed(2) + '%"></span>' +
          '<span class="cash-bar is-expense' + (expenseH === 0 ? " is-zero" : "") + '" style="--h:' + expenseH.toFixed(2) + '%"></span>' +
        '</span>' +
        '<span class="cash-x" aria-hidden="true">' + esc(m.label) + '</span>' +
      '</button>';
    }).join("");
    const summary = months.some((m) => m.income || m.expense)
      ? "Income " + money.fmt(Dhan.sum(months, (m) => m.income), { compact: true }) + " · spent " + money.fmt(Dhan.sum(months, (m) => m.expense), { compact: true }) + " across the year."
      : "No entries in this FY yet.";
    return '<div class="cash-chart">' +
      '<div class="cash-yaxis" aria-hidden="true">' + ticks.map((t) => '<span>' + esc(t === 0 ? "₹0" : money.fmt(t, { compact: true })) + '</span>').join("") + '</div>' +
      '<div class="cash-plot">' +
        '<div class="cash-grid" aria-hidden="true"><span></span><span></span><span></span><span></span></div>' +
        '<div class="cash-cols" role="group" aria-label="Monthly income and expenses">' + bars + '</div>' +
      '</div>' +
      '</div>' +
      '<p class="chart-summary">' + esc(summary) + '</p>';
  }

  function donutChart(rows, total, centerLabel) {
    if (!rows.length || total <= 0) {
      return '<div class="empty is-tight">' +
        '<span class="empty-icon" aria-hidden="true"><svg class="icon"><use href="#i-chart"></use></svg></span>' +
        '<h3>No spending yet</h3><p>Add an expense for this month and the split will appear here.</p>' +
        '</div>';
    }
    const top = Dhan.topCategories(rows, 5);
    const circ = 100;
    let offset = 0;
    const patterns = [];
    const slices = top.map((row, i) => {
      const p = Math.max(0, (row.amountPaise / total) * 100);
      const color = COLORS[row.color] || COLORS.slate;
      const patternId = "dp-" + i + "-" + Math.random().toString(36).slice(2, 6);
      const pattern = '<pattern id="' + patternId + '" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(' + (i * 18) + ')"><rect width="7" height="7" fill="' + color + '"/>' +
        (i === 0 ? "" : i === 1 ? '<path d="M0 7 7 0" stroke="rgba(255,255,255,.28)" stroke-width="1.2"/>' :
          i === 2 ? '<circle cx="2" cy="2" r="1" fill="rgba(255,255,255,.35)"/>' :
            i === 3 ? '<path d="M0 3.5h7" stroke="rgba(0,0,0,.2)" stroke-width="1.2"/>' :
              '<path d="M0 7 7 0M0 0l7 7" stroke="rgba(255,255,255,.25)" stroke-width="1"/>') + '</pattern>';
      patterns.push(pattern);
      const len = Math.max(0.4, p - 0.8);
      const swatchStyle = "--swatch:" + color;
      const slice = '<circle cx="80" cy="80" r="62" fill="none" stroke="url(#' + patternId + ')" stroke-width="21" pathLength="100" stroke-dasharray="' + len.toFixed(2) + ' ' + (circ - len).toFixed(2) + '" stroke-dashoffset="' + (-offset).toFixed(2) + '"><title>' + esc(row.name + ": " + money.fmt(row.amountPaise)) + '</title></circle>';
      offset += p;
      return { slice, row, p, color, swatchStyle };
    });

    const legend = slices.map(({ row, p, color }) =>
      '<div class="donut-row"><span class="donut-dot" style="--swatch:' + color + '"></span>' +
      '<span class="name" title="' + esc(row.name) + '">' + esc(row.name) + '</span>' +
      '<span class="val">' + esc(money.fmt(row.amountPaise, { compact: true })) + '<span class="pct">' + p.toFixed(0) + '%</span></span></div>'
    ).join("");

    const aria = "Spending split: " + slices.map((s) => s.row.name + " " + money.fmt(s.row.amountPaise)).join(", ");
    return '<div class="donut-layout">' +
      '<div class="donut">' +
        '<svg viewBox="0 0 160 160" role="img" aria-label="' + esc(aria) + '"><defs>' + patterns.join("") + '</defs>' +
          '<circle cx="80" cy="80" r="62" fill="none" stroke="var(--surface-3)" stroke-width="21" pathLength="100"/>' +
          slices.map((s) => s.slice).join("") +
        '</svg>' +
        '<div class="donut-center"><span>' + esc(centerLabel || "Spent") + '</span><strong>' + esc(money.fmt(total, { compact: true })) + '</strong></div>' +
      '</div>' +
      '<div class="donut-legend">' + legend + '</div>' +
    '</div>';
  }

  function sparkline(points, label) {
    if (!points || points.length < 2) return "";
    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const w = 200, h = 58, pad = 4;
    const coords = points.map((p, i) => {
      const x = pad + (i / (points.length - 1)) * (w - pad * 2);
      const y = pad + (1 - (p.value - min) / span) * (h - pad * 2);
      return [x, y];
    });
    const line = coords.map(([x, y], i) => (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1)).join(" ");
    const area = line + " L" + (w - pad) + " " + (h - pad) + " L" + pad + " " + (h - pad) + " Z";
    const id = "sg-" + Math.random().toString(36).slice(2, 8);
    const last = coords[coords.length - 1];
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" role="img" aria-label="' + esc(label || "Trend") + '">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--hero-accent)" stop-opacity=".28"/><stop offset="1" stop-color="var(--hero-accent)" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + area + '" fill="url(#' + id + ')"/>' +
      '<path d="' + line + '" fill="none" stroke="var(--hero-accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' +
      '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="2.4" fill="var(--hero-accent)" stroke="var(--hero-bg)" stroke-width="1.6"/>' +
    '</svg>';
  }

  function trendChart(state, months) {
    const points = Dhan.netWorthSeries(state, months || 12);
    const values = points.map((p) => p.value);
    const minRaw = Math.min(...values);
    const maxRaw = Math.max(...values);
    const min = Math.min(0, minRaw);
    const max = Math.max(maxRaw, 1);
    const span = max - min || 1;
    const w = 600, h = 180, pad = 6;
    const coords = points.map((p, i) => {
      const x = pad + (i / (points.length - 1)) * (w - pad * 2);
      const y = pad + (1 - (p.value - min) / span) * (h - pad * 2);
      return [x, y];
    });
    const line = coords.map(([x, y], i) => (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1)).join(" ");
    const area = line + " L" + (w - pad) + " " + (h - pad) + " L" + pad + " " + (h - pad) + " Z";
    const id = "tg-" + Math.random().toString(36).slice(2, 8);
    const yTicks = [max, min + span * 0.66, min + span * 0.33, min];
    const first = points[0], last = points[points.length - 1];
    const change = last.value - first.value;
    return '<div class="trend-chart">' +
      '<div class="trend-yaxis" aria-hidden="true">' + yTicks.map((v) => '<span>' + esc(money.fmt(v, { compact: true })) + '</span>').join("") + '</div>' +
      '<div class="trend-canvas">' +
        '<svg class="trend-svg" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" role="img" aria-label="Net worth from ' + esc(first.label) + ' ' + esc(money.fmt(first.value)) + ' to ' + esc(last.label) + ' ' + esc(money.fmt(last.value)) + '">' +
          '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--cat-emerald)" stop-opacity=".22"/><stop offset="1" stop-color="var(--cat-emerald)" stop-opacity="0"/></linearGradient></defs>' +
          '<path d="' + area + '" fill="url(#' + id + ')"/>' +
          '<path d="' + line + '" fill="none" stroke="var(--cat-emerald)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' +
        '</svg>' +
        '<div class="trend-labels" aria-hidden="true">' + points.map((p) => '<span>' + esc(p.label) + '</span>').join("") + '</div>' +
      '</div>' +
      '<div class="trend-summary"><span>Since you started</span><strong class="' + (change < 0 ? "negative" : "positive") + '">' + esc((change >= 0 ? "+" : "") + money.fmt(change, { compact: true })) + '</strong></div>' +
    '</div>';
  }

  function emptyChart(title, message) {
    return '<div class="empty is-tight"><span class="empty-icon" aria-hidden="true"><svg class="icon"><use href="#i-chart"></use></svg></span><h3>' + esc(title) + '</h3><p>' + esc(message) + '</p></div>';
  }

  /* ---------- tooltip binding ---------- */
  let tipEl = null;
  let activeTrigger = null;

  function positionTip(trigger) {
    if (!tipEl) return;
    const rect = trigger.getBoundingClientRect();
    const pad = 8;
    tipEl.hidden = false;
    const tw = tipEl.offsetWidth;
    const th = tipEl.offsetHeight;
    let left = rect.left + rect.width / 2 - tw / 2;
    left = Math.max(pad, Math.min(left, window.innerWidth - tw - pad));
    let top = rect.top - th - 10;
    if (top < pad) top = rect.bottom + 10;
    top = Math.max(pad, Math.min(top, window.innerHeight - th - pad));
    tipEl.style.left = left + "px";
    tipEl.style.top = top + "px";
  }

  function showTip(trigger) {
    if (!tipEl) tipEl = document.getElementById("chart-tip");
    if (!tipEl || !trigger) return;
    activeTrigger = trigger;
    tipEl.textContent = "";
    const title = document.createElement("strong");
    title.textContent = trigger.getAttribute("data-tip-title") || "";
    const body = document.createElement("span");
    body.textContent = trigger.getAttribute("data-tip-body") || "";
    tipEl.appendChild(title);
    tipEl.appendChild(body);
    positionTip(trigger);
  }

  function hideTip() {
    if (tipEl) tipEl.hidden = true;
    activeTrigger = null;
  }

  function bindTooltips(rootEl) {
    if (!tipEl) tipEl = document.getElementById("chart-tip");
    if (!tipEl || !rootEl || rootEl.dataset.tipBound === "1") return;
    rootEl.dataset.tipBound = "1";
    rootEl.addEventListener("pointerover", (e) => {
      const trigger = e.target.closest("[data-tip-title]");
      if (!trigger || !rootEl.contains(trigger)) return;
      if (e.relatedTarget && trigger.contains(e.relatedTarget)) return;
      showTip(trigger);
    });
    rootEl.addEventListener("pointerout", (e) => {
      const trigger = e.target.closest("[data-tip-title]");
      if (!trigger) return;
      if (e.relatedTarget && trigger.contains(e.relatedTarget)) return;
      hideTip();
    });
    rootEl.addEventListener("focusin", (e) => {
      const trigger = e.target.closest("[data-tip-title]");
      if (trigger) showTip(trigger);
    });
    rootEl.addEventListener("focusout", (e) => {
      if (e.target.closest("[data-tip-title]")) hideTip();
    });
    window.addEventListener("scroll", hideTip, { passive: true });
    window.addEventListener("resize", hideTip, { passive: true });
  }

  charts.cashflowChart = cashflowChart;
  charts.donutChart = donutChart;
  charts.sparkline = sparkline;
  charts.trendChart = trendChart;
  charts.emptyChart = emptyChart;
  charts.bindTooltips = bindTooltips;
  charts.colors = COLORS;
  Dhan.charts = charts;
})(typeof window !== "undefined" ? window : globalThis);
