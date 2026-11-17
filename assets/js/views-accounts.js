/* Dhan — accounts: every balance in one place. */
(function (root) {
  "use strict";
  const Dhan = root.Dhan = root.Dhan || {};
  const ui = Dhan.ui;
  const money = Dhan.money;
  const date = Dhan.date;

  const view = { showArchived: false };
  let bound = false;

  function accountCard(state, account) {
    const meta = Dhan.accountType(account.type);
    const balance = Dhan.accountBalance(state, account.id);
    const isLiability = balance < 0;
    const sub = [account.institution, account.last4 ? "•••• " + account.last4 : ""].filter(Boolean).join(" · ");
    const badge = account.archived
      ? '<span class="badge">Archived</span>'
      : meta.liability
        ? '<span class="badge is-negative">' + esc(meta.label) + "</span>"
        : '<span class="badge">' + esc(meta.label) + "</span>";
    return '<button type="button" class="account-card" data-action="edit-account" data-id="' + esc(account.id) + '" aria-label="Edit ' + esc(account.name) + ", balance " + esc(money.fmt(balance)) + '">' +
      '<span class="account-card-top"><span class="account-icon" aria-hidden="true">' + ui.icon(meta.icon) + "</span>" + badge + "</span>" +
      '<span class="account-name">' + esc(account.name) + "</span>" +
      '<span class="account-bank">' + esc(sub || meta.label) + "</span>" +
      '<span class="account-balance' + (isLiability ? " is-liability" : "") + '">' + esc(money.fmt(balance)) +
        "<small>" + (isLiability ? "Owed" : "Available") + (account.archived ? " · Archived" : "") + "</small></span>" +
    "</button>";
  }

  function hero(state) {
    const active = Dhan.activeAccounts(state);
    const totals = Dhan.assetsAndLiabilities(state);
    const net = totals.net;
    const archived = state.accounts.filter((a) => a.archived);
    return '<section class="accounts-hero" aria-label="Net worth across active accounts">' +
      "<div>" +
        '<div class="net-label">NET WORTH · ACTIVE ACCOUNTS</div>' +
        '<div class="net-value' + (net < 0 ? " negative" : "") + '">' + esc(money.fmt(net)) + "</div>" +
        '<p class="field-hint" style="margin-top:7px">' + active.length + " " + ui.plural(active.length, "account") +
          " · assets minus what you owe" + (archived.length ? " · " + archived.length + " archived" : "") + "</p>" +
      "</div>" +
      '<div class="accounts-totals">' +
        '<div class="accounts-total"><div class="metric-label">ASSETS</div><div class="metric-value positive">' + esc(money.fmt(totals.assets, { compact: true })) + "</div></div>" +
        '<div class="accounts-total"><div class="metric-label">LIABILITIES</div><div class="metric-value negative">' + esc(money.fmt(totals.liabilities, { compact: true })) + "</div></div>" +
        '<div class="accounts-total"><div class="metric-label">ACCOUNTS</div><div class="metric-value">' + active.length + "</div></div>" +
      "</div>" +
    "</section>";
  }

  function render(state) {
    const active = Dhan.activeAccounts(state);
    const archived = state.accounts.filter((a) => a.archived);
    const activeCards = active.map((a) => accountCard(state, a)).join("");
    const addCard = '<button type="button" class="account-add" data-action="add-account">' + ui.icon("plus") + "Add another account</button>";
    const archivedBlock = archived.length
      ? (view.showArchived
        ? '<div class="archived-label">Archived accounts</div><div class="account-grid">' + archived.map((a) => accountCard(state, a)).join("") + "</div>"
        : '<div class="archived-toggle"><button type="button" class="btn btn-ghost btn-sm" data-accounts-action="toggle-archived">' +
          ui.icon("eye") + "Show " + archived.length + " archived " + ui.plural(archived.length, "account") + "</button></div>")
      : "";

    return '<div class="page" data-view="accounts">' +
      '<header class="page-head">' +
        '<div class="page-head-copy"><div class="eyebrow">ACCOUNTS · THIS DEVICE ONLY</div>' +
          "<h1>Where the money sits.</h1>" +
          '<p class="lede">Bank, cash, UPI, investments, cards and loans. One honest net worth, updated with every entry.</p></div>' +
        '<div class="head-actions">' +
          '<button type="button" class="btn btn-secondary" data-action="add-transfer">' + ui.icon("swap") + "Transfer</button>" +
          '<button type="button" class="btn btn-primary" data-action="add-account">' + ui.icon("plus") + "Add account</button>" +
        "</div>" +
      "</header>" +

      hero(state) +

      '<section class="section" aria-label="Your accounts">' +
        '<div class="section-head"><h2>Your accounts</h2><span class="mono">' + active.length + " ACTIVE</span></div>" +
        '<div class="account-grid">' + activeCards + addCard + "</div>" +
        archivedBlock +
      "</section>" +

      '<div class="accounts-note">' + ui.icon("info") +
        "<div>A credit card or loan balance is money you owe, so it counts against net worth. Opening balances are only a starting point — add entries for everything after that. Transfers between your own accounts never change net worth.</div>" +
      "</div>" +
    "</div>";
  }

  function init() {
    if (bound) return;
    bound = true;
    document.addEventListener("click", (e) => {
      const btn = e.target.closest && e.target.closest("[data-accounts-action]");
      if (!btn) return;
      if (btn.getAttribute("data-accounts-action") === "toggle-archived") {
        view.showArchived = !view.showArchived;
        Dhan.app.render();
      }
    });
  }

  function esc(value) { return Dhan.esc(value); }

  Dhan.views = Dhan.views || {};
  Dhan.views.accounts = { id: "accounts", title: "Accounts", render, init };
})(typeof window !== "undefined" ? window : globalThis);
