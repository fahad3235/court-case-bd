// court-case-bd -- node unit tests for logic.js (pure engine).
// Run: node --test tests/logic.test.js
// All expected values were hand-computed; see TEST_RESULTS.md.
const test = require('node:test');
const assert = require('node:assert/strict');
const CC = require('../logic.js');

const TODAY = '2026-11-10';

function goodCase(over) {
  return Object.assign({
    caseNo: 'Civil Suit 123/2026',
    title: 'Land dispute - Mirpur plot',
    court: 'District Judge Court',
    type: 'civil',
    filingDate: '2026-01-15',
    lawyerName: 'Adv. Rahim Uddin',
    lawyerPhone: '01712345678',
    status: 'ongoing',
    notes: '',
    nextHearing: '2026-11-12',
  }, over || {});
}

test('isValidDateStr accepts real dates, rejects impossible ones', () => {
  assert.equal(CC.isValidDateStr('2026-11-10'), true);
  assert.equal(CC.isValidDateStr('2026-02-30'), false);
  assert.equal(CC.isValidDateStr('2026-13-01'), false);
  assert.equal(CC.isValidDateStr('10-11-2026'), false);
  assert.equal(CC.isValidDateStr(''), false);
  assert.equal(CC.isValidDateStr(null), false);
});

test('daysUntil: hand-computed gaps', () => {
  assert.equal(CC.daysUntil('2026-11-12', TODAY), 2);
  assert.equal(CC.daysUntil('2026-11-10', TODAY), 0);
  assert.equal(CC.daysUntil('2026-11-09', TODAY), -1);
  assert.equal(CC.daysUntil('2026-12-10', TODAY), 30);
  assert.equal(CC.daysUntil('2026-11-01', TODAY), -9);
  assert.equal(CC.daysUntil('not-a-date', TODAY), null);
  assert.equal(CC.daysUntil('2026-11-12', 'bad'), null);
});

test('addDays crosses month boundary', () => {
  assert.equal(CC.addDays('2026-11-10', 5), '2026-11-15');
  assert.equal(CC.addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(CC.addDays('2026-11-10', -10), '2026-10-31');
});

test('isBdMobile: 11-digit 01[3-9] numbers only', () => {
  assert.equal(CC.isBdMobile('01712345678'), true);
  assert.equal(CC.isBdMobile('01987654321'), true);
  assert.equal(CC.isBdMobile('01312345678'), true);
  assert.equal(CC.isBdMobile('01712 345678'), true);
  assert.equal(CC.isBdMobile('0171234567'), false);
  assert.equal(CC.isBdMobile('02712345678'), false);
  assert.equal(CC.isBdMobile('01112345678'), false);
  assert.equal(CC.isBdMobile('+8801712345678'), false);
  assert.equal(CC.isBdMobile(''), false);
});

test('validateCase: good case passes; each bad field flagged', () => {
  assert.deepEqual(CC.validateCase(goodCase()), []);
  assert.ok(CC.validateCase(goodCase({ caseNo: '' })).includes('caseNo'));
  assert.ok(CC.validateCase(goodCase({ caseNo: '   ' })).includes('caseNo'));
  assert.ok(CC.validateCase(goodCase({ title: 'x' })).includes('title'));
  assert.ok(CC.validateCase(goodCase({ court: '' })).includes('court'));
  assert.ok(CC.validateCase(goodCase({ type: 'tax' })).includes('type'));
  assert.ok(CC.validateCase(goodCase({ status: 'pending' })).includes('status'));
  assert.ok(CC.validateCase(goodCase({ filingDate: '2026-02-30' })).includes('filingDate'));
  assert.ok(CC.validateCase(goodCase({ filingDate: '2999-01-01' })).includes('filingDateFuture'));
  assert.ok(CC.validateCase(goodCase({ nextHearing: '12-11-2026' })).includes('nextHearing'));
  assert.ok(CC.validateCase(goodCase({ lawyerPhone: '12345' })).includes('lawyerPhone'));
  assert.ok(CC.validateCase(goodCase({ lawyerPhone: '' })).length === 0); // optional
  assert.ok(CC.validateCase(goodCase({ lawyerPhone: undefined })).length === 0);
  assert.equal(CC.validateCase(null).length, 1);
});

test('validateHearing: good passes; bad date/outcome/nextDate flagged', () => {
  assert.deepEqual(CC.validateHearing({ date: '2026-11-10', outcome: 'adjourned', nextDate: '2026-11-24', notes: '' }), []);
  assert.ok(CC.validateHearing({ date: '2026-11-32', outcome: 'adjourned' }).includes('date'));
  assert.ok(CC.validateHearing({ date: '2026-11-10', outcome: 'won' }).includes('outcome'));
  assert.ok(CC.validateHearing({ date: '2026-11-10', outcome: 'order', nextDate: 'bad' }).includes('nextDate'));
  assert.deepEqual(CC.validateHearing({ date: '2026-11-10', outcome: 'judgment' }), []);
});

test('hearingStatus: none/today/tomorrow/soon/later/overdue + disposed is none', () => {
  assert.equal(CC.hearingStatus(goodCase({ nextHearing: '' }), TODAY), 'none');
  assert.equal(CC.hearingStatus(goodCase({ nextHearing: '2026-11-10' }), TODAY), 'today');
  assert.equal(CC.hearingStatus(goodCase({ nextHearing: '2026-11-11' }), TODAY), 'tomorrow');
  assert.equal(CC.hearingStatus(goodCase({ nextHearing: '2026-11-13' }), TODAY), 'soon');
  assert.equal(CC.hearingStatus(goodCase({ nextHearing: '2026-11-17' }), TODAY), 'soon');
  assert.equal(CC.hearingStatus(goodCase({ nextHearing: '2026-11-18' }), TODAY), 'later');
  assert.equal(CC.hearingStatus(goodCase({ nextHearing: '2026-11-09' }), TODAY), 'overdue');
  assert.equal(CC.hearingStatus(goodCase({ nextHearing: '2026-11-10', status: 'disposed' }), TODAY), 'none');
  assert.equal(CC.hearingStatus(goodCase({ nextHearing: '2026-11-10', status: 'appeal' }), TODAY), 'today');
});

test('upcomingHearings: overdue first, then by date; excludes far + disposed', () => {
  const cases = [
    goodCase({ caseNo: 'A', nextHearing: '2026-11-12' }),
    goodCase({ caseNo: 'B', nextHearing: '2026-11-09' }),
    goodCase({ caseNo: 'C', nextHearing: '2026-11-10' }),
    goodCase({ caseNo: 'D', nextHearing: '2026-12-01' }), // 21 days out: excluded
    goodCase({ caseNo: 'E', nextHearing: '2026-11-11', status: 'disposed' }), // excluded
    goodCase({ caseNo: 'F', nextHearing: '' }), // excluded
  ];
  const up = CC.upcomingHearings(cases, TODAY, 14);
  assert.deepEqual(up.map((u) => u.kase.caseNo), ['B', 'C', 'A']);
  assert.deepEqual(up.map((u) => u.daysLeft), [-1, 0, 2]);
  assert.deepEqual(up.map((u) => u.overdue), [true, false, false]);
});

test('dashboardStats: counts, overdue, this-week, hearings logged, by-type', () => {
  const a = CC.newCase(goodCase({ caseNo: 'A', type: 'civil', nextHearing: '2026-11-09' }));
  const b = CC.newCase(goodCase({ caseNo: 'B', type: 'family', nextHearing: '2026-11-12' }));
  const c = CC.newCase(goodCase({ caseNo: 'C', type: 'civil', status: 'disposed', nextHearing: '2026-11-11' }));
  const d = CC.newCase(goodCase({ caseNo: 'D', type: 'writ', status: 'withdrawn', nextHearing: '' }));
  b.hearings = [{ id: 'h1', date: '2026-11-01', outcome: 'adjourned', nextDate: '2026-11-12', notes: '' }];
  const s = CC.dashboardStats([a, b, c, d], TODAY);
  assert.equal(s.total, 4);
  assert.equal(s.ongoing, 2);
  assert.equal(s.disposed, 1);
  assert.equal(s.withdrawn, 1);
  assert.equal(s.appeal, 0);
  assert.equal(s.overdue, 1); // A only; C is disposed
  assert.equal(s.thisWeek, 1); // B (2 days); A is overdue, not this-week
  assert.equal(s.hearingsLogged, 1);
  assert.deepEqual(s.byType, { civil: 2, family: 1, writ: 1 });
});

test('docChecklistFor + docProgress: civil has 7 docs; 2 ticked = 29%', () => {
  assert.equal(CC.docChecklistFor('civil').length, 7);
  assert.equal(CC.docChecklistFor('land').length, 6);
  assert.equal(CC.docChecklistFor('criminal').length, 7);
  assert.equal(CC.docChecklistFor('unknown-type').length, 4);
  const k = CC.newCase(goodCase());
  assert.deepEqual(CC.docProgress(k), { done: 0, total: 7, pct: 0 });
  k.docs = { plaint: true, vakalatnama: true };
  assert.deepEqual(CC.docProgress(k), { done: 2, total: 7, pct: 29 });
  k.docs = { plaint: true, vakalatnama: true, courtFee: true, evidenceList: true, witnessList: true, deedCopies: true, prevOrders: true };
  assert.deepEqual(CC.docProgress(k), { done: 7, total: 7, pct: 100 });
});

test('newCase trims and defaults; addHearing sorts + advances nextHearing', () => {
  const k = CC.newCase(goodCase({ caseNo: '  CS 9/2026  ', lawyerPhone: '' }));
  assert.equal(k.caseNo, 'CS 9/2026');
  assert.deepEqual(k.hearings, []);
  assert.deepEqual(k.docs, {});
  const r1 = CC.addHearing(k, { date: '2026-11-10', outcome: 'adjourned', nextDate: '2026-11-24', notes: 'Next: arguments' });
  assert.equal(r1.ok, true);
  assert.equal(r1.kase.hearings.length, 1);
  assert.equal(r1.kase.nextHearing, '2026-11-24');
  const r2 = CC.addHearing(r1.kase, { date: '2026-10-20', outcome: 'evidence', nextDate: '', notes: '' });
  assert.equal(r2.kase.hearings.length, 2);
  assert.equal(r2.kase.hearings[0].date, '2026-10-20'); // sorted oldest first
  assert.equal(r2.kase.nextHearing, '2026-11-24'); // no nextDate: unchanged
  const bad = CC.addHearing(k, { date: 'bad', outcome: 'adjourned' });
  assert.equal(bad.ok, false);
});

test('validateSavedCase: good saved case passes; bad hearing/docs fail', () => {
  const k = CC.newCase(goodCase());
  assert.equal(CC.validateSavedCase(k), true);
  const badH = JSON.parse(JSON.stringify(k));
  badH.hearings = [{ id: 'h1', date: 'bad', outcome: 'adjourned' }];
  assert.equal(CC.validateSavedCase(badH), false);
  const badD = JSON.parse(JSON.stringify(k));
  badD.docs = { plaint: 'yes' };
  assert.equal(CC.validateSavedCase(badD), false);
  const noId = JSON.parse(JSON.stringify(k));
  delete noId.id;
  assert.equal(CC.validateSavedCase(noId), false);
});

test('export/import round-trip; strict rejection', () => {
  const k = CC.newCase(goodCase());
  const payload = CC.exportPayload([k]);
  const imp = CC.importPayload(payload);
  assert.equal(imp.ok, true);
  assert.equal(imp.data.cases[0].caseNo, 'Civil Suit 123/2026');
  assert.equal(CC.importPayload('{"app":"train-schedule-bd","version":1,"cases":[]}').ok, false);
  assert.equal(CC.importPayload('{not json').ok, false);
  assert.equal(CC.importPayload('{"app":"court-case-bd","version":2,"cases":[]}').ok, false);
  assert.equal(CC.importPayload('{"app":"court-case-bd","version":1,"cases":"x"}').ok, false);
  const badCase = CC.importPayload(JSON.stringify({
    app: 'court-case-bd', version: 1,
    cases: [Object.assign(goodCase({ title: 'x' }), { id: 'x', hearings: [] })],
  }));
  assert.equal(badCase.ok, false); // title too short: validateCase fails
  const dup = CC.importPayload(JSON.stringify({
    app: 'court-case-bd', version: 1,
    cases: [k, JSON.parse(JSON.stringify(k))],
  }));
  assert.equal(dup.ok, false);
});

test('formatDate EN + BN; toBnDigits', () => {
  assert.equal(CC.formatDate('2026-11-10', 'en'), '10 Nov 2026');
  assert.equal(CC.formatDate('2026-01-05', 'en'), '5 Jan 2026');
  assert.equal(CC.formatDate('2026-11-10', 'bn'), '\u09e7\u09e6 \u09a8\u09ad\u09c7\u09ae\u09cd\u09ac\u09b0 \u09e8\u09e6\u09e8\u09ec');
  assert.equal(CC.formatDate('bad', 'en'), 'bad');
  assert.equal(CC.toBnDigits('123'), '\u09e7\u09e8\u09e9');
  assert.equal(CC.toBnDigits('2026-11-10'), '\u09e8\u09e6\u09e8\u09ec-\u09e7\u09e7-\u09e7\u09e6');
});
