/* Dhan — boot, routing, delegated actions and optional Google Sheets sync. */
(function (root) {
  "use strict";
  const Dhan = root.Dhan = root.Dhan || {};
  const ui = Dhan.ui;
  const money = Dhan.money;
  const date = Dhan.date;

  const app = { state: null, view: "dashboard", route: "dashboard" };
  Dhan.app = app;

  let onboardingShown = false;
  let installPrompt = null;
  let sheetsBusy = false;
  let bound = false;

  const ROUTES = {
    dashboard: "dashboard",
    activity: "activity",
    accounts: "accounts",
    plan: "plan",
    goals: "plan",
    budgets: "plan",
    tax: "tax",
    reports: "reports",
    settings: "settings"
  };

  function parseRoute() {
    const raw = String(location.hash || "").replace(/^#\/?/, "");
    const key = raw.split("?")[0].split("/").filter(Boolean)[0] || "dashboard";
    return { key, view: ROUTES[key] || "dashboard" };
  }

  function render() {
    if (!app.state) return;
    const parsed = parseRoute();
    const view = Dhan.views[parsed.view] || Dhan.views.dashboard;
    if (!view) return;
    app.route = parsed.key;
    app.view = parsed.view;
    ui.setNav(parsed.view);
    ui.setTitle(view.title);
    ui.applyTheme((app.state.settings && app.state.settings.theme) || "system");
    ui.setChrome(app.state);
    const main = document.getElementById("main");
    if (!main) return;
    main.innerHTML = view.render(app.state);
    if (typeof view.init === "function") view.init();
    Dhan.charts.bindTooltips(main);
  }

  function commit(message, options) {
    const result = Dhan.store.save(app.state);
    if (!result.ok) {
      ui.toast(result.error || "Could not save to this browser.", "error", 7000);
      return false;
    }
    if (!options || options.render !== false) render();
    return true;
  }
  app.commit = commit;
  app.render = render;

  /* ---------- theme ---------- */
  function syncThemeInputs(pref) {
    document.querySelectorAll("[data-theme-pref]").forEach((input) => {
      input.checked = input.value === pref;
    });
  }

  function setTheme(pref) {
    app.state.settings.theme = pref;
    if (commit("Theme updated", { render: false })) {
      ui.applyTheme(pref);
      syncThemeInputs(pref);
    }
  }

  function toggleTheme() {
    const resolved = ui.resolveTheme(app.state.settings.theme);
    setTheme(resolved === "dark" ? "light" : "dark");
  }

  /* ---------- sheet helpers ---------- */
  function sheetConfig() {
    return {
      url: String(app.state.settings.googleSheetUrl || "").trim(),
      token: String(app.state.settings.googleSheetToken || "").trim()
    };
  }

  function formSheetConfig() {
    const form = document.querySelector('[data-form="sheet-config"]');
    if (!form) return null;
    return {
      url: String(form.elements.url.value || "").trim(),
      token: String(form.elements.token.value || "").trim()
    };
  }

  function checkSheetConfig(cfg, useFields) {
    const form = document.querySelector('[data-form="sheet-config"]');
    if (!cfg.url || !cfg.token) {
      if (useFields && form) {
        if (!cfg.url) ui.fieldError(form.elements.url, "Paste the Web App URL that ends in /exec.");
        if (!cfg.token) ui.fieldError(form.elements.token, "Use the same token that is inside the Apps Script.");
      }
      ui.toast("Both the Web App URL and the sync token are needed.", "error");
      return false;
    }
    if (!Dhan.isAppsScriptUrl(cfg.url)) {
      if (useFields && form) ui.fieldError(form.elements.url, "Use the deployed Web App URL from Apps Script — it ends in /exec.");
      ui.toast("That does not look like an Apps Script Web App URL.", "error");
      return false;
    }
    return true;
  }

  function sheetFormDirty() {
    const formCfg = formSheetConfig();
    if (!formCfg) return false;
    const saved = sheetConfig();
    return formCfg.url !== saved.url || formCfg.token !== saved.token;
  }

  function setSheetsBusy(busy) {
    sheetsBusy = busy;
    document.querySelectorAll('[data-action="sheet-test"],[data-action="sheet-push"],[data-action="sheet-pull"]').forEach((btn) => {
      if (busy) {
        btn.dataset.wasDisabled = btn.disabled ? "1" : "";
        btn.disabled = true;
      } else {
        btn.disabled = btn.dataset.wasDisabled === "1";
        delete btn.dataset.wasDisabled;
      }
    });
    const submit = document.querySelector('[data-form="sheet-config"] button[type="submit"]');
    if (submit) submit.disabled = busy;
  }

  async function sheetRequest(cfg, action, payload) {
    let response;
    try {
      response = await fetch(cfg.url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ token: cfg.token, action, payload: payload == null ? null : payload }),
        redirect: "follow",
        cache: "no-store"
      });
    } catch (err) {
      throw new Error("Could not reach your Google Sheet. Check the connection, the /exec URL and that the deployment is open to Anyone.");
    }
    if (!response.ok) throw new Error("Google returned HTTP " + response.status + ". Re-deploy the Apps Script and try again.");
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      throw new Error("Your Apps Script did not return valid JSON. Check that the latest Code.gs is deployed as a Web App.");
    }
    if (!data || data.ok === false) throw new Error((data && data.error) || "Your Apps Script refused the request.");
    return data;
  }

  function sheetPayload() {
    const copy = Dhan.clone(app.state);
    copy.settings.googleSheetUrl = "";
    copy.settings.googleSheetToken = "";
    copy.settings.lastSyncAt = null;
    return copy;
  }

  function preserveDeviceSettings(next) {
    next.settings.googleSheetUrl = app.state.settings.googleSheetUrl || "";
    next.settings.googleSheetToken = app.state.settings.googleSheetToken || "";
    next.settings.lastSyncAt = app.state.settings.lastSyncAt || null;
    next.settings.theme = app.state.settings.theme || "system";
    next.settings.onboarded = true;
    return next;
  }

  async function testSheet() {
    if (sheetsBusy) return;
    const cfg = formSheetConfig() || sheetConfig();
    if (!checkSheetConfig(cfg, Boolean(formSheetConfig()))) return;
    setSheetsBusy(true);
    try {
      const data = await sheetRequest(cfg, "ping");
      ui.toast(data.message || "Your Apps Script bridge replied. Save the connection and push when ready.", "success", 5000);
    } catch (err) {
      ui.toast(err.message || "The bridge test failed.", "error", 7000);
    } finally {
      setSheetsBusy(false);
    }
  }

  async function pushSheet() {
    if (sheetsBusy) return;
    if (sheetFormDirty()) {
      ui.toast("You have unsaved connection details. Press “Save connection” first.", "error");
      return;
    }
    const cfg = sheetConfig();
    if (!checkSheetConfig(cfg, false)) return;
    const ok = await ui.confirm({
      title: "Push this browser's khata?",
      message: "This replaces the copy in your Google Sheet with <strong>" + app.state.transactions.length + " entries</strong> from this browser. " +
        "Your sync URL and token are never written into the sheet.",
      confirmLabel: "Push to Sheet"
    });
    if (!ok) return;
    setSheetsBusy(true);
    try {
      const data = await sheetRequest(cfg, "push", sheetPayload());
      app.state.settings.lastSyncAt = data.syncedAt || date.nowISO();
      commit("Pushed to Google Sheet", { render: false });
      render();
      ui.toast("Pushed to your Google Sheet. A readable copy and a hidden restore block are ready.", "success", 5600);
    } catch (err) {
      ui.toast(err.message || "The push failed. Nothing local was changed.", "error", 7000);
    } finally {
      setSheetsBusy(false);
    }
  }

  async function pullSheet() {
    if (sheetsBusy) return;
    if (sheetFormDirty()) {
      ui.toast("You have unsaved connection details. Press “Save connection” first.", "error");
      return;
    }
    const cfg = sheetConfig();
    if (!checkSheetConfig(cfg, false)) return;
    setSheetsBusy(true);
    try {
      const data = await sheetRequest(cfg, "pull");
      let source = data.state;
      if (typeof source === "string") {
        try { source = JSON.parse(source); } catch (err) { throw new Error("The sheet's saved state could not be read."); }
      }
      if (!source) throw new Error("There is no saved state in this sheet yet. Push from Dhan first.");
      const next = Dhan.normalizeState(source);
      preserveDeviceSettings(next);
      const ok = await ui.confirm({
        title: "Replace this browser's khata?",
        message: "The sheet copy has <strong>" + next.transactions.length + " entries</strong> across " + next.accounts.length + " accounts. " +
          "This browser currently has " + app.state.transactions.length + " entries. A snapshot will be taken first, and your sheet connection will be kept.",
        confirmLabel: "Replace with sheet copy",
        cancelLabel: "Keep this browser",
        danger: true
      });
      if (!ok) {
        ui.toast("Nothing changed.", "info");
        return;
      }
      Dhan.store.snapshot(app.state, "Before pulling from Google Sheets");
      next.settings.lastSyncAt = data.syncedAt || date.nowISO();
      app.state = next;
      Dhan.store.save(app.state);
      render();
      ui.applyTheme(app.state.settings.theme);
      ui.toast("Pulled the sheet copy into this browser.", "success", 5000);
    } catch (err) {
      ui.toast(err.message || "The pull failed. Nothing local was changed.", "error", 7000);
    } finally {
      setSheetsBusy(false);
    }
  }

  function generateToken() {
    const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = new Uint8Array(28);
    if (root.crypto && root.crypto.getRandomValues) root.crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    const token = Array.from(bytes).map((b) => alphabet[b % alphabet.length]).join("");
    const input = document.getElementById("sheet-token");
    if (input) {
      input.value = token;
      input.type = "text";
    }
    ui.copy(token).then((copied) => {
      ui.toast(copied
        ? "Token generated and copied. Paste the same token into the Apps Script."
        : "Token generated. Copy it into the Apps Script, then save this connection.", "success", 6000);
    });
  }

  function toggleTokenVisibility() {
    const input = document.getElementById("sheet-token");
    if (!input) return;
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    const btn = document.querySelector('[data-action="toggle-token"]');
    if (btn) btn.innerHTML = ui.icon(show ? "eye-off" : "eye");
  }

  async function copyAppsScript() {
    const tokenInput = document.getElementById("sheet-token");
    const token = String((tokenInput && tokenInput.value) || (app.state.settings.googleSheetToken || "")).trim();
    if (!token) {
      ui.toast("Generate or type a sync token first, then copy the script.", "error");
      return;
    }
    try {
      const response = await fetch("apps-script/Code.gs", { cache: "no-store" });
      if (!response.ok) throw new Error("file");
      const source = await response.text();
      const patched = source.replace(/const TOKEN = "[^"]*";/, "const TOKEN = " + JSON.stringify(token) + ";");
      const copied = await ui.copy(patched);
      if (copied) ui.toast("Starter script copied with your token. Paste it into script.new and deploy.", "success", 6000);
      else throw new Error("copy");
    } catch (err) {
      ui.toast("The script file could not be copied here. Use the Download Code.gs button instead.", "error");
    }
  }

  /* ---------- backup / import / snapshots ---------- */
  function exportBackup() {
    const copy = Dhan.clone(app.state);
    copy.settings.googleSheetUrl = "";
    copy.settings.googleSheetToken = "";
    copy.settings.lastSyncAt = null;
    const payload = Dhan.backupPayload(copy);
    ui.download("dhan-backup-" + date.todayISO() + ".json", JSON.stringify(payload, null, 2), "application/json");
    ui.toast("Backup downloaded. Connection secrets are left out on purpose.", "success", 5200);
  }

  function importBackup() {
    const input = document.getElementById("backup-file");
    if (!input) return;
    input.value = "";
    input.click();
  }

  async function readBackupFile(file) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      ui.toast("That file is too large to be a Dhan backup.", "error");
      return;
    }
    try {
      const text = await file.text();
      const next = preserveDeviceSettings(Dhan.parseBackup(text));
      const ok = await ui.confirm({
        title: "Replace this browser's khata?",
        message: "The backup has <strong>" + next.transactions.length + " entries</strong> and " + next.accounts.length + " accounts. " +
          "This browser has " + app.state.transactions.length + " entries. A snapshot of the current khata is taken first.",
        confirmLabel: "Import backup",
        danger: true
      });
      if (!ok) return;
      Dhan.store.snapshot(app.state, "Before importing a backup");
      app.state = next;
      Dhan.store.save(app.state);
      render();
      ui.applyTheme(app.state.settings.theme);
      ui.toast("Backup imported. Reconnect Google Sheets if you use it on this device.", "success", 5600);
    } catch (err) {
      ui.toast(err.message || "That file could not be read as a Dhan backup.", "error", 6500);
    }
  }

  function takeSnapshot() {
    const item = Dhan.store.snapshot(app.state, "Manual snapshot");
    if (!item) {
      ui.toast("Could not save a snapshot in this browser.", "error");
      return;
    }
    render();
    ui.toast("Snapshot taken.", "success");
  }

  async function restoreSnapshot(id) {
    const item = Dhan.store.snapshots().find((s) => s.id === id);
    if (!item) {
      ui.toast("That snapshot no longer exists.", "error");
      render();
      return;
    }
    const ok = await ui.confirm({
      title: "Restore this snapshot?",
      message: "“" + Dhan.esc(item.reason) + "” from <strong>" + Dhan.esc(date.fmtDate(String(item.at).slice(0, 10))) + "</strong> will replace the khata in this browser. A fresh snapshot of the current state is kept first.",
      confirmLabel: "Restore snapshot",
      danger: true
    });
    if (!ok) return;
    try {
      const next = preserveDeviceSettings(Dhan.normalizeState(item.state));
      Dhan.store.snapshot(app.state, "Before restoring a snapshot");
      app.state = next;
      Dhan.store.save(app.state);
      render();
      ui.applyTheme(app.state.settings.theme);
      ui.toast("Snapshot restored.", "success");
    } catch (err) {
      ui.toast("That snapshot could not be restored.", "error");
    }
  }

  async function deleteSnapshot(id) {
    const item = Dhan.store.snapshots().find((s) => s.id === id);
    if (!item) return;
    const ok = await ui.confirm({
      title: "Delete this snapshot?",
      message: "“" + Dhan.esc(item.reason) + "” will be removed from this browser.",
      confirmLabel: "Delete snapshot",
      danger: true
    });
    if (!ok) return;
    Dhan.store.removeSnapshot(id);
    render();
    ui.toast("Snapshot deleted.", "success");
  }

  async function resetAll() {
    const ok = await ui.confirm({
      title: "Erase this browser's khata?",
      message: "This removes <strong>" + app.state.transactions.length + " entries</strong>, " + app.state.accounts.length + " accounts and " +
        app.state.goals.length + " goals from this browser. Snapshots and a Google Sheet copy are kept, so you can still restore one from Settings. This cannot be undone without a backup.",
      confirmLabel: "Erase this khata",
      requireText: "RESET",
      danger: true
    });
    if (!ok) return;
    Dhan.store.clearState();
    app.state = Dhan.defaultState();
    Dhan.store.save(app.state);
    onboardingShown = true;
    render();
    ui.applyTheme(app.state.settings.theme);
    ui.toast("This browser's khata is blank again.", "success");
    setTimeout(() => Dhan.modals.openOnboarding(), 180);
  }

  async function persistStorage() {
    if (!navigator.storage || !navigator.storage.persist) {
      ui.toast("This browser does not offer persistent storage. Install Dhan or keep a backup.", "info", 6000);
      return;
    }
    try {
      const granted = await Dhan.store.isPersistent();
      ui.toast(granted
        ? "This browser will try to keep Dhan's data even when storage is tight."
        : "The browser did not grant persistent storage. Install Dhan or keep regular backups.", granted ? "success" : "info", 6000);
    } catch (err) {
      ui.toast("Persistent storage could not be requested.", "error");
    }
  }

  /* ---------- install ---------- */
  async function installApp() {
    if (window.matchMedia("(display-mode: standalone)").matches || navigator.standalone) {
      ui.toast("Dhan is already installed on this device.", "info");
      return;
    }
    if (installPrompt) {
      const prompt = installPrompt;
      installPrompt = null;
      prompt.prompt();
      try {
        const choice = await prompt.userChoice;
        ui.toast(choice && choice.outcome === "accepted" ? "Dhan added to your device." : "Install cancelled. You can try again from Settings.", choice && choice.outcome === "accepted" ? "success" : "info");
      } catch (err) {
        ui.toast("The install prompt was dismissed.", "info");
      }
      return;
    }
    ui.toast("Use your browser menu → Install app (or Add to Home Screen on iPhone), then open Dhan from there.", "info", 7000);
  }

  /* ---------- actions ---------- */
  async function handleAction(btn) {
    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id") || "";
    const state = app.state;
    const failMissing = () => {
      ui.toast("That item no longer exists. The page will refresh.", "error");
      render();
    };

    switch (action) {
      case "add-tx":
        Dhan.modals.openTransaction();
        break;
      case "edit-tx": {
        const tx = state.transactions.find((t) => t.id === id);
        if (!tx) return failMissing();
        Dhan.modals.openTransaction(tx);
        break;
      }
      case "add-transfer":
        Dhan.modals.openTransaction(null, { type: "transfer" });
        break;
      case "add-account":
        Dhan.modals.openAccount();
        break;
      case "edit-account": {
        const account = state.accounts.find((a) => a.id === id);
        if (!account) return failMissing();
        Dhan.modals.openAccount(account);
        break;
      }
      case "add-goal":
        Dhan.modals.openGoal();
        break;
      case "add-goal-template":
        Dhan.modals.openGoal(null, btn.getAttribute("data-template"));
        break;
      case "edit-goal": {
        const goal = state.goals.find((g) => g.id === id);
        if (!goal) return failMissing();
        Dhan.modals.openGoal(goal);
        break;
      }
      case "goal-detail":
        Dhan.modals.openGoalDetail(id);
        break;
      case "contribute-goal":
        Dhan.modals.openContribution(id);
        break;
      case "add-budget":
        Dhan.modals.openBudget(null, btn.getAttribute("data-month") || date.currentMonth());
        break;
      case "add-budget-category":
        Dhan.modals.openBudget(null, btn.getAttribute("data-month") || date.currentMonth(), btn.getAttribute("data-category") || "");
        break;
      case "edit-budget": {
        const budget = state.budgets.find((b) => b.id === id);
        if (!budget) return failMissing();
        Dhan.modals.openBudget(budget);
        break;
      }
      case "add-deduction":
        Dhan.modals.openDeduction(null, btn.getAttribute("data-fy") || date.fyOf(date.todayISO()));
        break;
      case "edit-deduction": {
        const deduction = state.deductions.find((d) => d.id === id);
        if (!deduction) return failMissing();
        Dhan.modals.openDeduction(deduction);
        break;
      }
      case "add-category": {
        const kind = btn.getAttribute("data-kind") === "income" ? "income" : "expense";
        Dhan.modals.openCategory({
          type: kind,
          name: "",
          icon: kind === "income" ? "plus" : "dots",
          color: Dhan.nextCategoryColor(state),
          bucket: kind === "income" ? "other" : undefined,
          archived: false
        });
        break;
      }
      case "edit-category": {
        const category = state.categories.find((c) => c.id === id);
        if (!category) return failMissing();
        Dhan.modals.openCategory(category);
        break;
      }
      case "open-more":
        Dhan.modals.openMore();
        break;
      case "toggle-theme":
        toggleTheme();
        break;
      case "install-app":
        installApp();
        break;
      case "generate-token":
        generateToken();
        break;
      case "toggle-token":
        toggleTokenVisibility();
        break;
      case "sheet-test":
        testSheet();
        break;
      case "sheet-push":
        pushSheet();
        break;
      case "sheet-pull":
        pullSheet();
        break;
      case "copy-apps-script":
        copyAppsScript();
        break;
      case "backup-export":
        exportBackup();
        break;
      case "backup-import":
        importBackup();
        break;
      case "snapshot-take":
        takeSnapshot();
        break;
      case "snapshot-restore":
        restoreSnapshot(id);
        break;
      case "snapshot-delete":
        deleteSnapshot(id);
        break;
      case "reset-all":
        resetAll();
        break;
      case "persist-storage":
        persistStorage();
        break;
      default:
        break;
    }
  }

  /* ---------- forms ---------- */
  async function saveSheetConfig(form) {
    const url = String(form.elements.url.value || "").trim();
    const token = String(form.elements.token.value || "").trim();
    ui.clearErrors(form);
    if (!url && !token) {
      const hadConnection = Boolean(app.state.settings.googleSheetUrl || app.state.settings.googleSheetToken);
      app.state.settings.googleSheetUrl = "";
      app.state.settings.googleSheetToken = "";
      app.state.settings.lastSyncAt = null;
      commit("Google Sheets disconnected");
      ui.toast(hadConnection ? "Google Sheets connection removed." : "No connection to remove.", "success");
      return;
    }
    if (!url || !token) {
      if (!url) ui.fieldError(form.elements.url, "Paste the Web App URL that ends in /exec.");
      if (!token) ui.fieldError(form.elements.token, "Use the same token that is inside the Apps Script.");
      return;
    }
    if (!Dhan.isAppsScriptUrl(url)) {
      ui.fieldError(form.elements.url, "Use the deployed Web App URL from Apps Script — it ends in /exec.");
      return;
    }
    const changed = url !== app.state.settings.googleSheetUrl || token !== app.state.settings.googleSheetToken;
    app.state.settings.googleSheetUrl = url;
    app.state.settings.googleSheetToken = token;
    if (changed) app.state.settings.lastSyncAt = null;
    commit("Google Sheets connection saved");
    ui.toast("Connection saved. Press Test to check the bridge.", "success");
  }

  function bindEvents() {
    if (bound) return;
    bound = true;

    document.addEventListener("click", (e) => {
      const btn = e.target.closest && e.target.closest("[data-action]");
      if (!btn || btn.disabled) return;
      if (btn.tagName === "A" && btn.getAttribute("href")) return;
      const action = btn.getAttribute("data-action");
      if (!action) return;
      if (!["submit"].includes(btn.type)) e.preventDefault();
      handleAction(btn);
    });

    document.addEventListener("submit", (e) => {
      const form = e.target.closest && e.target.closest('[data-form="sheet-config"]');
      if (!form) return;
      e.preventDefault();
      saveSheetConfig(form);
    });

    document.addEventListener("change", (e) => {
      const input = e.target.closest && e.target.closest("#backup-file");
      if (!input) return;
      const file = input.files && input.files[0];
      readBackupFile(file);
    });

    window.addEventListener("hashchange", () => {
      render();
      window.scrollTo({ top: 0, behavior: "auto" });
      const main = document.getElementById("main");
      if (main) setTimeout(() => main.focus({ preventScroll: true }), 0);
    });

    window.addEventListener("storage", (e) => {
      if (e.key !== Dhan.storageKey || !e.newValue) return;
      if (sheetsBusy || document.querySelector("dialog[open]")) {
        ui.toast("Another tab changed your khata. Close any open window to see it here.", "info", 6000);
        return;
      }
      try {
        app.state = Dhan.normalizeState(JSON.parse(e.newValue));
        render();
        ui.applyTheme(app.state.settings.theme);
        ui.toast("Updated from another tab.", "success");
      } catch (err) {
        /* A half-written state from another tab is not worth interrupting for. */
      }
    });

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      installPrompt = e;
    });

    window.addEventListener("appinstalled", () => {
      installPrompt = null;
      ui.toast("Dhan installed. It will open offline from now on.", "success");
    });

    const darkQuery = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
    if (darkQuery) {
      const syncSystem = () => {
        if (app.state && app.state.settings.theme === "system") ui.applyTheme("system");
      };
      if (darkQuery.addEventListener) darkQuery.addEventListener("change", syncSystem);
      else if (darkQuery.addListener) darkQuery.addListener(syncSystem);
    }
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
    const start = () => {
      navigator.serviceWorker.register("sw.js").catch(() => {
        /* Offline mode is a bonus, not a requirement. */
      });
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
  }

  function boot() {
    bindEvents();
    const loaded = Dhan.store.load();
    app.state = loaded.state;
    ui.applyTheme(app.state.settings.theme || "system");
    if (!location.hash) {
      try { history.replaceState(null, "", "#/dashboard"); } catch (e) { location.hash = "#/dashboard"; }
    }
    render();
    registerServiceWorker();

    if (loaded.warning) {
      setTimeout(() => ui.toast(loaded.warning, "error", 8000), 700);
    }
    if (!app.state.settings.onboarded && !onboardingShown) {
      onboardingShown = true;
      setTimeout(() => {
        if (!document.querySelector("dialog[open]")) Dhan.modals.openOnboarding();
      }, 260);
    }

    document.documentElement.classList.add("is-ready");
  }

  boot();
})(typeof window !== "undefined" ? window : globalThis);
