# TEST_RESULTS.md — court-case-bd (run #294, 2026-11-10 18:00 slot)

## Unit tests — `node --test tests/logic.test.js`

**14/14 pass, 0 fail** (run 2026-11-10 ~18:10 +06, after the one fixture
fix below).

- isValidDateStr: accepts `2026-11-10`; rejects `2026-02-30`, `2026-13-01`,
  `10-11-2026`, empty, null.
- daysUntil (today `2026-11-10`): `2026-11-12` → 2, same day → 0,
  `2026-11-09` → −1, `2026-12-10` → 30, `2026-11-01` → −9; invalid → null.
- addDays: `2026-11-10` +5 → `2026-11-15`; `2026-01-31` +1 → `2026-02-01`;
  −10 → `2026-10-31`.
- isBdMobile: `01712345678`, `01987654321`, `01312345678` pass; 10 digits,
  `02…`, `011…`, `+880…` fail; spaces stripped.
- validateCase: good case passes; each bad field flagged (empty caseNo,
  1-char title, empty court, bad type/status, invalid + future filing
  date, invalid next hearing, bad phone); phone optional when blank.
- validateHearing: good passes; bad date / outcome / nextDate flagged.
- hearingStatus: none / today / tomorrow / soon (3d, 7d) / later (8d) /
  overdue; disposed case with a date → none; appeal counts.
- upcomingHearings: overdue first, then by date; excludes >14 days and
  disposed cases — order `B(-1), C(0), A(+2)`.
- dashboardStats: total 4, ongoing 2, disposed 1, withdrawn 1, overdue 1,
  this-week 1, hearings logged 1, byType `{civil: 2, family: 1, writ: 1}`.
- docChecklistFor + docProgress: civil 7 docs, land 6, criminal 7,
  unknown type 4; 2 ticked → `{done: 2, total: 7, pct: 29}`; all 7 → 100%.
- newCase trims + defaults; addHearing sorts oldest-first and advances
  `nextHearing` only when a next date is given; invalid hearing rejected.
- validateSavedCase: good passes; bad hearing / non-boolean doc / missing
  id fail.
- export/import: round-trip keeps the case; wrong app, bad JSON, version 2,
  non-array cases, invalid case, duplicate ids all rejected.
- formatDate: EN `10 Nov 2026`; BN `১০ নভেম্বর ২০২৬`; toBnDigits `123` → `১২৩`.

Fix during testing (1 test-fix, 0 app bugs): the import test first asserted
a valid case was rejected — corrected to use a genuinely invalid case
(1-char title). Also replaced an em-dash in a test fixture with a hyphen
to keep test sources pure ASCII.

## Smoke tests — `node tests/smoke.js` (raw CDP, headless_shell, file://)

**59/59 checks pass, 0 console/page errors** (run 2026-11-10 ~18:10 +06).

Hand-verified flows: empty state + validation (empty form, bad phone with
"mobile" error text); add case with hearing in 2 days → chip "in 2 days";
dashboard total/ongoing/this-week/overdue = 1/1/1/0; upcoming list 1 item;
detail view shows 7 civil document checkboxes; tick 2 → card shows 2/7;
log hearing (adjourned, next in 16 days) → history row "Adjourned", chip
"in 16 days", hearings-logged 1, this-week back to 0; persistence across
reload (case + doc ticks); edit title → "updated"; status filter hides the
case, "all" restores it; export/import round-trip via `__ccbd` hooks, wrong
app rejected, data intact; bad/good UI import; typed-DELETE (wrong word
rejected, DELETE erases); BN toggle (title `কোর্ট কেস বিডি`, total `১`,
tab `আমার মামলা`), persists across reload, back to EN; 390px no-overflow
on all 4 tabs (detail open); zero non-file network requests.

## What was NOT tested

- Real GitHub Pages serving (verified separately after push, Step 6).
- `confirm()` dialogs: the app uses a two-click arm-then-delete pattern
  instead, so no browser dialog is involved.
