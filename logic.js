// court-case-bd -- pure logic engine (no DOM, no localStorage).
// Node: const CC = require('./logic.js'); Browser: window.COURT_CASE_BD.
// All dates are ISO 'YYYY-MM-DD' strings. "today" is always injected so the
// engine is deterministic and unit-testable (no hidden Date.now() calls).
(function (root) {
  'use strict';

  var APP = 'court-case-bd';
  var VERSION = 1;

  var CASE_TYPES = ['civil', 'criminal', 'family', 'writ', 'land', 'labour', 'money', 'other'];
  var STATUSES = ['ongoing', 'disposed', 'withdrawn', 'appeal'];
  var OUTCOMES = ['adjourned', 'arguments', 'evidence', 'order', 'judgment', 'other'];

  var COURTS = [
    'District Judge Court',
    'Chief Metropolitan Magistrate Court',
    'Family Court',
    'High Court Division',
    'Appellate Division',
    'Labour Court',
    'Land Survey Tribunal',
    'Administrative Tribunal',
    'Special Judge Court',
    'Nari o Shishu Nirjatan Daman Tribunal',
    'Cyber Tribunal',
    'Artha Rin Adalat (Money Loan Court)',
    'Other court',
  ];

  // General document checklists per case type. These are guidance only --
  // the exact papers a court asks for vary by case. Never presented as legal
  // advice; the app footer + README say so.
  var DOC_CHECKLISTS = {
    civil: ['plaint', 'vakalatnama', 'courtFee', 'evidenceList', 'witnessList', 'deedCopies', 'prevOrders'],
    criminal: ['firCopy', 'chargeSheet', 'bailPapers', 'seizureList', 'medicalCert', 'witnessList', 'vakalatnama'],
    family: ['kabinNama', 'birthCerts', 'nidCopies', 'maintenanceClaim', 'vakalatnama', 'prevOrders'],
    writ: ['petition', 'affidavit', 'annexures', 'vakalatnama', 'prevOrders', 'govtNotice'],
    land: ['khatian', 'deed', 'mutation', 'rentReceipts', 'surveyMap', 'vakalatnama'],
    labour: ['appointmentLetter', 'salaryRecords', 'terminationLetter', 'labourComplaint', 'unionPapers', 'vakalatnama'],
    money: ['loanAgreement', 'demandNotice', 'accountStatement', 'mortgageDeed', 'vakalatnama'],
    other: ['vakalatnama', 'nidCopies', 'relevantDocs', 'prevOrders'],
  };

  // ---------- dates ----------

  function isValidDateStr(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var d = new Date(s + 'T00:00:00Z');
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // Whole days from today to dateStr (negative = past). Pure: both injected.
  function daysUntil(dateStr, today) {
    if (!isValidDateStr(dateStr) || !isValidDateStr(today)) return null;
    var a = Date.parse(dateStr + 'T00:00:00Z');
    var b = Date.parse(today + 'T00:00:00Z');
    return Math.round((a - b) / 86400000);
  }

  function addDays(dateStr, n) {
    var d = new Date(dateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  // ---------- validation ----------

  function isBdMobile(s) {
    return typeof s === 'string' && /^01[3-9]\d{8}$/.test(s.replace(/[\s-]/g, ''));
  }

  function validateCase(c) {
    var errs = [];
    if (!c || typeof c !== 'object') return ['case'];
    if (typeof c.caseNo !== 'string' || c.caseNo.trim().length < 1 || c.caseNo.trim().length > 60) errs.push('caseNo');
    if (typeof c.title !== 'string' || c.title.trim().length < 2 || c.title.trim().length > 120) errs.push('title');
    if (typeof c.court !== 'string' || c.court.trim().length < 2 || c.court.trim().length > 100) errs.push('court');
    if (CASE_TYPES.indexOf(c.type) === -1) errs.push('type');
    if (STATUSES.indexOf(c.status) === -1) errs.push('status');
    if (c.filingDate && !isValidDateStr(c.filingDate)) errs.push('filingDate');
    if (c.filingDate && isValidDateStr(c.filingDate) && isValidDateStr(todayStr()) && daysUntil(c.filingDate, todayStr()) > 0) errs.push('filingDateFuture');
    if (c.nextHearing && !isValidDateStr(c.nextHearing)) errs.push('nextHearing');
    if (c.lawyerPhone && !isBdMobile(c.lawyerPhone)) errs.push('lawyerPhone');
    if (c.lawyerName && (typeof c.lawyerName !== 'string' || c.lawyerName.length > 80)) errs.push('lawyerName');
    if (c.notes && (typeof c.notes !== 'string' || c.notes.length > 1000)) errs.push('notes');
    return errs;
  }

  function validateHearing(h) {
    var errs = [];
    if (!h || typeof h !== 'object') return ['hearing'];
    if (!isValidDateStr(h.date)) errs.push('date');
    if (OUTCOMES.indexOf(h.outcome) === -1) errs.push('outcome');
    if (h.nextDate && !isValidDateStr(h.nextDate)) errs.push('nextDate');
    if (h.notes && (typeof h.notes !== 'string' || h.notes.length > 500)) errs.push('notes');
    return errs;
  }

  function validateSavedCase(c) {
    if (!c || typeof c !== 'object') return false;
    if (typeof c.id !== 'string' || !c.id) return false;
    if (validateCase(c).length > 0) return false;
    if (!Array.isArray(c.hearings)) return false;
    for (var i = 0; i < c.hearings.length; i++) {
      var h = c.hearings[i];
      if (typeof h.id !== 'string' || !h.id) return false;
      if (validateHearing(h).length > 0) return false;
    }
    if (c.docs !== undefined && (typeof c.docs !== 'object' || c.docs === null || Array.isArray(c.docs))) return false;
    if (c.docs) {
      var keys = Object.keys(c.docs);
      for (var j = 0; j < keys.length; j++) {
        if (typeof c.docs[keys[j]] !== 'boolean') return false;
      }
    }
    return true;
  }

  // ---------- hearing status ----------

  // 'none' (no date) | 'overdue' | 'today' | 'tomorrow' | 'soon' (2-7d) | 'later' (8+d)
  function hearingStatus(c, today) {
    if (!c.nextHearing) return 'none';
    if (c.status !== 'ongoing' && c.status !== 'appeal') return 'none';
    var d = daysUntil(c.nextHearing, today);
    if (d === null) return 'none';
    if (d < 0) return 'overdue';
    if (d === 0) return 'today';
    if (d === 1) return 'tomorrow';
    if (d <= 7) return 'soon';
    return 'later';
  }

  // Upcoming hearings (ongoing/appeal cases), sorted by date ascending.
  // Includes overdue ones first (they need attention), then today..+days.
  function upcomingHearings(cases, today, days) {
    var out = [];
    for (var i = 0; i < cases.length; i++) {
      var c = cases[i];
      if (!c.nextHearing || (c.status !== 'ongoing' && c.status !== 'appeal')) continue;
      var d = daysUntil(c.nextHearing, today);
      if (d === null || d < 0 || d > days) {
        if (d !== null && d < 0) out.push({ kase: c, daysLeft: d, overdue: true });
        continue;
      }
      out.push({ kase: c, daysLeft: d, overdue: false });
    }
    out.sort(function (a, b) {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return a.daysLeft - b.daysLeft;
    });
    return out;
  }

  function dashboardStats(cases, today) {
    var s = { total: 0, ongoing: 0, disposed: 0, withdrawn: 0, appeal: 0, overdue: 0, thisWeek: 0, hearingsLogged: 0, byType: {} };
    for (var i = 0; i < cases.length; i++) {
      var c = cases[i];
      s.total++;
      s[c.status] = (s[c.status] || 0) + 1;
      s.byType[c.type] = (s.byType[c.type] || 0) + 1;
      s.hearingsLogged += (c.hearings || []).length;
      if ((c.status === 'ongoing' || c.status === 'appeal') && c.nextHearing) {
        var d = daysUntil(c.nextHearing, today);
        if (d !== null && d < 0) s.overdue++;
        if (d !== null && d >= 0 && d <= 7) s.thisWeek++;
      }
    }
    return s;
  }

  // ---------- documents ----------

  function docChecklistFor(type) {
    return (DOC_CHECKLISTS[type] || DOC_CHECKLISTS.other).slice();
  }

  function docProgress(kase) {
    var list = docChecklistFor(kase.type);
    var done = 0;
    for (var i = 0; i < list.length; i++) {
      if (kase.docs && kase.docs[list[i]]) done++;
    }
    return { done: done, total: list.length, pct: list.length ? Math.round((done / list.length) * 100) : 0 };
  }

  // ---------- case ops (pure, return new arrays) ----------

  function uid() {
    return 'c-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function newCase(data) {
    return {
      id: uid(),
      caseNo: (data.caseNo || '').trim(),
      title: (data.title || '').trim(),
      court: (data.court || '').trim(),
      type: data.type || 'civil',
      filingDate: data.filingDate || '',
      lawyerName: (data.lawyerName || '').trim(),
      lawyerPhone: (data.lawyerPhone || '').trim(),
      status: data.status || 'ongoing',
      notes: (data.notes || '').trim(),
      nextHearing: data.nextHearing || '',
      hearings: [],
      docs: {},
      createdAt: todayStr(),
    };
  }

  function addHearing(kase, h) {
    var errs = validateHearing(h);
    if (errs.length) return { ok: false, errors: errs };
    var copy = JSON.parse(JSON.stringify(kase));
    copy.hearings.push({ id: uid(), date: h.date, outcome: h.outcome, nextDate: h.nextDate || '', notes: (h.notes || '').trim() });
    copy.hearings.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    if (h.nextDate) copy.nextHearing = h.nextDate;
    return { ok: true, kase: copy };
  }

  // ---------- export / import ----------

  function exportPayload(cases) {
    return JSON.stringify({ app: APP, version: VERSION, exportedAt: todayStr(), cases: cases }, null, 2);
  }

  function importPayload(text) {
    var data;
    try { data = JSON.parse(text); } catch (e) { return { ok: false, error: 'json' }; }
    if (!data || data.app !== APP || data.version !== VERSION) return { ok: false, error: 'app' };
    if (!Array.isArray(data.cases)) return { ok: false, error: 'cases' };
    for (var i = 0; i < data.cases.length; i++) {
      if (!validateSavedCase(data.cases[i])) return { ok: false, error: 'case', index: i };
    }
    var ids = {};
    for (var j = 0; j < data.cases.length; j++) {
      if (ids[data.cases[j].id]) return { ok: false, error: 'dup', index: j };
      ids[data.cases[j].id] = true;
    }
    return { ok: true, data: data };
  }

  // ---------- formatting ----------

  var BN_DIGITS = ['\u09e6', '\u09e7', '\u09e8', '\u09e9', '\u09ea', '\u09eb', '\u09ec', '\u09ed', '\u09ee', '\u09ef'];
  function toBnDigits(s) {
    return String(s).replace(/[0-9]/g, function (d) { return BN_DIGITS[+d]; });
  }

  function formatDate(iso, lang) {
    if (!isValidDateStr(iso)) return iso || '';
    var p = iso.split('-');
    var monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var monthsBn = ['\u099c\u09be\u09a8\u09c1', '\u09ab\u09c7\u09ac\u09cd\u09b0\u09c1', '\u09ae\u09be\u09b0\u09cd\u099a', '\u098f\u09aa\u09cd\u09b0\u09bf\u09b2', '\u09ae\u09c7', '\u099c\u09c1\u09a8', '\u099c\u09c1\u09b2\u09be\u0987', '\u0986\u0997\u09b8\u09cd\u099f', '\u09b8\u09c7\u09aa\u09cd\u099f\u09c7\u09ae\u09cd\u09ac\u09b0', '\u0985\u0995\u09cd\u099f\u09cb\u09ac\u09b0', '\u09a8\u09ad\u09c7\u09ae\u09cd\u09ac\u09b0', '\u09a1\u09bf\u09b8\u09c7\u09ae\u09cd\u09ac\u09b0'];
    var day = parseInt(p[2], 10);
    var mon = parseInt(p[1], 10) - 1;
    if (lang === 'bn') return toBnDigits(day) + ' ' + monthsBn[mon] + ' ' + toBnDigits(p[0]);
    return day + ' ' + monthsEn[mon] + ' ' + p[0];
  }

  var api = {
    APP: APP, VERSION: VERSION, CASE_TYPES: CASE_TYPES, STATUSES: STATUSES,
    OUTCOMES: OUTCOMES, COURTS: COURTS, DOC_CHECKLISTS: DOC_CHECKLISTS,
    isValidDateStr: isValidDateStr, todayStr: todayStr, daysUntil: daysUntil,
    addDays: addDays, isBdMobile: isBdMobile, validateCase: validateCase,
    validateHearing: validateHearing, validateSavedCase: validateSavedCase,
    hearingStatus: hearingStatus, upcomingHearings: upcomingHearings,
    dashboardStats: dashboardStats, docChecklistFor: docChecklistFor,
    docProgress: docProgress, uid: uid, newCase: newCase, addHearing: addHearing,
    exportPayload: exportPayload, importPayload: importPayload,
    toBnDigits: toBnDigits, formatDate: formatDate,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.COURT_CASE_BD = api;
})(typeof window !== 'undefined' ? window : globalThis);
