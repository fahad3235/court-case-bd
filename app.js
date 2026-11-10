// court-case-bd -- UI wiring (DOM + localStorage). Pure logic lives in logic.js.
(function () {
  'use strict';
  var CC = window.COURT_CASE_BD;
  var I18N = window.COURT_CASE_I18N;
  var LS_KEY = 'court-case-bd/v1';

  var state = { lang: 'en', cases: [] };
  var editingId = null;
  var openDetailId = null;
  var filterStatus = 'all';
  var filterType = 'all';
  var deleteArmedId = null;

  function t(key) { return I18N.t(state.lang, key); }
  function $(id) { return document.getElementById(id); }
  function today() { return CC.todayStr(); }

  function num(n) {
    return state.lang === 'bn' ? CC.toBnDigits(String(n)) : String(n);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ---------- persistence ----------

  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        if (data.lang === 'en' || data.lang === 'bn') state.lang = data.lang;
        if (Array.isArray(data.cases) && data.cases.every(CC.validateSavedCase)) state.cases = data.cases;
      }
    } catch (e) { /* corrupt storage: start empty */ }
  }

  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* storage full/blocked */ }
  }

  function findCase(id) {
    for (var i = 0; i < state.cases.length; i++) if (state.cases[i].id === id) return state.cases[i];
    return null;
  }

  // ---------- hearing countdown text ----------

  function hearingChip(kase) {
    var st = CC.hearingStatus(kase, today());
    if (st === 'none') return { cls: 'chip none', text: t('statusNone') };
    var d = CC.daysUntil(kase.nextHearing, today());
    if (st === 'overdue') return { cls: 'chip overdue', text: t('statusOverdue') + ' \u00b7 ' + t('daysOverdue').replace('{n}', num(Math.abs(d))) };
    if (st === 'today') return { cls: 'chip today', text: t('statusToday') };
    if (st === 'tomorrow') return { cls: 'chip soon', text: t('statusTomorrow') };
    return { cls: 'chip soon', text: t('statusSoon').replace('{n}', num(d)) };
  }

  // ---------- static labels ----------

  function applyI18n() {
    document.documentElement.lang = state.lang === 'bn' ? 'bn' : 'en';
    $('title').textContent = t('title');
    $('subtitle').textContent = t('subtitle');
    $('langBtn').textContent = state.lang === 'bn' ? 'English' : '\u09ac\u09be\u0982\u09b2\u09be';
    $('tab-dashboard').textContent = t('tabDashboard');
    $('tab-cases').textContent = t('tabCases');
    $('tab-add').textContent = t('tabAdd');
    $('tab-data').textContent = t('tabData');
    $('statTotalLabel').textContent = t('statTotal');
    $('statOngoingLabel').textContent = t('statOngoing');
    $('statOverdueLabel').textContent = t('statOverdue');
    $('statThisWeekLabel').textContent = t('statThisWeek');
    $('statDisposedLabel').textContent = t('statDisposed');
    $('statLoggedLabel').textContent = t('statLogged');
    $('upcomingTitle').textContent = t('upcomingTitle');
    $('byTypeTitle').textContent = t('byTypeTitle');
    $('filterStatusLabel').textContent = t('filterStatus');
    $('filterTypeLabel').textContent = t('filterType');
    $('addCaseTitle').textContent = editingId ? t('editCaseTitle') : t('addCaseTitle');
    $('caseNoLabel').textContent = t('caseNo');
    $('titleLabel').textContent = t('caseTitle');
    $('courtLabel').textContent = t('court');
    $('typeLabel').textContent = t('caseType');
    $('filingLabel').textContent = t('filingDate');
    $('hearingLabel').textContent = t('nextHearing');
    $('lawyerNameLabel').textContent = t('lawyerName');
    $('lawyerPhoneLabel').textContent = t('lawyerPhone');
    $('statusLabel').textContent = t('status');
    $('notesLabel').textContent = t('notes');
    $('saveCaseBtn').textContent = editingId ? t('updateCaseBtn') : t('saveCaseBtn');
    $('cancelEditBtn').textContent = t('cancelEditBtn');
    $('cancelEditBtn').hidden = !editingId;
    $('caseNoInput').placeholder = t('caseNoPh');
    $('titleInput').placeholder = t('titlePh');
    $('courtInput').placeholder = t('courtPh');
    $('lawyerNameInput').placeholder = t('lawyerNamePh');
    $('lawyerPhoneInput').placeholder = t('lawyerPhonePh');
    $('notesInput').placeholder = t('notesPh');
    $('dataTitle').textContent = t('dataTitle');
    $('exportBtn').textContent = t('exportBtn');
    $('importBtn').textContent = t('importBtn');
    $('importLabel').textContent = t('importBtn');
    $('importText').placeholder = t('importPh');
    $('eraseTitle').textContent = t('eraseTitle');
    $('eraseHint').textContent = t('eraseHint');
    $('eraseBtn').textContent = t('eraseBtn');
    $('disclaimer').textContent = t('disclaimer');
    $('footNote').textContent = t('footNote');

    // selects
    fillSelect($('typeSelect'), CC.CASE_TYPES.map(function (ty) { return { v: ty, l: t('type_' + ty) }; }));
    fillSelect($('statusSelect'), CC.STATUSES.map(function (s) { return { v: s, l: t('status_' + s) }; }));
    fillSelect($('filterStatus'), [{ v: 'all', l: t('all') }].concat(CC.STATUSES.map(function (s) { return { v: s, l: t('status_' + s) }; })), filterStatus);
    fillSelect($('filterType'), [{ v: 'all', l: t('all') }].concat(CC.CASE_TYPES.map(function (ty) { return { v: ty, l: t('type_' + ty) }; })), filterType);
    var dl = $('courtList');
    dl.innerHTML = CC.COURTS.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('');
  }

  function fillSelect(sel, opts, keepValue) {
    var prev = keepValue !== undefined ? keepValue : sel.value;
    sel.innerHTML = opts.map(function (o) { return '<option value="' + esc(o.v) + '">' + esc(o.l) + '</option>'; }).join('');
    if (prev && opts.some(function (o) { return o.v === prev; })) sel.value = prev;
  }

  // ---------- dashboard ----------

  function renderDashboard() {
    var s = CC.dashboardStats(state.cases, today());
    $('statTotal').textContent = num(s.total);
    $('statOngoing').textContent = num(s.ongoing);
    $('statOverdue').textContent = num(s.overdue);
    $('statThisWeek').textContent = num(s.thisWeek);
    $('statDisposed').textContent = num(s.disposed);
    $('statLogged').textContent = num(s.hearingsLogged);

    var up = CC.upcomingHearings(state.cases, today(), 14);
    $('upcomingEmpty').hidden = up.length > 0;
    $('upcomingEmpty').textContent = t('upcomingEmpty');
    $('upcomingList').innerHTML = up.map(function (u) {
      var chip = hearingChip(u.kase);
      return '<li><button type="button" class="linklike" data-open="' + esc(u.kase.id) + '">' +
        '<strong>' + esc(u.kase.title) + '</strong> <span class="muted">' + esc(u.kase.caseNo) + '</span></button>' +
        '<span class="up-date">' + esc(CC.formatDate(u.kase.nextHearing, state.lang)) + '</span> ' +
        '<span class="' + chip.cls + '">' + esc(chip.text) + '</span></li>';
    }).join('');

    var byType = $('byTypeList');
    var rows = CC.CASE_TYPES.filter(function (ty) { return (s.byType[ty] || 0) > 0; });
    byType.innerHTML = rows.length ? rows.map(function (ty) {
      return '<li><span>' + esc(t('type_' + ty)) + '</span><strong>' + num(s.byType[ty]) + '</strong></li>';
    }).join('') : '<li class="empty">' + esc(t('noCasesYet')) + '</li>';
  }

  // ---------- case list ----------

  function filteredCases() {
    var list = state.cases.filter(function (c) {
      return (filterStatus === 'all' || c.status === filterStatus) &&
        (filterType === 'all' || c.type === filterType);
    });
    list.sort(function (a, b) {
      var sa = CC.hearingStatus(a, today()), sb = CC.hearingStatus(b, today());
      var rank = { overdue: 0, today: 1, tomorrow: 2, soon: 3, later: 4, none: 5 };
      if (rank[sa] !== rank[sb]) return rank[sa] - rank[sb];
      if (a.nextHearing && b.nextHearing && a.nextHearing !== b.nextHearing) return a.nextHearing < b.nextHearing ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
    return list;
  }

  function renderCases() {
    var list = filteredCases();
    $('casesEmpty').hidden = list.length > 0;
    $('casesEmpty').textContent = state.cases.length ? '' : t('noCasesYet');
    if (state.cases.length && !list.length) $('casesEmpty').textContent = t('noCasesYet');
    var html = list.map(function (c) {
      var chip = hearingChip(c);
      var prog = CC.docProgress(c);
      return '<article class="case-card card" data-id="' + esc(c.id) + '">' +
        '<div class="case-head"><div><h3>' + esc(c.title) + '</h3>' +
        '<p class="muted">' + esc(c.caseNo) + ' \u00b7 ' + esc(c.court) + '</p></div>' +
        '<span class="badge">' + esc(t('type_' + c.type)) + '</span></div>' +
        '<div class="case-meta"><span class="badge status-' + esc(c.status) + '">' + esc(t('status_' + c.status)) + '</span> ' +
        '<span class="' + chip.cls + '">' + esc(chip.text) + '</span>' +
        (c.nextHearing ? ' <span class="muted">' + esc(CC.formatDate(c.nextHearing, state.lang)) + '</span>' : '') +
        ' <span class="muted">\u00b7 ' + num(prog.done) + '/' + num(prog.total) + ' ' + esc(t('docsProgress')) + '</span></div>' +
        '<div class="btn-row">' +
        '<button type="button" class="btn mini" data-act="details">' + esc(t('detailsBtn')) + '</button>' +
        '<button type="button" class="btn mini" data-act="hearing">' + esc(t('logHearingBtn')) + '</button>' +
        '<button type="button" class="btn mini" data-act="edit">' + esc(t('editBtn')) + '</button>' +
        '<button type="button" class="btn mini danger-btn" data-act="delete">' + esc(deleteArmedId === c.id ? t('confirmDelete') : t('deleteBtn')) + '</button>' +
        '</div></article>';
    }).join('');
    $('caseList').innerHTML = html;
    renderDetail();
  }

  // ---------- case detail ----------

  function renderDetail() {
    var box = $('caseDetail');
    var c = openDetailId ? findCase(openDetailId) : null;
    if (!c) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    var prog = CC.docProgress(c);
    var docs = CC.docChecklistFor(c.type).map(function (d) {
      var checked = c.docs && c.docs[d] ? ' checked' : '';
      return '<label class="check"><input type="checkbox" data-doc="' + esc(d) + '"' + checked + '> ' + esc(t('doc_' + d)) + '</label>';
    }).join('');
    var hearings = (c.hearings || []).slice().reverse().map(function (h) {
      return '<tr><td>' + esc(CC.formatDate(h.date, state.lang)) + '</td><td>' + esc(t('outcome_' + h.outcome)) + '</td><td>' +
        (h.nextDate ? esc(CC.formatDate(h.nextDate, state.lang)) : '\u2014') + '</td><td>' + esc(h.notes || '') + '</td></tr>';
    }).join('');
    box.innerHTML =
      '<h2>' + esc(c.title) + '</h2>' +
      '<dl class="info-grid">' +
      '<dt>' + esc(t('caseNo')) + '</dt><dd>' + esc(c.caseNo) + '</dd>' +
      '<dt>' + esc(t('court')) + '</dt><dd>' + esc(c.court) + '</dd>' +
      '<dt>' + esc(t('caseType')) + '</dt><dd>' + esc(t('type_' + c.type)) + '</dd>' +
      '<dt>' + esc(t('filingDate')) + '</dt><dd>' + (c.filingDate ? esc(CC.formatDate(c.filingDate, state.lang)) : '\u2014') + '</dd>' +
      '<dt>' + esc(t('lawyerName')) + '</dt><dd>' + (c.lawyerName ? esc(c.lawyerName) : '\u2014') + '</dd>' +
      '<dt>' + esc(t('lawyerPhone')) + '</dt><dd>' + (c.lawyerPhone ? esc(c.lawyerPhone) : '\u2014') + '</dd>' +
      '<dt>' + esc(t('status')) + '</dt><dd>' + esc(t('status_' + c.status)) + '</dd>' +
      '<dt>' + esc(t('nextHearing')) + '</dt><dd>' + (c.nextHearing ? esc(CC.formatDate(c.nextHearing, state.lang)) : '\u2014') + '</dd>' +
      (c.notes ? '<dt>' + esc(t('notes')) + '</dt><dd>' + esc(c.notes) + '</dd>' : '') +
      '</dl>' +
      '<h3>' + esc(t('docsTitle')) + ' (' + num(prog.done) + '/' + num(prog.total) + ')</h3>' +
      '<p class="note">' + esc(t('docsNote')) + '</p>' +
      '<div class="check-grid">' + docs + '</div>' +
      '<h3>' + esc(t('hearingLogTitle')) + '</h3>' +
      '<form id="hearingForm" class="hearing-form" novalidate>' +
      '<div class="field-row"><div class="field"><label for="hDate">' + esc(t('hearingDate')) + '</label>' +
      '<input id="hDate" type="date" value="' + esc(today()) + '"></div>' +
      '<div class="field"><label for="hOutcome">' + esc(t('hearingOutcome')) + '</label>' +
      '<select id="hOutcome">' + CC.OUTCOMES.map(function (o) { return '<option value="' + o + '">' + esc(t('outcome_' + o)) + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="field"><label for="hNext">' + esc(t('nextHearing')) + '</label><input id="hNext" type="date"></div>' +
      '<div class="field"><label for="hNotes">' + esc(t('hearingNotes')) + '</label><textarea id="hNotes" rows="2" maxlength="500" placeholder="' + esc(t('hearingNotesPh')) + '"></textarea></div>' +
      '<p id="hearingError" class="error" hidden></p><p id="hearingOk" class="ok" hidden></p>' +
      '<button class="btn primary" type="submit">' + esc(t('saveHearingBtn')) + '</button></form>' +
      '<h3>' + esc(t('hearingHistory')) + '</h3>' +
      (hearings ? '<table class="tbl"><thead><tr><th>' + esc(t('hearingDate')) + '</th><th>' + esc(t('hearingOutcome')) + '</th><th>' + esc(t('nextHearing')) + '</th><th>' + esc(t('hearingNotes')) + '</th></tr></thead><tbody>' + hearings + '</tbody></table>'
        : '<p class="empty">' + esc(t('noHearings')) + '</p>');
  }

  // ---------- tabs ----------

  function showTab(name) {
    var tabs = ['dashboard', 'cases', 'add', 'data'];
    tabs.forEach(function (tb) {
      $('panel-' + tb).hidden = tb !== name;
      var btn = document.querySelector('[data-tab="' + tb + '"]');
      if (btn) btn.classList.toggle('active', tb === name);
    });
  }

  // ---------- case form ----------

  function readCaseForm() {
    return {
      caseNo: $('caseNoInput').value,
      title: $('titleInput').value,
      court: $('courtInput').value,
      type: $('typeSelect').value,
      filingDate: $('filingInput').value,
      nextHearing: $('hearingInput').value,
      lawyerName: $('lawyerNameInput').value,
      lawyerPhone: $('lawyerPhoneInput').value,
      status: $('statusSelect').value,
      notes: $('notesInput').value,
    };
  }

  function caseErrorFor(code) {
    return { caseNo: 'errCaseNo', title: 'errTitle', court: 'errCourt', type: 'errType', filingDate: 'errFilingDate', filingDateFuture: 'errFilingFuture', nextHearing: 'errNextHearing', lawyerPhone: 'errPhone', lawyerName: 'errPhone', notes: 'errTitle' }[code] || 'errTitle';
  }

  function resetCaseForm() {
    editingId = null;
    $('caseForm').reset();
    $('caseError').hidden = true;
    $('caseOk').hidden = true;
    applyI18n();
    renderDashboard();
    renderCases();
  }

  function startEdit(c) {
    editingId = c.id;
    $('caseNoInput').value = c.caseNo;
    $('titleInput').value = c.title;
    $('courtInput').value = c.court;
    $('typeSelect').value = c.type;
    $('filingInput').value = c.filingDate || '';
    $('hearingInput').value = c.nextHearing || '';
    $('lawyerNameInput').value = c.lawyerName || '';
    $('lawyerPhoneInput').value = c.lawyerPhone || '';
    $('statusSelect').value = c.status;
    $('notesInput').value = c.notes || '';
    $('caseError').hidden = true;
    $('caseOk').hidden = true;
    applyI18n();
    showTab('add');
    $('caseNoInput').focus();
  }

  // ---------- render all ----------

  function renderAll() {
    applyI18n();
    renderDashboard();
    renderCases();
  }

  // ---------- events ----------

  document.querySelectorAll('.tab').forEach(function (btn) {
    btn.addEventListener('click', function () { showTab(btn.getAttribute('data-tab')); });
  });

  $('langBtn').addEventListener('click', function () {
    state.lang = state.lang === 'en' ? 'bn' : 'en';
    save();
    renderAll();
  });

  $('filterStatus').addEventListener('change', function () { filterStatus = $('filterStatus').value; renderCases(); });
  $('filterType').addEventListener('change', function () { filterType = $('filterType').value; renderCases(); });

  $('caseForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var data = readCaseForm();
    var errs = CC.validateCase(data);
    if (errs.length) {
      $('caseError').textContent = t(caseErrorFor(errs[0]));
      $('caseError').hidden = false;
      $('caseOk').hidden = true;
      return;
    }
    $('caseError').hidden = true;
    var wasEdit = !!editingId;
    if (editingId) {
      var c = findCase(editingId);
      if (c) {
        var keep = { id: c.id, hearings: c.hearings, docs: c.docs, createdAt: c.createdAt };
        var updated = CC.newCase(data);
        Object.assign(c, updated, keep);
      }
    } else {
      state.cases.push(CC.newCase(data));
    }
    save();
    resetCaseForm();
    $('caseOk').textContent = t(wasEdit ? 'caseUpdated' : 'caseSaved');
    $('caseOk').hidden = false;
  });

  $('cancelEditBtn').addEventListener('click', function () { resetCaseForm(); });

  $('caseList').addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    var card = e.target.closest('.case-card');
    if (!card) return;
    var id = card.getAttribute('data-id');
    var c = findCase(id);
    if (!c) return;
    var act = btn.getAttribute('data-act');
    if (act === 'details' || act === 'hearing') {
      openDetailId = openDetailId === id ? null : id;
      renderCases();
      if (openDetailId) $('caseDetail').scrollIntoView({ block: 'nearest' });
    } else if (act === 'edit') {
      startEdit(c);
    } else if (act === 'delete') {
      if (deleteArmedId === id) {
        state.cases = state.cases.filter(function (x) { return x.id !== id; });
        if (openDetailId === id) openDetailId = null;
        deleteArmedId = null;
        save();
        renderAll();
      } else {
        deleteArmedId = id;
        renderCases();
        setTimeout(function () { if (deleteArmedId === id) { deleteArmedId = null; renderCases(); } }, 5000);
      }
    }
  });

  $('caseDetail').addEventListener('change', function (e) {
    var box = e.target.closest('input[data-doc]');
    if (!box) return;
    var c = findCase(openDetailId);
    if (!c) return;
    if (!c.docs) c.docs = {};
    c.docs[box.getAttribute('data-doc')] = box.checked;
    save();
    renderDashboard();
    renderCases();
  });

  $('caseDetail').addEventListener('submit', function (e) {
    if (!e.target || e.target.id !== 'hearingForm') return;
    e.preventDefault();
    var c = findCase(openDetailId);
    if (!c) return;
    var h = { date: $('hDate').value, outcome: $('hOutcome').value, nextDate: $('hNext').value, notes: $('hNotes').value };
    var errs = CC.validateHearing(h);
    var errEl = $('hearingError'), okEl = $('hearingOk');
    if (errs.length) {
      errEl.textContent = t({ date: 'errHearingDate', outcome: 'errHearingOutcome', nextDate: 'errHearingNext', notes: 'errHearingDate' }[errs[0]] || 'errHearingDate');
      errEl.hidden = false;
      okEl.hidden = true;
      return;
    }
    var res = CC.addHearing(c, h);
    if (!res.ok) return;
    var idx = state.cases.findIndex(function (x) { return x.id === c.id; });
    state.cases[idx] = res.kase;
    save();
    renderAll();
    var ok2 = $('hearingOk');
    if (ok2) { ok2.textContent = t('hearingSaved'); ok2.hidden = false; }
  });

  $('upcomingList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-open]');
    if (!b) return;
    openDetailId = b.getAttribute('data-open');
    showTab('cases');
    renderCases();
  });

  // ---------- data tab ----------

  $('exportBtn').addEventListener('click', function () {
    var payload = CC.exportPayload(state.cases);
    var blob = new Blob([payload], { type: 'application/json' });
    var a = $('downloadLink');
    a.href = URL.createObjectURL(blob);
    a.hidden = false;
    a.click();
  });

  $('importBtn').addEventListener('click', function () {
    var res = CC.importPayload($('importText').value);
    if (!res.ok) {
      $('importFail').hidden = false;
      $('importOk').hidden = true;
      return;
    }
    state.cases = res.data.cases;
    openDetailId = null;
    save();
    $('importFail').hidden = true;
    $('importOk').textContent = t('importOk');
    $('importOk').hidden = false;
    renderAll();
  });

  $('eraseBtn').addEventListener('click', function () {
    if ($('eraseInput').value !== 'DELETE') {
      $('eraseWrong').hidden = false;
      $('erasedMsg').hidden = true;
      return;
    }
    state.cases = [];
    openDetailId = null;
    save();
    $('eraseWrong').hidden = true;
    $('erasedMsg').textContent = t('erasedMsg');
    $('erasedMsg').hidden = false;
    $('eraseInput').value = '';
    renderAll();
  });

  // ---------- boot + test hooks ----------

  load();
  renderAll();

  window.__ccbd = {
    state: state,
    exportPayload: function () { return CC.exportPayload(state.cases); },
    importPayload: function (text) {
      var res = CC.importPayload(text);
      if (res.ok) { state.cases = res.data.cases; save(); renderAll(); }
      return res;
    },
    eraseAll: function () { state.cases = []; openDetailId = null; save(); renderAll(); },
    addCase: function (data) {
      var errs = CC.validateCase(data);
      if (errs.length) return { ok: false, errors: errs };
      var c = CC.newCase(data);
      state.cases.push(c);
      save();
      renderAll();
      return { ok: true, kase: c };
    },
  };
})();
