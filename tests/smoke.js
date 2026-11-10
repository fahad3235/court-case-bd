// court-case-bd -- headless-Chrome smoke test via raw CDP (no puppeteer).
// Usage: node tests/smoke.js
// Exits non-zero on any failed assertion; fails on page console errors.
// Dates are computed from the page's own "today" so the test is date-robust.
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = 9356;
const BASE = 'file://' + path.resolve(__dirname, '..', 'index.html');
let failures = 0;
let count = 0;
const pageErrors = [];
function check(name, cond, extra) {
  count++;
  console.log((cond ? 'ok - ' : 'FAIL - ') + name + (cond ? '' : ' :: ' + (extra || '')));
  if (!cond) failures++;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const CHROME_BIN = process.env.CHROME_BIN ||
    require('os').homedir() + '/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell';
  const chrome = spawn(CHROME_BIN, [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=' + PORT, '--user-data-dir=/tmp/ccbd2-smoke-' + process.pid,
    'about:blank',
  ], { stdio: 'ignore' });
  let targets = [];
  for (let i = 0; i < 50 && targets.length === 0; i++) {
    await wait(200);
    try {
      targets = JSON.parse(await new Promise((res, rej) => {
        http.get('http://127.0.0.1:' + PORT + '/json/list', (r) => {
          let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(d));
        }).on('error', rej);
      }));
    } catch (e) { /* retry */ }
  }
  if (!targets.length) { console.log('FAIL - chrome did not start'); process.exit(2); }
  const wsUrl = targets[0].webSocketDebuggerUrl;
  const ws = new WebSocket(wsUrl);
  await new Promise((res) => { ws.onopen = res; });
  let seq = 0; const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') {
      pageErrors.push('exception: ' + JSON.stringify(msg.params.exceptionDetails).slice(0, 300));
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      pageErrors.push('console.error: ' + JSON.stringify(msg.params.args).slice(0, 300));
    }
  };
  function send(method, params) {
    return new Promise((res) => {
      const id = ++seq;
      pending.set(id, res);
      ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  const nav = async (url) => { await send('Page.navigate', { url }); await wait(1400); };
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) return { error: JSON.stringify(r.result.exceptionDetails).slice(0, 300) };
    return r.result ? r.result.result.value : undefined;
  };
  const clickTab = async (name) => ev(`document.querySelector('[data-tab="${name}"]').click()`);
  const BN_TITLE = '\u0995\u09cb\u09b0\u09cd\u099f \u0995\u09c7\u09b8 \u09ac\u09bf\u09a1\u09bf';

  // ---- Load: defaults, empty state ----
  await nav(BASE);
  const TODAY = await ev(`window.COURT_CASE_BD.todayStr()`);
  const D2 = await ev(`window.COURT_CASE_BD.addDays('${TODAY}', 2)`);
  const D16 = await ev(`window.COURT_CASE_BD.addDays('${TODAY}', 16)`);
  const D30 = await ev(`window.COURT_CASE_BD.addDays('${TODAY}', 30)`);
  check('page title mentions Court Case', (await ev('document.title'))?.includes('Court Case'));
  check('subtitle present', (await ev(`document.getElementById('subtitle').textContent`)).length > 40);
  check('stat total is 0', (await ev(`document.getElementById('statTotal').textContent`)) === '0');
  check('upcoming empty shown', (await ev(`document.getElementById('upcomingEmpty').hidden`)) === false);
  await clickTab('cases');
  check('cases empty text shown', (await ev(`document.getElementById('casesEmpty').textContent`)).length > 10);

  // ---- Validation: empty form rejected ----
  await clickTab('add');
  await ev(`document.getElementById('saveCaseBtn').click()`);
  check('empty case shows inline error', (await ev(`document.getElementById('caseError').hidden`)) === false);

  // ---- Validation: bad lawyer phone rejected ----
  await ev(`document.getElementById('caseNoInput').value='Civil Suit 123/2026';
    document.getElementById('titleInput').value='Land dispute - Mirpur plot';
    document.getElementById('courtInput').value='District Judge Court';
    document.getElementById('lawyerPhoneInput').value='12345';
    document.getElementById('saveCaseBtn').click()`);
  check('bad phone shows error', (await ev(`document.getElementById('caseError').hidden`)) === false);
  check('bad phone error text mentions mobile', (await ev(`document.getElementById('caseError').textContent`)).toLowerCase().includes('mobile'));

  // ---- Add a valid case: hearing in 2 days ----
  await ev(`document.getElementById('lawyerPhoneInput').value='01712345678';
    document.getElementById('hearingInput').value='${D2}';
    document.getElementById('saveCaseBtn').click()`);
  check('save success message shows', (await ev(`document.getElementById('caseOk').hidden`)) === false);
  check('save success text', (await ev(`document.getElementById('caseOk').textContent`)).includes('saved'));
  await clickTab('cases');
  check('case list has 1 card', (await ev(`document.querySelectorAll('#caseList .case-card').length`)) === 1);
  check('card shows title', (await ev(`document.querySelector('#caseList .case-card').textContent`)).includes('Land dispute'));
  check('card shows case number', (await ev(`document.querySelector('#caseList .case-card').textContent`)).includes('Civil Suit 123/2026'));
  check('hearing chip says in 2 days', (await ev(`document.querySelector('#caseList .case-card').textContent`)).includes('in 2 days'));

  // ---- Dashboard stats after add ----
  await clickTab('dashboard');
  check('dashboard total is 1', (await ev(`document.getElementById('statTotal').textContent`)) === '1');
  check('dashboard ongoing is 1', (await ev(`document.getElementById('statOngoing').textContent`)) === '1');
  check('dashboard this-week is 1', (await ev(`document.getElementById('statThisWeek').textContent`)) === '1');
  check('dashboard overdue is 0', (await ev(`document.getElementById('statOverdue').textContent`)) === '0');
  check('upcoming list has 1 item', (await ev(`document.querySelectorAll('#upcomingList li').length`)) === 1);

  // ---- Details: docs checklist (civil = 7), tick 2 ----
  await clickTab('cases');
  await ev(`document.querySelector('#caseList [data-act="details"]').click()`);
  check('detail panel shown', (await ev(`document.getElementById('caseDetail').hidden`)) === false);
  check('7 doc checkboxes for civil', (await ev(`document.querySelectorAll('#caseDetail input[data-doc]').length`)) === 7);
  await ev(`document.querySelector('#caseDetail input[data-doc="plaint"]').click();
    document.querySelector('#caseDetail input[data-doc="vakalatnama"]').click()`);
  check('docs progress 2/7 in card', (await ev(`document.querySelector('#caseList .case-card').textContent`)).includes('2/7'));

  // ---- Log a hearing: adjourned, next in 16 days ----
  await ev(`document.getElementById('hDate').value='${D2}';
    document.getElementById('hOutcome').value='adjourned';
    document.getElementById('hNext').value='${D16}';
    document.querySelector('#hearingForm button[type="submit"]').click()`);
  check('hearing saved message shows', (await ev(`document.getElementById('hearingOk').hidden`)) === false);
  check('hearing history has 1 row', (await ev(`document.querySelectorAll('#caseDetail tbody tr').length`)) === 1);
  check('history row shows Adjourned', (await ev(`document.querySelector('#caseDetail tbody tr').textContent`)).includes('Adjourned'));
  check('chip now says in 16 days', (await ev(`document.querySelector('#caseList .case-card').textContent`)).includes('in 16 days'));
  await clickTab('dashboard');
  check('dashboard hearings logged is 1', (await ev(`document.getElementById('statLogged').textContent`)) === '1');
  check('dashboard this-week back to 0', (await ev(`document.getElementById('statThisWeek').textContent`)) === '0');

  // ---- Persistence across reload ----
  await nav(BASE);
  await clickTab('cases');
  check('case persists after reload', (await ev(`document.querySelectorAll('#caseList .case-card').length`)) === 1);
  check('docs ticks persist after reload', (await ev(`document.querySelector('#caseList .case-card').textContent`)).includes('2/7'));

  // ---- Edit: change title ----
  await ev(`document.querySelector('#caseList [data-act="edit"]').click()`);
  check('edit switches to add tab', (await ev(`document.getElementById('panel-add').hidden`)) === false);
  await ev(`document.getElementById('titleInput').value='Land dispute - Mirpur plot UPDATED';
    document.getElementById('saveCaseBtn').click()`);
  check('update message shows', (await ev(`document.getElementById('caseOk').textContent`)).includes('updated'));
  await clickTab('cases');
  check('edited title shown', (await ev(`document.querySelector('#caseList .case-card').textContent`)).includes('UPDATED'));

  // ---- Filters: disposed filter hides the ongoing case ----
  await ev(`document.getElementById('filterStatus').value='disposed'; document.getElementById('filterStatus').dispatchEvent(new Event('change'))`);
  check('disposed filter shows 0 cards', (await ev(`document.querySelectorAll('#caseList .case-card').length`)) === 0);
  await ev(`document.getElementById('filterStatus').value='all'; document.getElementById('filterStatus').dispatchEvent(new Event('change'))`);
  check('all filter restores 1 card', (await ev(`document.querySelectorAll('#caseList .case-card').length`)) === 1);

  // ---- Export / erase / import round-trip via test hooks ----
  const payload = await ev(`window.__ccbd.exportPayload()`);
  check('export payload is court-case-bd v1', payload.includes('"app": "court-case-bd"') && payload.includes('"version": 1'), payload.slice(0, 120));
  check('export carries updated title', payload.includes('UPDATED'));
  await ev(`window.__ccbd.eraseAll()`);
  check('eraseAll empties cases', (await ev(`window.__ccbd.exportPayload()`)).includes('"cases": []'));
  const imp = await ev(`JSON.stringify(window.__ccbd.importPayload(${JSON.stringify(payload)}))`);
  check('import valid payload ok', imp.includes('"ok":true'), imp);
  check('import restores case', (await ev(`window.__ccbd.exportPayload()`)).includes('UPDATED'));
  const badImp = await ev(`JSON.stringify(window.__ccbd.importPayload('{"app":"land-tax-bd","version":1,"cases":[]}'))`);
  check('import wrong app rejected', badImp.includes('"ok":false'));
  check('invalid import leaves data intact', (await ev(`window.__ccbd.exportPayload()`)).includes('UPDATED'));

  // ---- Bad import via UI textarea; good import succeeds ----
  await clickTab('data');
  await ev(`document.getElementById('importText').value='{not json'; document.getElementById('importBtn').click()`);
  check('bad UI import shows error', (await ev(`document.getElementById('importFail').hidden`)) === false);
  await ev(`document.getElementById('importText').value=${JSON.stringify(payload)}; document.getElementById('importBtn').click()`);
  check('good UI import succeeds', (await ev(`document.getElementById('importOk').hidden`)) === false);

  // ---- Typed-DELETE erase via UI; wrong word rejected ----
  await ev(`document.getElementById('eraseInput').value='delete'; document.getElementById('eraseBtn').click();`);
  check('wrong erase word rejected', (await ev(`document.getElementById('eraseWrong').hidden`)) === false);
  check('wrong erase keeps data', (await ev(`window.__ccbd.exportPayload()`)).includes('UPDATED'));
  await ev(`document.getElementById('eraseInput').value='DELETE'; document.getElementById('eraseBtn').click();`);
  check('DELETE erases data', (await ev(`window.__ccbd.exportPayload()`)).includes('"cases": []'));
  check('erase success message shows', (await ev(`document.getElementById('erasedMsg').hidden`)) === false);

  // ---- Re-add a case for language checks, then BN toggle ----
  await ev(`window.__ccbd.addCase({caseNo:'Writ 45/2026', title:'Writ petition test', court:'High Court Division', type:'writ', filingDate:'${TODAY}', nextHearing:'${D30}', lawyerName:'', lawyerPhone:'', status:'ongoing', notes:''})`);
  await clickTab('dashboard');
  await ev(`document.getElementById('langBtn').click()`);
  check('BN toggle: title in Bengali', (await ev(`document.getElementById('title').textContent`)) === BN_TITLE);
  check('BN toggle: total in Bengali digit', (await ev(`document.getElementById('statTotal').textContent`)) === '\u09e7');
  check('BN toggle: tab label in Bengali', (await ev(`document.getElementById('tab-cases').textContent`)) === '\u0986\u09ae\u09be\u09b0 \u09ae\u09be\u09ae\u09b2\u09be');
  await nav(BASE);
  check('BN toggle persists after reload', (await ev(`window.__ccbd.state.lang`)) === 'bn');
  await ev(`document.getElementById('langBtn').click()`);
  check('back to EN', (await ev(`window.__ccbd.state.lang`)) === 'en');

  // ---- Mobile 390px: no horizontal overflow on any tab ----
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await nav(BASE);
  await clickTab('cases');
  await ev(`document.querySelector('#caseList [data-act="details"]').click()`);
  for (const tab of ['dashboard', 'cases', 'add', 'data']) {
    await clickTab(tab);
    await wait(300);
    const overflow = await ev(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
    check('390px no overflow on ' + tab + ' tab', overflow <= 0, 'overflow=' + overflow);
  }

  // ---- Zero network requests: app is fully offline (only file:// loads) ----
  const reqs = await ev(`performance.getEntriesByType('resource').map(r => r.name).filter(n => !n.startsWith('file://')).length`);
  check('zero non-file network requests', reqs === 0, 'non-file=' + reqs);

  check('no console/page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  chrome.kill();
  console.log('\n' + count + ' checks, ' + failures + ' failed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL - harness error: ' + e.message); try { chrome.kill(); } catch (_) {} process.exit(2); });
