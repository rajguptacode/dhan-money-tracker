/* Dhan — settings: your name, your categories, your backup, your own sheet. */
(function (root) {
  "use strict";
  const Dhan = root.Dhan = root.Dhan || {};
  const ui = Dhan.ui;
  const money = Dhan.money;
  const date = Dhan.date;

  let bound = false;

  function themeChoice(pref) {
    const options = [
      { id: "light", label: "Light", icon: "sun" },
      { id: "dark", label: "Dark", icon: "moon" },
      { id: "system", label: "System", icon: "spark" }
    ];
    return '<div class="theme-choice" role="group" aria-label="Theme">' + options.map((o) =>
      '<label><input type="radio" name="theme" value="' + o.id + '"' + (pref === o.id ? " checked" : "") + ' data-theme-pref>' +
        "<span>" + ui.icon(o.icon) + o.label + "</span></label>"
    ).join("") + "</div>";
  }

  function manageRow(state, category, usageById) {
    const count = usageById.get(category.id) || 0;
    const meta = category.type === "income" ? Dhan.taxBucketLabel(category.bucket) : category.archived ? "Archived" : "Expense category";
    return '<div class="manage-row">' +
      '<span class="manage-icon" style="--cat-color:var(--cat-' + esc(category.color) + ')" aria-hidden="true">' + ui.icon(category.icon) + "</span>" +
      '<span class="manage-main"><strong>' + esc(category.name) + (category.archived ? ' <span class="badge">Archived</span>' : "") + "</strong>" +
        "<span>" + count + " " + ui.plural(count, "entry", "entries") + " · " + esc(meta) + "</span></span>" +
      '<span class="manage-actions"><button type="button" class="icon-btn" data-action="edit-category" data-id="' + esc(category.id) + '" aria-label="Edit ' + esc(category.name) + '">' + ui.icon("pencil") + "</button></span>" +
    "</div>";
  }

  function categoryColumn(state, type, usageById) {
    const list = Dhan.sortBy(state.categories.filter((c) => c.type === type), (c) => (c.archived ? "1" : "0") + c.name, "asc");
    return "<div>" +
      '<div class="settings-subhead">' + (type === "income" ? "Income categories" : "Expense categories") + "</div>" +
      '<div class="manage-list">' + (list.length ? list.map((c) => manageRow(state, c, usageById)).join("") : '<div class="manage-empty">None yet.</div>') + "</div>" +
      '<div class="manage-tools"><button type="button" class="btn btn-secondary btn-sm" data-action="add-category" data-kind="' + type + '">' + ui.icon("plus") + "Add " + (type === "income" ? "income" : "expense") + "</button>" +
      '<span class="field-hint">Archive instead of deleting — old entries keep their history.</span></div>' +
    "</div>";
  }

  function detailsSection(state) {
    return '<section class="settings-section">' +
      '<div class="settings-section-head"><h2>Your details</h2><p>A name for the sidebar and a savings target for the dashboard. Nothing here is uploaded.</p></div>' +
      '<form class="settings-form" data-form="profile">' +
        '<div class="field-row">' +
          '<div class="field"><label class="field-label" for="settings-name">What should we call you?</label>' +
            '<input class="input" id="settings-name" name="name" type="text" maxlength="60" placeholder="Your first name" value="' + esc(state.settings.name || "") + '"></div>' +
          '<div class="field"><label class="field-label" for="settings-savings">Savings target</label>' +
            '<div class="input-wrap"><input class="input num" id="settings-savings" name="savingsTarget" type="number" min="0" max="90" step="1" value="' + esc(String(state.settings.savingsTargetPct == null ? 20 : state.settings.savingsTargetPct)) + '"><span class="input-suffix">% of income</span></div></div>' +
        "</div>" +
        '<div class="settings-row"><div class="settings-row-copy"><strong>Appearance</strong><span>Light, dark, or follow this device.</span></div>' + themeChoice(state.settings.theme || "system") + "</div>" +
        '<div class="row" style="justify-content:flex-end"><button type="submit" class="btn btn-primary">Save details</button></div>' +
      "</form>" +
    "</section>";
  }

  function categorySection(state) {
    const usageById = new Map();
    for (const tx of state.transactions) {
      if (!tx.categoryId) continue;
      usageById.set(tx.categoryId, (usageById.get(tx.categoryId) || 0) + 1);
    }
    return '<section class="settings-section">' +
      '<div class="settings-section-head"><h2>Categories</h2><p>Your khata, your vocabulary. Income categories also decide which ITR head an entry lands under.</p></div>' +
      '<div class="settings-two-col">' + categoryColumn(state, "expense", usageById) + categoryColumn(state, "income", usageById) + "</div>" +
    "</section>";
  }

  function syncStatus(state) {
    const configured = Boolean(state.settings.googleSheetUrl);
    const last = state.settings.lastSyncAt;
    const statusClass = configured ? (last ? " is-on" : "") : "";
    const title = configured ? (last ? "Connected to your Google Sheet" : "Bridge configured, not synced yet") : "Not connected";
    const sub = configured
      ? (last ? "Last push " + esc(ui.timeAgo(last)) + " · " + esc(date.fmtDate(String(last).slice(0, 10))) : "Press “Push to Sheet” to create or update the spreadsheet in your Drive.")
      : "Your entries exist only in this browser. Connect your own sheet for a second copy.";
    return '<div class="sync-status' + statusClass + '"><span class="status-dot" aria-hidden="true"></span><div><strong>' + title + "</strong> · " + sub + "</div></div>";
  }

  function sheetsSection(state) {
    const configured = Boolean(state.settings.googleSheetUrl);
    const token = state.settings.googleSheetToken || "";
    return '<section class="settings-section" id="google-sheets">' +
      '<div class="settings-section-head"><h2>Google Sheets</h2><p>An optional bridge you own: a small Apps Script web app writes your khata into a spreadsheet in your own Drive. No Google login, no Dhan server, no third party.</p></div>' +
      '<div class="sync-grid">' +
        syncStatus(state) +
        '<form class="settings-form" data-form="sheet-config">' +
          '<div class="field"><label class="field-label" for="sheet-url">Apps Script Web App URL</label>' +
            '<input class="input" id="sheet-url" name="url" type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(state.settings.googleSheetUrl || "") + '">' +
            '<span class="field-hint">Must end in <code>/exec</code>. The spreadsheet is created automatically in your Google Drive the first time you push.</span></div>' +
          '<div class="field"><label class="field-label" for="sheet-token">Sync token</label>' +
            '<div class="token-field"><input class="input" id="sheet-token" name="token" type="password" autocomplete="off" spellcheck="false" placeholder="Same token as the script" value="' + esc(token) + '">' +
              '<button type="button" class="btn btn-secondary secret-toggle" data-action="generate-token">New</button>' +
              '<button type="button" class="icon-btn secret-toggle" data-action="toggle-token" aria-label="Show or hide sync token">' + ui.icon("eye") + "</button></div>" +
            '<span class="field-hint">A shared secret, not your Google password. Use any long phrase, exactly the same in the script and here.</span></div>' +
          '<div class="sync-actions">' +
            '<button type="submit" class="btn btn-primary">Save connection</button>' +
            '<button type="button" class="btn btn-secondary" data-action="sheet-test">' + ui.icon("bolt") + "Test</button>" +
            '<button type="button" class="btn btn-secondary" data-action="sheet-push"' + (configured ? "" : " disabled") + ">" + ui.icon("upload") + "Push to Sheet</button>" +
            '<button type="button" class="btn btn-secondary" data-action="sheet-pull"' + (configured ? "" : " disabled") + ">" + ui.icon("download") + "Pull from Sheet</button>" +
          "</div>" +
        "</form>" +
        '<details class="sync-help">' +
          '<summary>' + ui.icon("chevron-right") + "One-time setup, about three minutes</summary>" +
          '<div class="sync-help-body">' +
            "<ol>" +
              '<li>Open <a href="https://script.new" target="_blank" rel="noopener">script.new</a> and create a new Apps Script project. Give it a name like “Dhan bridge”.</li>' +
              "<li>Copy the starter code below and paste it over the editor's contents. Replace the token with the one in the field above — the copy button does that for you.</li>" +
              '<li>Click <strong>Deploy → New deployment → Web app</strong>. Set <strong>Execute as: Me</strong> and <strong>Who has access: Anyone</strong>, then deploy and authorise it.</li>' +
              "<li>Copy the Web App URL (it ends in <code>/exec</code>), paste it above with the same token, save and press <strong>Test</strong>.</li>" +
            "</ol>" +
            '<div class="sync-actions" style="margin-top:12px">' +
              '<button type="button" class="btn btn-secondary btn-sm" data-action="copy-apps-script">' + ui.icon("copy") + "Copy starter script</button>" +
              '<a class="btn btn-secondary btn-sm" href="apps-script/Code.gs" download="Code.gs">' + ui.icon("download") + "Download Code.gs</a>" +
              '<a class="btn btn-secondary btn-sm" href="https://script.new" target="_blank" rel="noopener">' + ui.icon("external") + "Open script.new</a>" +
            "</div>" +
            ui.callout("The sheet is a readable copy — transactions, accounts, goals, budgets and categories each get a tab, plus a hidden state block for exact restore. Treat the URL and token like a password: anyone with both can read or replace the sheet.", "lock") +
            '<p class="settings-inline-note">If Google shows an authorisation warning, choose the account you want, click Advanced → Go to Dhan bridge, and allow it. The script only touches the spreadsheet it creates.</p>' +
          "</div>" +
        "</details>" +
      "</div>" +
    "</section>";
  }

  function backupSection(state) {
    const snapshots = Dhan.store.snapshots();
    return '<section class="settings-section">' +
      '<div class="settings-section-head"><h2>Backup &amp; storage</h2><p>Local storage is reliable, but it is still one browser on one device. A JSON backup is your safety net.</p></div>' +
      '<div class="settings-row"><div class="settings-row-copy"><strong>Export everything</strong><span>One JSON file with entries, accounts, goals, budgets, tax settings and categories.</span></div>' +
        '<div class="settings-row-action"><button type="button" class="btn btn-secondary" data-action="backup-export">' + ui.icon("download") + "Download backup</button></div></div>" +
      '<div class="settings-row"><div class="settings-row-copy"><strong>Import a backup</strong><span>Replaces what is in this browser. A snapshot is taken first.</span></div>' +
        '<div class="settings-row-action"><button type="button" class="btn btn-secondary" data-action="backup-import">' + ui.icon("upload") + "Choose file</button>" +
        '<input type="file" id="backup-file" accept=".json,application/json" hidden></div></div>' +
      '<div class="settings-row"><div class="settings-row-copy"><strong>Storage used</strong><span id="storage-text">Checking this browser…</span></div>' +
        '<div class="settings-row-action"><button type="button" class="btn btn-secondary btn-sm" data-action="persist-storage">' + ui.icon("shield") + "Ask browser to keep data</button></div></div>" +
      '<div class="storage-bar" aria-hidden="true"><span id="storage-fill" style="width:2%"></span></div>' +
      '<div class="settings-row"><div class="settings-row-copy"><strong>Snapshots</strong><span>Up to four automatic or manual copies, kept in this browser.</span></div>' +
        '<div class="settings-row-action"><button type="button" class="btn btn-secondary btn-sm" data-action="snapshot-take">' + ui.icon("copy") + "Take snapshot</button></div></div>" +
      (snapshots.length
        ? '<div class="snapshot-list">' + snapshots.map((s) =>
            '<div class="snapshot-row"><div><strong>' + esc(s.reason) + "</strong><br><span>" + esc(date.fmtDate(String(s.at).slice(0, 10))) + " · " + esc(ui.timeAgo(s.at)) + "</span></div>" +
              '<div class="row gap-2"><button type="button" class="btn btn-secondary btn-sm" data-action="snapshot-restore" data-id="' + esc(s.id) + '">Restore</button>' +
              '<button type="button" class="icon-btn" data-action="snapshot-delete" data-id="' + esc(s.id) + '" aria-label="Delete snapshot">' + ui.icon("trash") + "</button></div></div>"
          ).join("") + "</div>"
        : '<div class="snapshot-row"><span>No snapshots yet. One is taken automatically before destructive changes.</span></div>') +
      '<div class="settings-inline-note">Clearing your browser\'s site data deletes Dhan\'s copy. Export a backup or push to your Google Sheet before you do that. Your JSON backup never leaves your device unless you move the file, and it deliberately leaves out your Apps Script URL, sync token and last-sync time.</div>' +
    "</section>";
  }

  function dangerSection(state) {
    return '<section class="settings-section danger-zone">' +
      '<div class="settings-section-head"><h2>Start over</h2><p>Erase every entry, account, goal and setting from the active khata. Snapshots stay available below, so a backup or snapshot first is still the safe move.</p></div>' +
      '<div class="settings-row"><div class="settings-row-copy"><strong>Reset Dhan completely</strong><span>' + state.transactions.length + " " + ui.plural(state.transactions.length, "entry", "entries") + " · " +
        state.accounts.length + " " + ui.plural(state.accounts.length, "account") + " · " + state.goals.length + " " + ui.plural(state.goals.length, "goal") + " will be erased from local storage.</span></div>" +
        '<div class="settings-row-action"><button type="button" class="btn btn-danger" data-action="reset-all">' + ui.icon("trash") + "Erase this browser's khata</button></div></div>" +
    "</section>";
  }

  function aboutSection(state) {
    const version = "1.0.0";
    return '<section class="settings-section">' +
      '<div class="settings-section-head"><h2>About Dhan</h2><p>A private, local-first khata built for Indian money — salary, UPI, bank interest, goals and future ITR paperwork.</p></div>' +
      '<div class="settings-row"><div class="settings-row-copy"><strong>Install as an app</strong><span>Add Dhan to your home screen. It opens offline from this browser.</span></div>' +
        '<div class="settings-row-action"><button type="button" class="btn btn-secondary" data-action="install-app">' + ui.icon("smartphone") + "Install Dhan</button></div></div>" +
      '<div class="settings-row"><div class="settings-row-copy"><strong>Privacy</strong><span>No account, no analytics, no ads. Data stays in this browser unless you connect and push to your own Google Sheet.</span></div>' +
        '<span class="badge is-positive">' + ui.icon("lock") + "Local first</span></div>" +
      '<div class="settings-row"><div class="settings-row-copy"><strong>Tax estimates</strong><span>Slab rules for FY 2024–25, 2025–26 and assumed 2026–27. An estimate only, not tax advice.</span></div>' +
        '<a class="link-arrow" href="#/tax">Open Tax &amp; ITR ' + ui.icon("arrow-right") + "</a></div>" +
      '<div class="about-links">' +
        '<a class="btn btn-secondary btn-sm" href="https://github.com/rajguptacode/dhan-money-tracker" target="_blank" rel="noopener">' + ui.icon("external") + "Source code</a>" +
        '<a class="btn btn-secondary btn-sm" href="https://github.com/rajguptacode/dhan-money-tracker#google-sheets" target="_blank" rel="noopener">' + ui.icon("sheet") + "Sheets guide</a>" +
        '<button type="button" class="btn btn-secondary btn-sm" data-action="copy-apps-script">' + ui.icon("copy") + "Copy bridge script</button>" +
      "</div>" +
      '<div class="settings-version">DHAN v' + version + " · SCHEMA " + (Dhan.SCHEMA || 1) + " · MADE FOR THIS BROWSER</div>" +
    "</section>";
  }

  function render(state) {
    return '<div class="page settings-wrap" data-view="settings">' +
      '<header class="page-head">' +
        '<div class="page-head-copy"><div class="eyebrow">SETTINGS · PRIVATE BY DEFAULT</div>' +
          "<h1>Make it yours.</h1>" +
          '<p class="lede">Your name, categories and backups. One optional bridge to your own Google Sheet. No login anywhere.</p></div>' +
      "</header>" +
      "<div>" +
        detailsSection(state) +
        categorySection(state) +
        sheetsSection(state) +
        backupSection(state) +
        dangerSection(state) +
        aboutSection(state) +
      "</div>" +
    "</div>";
  }

  function updateStorage() {
    const text = document.getElementById("storage-text");
    const fill = document.getElementById("storage-fill");
    if (!text || !fill) return;
    Dhan.store.estimate().then((est) => {
      if (!document.getElementById("storage-text")) return;
      if (!est || !est.usage) {
        text.textContent = "Browser storage is available. Exact usage is hidden by this browser.";
        return;
      }
      const kb = est.usage / 1024;
      const quotaMb = est.quota ? est.quota / (1024 * 1024) : 0;
      const pct = est.quota ? Math.min(100, (est.usage / est.quota) * 100) : 2;
      text.textContent = "About " + (kb < 1024 ? Math.round(kb) + " KB" : (kb / 1024).toFixed(1) + " MB") +
        (quotaMb ? " of roughly " + (quotaMb > 1024 ? (quotaMb / 1024).toFixed(1) + " GB" : Math.round(quotaMb) + " MB") + " available to this origin." : " used by Dhan on this origin.") +
        " Includes the offline cache, not only your khata.";
      fill.style.width = Math.max(2, pct).toFixed(1) + "%";
    }).catch(() => {
      if (document.getElementById("storage-text")) document.getElementById("storage-text").textContent = "Storage usage could not be read in this browser.";
    });
  }

  function init() {
    if (!bound) {
      bound = true;
      document.addEventListener("submit", (e) => {
        const form = e.target.closest && e.target.closest('[data-form="profile"]');
        if (!form) return;
        e.preventDefault();
        const state = Dhan.app.state;
        const name = String(form.elements.name.value || "").trim();
        const target = Number(form.elements.savingsTarget.value);
        if (!Number.isFinite(target) || target < 0 || target > 90) {
          ui.fieldError(form.elements.savingsTarget, "Choose a savings target between 0 and 90%.");
          return;
        }
        state.settings.name = name.slice(0, 60);
        state.settings.savingsTargetPct = Math.round(target);
        Dhan.app.commit("Profile updated");
        ui.toast("Details saved.", "success");
      });
      document.addEventListener("change", (e) => {
        const theme = e.target.closest && e.target.closest("[data-theme-pref]");
        if (!theme) return;
        Dhan.app.state.settings.theme = theme.value;
        if (Dhan.app.commit("Theme updated", { render: false })) ui.applyTheme(theme.value);
      });
    }
    updateStorage();
  }

  function esc(value) { return Dhan.esc(value); }

  Dhan.views = Dhan.views || {};
  Dhan.views.settings = { id: "settings", title: "Settings", render, init };
})(typeof window !== "undefined" ? window : globalThis);
