/* 可点性探针：派遣面板内的可操作控件，其中心点 elementFromPoint 是否命中自身/子孙。
 *
 *   NODE_PATH="C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules" \
 *     node scripts/_hitcheck.cjs [390x844|1440x900|320x568]
 *
 * 为什么不用「click() 是否成功」当判据：
 *   playwright 的 click 会重试到超时，结论取决于 timeout 长度，不是确定性量（见 .draw-toast 一例）。
 *   elementFromPoint 是瞬时的、与超时无关的，测的是「这个像素上压着谁」。
 *
 * 输出每行：state | 控件 | 尺寸 | 命中元素 | 结论
 *
 * v2 修正两处「测错量」（v1 假报了 18 处遮挡，实际为 0）：
 *   ① 角色切换 = 1×1 视觉隐藏 radio + 71.8×29.5 的 label 包裹。点 label 才点得到，
 *      判据必须是「命中点落在同一 label 内」，不能是「命中 input 自身」。
 *      行为复核：mouse.click(label 中心) → handView 0→1，生效。
 *   ② 折叠 <details> 的内容在 Chrome 里**保留布局盒**（li 仍有 274×25 的 rect），
 *      但 checkVisibility()===false、不绘制也不接收命中。对不可见元素做命中测试，
 *      命中的必然是别的东西。判据必须先过 checkVisibility()。
 *      推论：任何用 getBoundingClientRect 判断「折叠态是否隐藏」的断言都是无效的，
 *      要看 details.open 或 checkVisibility()。（这条建议同步给 V01 块数统计。）
 */
const {chromium} = require('playwright-core');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/chromium',
].filter(Boolean).find(p => fs.existsSync(p));

const VP = {
  '390x844': {width: 390, height: 844},
  '1440x900': {width: 1440, height: 900},
  '320x568': {width: 320, height: 568},
};
const vpName = process.argv[2] || '390x844';
const vp = VP[vpName];
if (!vp) { console.error('viewport 只支持：' + Object.keys(VP).join(' / ')); process.exit(2); }

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 面板内所有「人能点的东西」。disabled 的也收，标出来但不判红。 */
const HIT = () => {
  const dep = document.querySelector('.quest-deploy');
  if (!dep) return {error: 'no .quest-deploy'};
  const list = [...dep.querySelectorAll('button, input, summary, .actor-chip')];
  const toast = document.querySelector('.draw-toast');
  const desc = h => h ? (h.tagName.toLowerCase() + (h.className ? '.' + String(h.className).split(' ')[0] : '')) : null;
  const rows = list.map(el => {
    let what = el.tagName.toLowerCase();
    if (el.dataset.quest) what += '[quest=' + el.dataset.quest + ']';
    else if (el.dataset.commit) what += '[commit]';
    else if (el.tagName === 'SUMMARY') what = 'summary';
    else if (el.classList.contains('actor-chip')) what = 'label.actor-chip[' + el.querySelector('input')?.dataset.questActor + ']';
    // ① 视觉隐藏的 radio 由 label 代收点击：命中点落在同一个 label 内即视为可达。
    const zone = el.classList.contains('actor-chip') ? el : (el.closest('label') || el);
    const r = zone.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return {what, skip: 'zero-size'};
    // ② 折叠 <details> 里保留布局盒但 checkVisibility()=false，命中测试对它们无意义。
    if (zone.checkVisibility && !zone.checkVisibility()) return {what, skip: 'hidden(checkVisibility=false)'};
    const cx = +(r.left + r.width / 2).toFixed(2), cy = +(r.top + r.height / 2).toFixed(2);
    const inView = cy >= 0 && cy <= innerHeight && cx >= 0 && cx <= innerWidth;
    const hit = inView ? document.elementFromPoint(cx, cy) : null;
    const ok = !hit ? null : (hit === zone || zone.contains(hit));
    return {
      what,
      rect: [+r.left.toFixed(1), +r.top.toFixed(1), +r.width.toFixed(1), +r.height.toFixed(1)],
      disabled: !!(el.disabled || el.closest('[aria-disabled=true]')),
      inView,
      hit: desc(hit),
      ok,
    };
  });
  return {
    state: dep.dataset.state,
    toast: toast ? {present: true, z: getComputedStyle(toast).zIndex, pe: getComputedStyle(toast).pointerEvents, rect: [toast.getBoundingClientRect().width, toast.getBoundingClientRect().height]} : {present: false},
    scrollY: Math.round(scrollY),
    docH: document.documentElement.scrollHeight,
    rows,
  };
};

(async () => {
  const b = await chromium.launch({executablePath: CHROME, headless: true, args: ['--no-sandbox']});
  const p = await (await b.newContext({viewport: vp})).newPage();
  await p.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'));
  await sleep(450);
  // 开局：2 人、基础剧本
  await p.selectOption('#playerCount', '2'); await sleep(150);
  await p.locator('.ng-tabs button', {hasText: '新版扩展'}).click(); await sleep(220);
  await p.locator('.ng-card', {hasText: '基础剧本合集'}).first().click(); await sleep(280);
  await p.locator('[data-action="ngNext"]').click(); await sleep(280);
  await p.locator('[data-action="chooserConfirm"]').click(); await sleep(600);
  for (const x of await p.locator('button[data-action="keepHand"]').all()) await x.click();
  await sleep(200);
  const fin = p.locator('button[data-action="finishSetup"]');
  if (await fin.count()) await fin.click();
  await sleep(400);
  await p.evaluate(() => { for (let i = 0; i < 12; i++) { if (state.phase >= 2) break; try { ScenarioEngine.endPhase(state); } catch (e) { break; } } render(); });
  await sleep(250);
  await p.evaluate(() => document.querySelector('.phase-door .door-go:not([disabled])')?.click());
  await sleep(400);

  const out = [];
  const snap = async tag => { const r = await p.evaluate(HIT); out.push([tag, r]); };

  await p.evaluate(() => { handView = 0; render(); }); await sleep(200);
  await snap('A');

  // B：本人已提交、他人未提交（看玩家0）
  await p.evaluate(() => { const Q = ScenarioEngine.questing; Q.submitDeployment(state, 0, Q.eligible(state, 0).map(c => c.uid).slice(0, 1)); handView = 0; render(); }); await sleep(200);
  await snap('B');

  // C1：全员已交、无人确认
  await p.evaluate(() => { const Q = ScenarioEngine.questing; Q.submitDeployment(state, 1, Q.eligible(state, 1).map(c => c.uid).slice(0, 1)); handView = 0; render(); }); await sleep(200);
  await snap('C1');

  // C2：本人已确认、他人未确认
  await p.evaluate(() => { const Q = ScenarioEngine.questing; Q.approveDeployment(state, 0); handView = 0; render(); }); await sleep(200);
  await snap('C2');

  // D：全员确认 → deploymentLocked
  await p.evaluate(() => { const Q = ScenarioEngine.questing; Q.approveDeployment(state, 1); handView = 0; render(); }); await sleep(250);
  await snap('D');

  console.log('\n=== ' + vpName + ' ===');
  for (const [tag, r] of out) {
    if (r.error) { console.log(tag + '  ' + r.error); continue; }
    console.log(`\n[${tag}]  state=${r.state}  toast=${r.toast.present ? JSON.stringify(r.toast) : '无'}  scrollY=${r.scrollY} docH=${r.docH}`);
    for (const row of r.rows) {
      if (row.skip) { console.log(`   ${row.what.padEnd(22)} ${row.skip}`); continue; }
      const mark = row.disabled ? '  disabled' : row.ok === true ? '  OK' : row.ok === false ? '  ✗ OCCLUDED' : '  out-of-view';
      console.log(`   ${row.what.padEnd(22)} rect=${JSON.stringify(row.rect).padEnd(28)} hit=${String(row.hit).padEnd(30)}${mark}`);
    }
  }

  // 汇总：只看未被遮挡/未 disabled 的可操作控件
  const bad = [];
  for (const [tag, r] of out) for (const row of r.rows || []) if (row.ok === false && !row.disabled) bad.push(tag + ' ' + row.what + ' ← ' + row.hit);
  console.log('\n=== 汇总 ===');
  console.log(bad.length ? '遮挡 ' + bad.length + ' 处：\n  ' + bad.join('\n  ') : '无遮挡：所有可见可操作控件的中心点都命中自身或子孙。');

  await b.close();
})().catch(e => { console.error('FAILED:', e.message); process.exit(2); });
