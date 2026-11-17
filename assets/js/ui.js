/* Dhan — shared UI primitives: icons, toasts, dialogs, money display,
   transaction rows, empty states, downloads and theme wiring. */
(function (root) {
  "use strict";

  const Dhan = root.Dhan = root.Dhan || {};
  const esc = Dhan.esc;
  const money = Dhan.money;
  const date = Dhan.date;
  const ui = {};

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  /* ---------- small markup helpers ---------- */
  function icon(name, extra) {
    return '<svg class="icon' + (extra ? " " + extra : "") + '" aria-hidden="true" focusable="false"><use href="#i-' + esc(name) + '"></use></svg>';
  }

  function initials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "D";
    return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join("");
  }

  function plural(n, one, many) {
    return Number(n) === 1 ? one : (many || one + "s");
  }

  function pctLabel(n, digits) {
    return (Number(n) || 0).toFixed(digits == null ? 0 : digits) + "%";
  }

  function cap(str) {
    const s = String(str || "");
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function truncate(str, n) {
    const s = String(str || "");
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  }

  function debit(paise) {
    return "−" + money.fmt(Math.abs(Number(paise) || 0));
  }

  function credit(paise) {
    return "+" + money.fmt(Math.abs(Number(paise) || 0));
  }

  function debounce(fn, wait) {
    let timer = null;
    return function () {
      const args = arguments, ctx = this;
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(ctx, args), wait);
    };
  }

  function timeAgo(iso) {
    if (!iso) return "";
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return "";
    const diff = Date.now() - then;
    if (diff < 45000) return "just now";
    const mins = Math.round(diff / 60000);
    if (mins < 60) return mins + " min ago";
    const hours = Math.round(mins / 60);
    if (hours < 24) return hours + " " + plural(hours, "hour") + " ago";
    const days = Math.round(hours / 24);
    if (days < 7) return days + " " + plural(days, "day") + " ago";
    return date.fmtDate(String(iso).slice(0, 10));
  }

  function dayLabel(iso) {
    const today = date.todayISO();
    if (iso === today) return "Today · " + date.fmtDate(iso, { weekday: "short" });
    if (iso === date.addDays(today, -1)) return "Yesterday · " + date.fmtDate(iso, { weekday: "short" });
    return date.fmtDay(iso);
  }

  /* ---------- toasts ---------- */
  function toast(message, type, ms) {
    const stack = $("#toasts");
    if (!stack) return;
    const el = document.createElement("div");
    el.className = "toast" + (type === "error" ? " is-error" : type === "success" ? " is-success" : "");
    el.innerHTML = icon(type === "error" ? "alert" : type === "success" ? "check" : "info") +
      "<span>" + esc(message) + "</span>";
    stack.appendChild(el);
    while (stack.children.length > 3) stack.firstElementChild.remove();
    const life = ms || (type === "error" ? 5600 : 3400);
    setTimeout(() => {
      el.classList.add("is-leaving");
      setTimeout(() => el.remove(), 260);
    }, life);
  }

  /* ---------- download / copy ---------- */
  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime || "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  async function copy(text) {
    const value = String(text == null ? "" : text);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch (e) {}
    try {
      const area = document.createElement("textarea");
      area.value = value;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch (e) { return false; }
  }

  /* ---------- theme ---------- */
  function resolveTheme(pref) {
    if (pref === "dark" || pref === "light") return pref;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme(pref) {
    const resolved = resolveTheme(pref);
    document.documentElement.dataset.theme = resolved;
    const label = $("#theme-label");
    if (label) label.textContent = resolved === "dark" ? "Dark" : "Light";
    $$('meta[name="theme-color"][media]').forEach((m) => m.remove());
    let meta = $('meta[name="theme-color"]:not([media])');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = resolved === "dark" ? "#0f1814" : "#f5f0e4";
    return resolved;
  }

  /* ---------- shell chrome ---------- */
  function setChrome(state) {
    const name = String((state.settings && state.settings.name) || "").trim();
    const label = name || "Your khata";
    const initial = name ? initials(name) : "D";
    const sideName = $("#side-name");
    if (sideName) sideName.textContent = label;
    ["#side-avatar", "#mobile-avatar"].forEach((sel) => {
      const el = $(sel);
      if (el) el.textContent = initial;
    });
    const sub = $(".profile-sub");
    if (sub) sub.textContent = "Only in this browser";
  }

  function setNav(route) {
    const map = { dashboard: "dashboard", activity: "activity", accounts: "accounts", plan: "plan", tax: "tax", reports: "reports", settings: "settings" };
    const navKey = map[route] || "dashboard";
    $$("[data-nav]").forEach((el) => {
      const key = el.getAttribute("data-nav");
      const active = key === navKey || (key === "more" && ["accounts", "tax", "reports", "settings"].includes(navKey));
      el.classList.toggle("is-active", active);
      if (el.tagName === "A") {
        if (active) el.setAttribute("aria-current", "page");
        else el.removeAttribute("aria-current");
      }
    });
  }

  /* ---------- dialogs ---------- */
  let modalSeq = 0;

  function refreshModalBodyClass() {
    const any = document.querySelector("dialog[open]");
    document.body.classList.toggle("modal-open", Boolean(any));
  }

  function openModal(opts) {
    const options = opts || {};
    const layer = $("#modals");
    if (!layer) return null;
    const seq = "dhan-modal-" + (++modalSeq);
    const formId = seq + "-form";
    const dlg = document.createElement("dialog");
    dlg.className = "modal" +
      (options.size === "lg" ? " is-lg" : options.size === "sm" ? " is-sm" : "") +
      (options.className ? " " + options.className : "");
    dlg.setAttribute("aria-labelledby", seq + "-title");

    const head = '<div class="modal-head">' +
      '<div class="modal-head-copy">' +
        (options.eyebrow ? '<div class="mono">' + esc(options.eyebrow) + "</div>" : "") +
        '<h2 id="' + seq + '-title">' + (options.title || "") + "</h2>" +
        (options.subtitle ? "<p>" + options.subtitle + "</p>" : "") +
      "</div>" +
      (options.dismissible === false ? "" : '<button class="icon-btn is-plain modal-close" type="button" data-modal-close aria-label="Close">' + icon("close") + "</button>") +
    "</div>";

    const footer = options.footer === false ? "" :
      '<div class="modal-foot">' + (options.footer ||
        '<button type="button" class="btn btn-secondary" data-modal-close>' + esc(options.cancelLabel || "Cancel") + "</button>" +
        '<button type="submit" class="btn btn-primary">' + esc(options.submitLabel || "Save") + "</button>") + "</div>";

    const form = document.createElement("form");
    form.id = formId;
    form.noValidate = true;
    form.innerHTML = head + '<div class="modal-body">' + (options.body || "") + "</div>" + footer;
    dlg.appendChild(form);
    layer.appendChild(dlg);

    let closed = false;
    function finish(reason) {
      if (closed) return;
      closed = true;
      try { dlg.close(); } catch (e) {}
      dlg.remove();
      refreshModalBodyClass();
      if (typeof options.onClose === "function") options.onClose(reason);
    }
    function requestClose(reason) {
      if (closed) return;
      if (typeof options.onBeforeClose === "function" && options.onBeforeClose(reason) === false) return;
      finish(reason);
    }
    dlg._close = requestClose;

    try { dlg.showModal(); } catch (e) {
      dlg.setAttribute("open", "");
    }
    document.body.classList.add("modal-open");

    dlg.addEventListener("cancel", (e) => {
      e.preventDefault();
      if (options.dismissible !== false) requestClose("escape");
    });
    dlg.addEventListener("close", () => {
      if (!closed) {
        closed = true;
        dlg.remove();
        refreshModalBodyClass();
        if (typeof options.onClose === "function") options.onClose("closed");
      }
    });
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg && options.backdropClose) requestClose("backdrop");
    });
    $$("[data-modal-close]", dlg).forEach((btn) => {
      btn.addEventListener("click", () => requestClose("button"));
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (typeof options.onSubmit !== "function") {
        requestClose("submit");
        return;
      }
      try {
        const result = await options.onSubmit(form, requestClose, dlg, e);
        if (result !== false) requestClose("submit");
      } catch (err) {
        toast(err && err.message ? err.message : "Something went wrong. Nothing was saved.", "error");
      }
    });

    if (typeof options.onMount === "function") {
      try { options.onMount(form, requestClose, dlg); } catch (err) {
        toast("This window could not finish loading.", "error");
      }
    }

    setTimeout(() => {
      if (!dlg.isConnected) return;
      const target = $("[data-autofocus]", dlg) ||
        $(".amount-wrap input", dlg) ||
        $('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])', dlg) ||
        $(".modal-foot .btn-primary", dlg) ||
        dlg;
      if (target && target.focus) target.focus({ preventScroll: false });
    }, 40);

    return dlg;
  }

  function closeAllModals() {
    $$("#modals dialog[open]").reverse().forEach((dlg) => {
      if (typeof dlg._close === "function") dlg._close("all");
      else { try { dlg.close(); } catch (e) {} dlg.remove(); }
    });
    refreshModalBodyClass();
  }

  function confirm(opts) {
    const options = opts || {};
    return new Promise((resolve) => {
      let settled = false;
      const done = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const body = '<div class="modal-copy">' + (options.message || "") + "</div>" +
        (options.requireText ?
          '<div class="field confirm-field"><label class="field-label" for="confirm-text">Type <strong>' + esc(options.requireText) + "</strong> to continue</label>" +
          '<input class="input" id="confirm-text" name="confirmText" autocomplete="off" spellcheck="false" data-autofocus></div>' : "");
      openModal({
        title: options.title || "Are you sure?",
        size: "sm",
        body: body,
        dismissible: true,
        backdropClose: true,
        footer: '<button type="button" class="btn btn-secondary" data-modal-close>' + esc(options.cancelLabel || "Cancel") + "</button>" +
          '<button type="submit" class="btn ' + (options.danger ? "btn-danger" : "btn-primary") + '">' + esc(options.confirmLabel || "Confirm") + "</button>",
        onSubmit: (form) => {
          if (options.requireText) {
            const input = form.elements.confirmText;
            if (!input || input.value.trim() !== options.requireText) {
              fieldError(input, 'Type "' + options.requireText + '" exactly to confirm.');
              return false;
            }
          }
          done(true);
          return true;
        },
        onClose: () => done(false)
      });
    });
  }

  /* ---------- form errors ---------- */
  function clearErrors(form) {
    if (!form) return;
    $$(".field-error", form).forEach((el) => el.remove());
    $$('[aria-invalid="true"]', form).forEach((el) => el.removeAttribute("aria-invalid"));
  }

  function fieldError(input, message) {
    if (!input) return;
    input.setAttribute("aria-invalid", "true");
    const field = input.closest(".field") || input.closest(".form-section") || input.parentElement;
    if (!field) return;
    $$(".field-error", field).forEach((el) => el.remove());
    const err = document.createElement("div");
    err.className = "field-error";
    err.innerHTML = icon("alert") + "<span>" + esc(message) + "</span>";
    const hint = $(".field-hint", field);
    if (hint) hint.parentNode.insertBefore(err, hint);
    else field.appendChild(err);
    input.addEventListener("input", () => {
      input.removeAttribute("aria-invalid");
      const node = err.parentNode ? err : null;
      if (node) node.remove();
    }, { once: true });
  }

  function readAmount(form, name) {
    const input = form.elements[name];
    if (!input) return null;
    return money.parse(input.value);
  }

  /* ---------- transaction markup ---------- */
  function txRow(state, tx) {
    const transfer = tx.type === "transfer";
    const cat = transfer ? null : Dhan.categoryById(state, tx.categoryId);
    const color = transfer ? "var(--info)" : "var(--cat-" + (cat ? cat.color : "slate") + ")";
    const iconName = transfer ? "swap" : (cat ? cat.icon : "dots");
    const title = transfer ? "Transfer" : (cat ? cat.name : "Uncategorised");
    let sub;
    if (transfer) {
      sub = Dhan.accountName(state, tx.accountId) + " → " + Dhan.accountName(state, tx.toAccountId);
    } else {
      sub = Dhan.accountName(state, tx.accountId);
      if (tx.note) sub += " · " + tx.note;
    }
    const amount = transfer ? money.fmt(tx.amountPaise) :
      tx.type === "income" ? credit(tx.amountPaise) : debit(tx.amountPaise);
    const tiny = transfer ? "Moved" : tx.type === "income" ? "In" : "Out";
    const aria = "Edit " + title + ", " + money.fmt(tx.amountPaise) + ", " + date.fmtDate(tx.date);
    return '<button type="button" class="tx-item" data-action="edit-tx" data-id="' + esc(tx.id) + '" aria-label="' + esc(aria) + '" style="--cat-color:' + color + '">' +
      '<span class="tx-icon" aria-hidden="true">' + icon(iconName) + "</span>" +
      '<span class="tx-main"><span class="tx-title"><span>' + esc(title) + "</span></span>" +
      '<span class="tx-note">' + esc(sub) + "</span></span>" +
      '<span class="tx-amount is-' + esc(tx.type) + '">' + amount + "<small>" + tiny + "</small></span>" +
    "</button>";
  }

  function txGroups(state, txs, opts) {
    const options = opts || {};
    if (!txs.length) return "";
    const sorted = Dhan.sortBy(txs, (t) => t.date + " " + (t.createdAt || ""), "desc");
    const groups = new Map();
    for (const tx of sorted) {
      if (!groups.has(tx.date)) groups.set(tx.date, []);
      groups.get(tx.date).push(tx);
    }
    return Array.from(groups.entries()).map(([day, list]) => {
      const income = Dhan.sum(list.filter((t) => t.type === "income"), (t) => t.amountPaise);
      const expense = Dhan.sum(list.filter((t) => t.type === "expense"), (t) => t.amountPaise);
      const net = income - expense;
      const netLabel = net > 0 ? "+" + money.fmt(net) : net < 0 ? "−" + money.fmt(-net) : "No net change";
      const head = options.showDayTotals === false ? "" :
        '<div class="tx-day-head"><span class="date">' + esc(dayLabel(day)) + '</span><span class="total ' +
        (net > 0 ? "positive" : net < 0 ? "negative" : "") + '">' + esc(netLabel) + "</span></div>";
      return '<div class="tx-day">' + head + list.map((tx) => txRow(state, tx)).join("") + "</div>";
    }).join("");
  }

  /* ---------- empty state / banners ---------- */
  function empty(opts) {
    const o = opts || {};
    const actions = (o.actions || []).map((a) => {
      const cls = "btn " + (a.variant || "btn-secondary");
      const inner = (a.icon ? icon(a.icon) : "") + esc(a.label || "Open");
      if (a.href) return '<a class="' + cls + '" href="' + esc(a.href) + '">' + inner + "</a>";
      return '<button type="button" class="' + cls + '"' +
        (a.action ? ' data-action="' + esc(a.action) + '"' : "") +
        (a.attrs ? " " + a.attrs : "") + ">" + inner + "</button>";
    }).join("");
    return '<div class="empty' + (o.tight ? " is-tight" : "") + '">' +
      '<span class="empty-icon" aria-hidden="true">' + icon(o.icon || "info") + "</span>" +
      "<h3>" + esc(o.title || "Nothing here yet") + "</h3>" +
      "<p>" + esc(o.message || "") + "</p>" +
      (actions ? '<div class="empty-actions">' + actions + "</div>" : "") +
    "</div>";
  }

  function banner(message, type, iconName) {
    return '<div class="banner' + (type === "danger" ? " is-danger" : type === "info" ? " is-info" : "") + '">' +
      icon(iconName || (type === "danger" ? "alert" : "info")) +
      "<div>" + message + "</div></div>";
  }

  function callout(message, iconName) {
    return '<div class="callout">' + icon(iconName || "info") + '<div class="grow">' + message + "</div></div>";
  }

  /* ---------- form option builders ---------- */
  function accountOptions(state, selected, opts) {
    const o = opts || {};
    let list = state.accounts.filter((a) => o.includeArchived || !a.archived);
    if (selected && !list.some((a) => a.id === selected)) {
      const archived = state.accounts.find((a) => a.id === selected);
      if (archived) list = list.concat([archived]);
    }
    return list.map((a) => '<option value="' + esc(a.id) + '"' + (a.id === selected ? " selected" : "") + ">" +
      esc(a.name) + (a.archived ? " (archived)" : "") + "</option>").join("");
  }

  function categoryOptions(state, selected, opts) {
    const o = opts || {};
    const groups = ["expense", "income"];
    let html = o.allowAll ? '<option value="all">All categories</option>' : "";
    for (const type of groups) {
      const list = state.categories.filter((c) => (!o.allowArchived ? !c.archived : true) && c.type === type);
      if (!list.length) continue;
      html += '<optgroup label="' + (type === "income" ? "Income" : "Expense") + '">' +
        list.map((c) => '<option value="' + esc(c.id) + '"' + (c.id === selected ? " selected" : "") + ">" + esc(c.name) + "</option>").join("") +
        "</optgroup>";
    }
    return html;
  }

  function fyOptionsHtml(selected, count) {
    const list = Dhan.date.fyOptions(count || 5);
    if (selected && !list.includes(selected)) list.unshift(selected);
    return list.map((fy) => '<option value="' + esc(fy) + '"' + (fy === selected ? " selected" : "") + ">FY " + esc(fy.replace("-", "–")) + "</option>").join("");
  }

  function monthOptions(state, fy, selected) {
    const months = Dhan.date.fyMonths(fy);
    return '<option value="all">All months</option>' + months.slice().reverse().map((m) =>
      '<option value="' + esc(m) + '"' + (m === selected ? " selected" : "") + ">" + esc(date.fmtMonth(m)) + "</option>"
    ).join("");
  }

  function categoryPicker(state, type, selected) {
    const list = Dhan.activeCategories(state, type).slice();
    if (selected && !list.some((cat) => cat.id === selected)) {
      const archived = state.categories.find((cat) => cat.id === selected && cat.type === type);
      if (archived) list.push(archived);
    }
    if (!list.length) return '<div class="manage-empty">No categories yet. Add one in Settings.</div>';
    return list.map((cat) => {
      const checked = cat.id === selected || (!selected && cat === list[0]);
      return '<label class="cat-opt" style="--cat-color:var(--cat-' + esc(cat.color) + ')">' +
        '<input type="radio" name="categoryId" value="' + esc(cat.id) + '"' + (checked ? " checked" : "") + ">" +
        "<span>" + icon(cat.icon) + esc(cat.name) + "</span></label>";
    }).join("");
  }

  function goalIconPicker(selected) {
    return Dhan.GOAL_ICONS.map((g) =>
      '<label class="cat-opt" style="--cat-color:var(--gold-ink)">' +
        '<input type="radio" name="icon" value="' + esc(g.id) + '"' + (g.id === selected ? " checked" : "") + ">" +
        "<span>" + icon(g.id) + esc(g.label) + "</span></label>"
    ).join("");
  }

  /* ---------- navigation helpers ---------- */
  function go(hash) {
    if (location.hash === hash) {
      document.dispatchEvent(new CustomEvent("dhan:navigate"));
    } else {
      location.hash = hash;
    }
  }

  function setTitle(title) {
    document.title = title ? title + " · Dhan" : "Dhan — money, clearly.";
  }

  ui.$ = $;
  ui.$$ = $$;
  ui.icon = icon;
  ui.initials = initials;
  ui.plural = plural;
  ui.pctLabel = pctLabel;
  ui.cap = cap;
  ui.truncate = truncate;
  ui.debit = debit;
  ui.credit = credit;
  ui.debounce = debounce;
  ui.timeAgo = timeAgo;
  ui.dayLabel = dayLabel;
  ui.toast = toast;
  ui.download = download;
  ui.copy = copy;
  ui.resolveTheme = resolveTheme;
  ui.applyTheme = applyTheme;
  ui.setChrome = setChrome;
  ui.setNav = setNav;
  ui.openModal = openModal;
  ui.closeAllModals = closeAllModals;
  ui.confirm = confirm;
  ui.clearErrors = clearErrors;
  ui.fieldError = fieldError;
  ui.readAmount = readAmount;
  ui.txRow = txRow;
  ui.txGroups = txGroups;
  ui.empty = empty;
  ui.banner = banner;
  ui.callout = callout;
  ui.accountOptions = accountOptions;
  ui.categoryOptions = categoryOptions;
  ui.fyOptionsHtml = fyOptionsHtml;
  ui.monthOptions = monthOptions;
  ui.categoryPicker = categoryPicker;
  ui.goalIconPicker = goalIconPicker;
  ui.go = go;
  ui.setTitle = setTitle;
  Dhan.ui = ui;
})(typeof window !== "undefined" ? window : globalThis);
