# Court Case BD — Court-Case Diary & Hearing Tracker

Offline, bilingual (English / বাংলা) personal court-case diary and hearing tracker for Bangladesh. Pure static site — no server, no network requests, no account.

## The problem

A case in a Bangladeshi court can run for years, across many dates, with papers scattered between home, chamber and court. People miss hearings because the next date lives on a scrap of paper, lose track of which documents are ready, and cannot quickly answer "when is my next date, and what happened last time?" Court Case BD keeps the whole diary in one place, on the user's own device.

## Features

- **Case diary (CRUD)** — case number, title, court (13 common Bangladeshi courts in a datalist, free text allowed), case type (Civil, Criminal, Family, Writ, Land, Labour, Money loan, Other), filing date, lawyer name + Bangladeshi mobile validation (`01[3-9]XXXXXXXX`), status (Ongoing / Disposed / Withdrawn / On appeal), notes.
- **Hearing tracker** — next hearing date per case with a live countdown (overdue / today / tomorrow / in N days); a hearing log per case (date, outcome: Adjourned, Arguments heard, Evidence recorded, Order passed, Judgment delivered, Other; next date; notes) that auto-advances the next hearing date.
- **Dashboard** — total / ongoing / overdue / this-week / disposed / hearings-logged counts, upcoming hearings for the next 14 days (overdue first), cases by type.
- **Document checklists** — a per-type checklist of the papers a case usually needs (e.g. civil: plaint, vakalatnama, court-fee receipt, evidence list; land: khatian, deed, mutation, rent receipts, survey map), ticked off per case with a ready-count. Labelled general guidance only.
- **Filters** — filter the case list by status and type; overdue cases sort first.
- **Data control** — JSON export (download), strict JSON import (wrong app / version / malformed case rejected, data left intact), typed-`DELETE` erase-all.
- **Bilingual** — full English / বাংলা toggle, persisted, with Bengali digits; 390px mobile layout; zero network requests; ships empty.

## Stack

Vanilla HTML + CSS + JavaScript, no framework, no build step, no dependencies. `localStorage` for persistence. Pure logic in `logic.js` (no DOM), UI in `app.js`, strings in `i18n.js`.

## Prerequisites

Any modern browser. For tests: Node.js 18+ and a headless Chromium (the smoke test uses the Playwright `headless_shell` binary if present, or `CHROME_BIN`).

## Install & run

```sh
# serve locally (any static server; or just open index.html)
python3 -m http.server 8000
# then open http://localhost:8000
```

No install step, no environment variables, no secrets.

## Dev commands

```sh
node --test tests/logic.test.js   # 14 unit tests for the pure engine
node tests/smoke.js               # 59 headless-Chrome UI checks (CDP, file://)
```

## Testing

- `tests/logic.test.js` — 14/14 pass: date math (hand-computed gaps), BD mobile validation, case/hearing validation, hearing-status bands, upcoming-hearing ordering, dashboard stats, document progress (2/7 = 29%), hearing log sorting + next-date advance, export/import round-trip and strict rejection, EN/BN date formatting.
- `tests/smoke.js` — 59/59 headless-Chrome checks, 0 console/page errors: empty state, validation (empty form, bad phone), add case, dashboard counts, detail view + 7 civil documents, tick 2 → 2/7, log hearing → history row + countdown moves to 16 days, persistence across reload, edit, status filter, export/erase/import round-trip, typed-DELETE, BN toggle + persistence, 390px no-overflow on all 4 tabs, zero non-file network requests.

## Deployment

GitHub Pages (main branch, root). Live site: https://fahad3235.github.io/court-case-bd/

## Limitations

- A personal diary, **not legal advice**. Court procedures, fees and required documents vary by case and court — confirm with your lawyer. The app states this in its footer and in the document-checklist note.
- No court fees are quoted anywhere (they depend on case value and court); no live case status is fetched — the app never contacts any court or government system, and cannot check a real case status.
- Dates are stored as entered; the app does not remind you outside the browser (no notifications).
- Data lives in the browser's `localStorage` on one device — use Export to back it up before clearing browser data.

## Status

Built and verified 2026-11-10 (factory run #294, 18:00 slot). Ships empty, offline, no account.
