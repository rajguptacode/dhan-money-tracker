/* Dhan — dialogs and forms. Every mutation goes through Dhan.app.commit()
   so storage, rendering and cross-view state stay in one place. */
(function (root) {
  "use strict";

  const Dhan = root.Dhan = root.Dhan || {};
  const ui = Dhan.ui;
  const esc = Dhan.esc;
  const money = Dhan.money;
  const date = Dhan.date;
  const GOAL_TEMPLATES = {
    car: { name: "New car", target: 2200000, icon: "car", years: 3 },
    emergency: { name: "Emergency fund", target: 500000, icon: "umbrella", years: 1 },
    travel: { name: "Travel fund", target: 200000, icon: "plane", years: 1 },
    home: { name: "Home down payment", target: 1000000, icon: "house", years: 3 },
    education: { name: "Education fund", target: 500000, icon: "book", years: 2 }
  };
  const CATEGORY_ICONS = [
    "briefcase", "laptop", "percent", "coins", "trend", "rotate", "gift", "plus",
    "bowl", "basket", "bus", "fuel", "house", "bolt", "phone", "heart",
    "book", "bag", "film", "plane", "users", "bank", "shield", "wrench",
    "receipt", "dots", "wallet", "card", "car", "umbrella", "target", "chart"
  ];

  const state = () => Dhan.app.state;
  const commit = (message) => Dhan.app.commit(message);
  const checked = (form, name) => {
    const el = form.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : "";
  };
  const field = (form, name) => form.elements[name];
  const cancelButton = '<button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>';

  function nowStamp() { return date.nowISO(); }

  /* =========================================================
     Entry — expense / income / transfer
     ========================================================= */
  function openTransaction(tx, preset) {
    const s = state();
    const accounts = Dhan.activeAccounts(s);
    if (!accounts.length) {
      ui.toast("Add an account first — every entry needs a home.", "info");
      return openAccount();
    }
    const editing = Boolean(tx && tx.id);
    const source = tx || Object.assign({
      type: "expense",
      date: date.todayISO(),
      accountId: accounts[0].id,
      toAccountId: accounts[1] ? accounts[1].id : accounts[0].id,
      amountPaise: 0,
      categoryId: "",
      note: ""
    }, preset || {});

    const type = ["expense", "income", "transfer"].includes(source.type) ? source.type : "expense";
    const initialCategory = source.categoryId ||
      (Dhan.activeCategories(s, type === "income" ? "income" : "expense")[0] || {}).id || "";
    const categorySections = {
      expense: ui.categoryPicker(s, "expense", type === "expense" ? initialCategory : ""),
      income: ui.categoryPicker(s, "income", type === "income" ? initialCategory : "")
    };

    const body =
      '<div class="form-section"><div class="seg" role="group" aria-label="Type of entry">' +
        '<label><input type="radio" name="type" value="expense"' + (type === "expense" ? " checked" : "") + '><span>' + ui.icon("basket") + 'Expense</span></label>' +
        '<label><input type="radio" name="type" value="income"' + (type === "income" ? " checked" : "") + '><span>' + ui.icon("plus") + 'Income</span></label>' +
        '<label><input type="radio" name="type" value="transfer"' + (type === "transfer" ? " checked" : "") + '><span>' + ui.icon("swap") + 'Transfer</span></label>' +
      "</div></div>" +
      '<div class="form-section"><div class="field">' +
        '<label class="field-label" for="tx-amount">Amount</label>' +
        '<div class="amount-wrap"><span class="rupee">₹</span><input id="tx-amount" name="amount" type="text" inputmode="decimal" autocomplete="off" placeholder="0" value="' + (editing ? esc(money.input(source.amountPaise)) : "") + '" data-autofocus></div>' +
        '<span class="field-hint" id="tx-amount-hint">Use rupees, like 450 or 1,250.50.</span>' +
      "</div></div>" +
      '<div class="form-section"><div class="field-row">' +
        '<div class="field"><label class="field-label" for="tx-date">Date</label><input class="input" id="tx-date" name="date" type="date" value="' + esc(source.date) + '"></div>' +
        '<div class="field"><label class="field-label" for="tx-account" id="tx-account-label">Paid from</label><select class="input" id="tx-account" name="accountId">' + ui.accountOptions(s, source.accountId, { includeArchived: true }) + "</select></div>" +
      "</div></div>" +
      '<div class="form-section" id="tx-cat-section"><div class="field"><span class="field-label">Category</span>' +
        '<div class="cat-picker" id="tx-cat-picker">' + categorySections[type === "income" ? "income" : "expense"] + "</div>" +
      "</div></div>" +
      '<div class="form-section" id="tx-to-section"' + (type === "transfer" ? "" : " hidden") + '><div class="field">' +
        '<label class="field-label" for="tx-to">Received into</label>' +
        '<select class="input" id="tx-to" name="toAccountId">' + ui.accountOptions(s, source.toAccountId) + "</select>" +
        '<span class="field-hint">Transfers move money between your own accounts. They don&#39;t count as income or spending.</span>' +
      "</div></div>" +
      '<div class="form-section"><div class="field">' +
        '<label class="field-label" for="tx-note">Note <span class="optional">optional</span></label>' +
        '<input class="input" id="tx-note" name="note" type="text" maxlength="180" placeholder="What was this for?" value="' + esc(source.note || "") + '">' +
      "</div></div>";

    const footer = (editing ? '<button type="button" class="btn btn-danger" data-delete-tx>' + ui.icon("trash") + "Delete</button><span class=\"grow\"></span>" : "") +
      cancelButton +
      '<button type="submit" class="btn btn-primary">' + (editing ? "Save changes" : "Add entry") + "</button>";

    const dlg = ui.openModal({
      title: editing ? "Edit entry" : "Add an entry",
      subtitle: editing ? "Correct anything that changed." : "A few seconds now keeps the month honest.",
      body: body,
      footer: footer,
      onMount: (form, close, dialog) => {
        const catSection = ui.$("#tx-cat-section", form);
        const toSection = ui.$("#tx-to-section", form);
        const picker = ui.$("#tx-cat-picker", form);
        const accountLabel = ui.$("#tx-account-label", form);
        const amountHint = ui.$("#tx-amount-hint", form);
        const amount = field(form, "amount");

        function syncType(preserve) {
          const t = checked(form, "type");
          const isTransfer = t === "transfer";
          catSection.hidden = isTransfer;
          toSection.hidden = !isTransfer;
          accountLabel.textContent = t === "income" ? "Received into" : isTransfer ? "From" : "Paid from";
          amountHint.textContent = isTransfer ? "The amount moved. Both balances update." : "Use rupees, like 450 or 1,250.50.";
          if (!isTransfer) {
            const chosen = preserve ? (form.querySelector('input[name="categoryId"]:checked') || {}).value : "";
            picker.innerHTML = ui.categoryPicker(s, t === "income" ? "income" : "expense", chosen);
          }
        }

        form.querySelectorAll('input[name="type"]').forEach((radio) => {
          radio.addEventListener("change", () => syncType(false));
        });
        syncType(true);

        if (editing) {
          const del = ui.$("[data-delete-tx]", dialog);
          if (del) del.addEventListener("click", async () => {
            const ok = await ui.confirm({
              title: "Delete this entry?",
              message: "This removes <strong>" + esc(money.fmt(source.amountPaise)) + "</strong> from " + esc(date.fmtDate(source.date)) + ". Account balances will update.",
              confirmLabel: "Delete entry",
              danger: true
            });
            if (!ok) return;
            Dhan.store.snapshot(s, "Before deleting an entry");
            s.transactions = s.transactions.filter((t) => t.id !== source.id);
            commit("Entry deleted");
            close("deleted");
            ui.toast("Entry deleted.", "success");
          });
        }

        if (!editing) amount.addEventListener("input", () => {
          if (amount.value.trim()) amount.removeAttribute("aria-invalid");
        });
      },
      onSubmit: (form, close) => {
        ui.clearErrors(form);
        const amountPaise = ui.readAmount(form, "amount");
        const day = field(form, "date").value;
        const t = checked(form, "type");
        const accountId = field(form, "accountId").value;
        const toAccountId = field(form, "toAccountId").value;
        let ok = true;
        if (amountPaise == null || amountPaise <= 0) {
          ui.fieldError(field(form, "amount"), "Enter an amount greater than zero.");
          ok = false;
        }
        if (!date.isValidISODate(day)) {
          ui.fieldError(field(form, "date"), "Pick a valid date.");
          ok = false;
        }
        if (!accountId) {
          ui.fieldError(field(form, "accountId"), "Choose an account.");
          ok = false;
        }
        if (t === "transfer" && toAccountId === accountId) {
          ui.fieldError(field(form, "toAccountId"), "Choose two different accounts for a transfer.");
          ok = false;
        }
        let categoryId = "";
        if (t !== "transfer") {
          categoryId = checked(form, "categoryId");
          if (!categoryId) {
            ui.toast("Choose a category for this entry.", "error");
            ok = false;
          }
        }
        if (!ok) return false;

        const payload = {
          id: editing ? source.id : Dhan.uid("tx"),
          type: t,
          date: day,
          amountPaise: amountPaise,
          accountId: accountId,
          toAccountId: t === "transfer" ? toAccountId : "",
          categoryId: t === "transfer" ? "" : categoryId,
          note: String(field(form, "note").value || "").trim().slice(0, 180),
          createdAt: editing ? source.createdAt : nowStamp(),
          updatedAt: nowStamp()
        };
        if (editing) {
          const index = s.transactions.findIndex((item) => item.id === source.id);
          if (index >= 0) s.transactions[index] = payload;
          else s.transactions.push(payload);
        } else {
          s.transactions.push(payload);
        }
        commit(editing ? "Entry updated" : "Entry added");
        close("saved");
        ui.toast(editing ? "Entry updated." : "Entry added.", "success");
      }
    });
    return dlg;
  }

  /* =========================================================
     Account
     ========================================================= */
  function openAccount(account) {
    const s = state();
    const editing = Boolean(account && account.id);
    const source = account || {
      name: "", type: "bank", institution: "", last4: "", openingPaise: 0
    };
    const body =
      '<div class="form-section"><div class="field">' +
        '<label class="field-label" for="acc-name">Account name</label>' +
        '<input class="input" id="acc-name" name="name" type="text" maxlength="60" placeholder="e.g. HDFC savings" value="' + esc(source.name) + '" data-autofocus>' +
      "</div></div>" +
      '<div class="form-section"><div class="field-row">' +
        '<div class="field"><label class="field-label" for="acc-type">Type</label><div class="select-wrap"><select class="input" id="acc-type" name="type">' +
          Dhan.ACCOUNT_TYPES.map((t) => '<option value="' + esc(t.id) + '"' + (source.type === t.id ? " selected" : "") + ">" + esc(t.label) + "</option>").join("") +
        "</select>" + ui.icon("chevron-down") + "</div></div>" +
        '<div class="field"><label class="field-label" for="acc-opening">Opening balance</label>' +
          '<input class="input num" id="acc-opening" name="opening" type="text" inputmode="decimal" placeholder="0" value="' + esc(money.input(source.openingPaise)) + '">' +
        "</div>" +
      "</div><span class=\"field-hint\">The balance you had before you started tracking here. For a credit card or loan, use a negative number for what you owe.</span></div>" +
      '<div class="form-section"><div class="field-row">' +
        '<div class="field"><label class="field-label" for="acc-bank">Bank / institution <span class="optional">optional</span></label>' +
          '<input class="input" id="acc-bank" name="institution" type="text" maxlength="80" placeholder="HDFC Bank" value="' + esc(source.institution || "") + '">' +
        "</div>" +
        '<div class="field"><label class="field-label" for="acc-last4">Last 4 digits <span class="optional">optional</span></label>' +
          '<input class="input" id="acc-last4" name="last4" type="text" inputmode="numeric" maxlength="4" placeholder="4821" value="' + esc(source.last4 || "") + '">' +
        "</div>" +
      "</div></div>" +
      (editing ? '<div class="form-section">' + ui.callout(
        "Current balance: <strong>" + esc(money.fmt(Dhan.accountBalance(s, source.id))) + "</strong> · " +
        Dhan.accountUsage(s, source.id) + " " + ui.plural(Dhan.accountUsage(s, source.id), "entry", "entries") + " use this account.",
        "wallet"
      ) + "</div>" : "");

    const footer = (editing ? '<button type="button" class="btn btn-secondary" data-archive-account>' + ui.icon(source.archived ? "rotate" : "file") + (source.archived ? "Restore" : "Archive") + "</button><span class=\"grow\"></span>" : "") +
      cancelButton +
      '<button type="submit" class="btn btn-primary">' + (editing ? "Save account" : "Add account") + "</button>";

    return ui.openModal({
      title: editing ? "Edit account" : "Add an account",
      subtitle: "Bank, cash, UPI wallet, investment or even a loan.",
      body: body,
      footer: footer,
      onMount: (form, close, dialog) => {
        const archive = ui.$("[data-archive-account]", dialog);
        if (archive) archive.addEventListener("click", async () => {
          if (!source.archived) {
            const ok = await ui.confirm({
              title: "Archive this account?",
              message: Dhan.accountUsage(s, source.id) > 0
                ? "The account disappears from new-entry pickers, but its entries stay in your history and reports."
                : "This account has no entries. You can restore it later from Accounts.",
              confirmLabel: "Archive account"
            });
            if (!ok) return;
          }
          source.archived = !source.archived;
          commit(source.archived ? "Account archived" : "Account restored");
          close("archived");
          ui.toast(source.archived ? "Account archived." : "Account restored.", "success");
        });
      },
      onSubmit: (form, close) => {
        ui.clearErrors(form);
        const name = String(field(form, "name").value || "").trim();
        const openingRaw = String(field(form, "opening").value || "").trim();
        const opening = openingRaw ? money.parse(openingRaw) : 0;
        let ok = true;
        if (!name) {
          ui.fieldError(field(form, "name"), "Give this account a name.");
          ok = false;
        }
        if (opening == null) {
          ui.fieldError(field(form, "opening"), "Use a number, like 12500 or -42000.");
          ok = false;
        }
        if (!ok) return false;
        const payload = {
          id: editing ? source.id : Dhan.uid("acc"),
          name: name.slice(0, 60),
          type: field(form, "type").value,
          openingPaise: opening,
          institution: String(field(form, "institution").value || "").trim().slice(0, 80),
          last4: String(field(form, "last4").value || "").replace(/\D/g, "").slice(0, 4),
          archived: editing ? Boolean(source.archived) : false,
          createdAt: editing ? source.createdAt : nowStamp()
        };
        if (editing) {
          const index = s.accounts.findIndex((a) => a.id === source.id);
          if (index >= 0) s.accounts[index] = payload;
        } else {
          s.accounts.push(payload);
        }
        commit(editing ? "Account updated" : "Account added");
        close("saved");
        ui.toast(editing ? "Account updated." : "Account added.", "success");
      }
    });
  }

  /* =========================================================
     Goal
     ========================================================= */
  function openGoal(goal, templateKey) {
    const s = state();
    const editing = Boolean(goal && goal.id);
    const template = GOAL_TEMPLATES[templateKey] || null;
    const targetPaise = editing ? goal.targetPaise : template ? template.target * 100 : 2200000 * 100;
    const targetDate = editing ? goal.targetDate : date.addDays(date.todayISO(), 365 * (template ? template.years : 3));
    const source = editing ? goal : {
      name: template ? template.name : "",
      targetPaise: targetPaise,
      targetDate: targetDate,
      icon: template ? template.icon : "target",
      note: ""
    };
    const body =
      '<div class="form-section"><div class="field">' +
        '<label class="field-label" for="goal-name">What are you saving for?</label>' +
        '<input class="input" id="goal-name" name="name" type="text" maxlength="60" placeholder="e.g. New car" value="' + esc(source.name) + '" data-autofocus>' +
      "</div></div>" +
      '<div class="form-section"><div class="field-row">' +
        '<div class="field"><label class="field-label" for="goal-target">Target amount</label>' +
          '<div class="amount-wrap"><span class="rupee">₹</span><input id="goal-target" name="target" type="text" inputmode="decimal" placeholder="2200000" value="' + esc(money.input(source.targetPaise)) + '"></div>' +
        "</div>" +
        '<div class="field"><label class="field-label" for="goal-date">By when?</label>' +
          '<input class="input" id="goal-date" name="targetDate" type="date" value="' + esc(source.targetDate) + '">' +
        "</div>" +
      "</div><span class=\"field-hint\">Dhan will work out how much to set aside each month.</span></div>" +
      '<div class="form-section"><div class="field"><span class="field-label">Icon</span>' +
        '<div class="cat-picker">' + ui.goalIconPicker(source.icon || "target") + "</div>" +
      "</div></div>" +
      '<div class="form-section"><div class="field">' +
        '<label class="field-label" for="goal-note">Why it matters <span class="optional">optional</span></label>' +
        '<input class="input" id="goal-note" name="note" type="text" maxlength="180" placeholder="A little note to yourself" value="' + esc(source.note || "") + '">' +
      "</div></div>";

    const footer = (editing ? '<button type="button" class="btn btn-danger" data-delete-goal>' + ui.icon("trash") + "Delete</button><span class=\"grow\"></span>" : "") +
      cancelButton +
      '<button type="submit" class="btn btn-primary">' + (editing ? "Save goal" : "Create goal") + "</button>";

    return ui.openModal({
      title: editing ? "Edit goal" : "Set a goal",
      subtitle: editing ? "Change the target, the date, or the name." : "A target with a date is a plan. Everything else is a wish.",
      body: body,
      footer: footer,
      onMount: (form, close, dialog) => {
        const del = ui.$("[data-delete-goal]", dialog);
        if (!del) return;
        del.addEventListener("click", async () => {
          const saved = Dhan.goalSaved(s, source.id);
          const count = s.contributions.filter((c) => c.goalId === source.id).length;
          const ok = await ui.confirm({
            title: "Delete this goal?",
            message: "This also removes " + count + " " + ui.plural(count, "contribution", "contributions") +
              (saved ? " worth <strong>" + esc(money.fmt(saved)) + "</strong>" : "") + ". Your account balances won&#39;t change.",
            confirmLabel: "Delete goal",
            danger: true
          });
          if (!ok) return;
          Dhan.store.snapshot(s, "Before deleting a goal");
          s.goals = s.goals.filter((g) => g.id !== source.id);
          s.contributions = s.contributions.filter((c) => c.goalId !== source.id);
          commit("Goal deleted");
          close("deleted");
          ui.toast("Goal deleted.", "success");
        });
      },
      onSubmit: (form, close) => {
        ui.clearErrors(form);
        const name = String(field(form, "name").value || "").trim();
        const target = ui.readAmount(form, "target");
        const targetDate = field(form, "targetDate").value;
        let ok = true;
        if (!name) {
          ui.fieldError(field(form, "name"), "Give this goal a name.");
          ok = false;
        }
        if (target == null || target <= 0) {
          ui.fieldError(field(form, "target"), "Enter a target above zero.");
          ok = false;
        }
        if (!date.isValidISODate(targetDate)) {
          ui.fieldError(field(form, "targetDate"), "Pick a target date.");
          ok = false;
        }
        if (!ok) return false;
        const payload = {
          id: editing ? source.id : Dhan.uid("goal"),
          name: name.slice(0, 60),
          targetPaise: target,
          targetDate: targetDate,
          icon: checked(form, "icon") || "target",
          note: String(field(form, "note").value || "").trim().slice(0, 180),
          archived: editing ? Boolean(source.archived) : false,
          createdAt: editing ? source.createdAt : nowStamp()
        };
        if (editing) {
          const index = s.goals.findIndex((g) => g.id === source.id);
          if (index >= 0) s.goals[index] = payload;
        } else {
          s.goals.push(payload);
        }
        commit(editing ? "Goal updated" : "Goal created");
        close("saved");
        ui.toast(editing ? "Goal updated." : "Goal created.", "success");
      }
    });
  }

  function goalFigures(state, goal) {
    const p = Dhan.goalProgress(state, goal);
    return '<div class="goal-detail-figures">' +
      '<div><div class="label">Saved</div><div class="value">' + esc(money.fmt(p.saved)) + "</div></div>" +
      '<div><div class="label">Still needed</div><div class="value">' + esc(money.fmt(p.remaining)) + "</div></div>" +
      '<div><div class="label">Each month</div><div class="value">' + esc(money.fmt(p.monthlyNeeded, { decimals: 0 })) + "</div></div>" +
    "</div>" +
    '<div class="progress goal-detail-bar"><div class="progress-fill" style="width:' + Math.min(100, p.progress).toFixed(1) + '%"></div></div>' +
    '<div class="goal-card-progress"><span><strong>' + Math.round(p.progress) + '%</strong> of ' + esc(money.fmt(goal.targetPaise)) + "</span><span>" +
    (p.done ? "Goal reached" : p.monthsLeft > 0 ? p.monthsLeft + " " + ui.plural(p.monthsLeft, "month") + " to go" : "Target date has passed") +
    "</span></div>";
  }

  function openContribution(goalId) {
    const s = state();
    const goal = s.goals.find((g) => g.id === goalId);
    if (!goal) { ui.toast("That goal could not be found.", "error"); return; }
    const progress = Dhan.goalProgress(s, goal);
    const accounts = Dhan.activeAccounts(s);
    const body =
      '<div class="goal-detail-hero"><span class="goal-icon" aria-hidden="true">' + ui.icon(goal.icon) + "</span>" +
        "<div><h3>" + esc(goal.name) + "</h3><p>" + esc(date.fmtDate(goal.targetDate)) + " · " + esc(money.fmt(goal.targetPaise)) + " target</p></div></div>" +
      goalFigures(s, goal) +
      '<div class="form-section"><div class="field">' +
        '<label class="field-label" for="contrib-amount">Amount to add</label>' +
        '<div class="amount-wrap"><span class="rupee">₹</span><input id="contrib-amount" name="amount" type="text" inputmode="decimal" placeholder="0" data-autofocus></div>' +
      "</div></div>" +
      '<div class="form-section"><div class="field-row">' +
        '<div class="field"><label class="field-label" for="contrib-date">Date</label><input class="input" id="contrib-date" name="date" type="date" value="' + esc(date.todayISO()) + '"></div>' +
        '<div class="field"><label class="field-label" for="contrib-account">From account <span class="optional">optional</span></label>' +
          '<select class="input" id="contrib-account" name="accountId"><option value="">Not linked</option>' + ui.accountOptions(s, "") + "</select>" +
        "</div>" +
      "</div></div>" +
      '<div class="form-section"><div class="field">' +
        '<label class="field-label" for="contrib-note">Note <span class="optional">optional</span></label>' +
        '<input class="input" id="contrib-note" name="note" type="text" maxlength="180" placeholder="e.g. Diwali bonus" value="">' +
      "</div></div>" +
      '<div class="form-section">' + ui.callout(
        "Goal contributions are a plan, not a transaction. They don&#39;t move your account balances. Record the actual transfer or investment separately so your khata stays true.",
        "info"
      ) + "</div>";

    return ui.openModal({
      title: "Add to goal",
      subtitle: "Track what you set aside for this plan.",
      body: body,
      size: "lg",
      footer: cancelButton + '<button type="submit" class="btn btn-primary">' + ui.icon("target") + "Add to goal</button>",
      onSubmit: (form, close) => {
        ui.clearErrors(form);
        const amount = ui.readAmount(form, "amount");
        const day = field(form, "date").value;
        let ok = true;
        if (amount == null || amount <= 0) {
          ui.fieldError(field(form, "amount"), "Enter an amount above zero.");
          ok = false;
        }
        if (!date.isValidISODate(day)) {
          ui.fieldError(field(form, "date"), "Pick a valid date.");
          ok = false;
        }
        if (!ok) return false;
        s.contributions.push({
          id: Dhan.uid("con"),
          goalId: goal.id,
          amountPaise: amount,
          date: day,
          accountId: field(form, "accountId").value || "",
          note: String(field(form, "note").value || "").trim().slice(0, 180),
          createdAt: nowStamp()
        });
        commit("Goal contribution added");
        close("saved");
        const nowSaved = progress.saved + amount;
        ui.toast(nowSaved >= goal.targetPaise ? "Goal complete — well done!" : "Added to " + goal.name + ".", "success");
      }
    });
  }

  function openGoalDetail(goalId) {
    const s = state();
    const goal = s.goals.find((g) => g.id === goalId);
    if (!goal) { ui.toast("That goal could not be found.", "error"); return; }
    const contributions = Dhan.sortBy(s.contributions.filter((c) => c.goalId === goalId), (c) => c.date + " " + (c.createdAt || ""), "desc");
    const list = contributions.length ? '<div class="contrib-list">' + contributions.map((c) =>
      '<div class="contrib-row">' +
        '<span class="contrib-icon" aria-hidden="true">' + ui.icon("plus") + "</span>" +
        '<span class="contrib-main"><strong>' + esc(c.note || "Contribution") + "</strong><span>" +
          esc(date.fmtDate(c.date)) + (c.accountId ? " · " + esc(Dhan.accountName(s, c.accountId)) : "") + "</span></span>" +
        '<span class="contrib-amount">' + esc(money.fmt(c.amountPaise)) + "</span>" +
        '<button type="button" class="contrib-del" data-contrib-del="' + esc(c.id) + '" aria-label="Delete contribution">' + ui.icon("trash") + "</button>" +
      "</div>"
    ).join("") + "</div>" : ui.empty({ icon: "target", title: "No contributions yet", message: "Add the first amount you set aside — even ₹500 counts.", tight: true });

    const dlg = ui.openModal({
      title: esc(goal.name),
      eyebrow: "Goal detail",
      size: "lg",
      body: '<div class="goal-detail-hero"><span class="goal-icon" aria-hidden="true">' + ui.icon(goal.icon) + "</span>" +
        "<div><h3>" + esc(goal.name) + "</h3><p>" + esc(date.fmtDate(goal.targetDate)) + " · " + esc(money.fmt(goal.targetPaise)) + " target" +
        (goal.note ? " · " + esc(goal.note) : "") + "</p></div></div>" +
        goalFigures(s, goal) +
        '<div class="section-head" style="margin-top:20px"><h2>Contributions</h2><span class="mono">' + contributions.length + " total</span></div>" +
        list,
      footer: cancelButton +
        '<button type="button" class="btn btn-secondary" data-edit-goal>' + ui.icon("pencil") + "Edit</button>" +
        '<button type="button" class="btn btn-primary" data-add-money>' + ui.icon("plus") + "Add money</button>",
      onMount: (form, close, dialog) => {
        const add = ui.$("[data-add-money]", dialog);
        if (add) add.addEventListener("click", () => { close("add"); openContribution(goal.id); });
        const edit = ui.$("[data-edit-goal]", dialog);
        if (edit) edit.addEventListener("click", () => { close("edit"); openGoal(goal); });
        dialog.querySelectorAll("[data-contrib-del]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const id = btn.getAttribute("data-contrib-del");
            const item = s.contributions.find((c) => c.id === id);
            if (!item) return;
            const ok = await ui.confirm({
              title: "Remove this contribution?",
              message: "This only changes your goal progress. Account balances stay the same.",
              confirmLabel: "Remove",
              danger: true
            });
            if (!ok) return;
            s.contributions = s.contributions.filter((c) => c.id !== id);
            commit("Contribution removed");
            close("removed");
            ui.toast("Contribution removed.", "success");
            openGoalDetail(goal.id);
          });
        });
      }
    });
    return dlg;
  }

  /* =========================================================
     Budget
     ========================================================= */
  function openBudget(budget, presetMonth, presetCategory) {
    const s = state();
    const editing = Boolean(budget && budget.id);
    const source = budget || {
      month: presetMonth || date.currentMonth(),
      categoryId: presetCategory || "",
      amountPaise: 0
    };
    const expenseCats = Dhan.activeCategories(s, "expense");
    if (!expenseCats.length) {
      ui.toast("Add an expense category first, in Settings.", "info");
      return;
    }
    if (!source.categoryId || !expenseCats.some((c) => c.id === source.categoryId)) {
      const existing = s.categories.find((c) => c.id === source.categoryId);
      if (!existing) source.categoryId = expenseCats[0].id;
    }
    const catOptions = (() => {
      let list = expenseCats.slice();
      if (source.categoryId && !list.some((c) => c.id === source.categoryId)) {
        const used = s.categories.find((c) => c.id === source.categoryId);
        if (used) list = list.concat([used]);
      }
      return list.map((c) => '<option value="' + esc(c.id) + '"' + (c.id === source.categoryId ? " selected" : "") + ">" + esc(c.name) + (c.archived ? " (archived)" : "") + "</option>").join("");
    })();

    const body =
      '<div class="form-section"><div class="field-row">' +
        '<div class="field"><label class="field-label" for="budget-month">Month</label><input class="input" id="budget-month" name="month" type="month" value="' + esc(source.month) + '"></div>' +
        '<div class="field"><label class="field-label" for="budget-category">Category</label><div class="select-wrap"><select class="input" id="budget-category" name="categoryId">' + catOptions + "</select>" + ui.icon("chevron-down") + "</div></div>" +
      "</div></div>" +
      '<div class="form-section"><div class="field">' +
        '<label class="field-label" for="budget-amount">Monthly limit</label>' +
        '<div class="amount-wrap"><span class="rupee">₹</span><input id="budget-amount" name="amount" type="text" inputmode="decimal" placeholder="0" value="' + (editing ? esc(money.input(source.amountPaise)) : "") + '" data-autofocus></div>' +
        '<span class="field-hint">Each month starts fresh. Budgets don&#39;t roll over unused money.</span>' +
      "</div></div>" +
      '<div class="form-section">' + ui.callout("A budget is a gentle fence, not a punishment. Start with the categories that surprise you most.", "info") + "</div>";

    const footer = (editing ? '<button type="button" class="btn btn-danger" data-delete-budget>' + ui.icon("trash") + "Delete</button><span class=\"grow\"></span>" : "") +
      cancelButton + '<button type="submit" class="btn btn-primary">' + (editing ? "Save budget" : "Set budget") + "</button>";

    return ui.openModal({
      title: editing ? "Edit budget" : "Set a budget",
      subtitle: "Give a category a monthly ceiling.",
      body: body,
      footer: footer,
      onMount: (form, close, dialog) => {
        const del = ui.$("[data-delete-budget]", dialog);
        if (del) del.addEventListener("click", async () => {
          const ok = await ui.confirm({ title: "Delete this budget?", message: "Your entries stay exactly as they are.", confirmLabel: "Delete budget", danger: true });
          if (!ok) return;
          s.budgets = s.budgets.filter((b) => b.id !== source.id);
          commit("Budget deleted");
          close("deleted");
          ui.toast("Budget deleted.", "success");
        });
      },
      onSubmit: (form, close) => {
        ui.clearErrors(form);
        const month = field(form, "month").value;
        const categoryId = field(form, "categoryId").value;
        const amount = ui.readAmount(form, "amount");
        let ok = true;
        if (!/^\d{4}-\d{2}$/.test(month)) {
          ui.fieldError(field(form, "month"), "Choose a month.");
          ok = false;
        }
        if (!categoryId) {
          ui.fieldError(field(form, "categoryId"), "Choose a category.");
          ok = false;
        }
        if (amount == null || amount <= 0) {
          ui.fieldError(field(form, "amount"), "Enter a limit above zero.");
          ok = false;
        }
        if (!ok) return false;
        const duplicate = s.budgets.find((b) => b.id !== source.id && b.month === month && b.categoryId === categoryId);
        if (duplicate && !editing) {
          duplicate.amountPaise = amount;
          commit("Budget updated");
          close("saved");
          ui.toast("That category already had a budget — the limit was updated.", "success");
          return;
        }
        if (editing) {
          source.month = month;
          source.categoryId = categoryId;
          source.amountPaise = amount;
        } else {
          s.budgets.push({ id: Dhan.uid("bud"), month: month, categoryId: categoryId, amountPaise: amount });
        }
        commit(editing ? "Budget updated" : "Budget set");
        close("saved");
        ui.toast(editing ? "Budget updated." : "Budget set.", "success");
      }
    });
  }

  /* =========================================================
     Deduction
     ========================================================= */
  function openDeduction(deduction, presetFy) {
    const s = state();
    const editing = Boolean(deduction && deduction.id);
    const source = deduction || {
      fy: presetFy || Dhan.date.fyOf(date.todayISO()),
      section: "80C",
      label: "",
      amountPaise: 0
    };
    const sectionOptions = Dhan.DEDUCTION_SECTIONS.map((sec) =>
      '<option value="' + esc(sec.id) + '"' + (sec.id === source.section ? " selected" : "") + ">" + esc(sec.label) + "</option>"
    ).join("");
    const body =
      '<div class="form-section"><div class="field-row">' +
        '<div class="field"><label class="field-label" for="ded-fy">Financial year</label><div class="select-wrap"><select class="input" id="ded-fy" name="fy">' + ui.fyOptionsHtml(source.fy, 5) + "</select>" + ui.icon("chevron-down") + "</div></div>" +
        '<div class="field"><label class="field-label" for="ded-section">Section</label><div class="select-wrap"><select class="input" id="ded-section" name="section">' + sectionOptions + "</select>" + ui.icon("chevron-down") + "</div></div>" +
      "</div></div>" +
      '<div class="form-section"><div class="field">' +
        '<label class="field-label" for="ded-label">What is it? <span class="optional">optional</span></label>' +
        '<input class="input" id="ded-label" name="label" type="text" maxlength="80" placeholder="e.g. PPF contribution" value="' + esc(source.label || "") + '">' +
      "</div></div>" +
      '<div class="form-section"><div class="field">' +
        '<label class="field-label" for="ded-amount">Amount</label>' +
        '<div class="amount-wrap"><span class="rupee">₹</span><input id="ded-amount" name="amount" type="text" inputmode="decimal" placeholder="0" value="' + (editing ? esc(money.input(source.amountPaise)) : "") + '" data-autofocus></div>' +
        '<span class="field-hint" id="ded-hint">' + esc((Dhan.DEDUCTION_SECTIONS.find((x) => x.id === source.section) || {}).hint || "") + "</span>" +
      "</div></div>" +
      '<div class="form-section">' + ui.callout("Enter the amount you actually invested or paid this financial year. Keep the receipts — the tax portal may ask for proof.", "shield") + "</div>";

    const footer = (editing ? '<button type="button" class="btn btn-danger" data-delete-ded>' + ui.icon("trash") + "Delete</button><span class=\"grow\"></span>" : "") +
      cancelButton + '<button type="submit" class="btn btn-primary">' + (editing ? "Save" : "Add deduction") + "</button>";

    return ui.openModal({
      title: editing ? "Edit deduction" : "Add a deduction",
      subtitle: "Keep your ITR working papers in one place.",
      body: body,
      footer: footer,
      onMount: (form, close, dialog) => {
        const section = field(form, "section");
        const hint = ui.$("#ded-hint", form);
        section.addEventListener("change", () => {
          const meta = Dhan.DEDUCTION_SECTIONS.find((x) => x.id === section.value);
          hint.textContent = meta ? meta.hint : "";
        });
        const del = ui.$("[data-delete-ded]", dialog);
        if (del) del.addEventListener("click", async () => {
          const ok = await ui.confirm({ title: "Delete this deduction?", message: "It will stop counting in your tax estimate.", confirmLabel: "Delete", danger: true });
          if (!ok) return;
          s.deductions = s.deductions.filter((d) => d.id !== source.id);
          commit("Deduction deleted");
          close("deleted");
          ui.toast("Deduction deleted.", "success");
        });
      },
      onSubmit: (form, close) => {
        ui.clearErrors(form);
        const amount = ui.readAmount(form, "amount");
        const fy = field(form, "fy").value;
        let ok = true;
        if (amount == null || amount <= 0) {
          ui.fieldError(field(form, "amount"), "Enter an amount above zero.");
          ok = false;
        }
        if (!/^\d{4}-\d{2}$/.test(fy)) {
          ui.fieldError(field(form, "fy"), "Choose a financial year.");
          ok = false;
        }
        if (!ok) return false;
        const payload = {
          id: editing ? source.id : Dhan.uid("ded"),
          fy: fy,
          section: field(form, "section").value,
          label: String(field(form, "label").value || "").trim().slice(0, 80),
          amountPaise: amount,
          createdAt: editing ? source.createdAt : nowStamp()
        };
        if (editing) {
          const index = s.deductions.findIndex((d) => d.id === source.id);
          if (index >= 0) s.deductions[index] = payload;
        } else {
          s.deductions.push(payload);
        }
        commit(editing ? "Deduction updated" : "Deduction added");
        close("saved");
        ui.toast(editing ? "Deduction updated." : "Deduction added.", "success");
      }
    });
  }

  /* =========================================================
     Category
     ========================================================= */
  function openCategory(category) {
    const s = state();
    const editing = Boolean(category && category.id);
    const usage = editing ? Dhan.categoryUsage(s, category.id) : 0;
    const source = category || {
      name: "",
      type: "expense",
      icon: "dots",
      color: Dhan.nextCategoryColor(s),
      bucket: "other",
      archived: false
    };
    const iconGrid = CATEGORY_ICONS.map((name) =>
      '<label class="icon-opt"><input type="radio" name="icon" value="' + esc(name) + '"' + (name === source.icon ? " checked" : "") + ' aria-label="' + esc(name) + '"><span>' + ui.icon(name) + "</span></label>"
    ).join("");
    const colorGrid = Dhan.CATEGORY_COLORS.map((color) =>
      '<label class="color-opt"><input type="radio" name="color" value="' + esc(color) + '"' + (color === source.color ? " checked" : "") + ' aria-label="' + esc(color) + '"><span style="--swatch:var(--cat-' + esc(color) + ')">' + ui.icon("check") + "</span></label>"
    ).join("");
    const bucketOptions = Dhan.TAX_BUCKETS.map((b) =>
      '<option value="' + esc(b.id) + '"' + (b.id === source.bucket ? " selected" : "") + ">" + esc(b.label) + "</option>"
    ).join("");
    const typeField = usage > 0
      ? '<div class="callout">' + ui.icon("lock") + '<div class="grow">This category is used by ' + usage + " " + ui.plural(usage, "entry", "entries") + ", so its type is fixed. You can still rename it or change its icon.</div></div>" +
        '<input type="hidden" name="type" value="' + esc(source.type) + '">'
      : '<div class="seg" role="group" aria-label="Category type">' +
        '<label><input type="radio" name="type" value="expense"' + (source.type === "expense" ? " checked" : "") + '><span>Expense</span></label>' +
        '<label><input type="radio" name="type" value="income"' + (source.type === "income" ? " checked" : "") + '><span>Income</span></label>' +
        "</div>";

    const body =
      '<div class="form-section"><div class="field">' +
        '<label class="field-label" for="cat-name">Category name</label>' +
        '<input class="input" id="cat-name" name="name" type="text" maxlength="50" placeholder="e.g. Pet care" value="' + esc(source.name) + '" data-autofocus>' +
      "</div></div>" +
      '<div class="form-section">' + typeField + "</div>" +
      '<div class="form-section" id="cat-bucket-section"' + (source.type === "income" ? "" : " hidden") + '><div class="field">' +
        '<label class="field-label" for="cat-bucket">ITR income head</label>' +
        '<div class="select-wrap"><select class="input" id="cat-bucket" name="bucket">' + bucketOptions + "</select>" + ui.icon("chevron-down") + "</div>" +
        '<span class="field-hint">This tells the tax view where this income belongs. Use “Exempt” for gifts, cashback and reimbursements.</span>' +
      "</div></div>" +
      '<div class="form-section"><div class="field"><span class="field-label">Icon</span><div class="icon-grid">' + iconGrid + "</div></div></div>" +
      '<div class="form-section"><div class="field"><span class="field-label">Colour</span><div class="color-grid">' + colorGrid + "</div></div></div>" +
      '<div class="form-section"><label class="check"><input type="checkbox" name="archived"' + (source.archived ? " checked" : "") + '><span class="check-copy">Archived<small>Hide this category from new entries. Old entries keep their label.</small></span></label></div>';

    return ui.openModal({
      title: editing ? "Edit category" : "New category",
      subtitle: "Make your khata speak your language.",
      body: body,
      onSubmit: (form, close) => {
        ui.clearErrors(form);
        const name = String(field(form, "name").value || "").trim();
        if (!name) {
          ui.fieldError(field(form, "name"), "Give this category a name.");
          return false;
        }
        const type = checked(form, "type") || source.type;
        const payload = {
          id: editing ? source.id : Dhan.uid("cat"),
          name: name.slice(0, 50),
          type: type,
          icon: checked(form, "icon") || "dots",
          color: checked(form, "color") || "slate",
          archived: Boolean(field(form, "archived").checked),
          createdAt: editing ? source.createdAt : nowStamp()
        };
        if (type === "income") payload.bucket = field(form, "bucket").value || "other";
        if (editing) {
          const index = s.categories.findIndex((c) => c.id === source.id);
          if (index >= 0) s.categories[index] = Object.assign(s.categories[index], payload, { bucket: type === "income" ? payload.bucket : undefined });
        } else {
          s.categories.push(payload);
        }
        commit(editing ? "Category updated" : "Category added");
        close("saved");
        ui.toast(editing ? "Category updated." : "Category added.", "success");
      },
      onMount: (form) => {
        const typeValue = () => {
          const el = form.querySelector('input[name="type"]:checked') || form.querySelector('input[name="type"]');
          return el ? el.value : source.type;
        };
        const syncBucket = () => {
          const section = ui.$("#cat-bucket-section", form);
          if (section) section.hidden = typeValue() !== "income";
        };
        form.querySelectorAll('input[name="type"]').forEach((r) => r.addEventListener("change", syncBucket));
        syncBucket();
      }
    });
  }

  /* =========================================================
     More sheet
     ========================================================= */
  function openMore() {
    const links = [
      { href: "#/accounts", icon: "wallet", title: "Accounts", sub: "Balances, cash, cards and loans" },
      { href: "#/goals", icon: "target", title: "Plan", sub: "Goals and monthly budgets" },
      { href: "#/tax", icon: "receipt", title: "Tax & ITR", sub: "Income heads, deductions, working papers" },
      { href: "#/reports", icon: "chart", title: "Reports", sub: "Cashflow, categories and year summary" },
      { href: "#/settings", icon: "settings", title: "Settings", sub: "Categories, backup and Google Sheets" },
      { href: "#/settings", icon: "sheet", title: "Google Sheets sync", sub: "One-time setup · your own Drive" }
    ];
    const body = '<div class="more-list">' + links.map((l) =>
      '<a class="more-link" href="' + l.href + '" data-close-modal><span class="more-link-icon">' + ui.icon(l.icon) + '</span><span class="more-link-copy"><strong>' + l.title + "</strong><span>" + l.sub + '</span></span>' + ui.icon("chevron-right") + "</a>"
    ).join("") +
      '<hr class="more-sep">' +
      '<button type="button" class="more-link" data-action="install-app"><span class="more-link-icon">' + ui.icon("smartphone") + '</span><span class="more-link-copy"><strong>Install Dhan</strong><span>Add it to your home screen</span></span>' + ui.icon("chevron-right") + "</button>" +
      '<button type="button" class="more-link" data-action="toggle-theme"><span class="more-link-icon">' + ui.icon("moon") + '</span><span class="more-link-copy"><strong>Switch theme</strong><span>Light or dark</span></span>' + ui.icon("chevron-right") + "</button>" +
      "</div>" +
      '<div class="more-foot"><span>Dhan v1.0 · local first</span><span class="mono">No account needed</span></div>';
    const dlg = ui.openModal({
      title: "Everything else",
      className: "is-sheet",
      body: body,
      footer: false,
      backdropClose: true,
      onMount: (form, close, dialog) => {
        dialog.querySelectorAll("[data-close-modal]").forEach((a) => a.addEventListener("click", () => close("nav")));
      }
    });
    return dlg;
  }

  /* =========================================================
     Onboarding
     ========================================================= */
  function openOnboarding() {
    const layer = document.getElementById("modals");
    if (!layer) return;
    const s = state();
    const brand = '<span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 40 40"><rect width="40" height="40" rx="11" fill="var(--sidebar-brand-bg)"/><text x="9" y="29" font-family="Fraunces, Georgia, serif" font-size="27" font-weight="600" fill="var(--sidebar-brand-ink)">d</text><circle cx="29.5" cy="27.5" r="3" fill="var(--marigold)"/></svg></span>';
    const dlg = document.createElement("dialog");
    dlg.className = "onboarding-modal";
    dlg.setAttribute("aria-labelledby", "onboard-title");
    dlg.innerHTML =
      '<div class="onboard-grid">' +
        '<aside class="onboard-left">' +
          '<div class="onboard-brand">' + brand + '<div class="brand-copy"><span class="brand-name">dhan<span class="brand-dot">.</span></span><span class="brand-tag">MONEY, CLEARLY</span></div></div>' +
          '<div class="onboard-quote">' +
            '<div class="mono">YOUR PRIVATE KHATA</div>' +
            '<h2>Money, <em>clearly</em>.<br>Every rupee,<br>accounted for.</h2>' +
            '<p>A quiet place for your salary, UPI spends, bank interest and the car you are saving for.</p>' +
            '<div class="onboard-points">' +
              '<div class="onboard-point">' + ui.icon("lock") + "<span>Stays in this browser. No sign-up, no server, no one watching.</span></div>" +
              '<div class="onboard-point">' + ui.icon("receipt") + "<span>Income heads and deductions kept tidy for future ITR filing.</span></div>" +
              '<div class="onboard-point">' + ui.icon("target") + "<span>Goals that count down — and tell you the monthly number.</span></div>" +
            '</div>' +
            '<div class="onboard-preview"><div class="label">A GOAL, FOR EXAMPLE</div><div class="row"><span class="amount">₹22,00,000</span><span class="target">New car · 3 years</span></div><div class="mini-bar"><span></span></div></div>' +
            '<div class="stamp"><span>LOCAL FIRST</span><strong>No login</strong></div>' +
          "</div>" +
        "</aside>" +
        '<div class="onboard-right">' +
          '<div class="onboard-right-head">' +
            '<div class="onboard-mobile-brand">' + brand + '<div class="brand-copy"><span class="brand-name">dhan<span class="brand-dot">.</span></span></div></div>' +
            '<div class="eyebrow">WELCOME TO DHAN</div>' +
            '<h1 id="onboard-title">Let&#39;s set up your khata.</h1>' +
            '<p class="onboard-head-note">Two small details now, then you can add entries. You can change everything later.</p>' +
          "</div>" +
          '<form class="onboard-form-body" id="onboard-form" novalidate>' +
            '<div class="form-section"><div class="field">' +
              '<label class="field-label" for="onboard-name">What should we call you? <span class="optional">optional</span></label>' +
              '<input class="input" id="onboard-name" name="name" type="text" maxlength="60" placeholder="Your first name" value="' + esc(s.settings.name || "") + '" data-autofocus>' +
            "</div></div>" +
            '<div class="form-section"><div class="field-row">' +
              '<div class="field"><label class="field-label" for="onboard-opening">Bank balance today <span class="optional">optional</span></label>' +
                '<input class="input num" id="onboard-opening" name="opening" type="text" inputmode="decimal" placeholder="0">' +
                '<span class="field-hint">Your main bank account&#39;s opening balance.</span>' +
              "</div>" +
              '<div class="field"><label class="field-label" for="onboard-savings">Savings target</label>' +
                '<div class="input-wrap"><input class="input num" id="onboard-savings" name="savingsTarget" type="number" min="0" max="90" step="1" value="20"><span class="input-suffix">% of income</span></div>' +
                '<span class="field-hint">A gentle target for the dashboard.</span>' +
              "</div>" +
            "</div></div>" +
            '<div class="form-section"><div class="onboard-goal-toggle">' +
              '<label class="check"><input type="checkbox" name="goalOn" checked><span class="check-copy">Start with a goal<small>You can rename it or skip this.</small></span></label>' +
              '<div class="onboard-goal-fields" id="onboard-goal-fields">' +
                '<div class="field"><label class="field-label" for="onboard-goal-name">Goal</label><input class="input" id="onboard-goal-name" name="goalName" type="text" maxlength="60" value="New car"></div>' +
                '<div class="field"><label class="field-label" for="onboard-goal-target">Target</label><div class="amount-wrap" style="padding:6px 10px"><span class="rupee" style="font-size:1.1rem">₹</span><input id="onboard-goal-target" name="goalTarget" type="text" inputmode="decimal" value="2200000" style="font-size:1.15rem"></div></div>' +
                '<div class="field" style="grid-column:1/-1"><label class="field-label" for="onboard-goal-date">By when?</label><input class="input" id="onboard-goal-date" name="goalDate" type="date" value="' + esc(date.addDays(date.todayISO(), 365 * 3)) + '"></div>' +
              "</div>" +
            "</div></div>" +
            '<div class="onboard-actions">' +
              '<button type="button" class="onboard-skip" id="onboard-skip">Skip for now</button>' +
              '<button type="submit" class="btn btn-primary btn-lg" id="onboard-start">Open my khata ' + ui.icon("arrow-right") + "</button>" +
            "</div>" +
            '<div class="onboard-privacy">' + ui.icon("lock") + "<span>Your entries live in this browser&#39;s local storage. Clearing site data will erase them, so take a backup from Settings once in a while.</span></div>" +
          "</form>" +
        "</div>" +
      "</div>";

    layer.appendChild(dlg);
    document.body.classList.add("modal-open");
    try { dlg.showModal(); } catch (e) { dlg.setAttribute("open", ""); }

    const form = dlg.querySelector("#onboard-form");
    const goalOn = form.elements.goalOn;
    const goalFields = dlg.querySelector("#onboard-goal-fields");
    const syncGoal = () => { goalFields.hidden = !goalOn.checked; };
    goalOn.addEventListener("change", syncGoal);

    let finished = false;
    function finish(skip) {
      if (finished) return;
      finished = true;
      if (skip) {
        s.settings.onboarded = true;
        commit("Setup skipped");
        ui.toast("Your khata is ready. Add your first entry when you are.", "success");
      }
      try { dlg.close(); } catch (e) {}
      dlg.remove();
      document.body.classList.remove("modal-open");
    }

    dlg.addEventListener("cancel", (e) => e.preventDefault());
    dlg.querySelector("#onboard-skip").addEventListener("click", async () => {
      const ok = await ui.confirm({
        title: "Skip setup?",
        message: "You can add your name, opening balance and a goal later in Settings and Plan.",
        confirmLabel: "Skip setup",
        cancelLabel: "Keep setting up"
      });
      if (ok) finish(true);
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      ui.clearErrors(form);
      const name = String(form.elements.name.value || "").trim();
      const opening = String(form.elements.opening.value || "").trim() ? money.parse(form.elements.opening.value) : 0;
      const savings = Dhan.clamp(Number(form.elements.savingsTarget.value) || 20, 0, 90);
      let goalTarget = 0;
      let goalDate = "";
      let goalName = "";
      if (goalOn.checked) {
        goalName = String(form.elements.goalName.value || "").trim();
        goalTarget = money.parse(form.elements.goalTarget.value);
        goalDate = form.elements.goalDate.value;
        let ok = true;
        if (!goalName) { ui.fieldError(form.elements.goalName, "Name your first goal, or untick the box."); ok = false; }
        if (goalTarget == null || goalTarget <= 0) { ui.fieldError(form.elements.goalTarget, "Enter a target above zero."); ok = false; }
        if (!date.isValidISODate(goalDate)) { ui.fieldError(form.elements.goalDate, "Pick a target date."); ok = false; }
        if (opening == null) { ui.fieldError(form.elements.opening, "Use a number like 25000."); ok = false; }
        if (!ok) return;
      }
      if (opening == null) { ui.fieldError(form.elements.opening, "Use a number like 25000."); return; }

      s.settings.name = name.slice(0, 60);
      s.settings.savingsTargetPct = savings;
      s.settings.onboarded = true;
      const bank = s.accounts.find((a) => a.id === "acc_bank") || s.accounts[0];
      if (bank && opening > 0) bank.openingPaise = opening;
      if (goalOn.checked) {
        s.goals.push({
          id: Dhan.uid("goal"),
          name: goalName.slice(0, 60),
          targetPaise: goalTarget,
          targetDate: goalDate,
          icon: /car|scooter|bike|slavia|car/i.test(goalName) ? "car" : "target",
          note: "",
          archived: false,
          createdAt: nowStamp()
        });
      }
      commit("Welcome to Dhan");
      finished = true;
      try { dlg.close(); } catch (err) {}
      dlg.remove();
      document.body.classList.remove("modal-open");
      ui.toast(goalOn.checked ? "Your khata is ready — goal included." : "Your khata is ready.", "success");
    });
  }

  Dhan.modals = {
    openTransaction: openTransaction,
    openAccount: openAccount,
    openGoal: openGoal,
    openContribution: openContribution,
    openGoalDetail: openGoalDetail,
    openBudget: openBudget,
    openDeduction: openDeduction,
    openCategory: openCategory,
    openMore: openMore,
    openOnboarding: openOnboarding,
    goalTemplates: GOAL_TEMPLATES
  };
})(typeof window !== "undefined" ? window : globalThis);
