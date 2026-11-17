# Dhan — money, clearly.

A private, local-first money tracker for India. Salary, UPI spending, bank interest, budgets, a car fund, and a future-ITR working paper — all in one calm place.

**Live app:** https://rajguptacode.github.io/dhan-money-tracker/

No account. No server. No analytics. Your khata lives in your browser unless you choose to connect your own Google Sheet.

---

## What it does

- **Everyday ledger** — income, expenses and transfers between accounts. Amounts are stored as integer paise, so rounding never drifts.
- **Accounts & net worth** — bank, cash, wallet/UPI, investments, credit cards and loans. Opening balances, live balances and archived accounts included.
- **Plan** — savings goals with a target date and a monthly number, plus per-category monthly budgets. The example goal is a ₹22,00,000 car fund.
- **Bank interest, properly labelled** — separate income heads for savings interest, FD/RD interest, business income and exempt receipts.
- **Tax & ITR working paper** — income heads, deductions, TDS/advance tax, new-vs-old regime comparison and CSV exports. An estimate, not tax advice.
- **Reports** — cashflow, month-by-month totals, category ranking, net-worth trend, printable report and CSV exports.
- **Backups & snapshots** — JSON export/import and up to four in-browser snapshots. A snapshot is taken automatically before destructive edits.
- **Optional Google Sheets sync** — a user-owned Apps Script bridge writes a readable copy into your own Drive. No OAuth app and no middleman.
- **PWA / offline** — installable, with a service worker that caches the app shell. It still works after a reload with no network.

## Use it

1. Open the live link (or run it locally, below).
2. Enter your name and main bank balance. Keep or rename the starter car goal.
3. Add entries with the **Add entry** button — expense, income or transfer.
4. Set budgets and add money to goals from **Plan**.
5. Open **Tax & ITR** before filing season. Add deductions and the TDS actually deducted.
6. Download a backup from **Settings** occasionally. Local storage is one browser on one device.

### Keyboard and accessibility

The app uses real form controls and dialogs, visible focus states, reduced-motion support, and a skip link. Charts include accessible text summaries and tooltips.

## Privacy in one minute

- App data is stored in `localStorage` under `dhan.state.v1` (snapshots: `dhan.snapshots.v1`).
- There is no backend, login, tracking script, ad or third-party API call at runtime.
- The public repository contains **no personal data**. The app starts blank on a new browser.
- Clearing site data deletes the browser copy. Export a backup or push to your own Sheet first.
- Backups deliberately omit your Apps Script URL, sync token and last-sync time.
- Connecting Google Sheets is optional. The script and spreadsheet belong to your Google account.

## Google Sheets bridge (optional, about 3 minutes)

This is for a second copy in **your** Drive. Dhan never sees your Google account.

1. Open [script.new](https://script.new) and create a project, for example “Dhan bridge”.
2. Copy [`apps-script/Code.gs`](apps-script/Code.gs) into the editor. In Dhan, **Settings → Google Sheets** can generate a sync token and copy the starter script with the token already inserted.
3. Change `const TOKEN = "change-me-to-a-long-random-phrase";` if you are pasting the file manually. Use the same token in Dhan later.
4. **Deploy → New deployment → Web app**.
   - **Execute as:** Me
   - **Who has access:** Anyone
   - Deploy, then authorise the script for the Google account that should own the spreadsheet.
5. Copy the Web App URL. It ends in `/exec`.
6. In Dhan **Settings → Google Sheets**, paste the URL and the same token. Press **Save connection**, then **Test**.
7. Press **Push to Sheet**. The first push creates a spreadsheet named **Dhan — money tracker** in your Drive.

### What appears in the Sheet

- Readable tabs: **Transactions**, **Accounts**, **Goals**, **Budgets**, **Categories**, **Deductions**, **Tax settings**, and a **Summary**.
- A hidden `_state` sheet holds a chunked, checksummed copy of the full state for exact pull/restore.
- Pushing replaces the Sheet copy with this browser's current khata. Pulling replaces this browser after taking a snapshot.
- The sync URL and token are never written into the spreadsheet.
- Treat the Web App URL plus token like a password: together they can read or replace the sheet copy. Keep the spreadsheet private in Drive.

Google Apps Script has daily quotas and can be redeployed independently of Dhan. If Google shows an authorisation warning, choose the intended account, **Advanced → Go to Dhan bridge**, and allow it. The script only touches the spreadsheet it creates.

## Tax: an estimate, not advice

The Tax view supports:

- **FY 2024–25**, **FY 2025–26** and an assumed **FY 2026–27** (2025–26 slabs, clearly labelled).
- New and old regimes, standard deduction, 87A rebate, marginal relief and 4% cess.
- Automatic 80TTA in the old regime, with 80C, 80CCD(1B) and 24(b) caps.
- Manual deductions for 80D, 80E, 80G, HRA and anything else your CA confirms.

Not modelled: surcharge above ₹50 lakh, special capital-gains rates, clubbing, residency edge cases, and the detailed conditions of every deduction. Form 26AS/AIS, the latest Finance Act and a qualified CA are the final word. Use the CSV as a working paper, not as a filed return.

## Run locally

There is no build step and no package manager.

```bash
# from the repository root
python3 -m http.server 4173
# open http://127.0.0.1:4173
```

Any static file server works. Opening `index.html` directly via `file://` works for the core app, but service workers and install prompts need `http://` or `https://`.

### Project layout

```text
index.html                 app shell, SVG icon sprite, script order
assets/css/styles.css      design system and every view
assets/js/core.js          state, storage, balances, goals, tax, CSV
assets/js/charts.js        SVG charts and tooltips
assets/js/ui.js            formatting, dialogs, shared UI
assets/js/modals.js        transaction/account/goal/budget/category dialogs
assets/js/views-*.js       dashboard, activity, accounts, plan, tax, reports, settings
assets/js/app.js           boot, routing, Sheets sync, backups, service worker
apps-script/Code.gs        optional Google Sheets bridge
sw.js                      offline app shell
manifest.webmanifest       PWA metadata
```

The scripts are classic browser scripts (no bundler). Load order matters and is listed at the bottom of `index.html`.

### Checks

```bash
for f in assets/js/*.js sw.js; do node --check "$f"; done
```

The Apps Script bridge is a standalone `.gs` file and can be exercised against a mock `SpreadsheetApp`; it is not part of the browser app.

## Design

Warm paper, deep ink-green, marigold accents, Fraunces display type, Hanken Grotesk text and IBM Plex Mono for figures. Self-hosted fonts, original SVG icons and charts, light/dark/system themes. More detail in [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

## License

MIT — see [LICENSE](LICENSE). Fonts are under the SIL Open Font License; their licence files live in `assets/fonts/`.

Built for Indian money, without a login.
