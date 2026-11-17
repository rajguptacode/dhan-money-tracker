/* Dhan — core utilities, state, storage, derived numbers and tax maths.
   No DOM in this file. Exposed on window.Dhan (and module.exports for tests). */
(function (root) {
  "use strict";

  const Dhan = root.Dhan = root.Dhan || {};
  const STORAGE_KEY = "dhan.state.v1";
  const SNAPSHOT_KEY = "dhan.snapshots.v1";
  const SCHEMA = 1;

  const hasStorage = (() => {
    try {
      const k = "__dhan_probe__";
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  })();

  /* ---------- small utilities ---------- */
  const esc = (value) => String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const uid = (prefix) => {
    const rand = (root.crypto && root.crypto.randomUUID)
      ? root.crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    return (prefix || "id") + "_" + rand;
  };

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const pct = (part, total) => (total > 0 ? (part / total) * 100 : 0);
  const round = (n, digits = 0) => {
    const p = Math.pow(10, digits);
    return Math.round((Number(n) + Number.EPSILON) * p) / p;
  };
  const sum = (list, fn) => list.reduce((total, item) => total + (fn ? fn(item) : item), 0);
  const unique = (list) => Array.from(new Set(list));
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const sortBy = (list, key, dir) => list.slice().sort((a, b) => {
    const av = typeof key === "function" ? key(a) : a[key];
    const bv = typeof key === "function" ? key(b) : b[key];
    if (av === bv) return 0;
    return (av > bv ? 1 : -1) * (dir === "desc" ? -1 : 1);
  });

  /* ---------- dates (local, ISO date strings only) ---------- */
  const pad2 = (n) => String(n).padStart(2, "0");
  const isValidISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) &&
    !Number.isNaN(parseISO(s).getTime());
  const parseISO = (s) => {
    const parts = String(s || "").slice(0, 10).split("-").map(Number);
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return new Date(NaN);
    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
  };
  const toISODate = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return "";
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  };
  const todayISO = () => toISODate(new Date());
  const nowISO = () => new Date().toISOString();
  const monthKey = (isoDate) => String(isoDate || "").slice(0, 7);
  const addDays = (isoDate, days) => {
    const d = parseISO(isoDate);
    d.setDate(d.getDate() + days);
    return toISODate(d);
  };
  const addMonths = (month, delta) => {
    const parts = String(month).slice(0, 7).split("-").map(Number);
    const d = new Date(parts[0], parts[1] - 1 + delta, 1, 12);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1);
  };
  const monthEnd = (month) => {
    const parts = String(month).slice(0, 7).split("-").map(Number);
    const d = new Date(parts[0], parts[1], 0, 12);
    return toISODate(d);
  };
  const monthStart = (month) => String(month).slice(0, 7) + "-01";
  const monthRange = (month) => ({ start: monthStart(month), end: monthEnd(month) });
  const fmtDate = (isoDate, opts) => {
    const d = parseISO(isoDate);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-IN", Object.assign({ day: "numeric", month: "short", year: "numeric" }, opts || {}));
  };
  const fmtDay = (isoDate) => {
    const d = parseISO(isoDate);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  };
  const fmtMonth = (month) => {
    const d = parseISO(String(month).slice(0, 7) + "-01");
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  };
  const fmtMonthLong = (month) => {
    const d = parseISO(String(month).slice(0, 7) + "-01");
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  };
  const fmtMonthShort = (month) => {
    const d = parseISO(String(month).slice(0, 7) + "-01");
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-IN", { month: "short" });
  };
  const daysBetween = (fromISO, toISO) => {
    const a = parseISO(fromISO), b = parseISO(toISO);
    return Math.round((b - a) / 86400000);
  };
  const monthsUntil = (targetISO) => {
    const target = parseISO(targetISO);
    const now = new Date();
    if (Number.isNaN(target.getTime())) return 0;
    const diff = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
    if (diff < 0) return 0;
    return diff + (target.getDate() >= now.getDate() ? 1 : 0);
  };
  const currentMonth = () => todayISO().slice(0, 7);
  const fyOf = (isoDate, startMonth) => {
    const d = parseISO(isoDate || todayISO());
    const sm = Number(startMonth || 4);
    const y = d.getMonth() + 1 >= sm ? d.getFullYear() : d.getFullYear() - 1;
    return y + "-" + String((y + 1) % 100).padStart(2, "0");
  };
  const fyStartYear = (fy) => Number(String(fy).slice(0, 4));
  const fyRange = (fy) => {
    const y = fyStartYear(fy);
    if (!Number.isFinite(y)) return { start: "0000-04-01", end: "0000-03-31" };
    return { start: y + "-04-01", end: (y + 1) + "-03-31" };
  };
  const fyLabel = (fy) => "FY " + String(fy).replace("-", "–");
  const fyOptions = (count, fromDate) => {
    const cur = fyOf(fromDate || todayISO());
    const y = fyStartYear(cur);
    return Array.from({ length: count || 3 }, (_, i) => (y - i) + "-" + String((y - i + 1) % 100).padStart(2, "0"));
  };
  const fyMonths = (fy) => {
    const y = fyStartYear(fy);
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(y, 3 + i, 1, 12);
      return d.getFullYear() + "-" + pad2(d.getMonth() + 1);
    });
  };
  const inFY = (isoDate, fy) => {
    const r = fyRange(fy);
    return isoDate >= r.start && isoDate <= r.end;
  };

  /* ---------- money ---------- */
  const inr0 = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0, minimumFractionDigits: 0 });
  const inr2 = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2, minimumFractionDigits: 2 });

  const money = {
    parse(str) {
      if (typeof str === "number") return Number.isFinite(str) ? Math.round(str * 100) : null;
      let s = String(str == null ? "" : str).trim();
      if (!s) return null;
      s = s.replace(/[₹,\s]/g, "").replace(/[−–]/g, "-");
      if (!/^-?\d*\.?\d*$/.test(s) || s === "-" || s === "." || s === "-.") return null;
      const n = Number(s);
      if (!Number.isFinite(n)) return null;
      const paise = Math.round(n * 100);
      if (!Number.isSafeInteger(paise)) return null;
      return paise;
    },
    rupees(paise) {
      return (Number(paise) || 0) / 100;
    },
    fmt(paise, opts) {
      const o = opts || {};
      const value = Number(paise) || 0;
      if (o.compact) return money.compact(value);
      const neg = value < 0;
      const abs = Math.abs(value) / 100;
      const d = o.decimals != null ? o.decimals : (abs % 1 === 0 ? 0 : 2);
      let out = (d === 2 ? inr2 : inr0).format(abs);
      if (neg) out = "−" + out;
      if (o.sign && value > 0) out = "+" + out;
      return out;
    },
    compact(paise) {
      const value = Math.abs(Number(paise) || 0) / 100;
      const sign = (Number(paise) || 0) < 0 ? "−" : "";
      if (value >= 1e7) return sign + "₹" + trimZeros(round(value / 1e7, 2)) + "Cr";
      if (value >= 1e5) return sign + "₹" + trimZeros(round(value / 1e5, 2)) + "L";
      if (value >= 1e3) return sign + "₹" + trimZeros(round(value / 1e3, 1)) + "K";
      return money.fmt(paise, { decimals: 0 });
    },
    input(paise) {
      return (Math.round(Number(paise) || 0) / 100).toString();
    },
    plain(paise) {
      return (Math.round(Number(paise) || 0) / 100).toFixed(2);
    },
    mask() { return "₹ ••••••"; }
  };
  const trimZeros = (n) => String(n).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");

  /* ---------- constants ---------- */
  const CATEGORY_COLORS = ["emerald", "terra", "ochre", "teal", "plum", "olive", "rose", "slate"];
  const TAX_BUCKETS = [
    { id: "salary", label: "Salary / pension" },
    { id: "business", label: "Business / freelance" },
    { id: "savings_interest", label: "Savings bank interest" },
    { id: "other_interest", label: "FD / other interest" },
    { id: "other", label: "Other taxable income" },
    { id: "exempt", label: "Exempt / non-taxable" }
  ];
  const ACCOUNT_TYPES = [
    { id: "bank", label: "Bank account", icon: "bank", liability: false },
    { id: "cash", label: "Cash", icon: "coins", liability: false },
    { id: "wallet", label: "Wallet / UPI", icon: "wallet", liability: false },
    { id: "investment", label: "Investment", icon: "trend", liability: false },
    { id: "credit", label: "Credit card", icon: "card", liability: true },
    { id: "loan", label: "Loan", icon: "bank", liability: true }
  ];
  const GOAL_ICONS = [
    { id: "car", label: "Car" },
    { id: "house", label: "Home" },
    { id: "umbrella", label: "Emergency fund" },
    { id: "plane", label: "Travel" },
    { id: "book", label: "Education" },
    { id: "gift", label: "Something else" },
    { id: "target", label: "Other goal" }
  ];
  const DEDUCTION_SECTIONS = [
    { id: "80C", label: "80C — PPF, ELSS, EPF, life insurance", cap: 150000, hint: "Overall cap ₹1.5 lakh" },
    { id: "80CCD(1B)", label: "80CCD(1B) — extra NPS", cap: 50000, hint: "Extra ₹50,000 over 80C" },
    { id: "80D", label: "80D — health insurance", cap: null, hint: "₹25k self / ₹50k senior; parents extra" },
    { id: "24(b)", label: "24(b) — home loan interest", cap: 200000, hint: "Cap ₹2 lakh for self-occupied" },
    { id: "80E", label: "80E — education loan interest", cap: null, hint: "No cap; old regime only" },
    { id: "80G", label: "80G — donations", cap: null, hint: "50% or 100% depending on the fund" },
    { id: "HRA", label: "HRA / exempt allowances", cap: null, hint: "Enter the eligible exempt amount" },
    { id: "Other", label: "Other deductions", cap: null, hint: "Anything else your CA confirms" }
  ];

  const defaultCategories = () => [
    { id: "cat_salary", name: "Salary", type: "income", icon: "briefcase", color: "emerald", bucket: "salary", archived: false },
    { id: "cat_freelance", name: "Freelance / business", type: "income", icon: "laptop", color: "teal", bucket: "business", archived: false },
    { id: "cat_interest", name: "Bank interest", type: "income", icon: "percent", color: "ochre", bucket: "savings_interest", archived: false },
    { id: "cat_fd_interest", name: "FD / RD interest", type: "income", icon: "coins", color: "ochre", bucket: "other_interest", archived: false },
    { id: "cat_returns", name: "Investment returns", type: "income", icon: "trend", color: "plum", bucket: "other", archived: false },
    { id: "cat_cashback", name: "Cashback / refund", type: "income", icon: "rotate", color: "slate", bucket: "exempt", archived: false },
    { id: "cat_gift_in", name: "Gift received", type: "income", icon: "gift", color: "rose", bucket: "exempt", archived: false },
    { id: "cat_other_income", name: "Other income", type: "income", icon: "plus", color: "olive", bucket: "other", archived: false },
    { id: "cat_food", name: "Food & dining", type: "expense", icon: "bowl", color: "terra", archived: false },
    { id: "cat_groceries", name: "Groceries", type: "expense", icon: "basket", color: "olive", archived: false },
    { id: "cat_transport", name: "Transport", type: "expense", icon: "bus", color: "teal", archived: false },
    { id: "cat_fuel", name: "Fuel", type: "expense", icon: "fuel", color: "ochre", archived: false },
    { id: "cat_rent", name: "Rent", type: "expense", icon: "house", color: "plum", archived: false },
    { id: "cat_utilities", name: "Utilities", type: "expense", icon: "bolt", color: "ochre", archived: false },
    { id: "cat_mobile", name: "Mobile & internet", type: "expense", icon: "phone", color: "teal", archived: false },
    { id: "cat_health", name: "Health", type: "expense", icon: "heart", color: "rose", archived: false },
    { id: "cat_education", name: "Education", type: "expense", icon: "book", color: "plum", archived: false },
    { id: "cat_shopping", name: "Shopping", type: "expense", icon: "bag", color: "rose", archived: false },
    { id: "cat_fun", name: "Entertainment", type: "expense", icon: "film", color: "plum", archived: false },
    { id: "cat_travel", name: "Travel", type: "expense", icon: "plane", color: "teal", archived: false },
    { id: "cat_family", name: "Family & gifts", type: "expense", icon: "users", color: "ochre", archived: false },
    { id: "cat_emi", name: "EMI & loans", type: "expense", icon: "bank", color: "slate", archived: false },
    { id: "cat_insurance", name: "Insurance", type: "expense", icon: "shield", color: "emerald", archived: false },
    { id: "cat_investments", name: "Investments", type: "expense", icon: "trend", color: "emerald", archived: false },
    { id: "cat_car", name: "Car care", type: "expense", icon: "wrench", color: "terra", archived: false },
    { id: "cat_taxes", name: "Taxes & fees", type: "expense", icon: "receipt", color: "slate", archived: false },
    { id: "cat_donations", name: "Donations", type: "expense", icon: "gift", color: "olive", archived: false },
    { id: "cat_other", name: "Other", type: "expense", icon: "dots", color: "slate", archived: false }
  ];

  const defaultSettings = () => ({
    name: "",
    theme: "system",
    savingsTargetPct: 20,
    onboarded: false,
    googleSheetUrl: "",
    googleSheetToken: "",
    lastSyncAt: null,
    createdAt: nowISO()
  });

  function defaultState() {
    return {
      schema: SCHEMA,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      settings: defaultSettings(),
      accounts: [
        { id: "acc_bank", name: "Bank account", type: "bank", openingPaise: 0, institution: "", last4: "", archived: false, createdAt: nowISO() },
        { id: "acc_cash", name: "Cash", type: "cash", openingPaise: 0, institution: "", last4: "", archived: false, createdAt: nowISO() }
      ],
      categories: defaultCategories(),
      transactions: [],
      budgets: [],
      goals: [],
      contributions: [],
      deductions: [],
      taxSettings: {}
    };
  }

  /* ---------- state loading & storage ---------- */
  const toPaiseValue = (v, fallback) => {
    if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
    const parsed = money.parse(v);
    return parsed == null ? (fallback || 0) : parsed;
  };
  const cleanString = (v, max) => String(v == null ? "" : v).trim().slice(0, max || 500);

  function normalizeState(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Not a Dhan state");
    const base = defaultState();
    const s = {
      schema: SCHEMA,
      createdAt: raw.createdAt || base.createdAt,
      updatedAt: raw.updatedAt || base.updatedAt,
      settings: Object.assign(base.settings, raw.settings || {}),
      accounts: [],
      categories: [],
      transactions: [],
      budgets: [],
      goals: [],
      contributions: [],
      deductions: [],
      taxSettings: raw.taxSettings && typeof raw.taxSettings === "object" ? raw.taxSettings : {}
    };

    s.settings.name = cleanString(s.settings.name, 60);
    s.settings.theme = ["light", "dark", "system"].includes(s.settings.theme) ? s.settings.theme : "system";
    s.settings.savingsTargetPct = clamp(Number(s.settings.savingsTargetPct) || 0, 0, 90);
    s.settings.onboarded = Boolean(s.settings.onboarded);
    s.settings.googleSheetUrl = cleanString(s.settings.googleSheetUrl, 500);
    s.settings.googleSheetToken = cleanString(s.settings.googleSheetToken, 200);
    s.settings.lastSyncAt = s.settings.lastSyncAt || null;
    s.settings.createdAt = s.settings.createdAt || base.settings.createdAt;

    if (Array.isArray(raw.accounts)) {
      s.accounts = raw.accounts.filter((a) => a && typeof a === "object").map((a) => ({
        id: cleanString(a.id, 80) || uid("acc"),
        name: cleanString(a.name, 60) || "Account",
        type: ACCOUNT_TYPES.some((t) => t.id === a.type) ? a.type : "bank",
        openingPaise: toPaiseValue(a.openingPaise),
        institution: cleanString(a.institution, 80),
        last4: cleanString(a.last4, 4).replace(/\D/g, "").slice(0, 4),
        archived: Boolean(a.archived),
        createdAt: a.createdAt || nowISO()
      }));
    }
    if (!s.accounts.length) s.accounts = base.accounts;

    if (Array.isArray(raw.categories) && raw.categories.length) {
      s.categories = raw.categories.filter((c) => c && typeof c === "object").map((c) => ({
        id: cleanString(c.id, 80) || uid("cat"),
        name: cleanString(c.name, 50) || "Category",
        type: c.type === "income" ? "income" : "expense",
        icon: cleanString(c.icon, 30) || (c.type === "income" ? "plus" : "dots"),
        color: CATEGORY_COLORS.includes(c.color) ? c.color : "slate",
        bucket: c.type === "income" && TAX_BUCKETS.some((b) => b.id === c.bucket) ? c.bucket : (c.type === "income" ? "other" : undefined),
        archived: Boolean(c.archived)
      }));
    } else s.categories = base.categories;

    if (Array.isArray(raw.transactions)) {
      s.transactions = raw.transactions.filter((t) => t && typeof t === "object").map((t) => {
        const type = ["income", "expense", "transfer"].includes(t.type) ? t.type : "expense";
        return {
          id: cleanString(t.id, 80) || uid("tx"),
          type,
          date: isValidISODate(t.date) ? String(t.date).slice(0, 10) : todayISO(),
          amountPaise: Math.abs(toPaiseValue(t.amountPaise)),
          accountId: cleanString(t.accountId, 80),
          toAccountId: type === "transfer" ? cleanString(t.toAccountId, 80) : "",
          categoryId: type === "transfer" ? "" : cleanString(t.categoryId, 80),
          note: cleanString(t.note, 180),
          createdAt: t.createdAt || nowISO(),
          updatedAt: t.updatedAt || t.createdAt || nowISO()
        };
      }).filter((t) => t.amountPaise > 0);
    }

    if (Array.isArray(raw.budgets)) {
      s.budgets = raw.budgets.filter((b) => b && typeof b === "object").map((b) => ({
        id: cleanString(b.id, 80) || uid("bud"),
        month: /^\d{4}-\d{2}$/.test(String(b.month)) ? String(b.month).slice(0, 7) : currentMonth(),
        categoryId: cleanString(b.categoryId, 80),
        amountPaise: Math.max(0, toPaiseValue(b.amountPaise))
      })).filter((b) => b.amountPaise > 0 && b.categoryId);
    }

    if (Array.isArray(raw.goals)) {
      s.goals = raw.goals.filter((g) => g && typeof g === "object").map((g) => ({
        id: cleanString(g.id, 80) || uid("goal"),
        name: cleanString(g.name, 60) || "Goal",
        targetPaise: Math.max(0, toPaiseValue(g.targetPaise)),
        targetDate: isValidISODate(g.targetDate) ? g.targetDate : addDays(todayISO(), 365),
        icon: GOAL_ICONS.some((i) => i.id === g.icon) ? g.icon : "target",
        note: cleanString(g.note, 180),
        archived: Boolean(g.archived),
        createdAt: g.createdAt || nowISO()
      })).filter((g) => g.targetPaise > 0);
    }

    if (Array.isArray(raw.contributions)) {
      s.contributions = raw.contributions.filter((c) => c && typeof c === "object").map((c) => ({
        id: cleanString(c.id, 80) || uid("con"),
        goalId: cleanString(c.goalId, 80),
        amountPaise: Math.abs(toPaiseValue(c.amountPaise)),
        date: isValidISODate(c.date) ? String(c.date).slice(0, 10) : todayISO(),
        accountId: cleanString(c.accountId, 80),
        note: cleanString(c.note, 180),
        createdAt: c.createdAt || nowISO()
      })).filter((c) => c.amountPaise > 0 && c.goalId);
    }

    if (Array.isArray(raw.deductions)) {
      s.deductions = raw.deductions.filter((d) => d && typeof d === "object").map((d) => ({
        id: cleanString(d.id, 80) || uid("ded"),
        fy: /^\d{4}-\d{2}$/.test(String(d.fy)) ? String(d.fy) : fyOf(todayISO()),
        section: DEDUCTION_SECTIONS.some((x) => x.id === d.section) ? d.section : "Other",
        label: cleanString(d.label, 80),
        amountPaise: Math.max(0, toPaiseValue(d.amountPaise)),
        createdAt: d.createdAt || nowISO()
      })).filter((d) => d.amountPaise > 0);
    }

    return s;
  }

  const store = {
    key: STORAGE_KEY,
    load() {
      const fresh = defaultState();
      if (!hasStorage) return { state: fresh, warning: null, fresh: true };
      let raw;
      try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { return { state: fresh, warning: "Storage is blocked by the browser.", fresh: true }; }
      if (!raw) return { state: fresh, warning: null, fresh: true };
      try {
        return { state: normalizeState(JSON.parse(raw)), warning: null, fresh: false };
      } catch (e) {
        try { localStorage.setItem("dhan.corrupt." + Date.now(), raw); } catch (err) {}
        return { state: fresh, warning: "Saved data could not be read. A copy was kept in this browser.", fresh: true };
      }
    },
    save(state) {
      if (!hasStorage) return { ok: false, error: "This browser is blocking local storage." };
      state.updatedAt = nowISO();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        return { ok: true };
      } catch (e) {
        return { ok: false, error: "Storage is full. Export a backup and clear old browser data." };
      }
    },
    snapshots() {
      if (!hasStorage) return [];
      try {
        const raw = localStorage.getItem(SNAPSHOT_KEY);
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list : [];
      } catch (e) { return []; }
    },
    snapshot(state, reason) {
      if (!hasStorage) return null;
      try {
        const list = store.snapshots();
        const item = { id: uid("snap"), at: nowISO(), reason: reason || "Manual snapshot", state: clone(state) };
        list.unshift(item);
        const trimmed = list.slice(0, 4);
        localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(trimmed));
        return item;
      } catch (e) { return null; }
    },
    removeSnapshot(id) {
      if (!hasStorage) return;
      try {
        localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(store.snapshots().filter((s) => s.id !== id)));
      } catch (e) {}
    },
    clearState() {
      if (!hasStorage) return;
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    },
    isPersistent: async function () {
      if (!navigator.storage || !navigator.storage.persist) return null;
      try { return await navigator.storage.persist(); } catch (e) { return null; }
    },
    estimate: async function () {
      if (!navigator.storage || !navigator.storage.estimate) return null;
      try { return await navigator.storage.estimate(); } catch (e) { return null; }
    }
  };

  function backupPayload(state) {
    return { app: "dhan", appVersion: 1, exportedAt: nowISO(), state: normalizeState(state) };
  }
  function parseBackup(text) {
    let raw;
    try { raw = JSON.parse(text); } catch (e) { throw new Error("This file is not valid JSON."); }
    const candidate = raw && raw.state ? raw.state : raw;
    if (!candidate || typeof candidate !== "object" || !Array.isArray(candidate.transactions) || !Array.isArray(candidate.accounts)) {
      throw new Error("This file isn't a Dhan backup. Choose a .json file exported from Settings.");
    }
    return normalizeState(candidate);
  }

  /* ---------- category/account lookups ---------- */
  const byId = (list, id) => (list || []).find((x) => x.id === id) || null;
  const accountById = (state, id) => byId(state.accounts, id);
  const categoryById = (state, id) => byId(state.categories, id);
  const categoryName = (state, id) => (categoryById(state, id) || {}).name || "Uncategorised";
  const accountName = (state, id) => (accountById(state, id) || {}).name || "Unknown account";
  const activeCategories = (state, type) => state.categories.filter((c) => !c.archived && (!type || c.type === type));
  const activeAccounts = (state) => state.accounts.filter((a) => !a.archived);
  const accountType = (type) => ACCOUNT_TYPES.find((t) => t.id === type) || ACCOUNT_TYPES[0];
  const taxBucketLabel = (id) => (TAX_BUCKETS.find((b) => b.id === id) || TAX_BUCKETS[4]).label;

  /* ---------- balances & basics ---------- */
  function accountBalance(state, accountId) {
    const account = accountById(state, accountId);
    let bal = account ? Number(account.openingPaise) || 0 : 0;
    for (const tx of state.transactions) {
      if (tx.accountId === accountId) {
        if (tx.type === "income") bal += tx.amountPaise;
        else bal -= tx.amountPaise;
      }
      if (tx.type === "transfer" && tx.toAccountId === accountId) bal += tx.amountPaise;
    }
    return bal;
  }
  function netWorth(state, includeArchived) {
    return sum(state.accounts.filter((a) => includeArchived || !a.archived), (a) => accountBalance(state, a.id));
  }
  function assetsAndLiabilities(state) {
    let assets = 0, liabilities = 0;
    for (const a of activeAccounts(state)) {
      const bal = accountBalance(state, a.id);
      if (bal >= 0) assets += bal; else liabilities += -bal;
    }
    return { assets, liabilities, net: assets - liabilities };
  }
  function txsInRange(state, start, end, type) {
    return state.transactions.filter((t) => t.date >= start && t.date <= end && (!type || type === "all" || t.type === type));
  }
  function txsInMonth(state, month) {
    const r = monthRange(month);
    return txsInRange(state, r.start, r.end);
  }
  function incomeExpense(state, txs) {
    let income = 0, expense = 0;
    for (const t of txs) {
      if (t.type === "income") income += t.amountPaise;
      else if (t.type === "expense") expense += t.amountPaise;
    }
    return { income, expense, savings: income - expense, rate: pct(income - expense, income) };
  }
  function monthStats(state, month) {
    const txs = txsInMonth(state, month);
    return Object.assign(incomeExpense(state, txs), { txs });
  }
  function fyStats(state, fy) {
    const r = fyRange(fy);
    return incomeExpense(state, txsInRange(state, r.start, r.end));
  }
  function monthlySummary(state, fy) {
    return fyMonths(fy).map((m) => {
      const s = monthStats(state, m);
      return { month: m, label: fmtMonthShort(m), labelLong: fmtMonth(m), income: s.income, expense: s.expense, savings: s.savings, rate: s.rate };
    });
  }
  function categorySpend(state, txs) {
    const map = new Map();
    for (const t of txs) {
      if (t.type !== "expense") continue;
      const key = t.categoryId || "uncategorised";
      const cat = categoryById(state, key);
      const row = map.get(key) || { categoryId: key, name: cat ? cat.name : "Uncategorised", icon: cat ? cat.icon : "dots", color: cat ? cat.color : "slate", amountPaise: 0 };
      row.amountPaise += t.amountPaise;
      map.set(key, row);
    }
    return Array.from(map.values()).sort((a, b) => b.amountPaise - a.amountPaise);
  }
  function topCategories(rows, limit) {
    const n = limit || 5;
    if (rows.length <= n) return rows;
    const head = rows.slice(0, n - 1);
    const rest = rows.slice(n - 1);
    const total = sum(rest, (r) => r.amountPaise);
    return head.concat([{ categoryId: "__other", name: "Other categories", icon: "dots", color: "slate", amountPaise: total, isGrouped: true }]);
  }
  function budgetFor(state, month, categoryId) {
    return state.budgets.find((b) => b.month === month && b.categoryId === categoryId) || null;
  }
  function budgetLines(state, month) {
    const txs = txsInMonth(state, month);
    const spendBy = new Map();
    for (const t of txs) {
      if (t.type !== "expense") continue;
      spendBy.set(t.categoryId, (spendBy.get(t.categoryId) || 0) + t.amountPaise);
    }
    return state.budgets.filter((b) => b.month === month).map((b) => {
      const cat = categoryById(state, b.categoryId);
      const spent = spendBy.get(b.categoryId) || 0;
      return {
        budget: b,
        category: cat,
        name: cat ? cat.name : "Category",
        icon: cat ? cat.icon : "dots",
        color: cat ? cat.color : "slate",
        spent,
        remaining: b.amountPaise - spent,
        progress: pct(spent, b.amountPaise),
        over: spent > b.amountPaise
      };
    }).sort((a, b) => b.progress - a.progress);
  }
  function unbudgetedSpend(state, month) {
    const budgeted = new Set(state.budgets.filter((b) => b.month === month).map((b) => b.categoryId));
    return categorySpend(state, txsInMonth(state, month)).filter((r) => !budgeted.has(r.categoryId));
  }
  function goalSaved(state, goalId) {
    return sum(state.contributions.filter((c) => c.goalId === goalId), (c) => c.amountPaise);
  }
  function goalProgress(state, goal) {
    const saved = goalSaved(state, goal.id);
    return {
      saved,
      remaining: Math.max(0, goal.targetPaise - saved),
      progress: pct(saved, goal.targetPaise),
      done: saved >= goal.targetPaise,
      monthsLeft: monthsUntil(goal.targetDate),
      monthlyNeeded: Math.max(0, goal.targetPaise - saved) / Math.max(1, monthsUntil(goal.targetDate))
    };
  }
  function netWorthSeries(state, months) {
    const n = months || 6;
    const points = [];
    const active = new Set(state.accounts.filter((a) => !a.archived).map((a) => a.id));
    const base = sum(state.accounts.filter((a) => active.has(a.id)), (a) => Number(a.openingPaise) || 0);
    for (let i = n - 1; i >= 0; i--) {
      const m = addMonths(currentMonth(), -i);
      const end = monthEnd(m);
      let net = base;
      for (const tx of state.transactions) {
        if (!active.has(tx.accountId)) continue;
        if (tx.date > end) continue;
        if (tx.type === "income") net += tx.amountPaise;
        else if (tx.type === "expense") net -= tx.amountPaise;
      }
      points.push({ month: m, label: fmtMonthShort(m), value: net });
    }
    return points;
  }


  /* ---------- income heads, deductions & tax ---------- */
  const OLD_RULE = {
    slabs: [[250000, 0], [500000, 0.05], [1000000, 0.20], [Infinity, 0.30]],
    std: 50000, rebateLimit: 500000, rebateMax: 12500, marginalRelief: false
  };
  const TAX_RULES = {
    "2024-25": {
      assumed: false,
      new: {
        slabs: [[300000, 0], [700000, 0.05], [1000000, 0.10], [1200000, 0.15], [1500000, 0.20], [Infinity, 0.30]],
        std: 75000, rebateLimit: 700000, rebateMax: 25000, marginalRelief: true
      },
      old: OLD_RULE
    },
    "2025-26": {
      assumed: false,
      new: {
        slabs: [[400000, 0], [800000, 0.05], [1200000, 0.10], [1600000, 0.15], [2000000, 0.20], [2400000, 0.25], [Infinity, 0.30]],
        std: 75000, rebateLimit: 1200000, rebateMax: 60000, marginalRelief: true
      },
      old: OLD_RULE
    },
    "2026-27": {
      assumed: true,
      new: {
        slabs: [[400000, 0], [800000, 0.05], [1200000, 0.10], [1600000, 0.15], [2000000, 0.20], [2400000, 0.25], [Infinity, 0.30]],
        std: 75000, rebateLimit: 1200000, rebateMax: 60000, marginalRelief: true
      },
      old: OLD_RULE
    }
  };
  const taxRulesFor = (fy) => TAX_RULES[fy] || TAX_RULES["2026-27"];

  function taxSettingsFor(state, fy) {
    const raw = (state.taxSettings && state.taxSettings[fy]) || {};
    return {
      regime: raw.regime === "old" ? "old" : "new",
      tdsPaise: Math.max(0, toPaiseValue(raw.tdsPaise)),
      advancePaise: Math.max(0, toPaiseValue(raw.advancePaise))
    };
  }

  function incomeByBucket(state, fy) {
    const buckets = TAX_BUCKETS.map((b) => ({ id: b.id, label: b.label, amountPaise: 0, count: 0, categories: [] }));
    const map = new Map(buckets.map((b) => [b.id, b]));
    const range = fyRange(fy);
    for (const tx of state.transactions) {
      if (tx.type !== "income" || tx.date < range.start || tx.date > range.end) continue;
      const cat = categoryById(state, tx.categoryId);
      const bucketId = cat && cat.bucket && map.has(cat.bucket) ? cat.bucket : "other";
      const row = map.get(bucketId);
      row.amountPaise += tx.amountPaise;
      row.count += 1;
      if (cat && !row.categories.some((c) => c.id === cat.id)) row.categories.push({ id: cat.id, name: cat.name });
    }
    const get = (id) => (map.get(id) || {}).amountPaise || 0;
    const taxable = get("salary") + get("business") + get("savings_interest") + get("other_interest") + get("other");
    return {
      buckets,
      salary: get("salary"),
      business: get("business"),
      savingsInterest: get("savings_interest"),
      otherInterest: get("other_interest"),
      other: get("other"),
      exempt: get("exempt"),
      grossTaxable: taxable,
      totalIncome: taxable + get("exempt")
    };
  }

  function deductionBreakdown(state, fy, regime) {
    const entries = state.deductions.filter((d) => d.fy === fy);
    const bySection = new Map();
    for (const d of entries) {
      const row = bySection.get(d.section) || { section: d.section, label: "", enteredPaise: 0, appliedPaise: 0, cap: null, count: 0 };
      row.enteredPaise += d.amountPaise;
      row.count += 1;
      bySection.set(d.section, row);
    }
    for (const sec of DEDUCTION_SECTIONS) {
      if (!bySection.has(sec.id)) continue;
      const row = bySection.get(sec.id);
      row.label = sec.label;
      row.cap = sec.cap;
      row.appliedPaise = sec.cap != null ? Math.min(row.enteredPaise, sec.cap * 100) : row.enteredPaise;
    }
    const lines = Array.from(bySection.values()).filter((r) => r.enteredPaise > 0);
    const manualEntered = sum(lines, (r) => r.enteredPaise);
    const manualApplied = regime === "old" ? sum(lines, (r) => r.appliedPaise) : 0;
    return { lines, manualEntered, manualApplied, entryCount: entries.length };
  }

  function slabTax(taxableRupees, slabs) {
    let tax = 0;
    let last = 0;
    for (const [upto, rate] of slabs) {
      if (taxableRupees > last) tax += (Math.min(taxableRupees, upto) - last) * rate;
      last = upto;
      if (taxableRupees <= upto) break;
    }
    return Math.max(0, tax);
  }

  function computeTax(state, fy, regimeOverride) {
    const income = incomeByBucket(state, fy);
    const settings = taxSettingsFor(state, fy);
    const regime = regimeOverride === "old" || regimeOverride === "new" ? regimeOverride : settings.regime;
    const rulesSet = taxRulesFor(fy);
    const rules = regime === "new" ? rulesSet.new : rulesSet.old;
    const ded = deductionBreakdown(state, fy, regime);

    const standard = Math.min(income.salary, rules.std * 100);
    const tta = regime === "old" ? Math.min(income.savingsInterest, 10000 * 100) : 0;
    const chapterVIA = ded.manualApplied;
    const totalDeductions = standard + tta + chapterVIA;
    const taxablePaise = Math.max(0, income.grossTaxable - totalDeductions);
    const taxable = money.rupees(taxablePaise);

    const taxBefore = slabTax(taxable, rules.slabs);
    let rebate = 0;
    let taxAfter = taxBefore;
    if (taxable <= rules.rebateLimit) {
      rebate = Math.min(taxBefore, rules.rebateMax);
      taxAfter = Math.max(0, taxBefore - rebate);
    } else if (rules.marginalRelief) {
      const excess = taxable - rules.rebateLimit;
      if (taxBefore > excess) {
        rebate = taxBefore - excess;
        taxAfter = excess;
      }
    }
    const cess = taxAfter * 0.04;
    const totalTax = Math.round((taxAfter + cess) * 100);
    const paid = settings.tdsPaise + settings.advancePaise;
    return {
      fy, regime, rulesSet, rules,
      income, settings,
      standardPaise: standard,
      ttaPaise: tta,
      deductionLines: ded.lines,
      manualEnteredPaise: ded.manualEntered,
      manualAppliedPaise: chapterVIA,
      totalDeductionsPaise: totalDeductions,
      taxablePaise,
      taxBeforeRebatePaise: Math.round(taxBefore * 100),
      rebatePaise: Math.round(rebate * 100),
      taxAfterRebatePaise: Math.round(taxAfter * 100),
      cessPaise: Math.round(cess * 100),
      totalTaxPaise: totalTax,
      tdsPaise: settings.tdsPaise,
      advancePaise: settings.advancePaise,
      paidPaise: paid,
      balancePaise: totalTax - paid,
      effectiveRate: pct(totalTax, income.grossTaxable),
      surchargeIgnored: taxable > 5000000,
      assumed: Boolean(rulesSet.assumed)
    };
  }

  function compareRegimes(state, fy) {
    const fresh = computeTax(state, fy, "new");
    const old = computeTax(state, fy, "old");
    return {
      new: fresh,
      old,
      best: fresh.totalTaxPaise <= old.totalTaxPaise ? "new" : "old",
      savingPaise: Math.abs(fresh.totalTaxPaise - old.totalTaxPaise)
    };
  }

  /* ---------- CSV exports ---------- */
  function csvEscape(value) {
    const s = String(value == null ? "" : value);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCSV(rows) {
    return "\uFEFF" + rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
  }
  function typeLabel(type) {
    return type === "income" ? "Income" : type === "transfer" ? "Transfer" : "Expense";
  }
  function transactionsCSV(state, txs) {
    const rows = [["Date", "Type", "Category", "Amount (INR)", "Account", "To account", "Note", "FY", "Entry ID"]];
    const list = sortBy(txs || state.transactions, (t) => t.date + (t.createdAt || ""), "asc");
    for (const t of list) {
      rows.push([
        t.date, typeLabel(t.type),
        t.type === "transfer" ? "Transfer" : categoryName(state, t.categoryId),
        money.plain(t.amountPaise),
        accountName(state, t.accountId),
        t.type === "transfer" ? accountName(state, t.toAccountId) : "",
        t.note || "", fyOf(t.date), t.id
      ]);
    }
    return toCSV(rows);
  }
  function monthlyCSV(state, fy) {
    const rows = [["Month", "Income (INR)", "Expense (INR)", "Saved (INR)", "Savings rate %"]];
    for (const m of monthlySummary(state, fy)) {
      rows.push([m.month, money.plain(m.income), money.plain(m.expense), money.plain(m.savings), m.rate.toFixed(1)]);
    }
    return toCSV(rows);
  }
  function itrSummaryCSV(state, fy) {
    const t = computeTax(state, fy);
    const comp = compareRegimes(state, fy);
    const inc = t.income;
    const rows = [
      ["Dhan — ITR working summary"],
      ["Financial year", fy],
      ["Generated", fmtDate(todayISO())],
      ["Name", state.settings.name || ""],
      ["Regime used", t.regime === "new" ? "New regime" : "Old regime"],
      [],
      ["Income head", "Amount (INR)"],
      ["Salary / pension", money.plain(inc.salary)],
      ["Business / freelance", money.plain(inc.business)],
      ["Savings bank interest", money.plain(inc.savingsInterest)],
      ["FD / other interest", money.plain(inc.otherInterest)],
      ["Other taxable income", money.plain(inc.other)],
      ["Exempt / non-taxable", money.plain(inc.exempt)],
      ["Gross taxable income", money.plain(inc.grossTaxable)],
      [],
      ["Deductions", "Amount (INR)"],
      ["Standard deduction", money.plain(t.standardPaise)],
      ["80TTA (savings interest)", money.plain(t.ttaPaise)]
    ];
    for (const line of t.deductionLines) {
      rows.push([line.section + " — " + line.label.replace(/^[^—]+—\s*/, ""), money.plain(line.appliedPaise)]);
    }
    rows.push(
      ["Total deductions", money.plain(t.totalDeductionsPaise)],
      ["Taxable income", money.plain(t.taxablePaise)],
      [],
      ["Tax estimate", "Amount (INR)"],
      ["Tax before rebate", money.plain(t.taxBeforeRebatePaise)],
      ["Rebate u/s 87A", money.plain(t.rebatePaise)],
      ["Health & education cess", money.plain(t.cessPaise)],
      ["Total tax", money.plain(t.totalTaxPaise)],
      ["TDS / advance tax paid", money.plain(t.paidPaise)],
      [t.balancePaise >= 0 ? "Balance payable" : "Refund due", money.plain(Math.abs(t.balancePaise))],
      [],
      ["Regime comparison", "Total tax (INR)"],
      ["New regime", money.plain(comp.new.totalTaxPaise)],
      ["Old regime", money.plain(comp.old.totalTaxPaise)],
      ["Suggested", comp.best === "new" ? "New regime" : "Old regime"],
      [],
      ["Note", "Estimate only, not tax advice. Verify with a CA and the latest Finance Act."],
      ["Assumed slabs", t.assumed ? "Yes — FY 2026-27 uses FY 2025-26 slabs" : "No"]
    );
    return toCSV(rows);
  }

  function categoryUsage(state, categoryId) {
    return state.transactions.filter((t) => t.categoryId === categoryId).length;
  }
  function accountUsage(state, accountId) {
    return state.transactions.filter((t) => t.accountId === accountId || t.toAccountId === accountId).length;
  }
  function nextCategoryColor(state) {
    const used = new Set(state.categories.map((c) => c.color));
    return CATEGORY_COLORS.find((c) => !used.has(c)) || CATEGORY_COLORS[state.categories.length % CATEGORY_COLORS.length];
  }
  function isAppsScriptUrl(url) {
    return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec(?:\?.*)?$/.test(String(url || "").trim());
  }


  Dhan.SCHEMA = SCHEMA;
  Dhan.storageKey = STORAGE_KEY;
  Dhan.hasStorage = hasStorage;
  Dhan.esc = esc;
  Dhan.uid = uid;
  Dhan.clamp = clamp;
  Dhan.pct = pct;
  Dhan.round = round;
  Dhan.sum = sum;
  Dhan.unique = unique;
  Dhan.clone = clone;
  Dhan.sortBy = sortBy;
  Dhan.date = {
    pad2, parseISO, toISODate, todayISO, nowISO, monthKey, addDays, addMonths, monthEnd, monthStart,
    monthRange, fmtDate, fmtDay, fmtMonth, fmtMonthLong, fmtMonthShort, daysBetween, monthsUntil,
    currentMonth, fyOf, fyStartYear, fyRange, fyLabel, fyOptions, fyMonths, inFY, isValidISODate
  };
  Dhan.money = money;
  Dhan.CATEGORY_COLORS = CATEGORY_COLORS;
  Dhan.TAX_BUCKETS = TAX_BUCKETS;
  Dhan.ACCOUNT_TYPES = ACCOUNT_TYPES;
  Dhan.GOAL_ICONS = GOAL_ICONS;
  Dhan.DEDUCTION_SECTIONS = DEDUCTION_SECTIONS;
  Dhan.defaultCategories = defaultCategories;
  Dhan.defaultState = defaultState;
  Dhan.normalizeState = normalizeState;
  Dhan.store = store;
  Dhan.backupPayload = backupPayload;
  Dhan.parseBackup = parseBackup;
  Dhan.byId = byId;
  Dhan.accountById = accountById;
  Dhan.categoryById = categoryById;
  Dhan.categoryName = categoryName;
  Dhan.accountName = accountName;
  Dhan.activeCategories = activeCategories;
  Dhan.activeAccounts = activeAccounts;
  Dhan.accountType = accountType;
  Dhan.taxBucketLabel = taxBucketLabel;
  Dhan.accountBalance = accountBalance;
  Dhan.netWorth = netWorth;
  Dhan.assetsAndLiabilities = assetsAndLiabilities;
  Dhan.txsInRange = txsInRange;
  Dhan.txsInMonth = txsInMonth;
  Dhan.incomeExpense = incomeExpense;
  Dhan.monthStats = monthStats;
  Dhan.fyStats = fyStats;
  Dhan.monthlySummary = monthlySummary;
  Dhan.categorySpend = categorySpend;
  Dhan.topCategories = topCategories;
  Dhan.budgetFor = budgetFor;
  Dhan.budgetLines = budgetLines;
  Dhan.unbudgetedSpend = unbudgetedSpend;
  Dhan.goalSaved = goalSaved;
  Dhan.goalProgress = goalProgress;
  Dhan.netWorthSeries = netWorthSeries;
  Dhan.taxRulesFor = taxRulesFor;
  Dhan.taxSettingsFor = taxSettingsFor;
  Dhan.incomeByBucket = incomeByBucket;
  Dhan.deductionBreakdown = deductionBreakdown;
  Dhan.computeTax = computeTax;
  Dhan.compareRegimes = compareRegimes;
  Dhan.toCSV = toCSV;
  Dhan.transactionsCSV = transactionsCSV;
  Dhan.monthlyCSV = monthlyCSV;
  Dhan.itrSummaryCSV = itrSummaryCSV;
  Dhan.categoryUsage = categoryUsage;
  Dhan.accountUsage = accountUsage;
  Dhan.nextCategoryColor = nextCategoryColor;
  Dhan.isAppsScriptUrl = isAppsScriptUrl;

  if (typeof module !== "undefined" && module.exports) module.exports = Dhan;
})(typeof window !== "undefined" ? window : globalThis);
