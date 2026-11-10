# DATA_NOTES.md — court-case-bd

## What data ships in the app

**None.** The app ships empty: zero cases, zero hearings, zero documents
ticked. Everything is entered by the user on their own device and stored
only in `localStorage`. There is no seed data, no sample case, no demo
content.

## Reference data (built into the app, not user data)

| Item | Source / basis | Notes |
|---|---|---|
| 13 courts in the datalist | Common Bangladeshi court names (District Judge Court, Chief Metropolitan Magistrate Court, Family Court, High Court Division, Appellate Division, Labour Court, Land Survey Tribunal, Administrative Tribunal, Special Judge Court, Nari o Shishu Nirjatan Daman Tribunal, Cyber Tribunal, Artha Rin Adalat, Other) | Free-text court names are also accepted; the list is a convenience, not an authority. |
| 8 case types | Civil, Criminal, Family, Writ, Land, Labour, Money loan, Other | Used for grouping, filters and document checklists. |
| Document checklists per type (4–7 items each) | General knowledge of the papers usually filed in each kind of Bangladeshi case (e.g. civil: plaint, vakalatnama, court-fee receipt; land: CS/RS/BS khatian, deed, mutation, rent receipts, survey map) | **Guidance only.** The exact papers a court asks for vary by case. The app says so next to the checklist and in the footer. |
| Hearing outcomes | Adjourned, Arguments heard, Evidence recorded, Order passed, Judgment delivered, Other | Plain labels for the log; no legal meaning is attached. |
| BD mobile validation | `01[3-9]` followed by 8 digits (11 digits total) | Bangladeshi mobile numbering. Spaces/dashes are stripped before checking. |

## What is deliberately NOT in the app

- **No court fees.** Fees depend on case value, court and current rules, so
  the app quotes none.
- **No live case status.** The app never contacts any court, the judiciary
  or any government system, and cannot verify a real case number or date.
- **No legal advice.** Nothing in the app tells the user what to file, what
  to argue, or what an order means. The footer and README carry the
  not-legal-advice disclaimer.

## Verification done this run

- Ledger + `builds/` + GitHub search `user:fahad3235 court` = 0 repos:
  no court-case project exists anywhere.
- All 14 unit-test expectations were hand-computed (date gaps, status
  bands, checklist sizes, 2/7 = 29%).
- Smoke test ran the real UI in headless Chrome: add → countdown →
  hearing log → checklist → edit → filter → export/import → erase.
