/* V10 判据校验（不是验收！）
 *
 * 起因：新构建把 .r0-num 从 `flex:1 1 auto;overflow:hidden;text-overflow:ellipsis` 改成了
 *       `flex:none`，并把 .r0 改成 `flex:0 1 auto`（shrink-to-fit）。这会让 V10 原有的三条断言
 *       在不同方向失效——需要实测哪一条还对「数字被截/被挤出」有分辨力，改判据之前先量。
 *
 * 只做一件事：四人局 C2，在 320×568 与 1440×900 各量一次 .r0-num 的几何与文本 range 几何，
 * 把三种候选判据的原始量并排打出来。不产出 PASS/FAIL，不写 report.json，不覆盖任何基线。
 *
 *   NODE_PATH="C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules" \
 *     node scripts/_v10probe.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const root = path.resolve(__dirname, '..');
const pageUrl = 'file:///' + path.join(root, 'index.html').replace(/\\/g, '/');
const executablePath = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].filter(Boolean).find(p => fs.existsSync(p));

/* 在页面里跑：拿到 .r0-num、.r0、若干候选容器的几何，以及数字文本自身的 range 几何。
   range 是关键——它量的是「字实际画到哪儿」，与用哪种 CSS 技巧裁切无关。 */
function probe() {
  const cs = el => getComputedStyle(el);
  const r = el => { const b = el.getBoundingClientRect(); return { left: +b.left.toFixed(2), right: +b.right.toFixed(2), width: +b.width.toFixed(2), top: +b.top.toFixed(2), height: +b.height.toFixed(2) }; };
  const contentBox = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect(), s = cs(el);
    const pl = parseFloat(s.paddingLeft), pr = parseFloat(s.paddingRight);
    const bl = parseFloat(s.borderLeftWidth), br = parseFloat(s.borderRightWidth);
    return { left: +(b.left + bl + pl).toFixed(2), right: +(b.right - br - pr).toFixed(2) };
  };

  const num = document.querySelector('.r0-num');
  const r0 = document.querySelector('.r0');
  const pill = document.querySelector('.r0');
  const head = document.querySelector('.r-head');
  const body = document.querySelector('.decide-body');
  const box = document.querySelector('.decide-box');
  if (!num || !r0) return { missing: true };

  // 数字文本自身的渲染矩形（可能跨多个行盒）
  const rg = document.createRange();
  rg.selectNodeContents(num);
  const rects = [...rg.getClientRects()].map(b => ({ left: +b.left.toFixed(2), right: +b.right.toFixed(2), width: +b.width.toFixed(2), top: +b.top.toFixed(2) }));
  const textRight = rects.length ? Math.max(...rects.map(x => x.right)) : null;
  const textLeft = rects.length ? Math.min(...rects.map(x => x.left)) : null;

  const nb = num.getBoundingClientRect();
  const rb = r0.getBoundingClientRect();
  const s = cs(num);

  return {
    文本: num.textContent.trim(),
    num: { ...r(num), clientWidth: num.clientWidth, scrollWidth: num.scrollWidth, overflow: num.scrollWidth - num.clientWidth,
           flex: s.flex, overflowCss: s.overflow, textOverflow: s.textOverflow, fontSize: s.fontSize },
    r0: r(r0),
    pill: pill ? { ...r(pill.querySelector('.state-pill')), text: (pill.querySelector('.state-pill') || {}).textContent } : null,
    rHead: r(head),
    容器内容盒: { decideBody: contentBox(body), decideInline: contentBox(box), rHead: contentBox(head) },
    num内容盒: contentBox(num),
    文本range: { 行盒数: rects.length, textLeft, textRight, 最宽盒: rects.length ? Math.max(...rects.map(x => x.width)) : null, rects },
    候选A_旧三条: { 溢出: num.scrollWidth - num.clientWidth, 行盒数: rects.length, clientWidth: num.clientWidth },
    候选B_Δ右: { num右: +nb.right.toFixed(2), r0内容盒右: +rb.right.toFixed(2), Δ: +(nb.right - rb.right).toFixed(2) },
    候选C_文本可见: (() => {
      const cb = contentBox(box);
      return cb && textRight != null ? { 文本右缘: textRight, 面板内容盒右: cb.right, 越界: +(textRight - cb.right).toFixed(2) } : null;
    })(),
  };
}

/* 对齐用：把「容器右缘」的所有候选口径一次量出来，并分别算 4 名 / 12 名两种文本的需要宽。
   目的：我和 ux 的 1px 差不是「谁算错」，而是取了不同盒子层；文本宽差不该存在，量一下就知道。 */
function alignBoxes() {
  const num = document.querySelector('.r0-num');
  const box = document.querySelector('.decide-box');
  const body = document.querySelector('.decide-body');
  if (!num || !box) return null;
  const cs = el => getComputedStyle(el);
  const px = (el, k) => parseFloat(cs(el)[k]) || 0;
  const b = el => el.getBoundingClientRect();
  const boxR = b(box), bodyR = body ? b(body) : null;
  const variants = {
    'decide-box.borderBox.right': +boxR.right.toFixed(2),
    'decide-box.paddingBox.right': +(boxR.right - px(box, 'borderRightWidth')).toFixed(2),
    'decide-box.contentBox.right': +(boxR.right - px(box, 'borderRightWidth') - px(box, 'paddingRight')).toFixed(2),
    'decide-body.borderBox.right': bodyR ? +bodyR.right.toFixed(2) : null,
    'decide-body.paddingBox.right': bodyR ? +(bodyR.right - px(body, 'borderRightWidth')).toFixed(2) : null,
    'decide-body.contentBox.right': bodyR ? +(bodyR.right - px(body, 'borderRightWidth') - px(body, 'paddingRight')).toFixed(2) : null,
    'overflow(decide-body)': body ? cs(body).overflow : null,
    'overflow(decide-box)': cs(box).overflow,
  };
  const needOf = (txt) => {
    const keep = num.textContent;
    num.textContent = txt;
    const rg = document.createRange(); rg.selectNodeContents(num);
    const rects = [...rg.getClientRects()];
    const w = rects.length ? Math.max(...rects.map(x => x.right)) - Math.min(...rects.map(x => x.left)) : null;
    const rb = rg.getBoundingClientRect();
    num.textContent = keep;
    return { text: txt, needRectsMax: w == null ? null : +w.toFixed(2), needRangeRectW: +rb.width.toFixed(2), 行盒数: rects.length };
  };
  return { variants, numLeft: +b(num).left.toFixed(2), numW: +num.getBoundingClientRect().width.toFixed(2),
    need4: needOf('4 名 · 意志 99 ／ 威胁 50'), need12: needOf('12 名 · 意志 99 ／ 威胁 50') };
}

async function drive(page, players) {
  await page.selectOption('#playerCount', String(players));
  await page.waitForTimeout(180);
  const tap = async (loc, ms = 250) => {
    if (!await loc.count()) return false;
    try { await loc.first().click({ timeout: 1800 }); } catch (e) {
      try { await loc.first().click({ force: true, timeout: 1200 }); } catch (e2) {
        try { await loc.first().evaluate(el => el.click()); } catch (e3) { return false; }
      }
    }
    await page.waitForTimeout(ms); return true;
  };
  await tap(page.locator('.ng-tabs button', { hasText: '新版扩展' }), 220);
  await tap(page.locator('.ng-card', { hasText: '基础剧本合集' }), 280);
  await tap(page.locator('[data-action="ngNext"]'), 280);
  await tap(page.locator('[data-action="chooserConfirm"]'), 560);
  for (let i = 0; i < 8; i++) {
    /* :not([disabled]) 是必须的：确认过的玩家按钮留在 DOM 里只是变 disabled，
       first() 会一直选中它、等到超时，然后整条 setup 卡死（1440 也一样）。 */
    const keeps = page.locator('button[data-action="keepHand"]:not([disabled])');
    if (!await keeps.count()) break;
    if (!await tap(keeps, 200)) break;
  }
  await page.waitForTimeout(180);
  const fin = page.locator('button[data-action="finishSetup"]:not([disabled])');
  if (await fin.count()) await tap(fin, 380);

  /* 起始手牌兜底：320 下真实指针落在阶段轨上（任务 #12 已定性），按钮虽然「可见」却点不到。
     这里用引擎把这一小段走完，UI 之后的部分仍然走真实点击。 */
  await page.evaluate(() => {
    const s = state;
    let g = 0;
    while (g++ < 8 && s.players.some(p => !p.openingConfirmed)) {
      for (const p of s.players) { if (!p.openingConfirmed) { try { ScenarioEngine.openingChoice(s, p.id, false); } catch (e) {} } }
    }
    if (s.phase === 0) { try { ScenarioEngine.startScenario(s); } catch (e) {} }
    render();
  });
  await page.waitForTimeout(240);
  // 先走 UI 推进（与验收脚本同一策略），点不动再退引擎（原因见 REPORT O3）
  const PANEL = ':is(.operation-content, .decide-box, .planning-strip)';
  const clickAny = async (sel, text) => {
    const el = text ? page.locator(sel, { hasText: text }).first() : page.locator(sel).first();
    if (!await el.count()) return false;
    try { await el.click({ timeout: 1500 }); }
    catch (e) { try { await el.evaluate(n => n.click()); } catch (e2) { return false; } }
    await page.waitForTimeout(280); return true;
  };
  const dismiss = async () => {
    const dc = page.locator('#draw-close');
    if (await dc.count() && await dc.isVisible()) { await dc.click({ force: true }).catch(() => {}); await page.waitForTimeout(140); return true; }
    return false;
  };
  let at = false;
  for (let i = 0; i < 40; i++) {
    const s = await page.evaluate(() => ({ p: state.phase, st: state.questing && state.questing.step, locked: !!(state.questing && state.questing.deploymentLocked) }));
    if (s.p === 2 && s.st === 'commit' && !s.locked) { at = true; break; }
    if (await dismiss()) continue;
    if (await clickAny(PANEL + ' button:not([disabled])', '结束我的盟友／附属出牌步骤')) continue;
    if (await clickAny(PANEL + ' button:not([disabled])', '继续到下一决策点')) continue;
    if (await clickAny(PANEL + ' button:not([disabled])', '：放弃剩余行动')) continue;
    if (await clickAny(PANEL + ' button:not([disabled])', '开始投入角色')) continue;
    if (await clickAny('.operation-title button.primary:not([disabled])')) continue;
    await page.waitForTimeout(220);
  }
  if (!at) await page.evaluate(() => {
    const s = state, Q = ScenarioEngine.questing;
    let g = 0; while (s.phase !== 2 && g++ < 8) { try { ScenarioEngine.nextPhase(s); } catch (e) { break; } }
    if (s.questing) {
      for (const id of (s.questing.order || [])) { try { Q.pass(s, id); } catch (e) {} }
      try { if (s.questing.step === 'beforeCommit') Q.move(s); } catch (e) {}
    }
    render();
  });
  await page.waitForTimeout(200);
  // 全员提交 + 前 3 人确认 → C2
  await page.evaluate((n) => {
    const Q = ScenarioEngine.questing, s = state;
    const ids = (s.questing && s.questing.order ? s.questing.order : []).slice(0, n);
    for (const id of ids) { try { Q.submitDeployment(s, id, Q.eligible(s, id).map(c => c.uid).slice(0, 1)); } catch (e) {} }
    for (const id of ids.slice(0, Math.max(0, ids.length - 1))) { try { Q.approveDeployment(s, id); } catch (e) {} }
    handView = 0; render();
  }, players);
  await page.waitForTimeout(300);
  return page.evaluate(() => ({ phase: state.phase, step: state.questing && state.questing.step, deploy: document.querySelector('.r0-num') ? 'R0 ok' : 'R0 missing' }));
}

(async () => {
  if (!executablePath) throw new Error('未找到本机 Chrome');
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  const out = [];
  for (const vp of [{ name: '320x568', w: 320, h: 568 }, { name: '1440x900', w: 1440, h: 900 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    page.setDefaultTimeout(8000);
    const errs = []; page.on('pageerror', e => errs.push(String(e)));
    await page.goto(pageUrl);
    await page.waitForTimeout(450);
    let info, data, fals = null, align = null;
    try {
      info = await drive(page, 4);
      data = await page.evaluate(probe);
      /* 负向对照：人为把数字挤出去，看哪几条断言会红。
         不修改构建，只在这一个页面实例上改内联样式，量完即还原。 */
      fals = await page.evaluate(() => {
        const num = document.querySelector('.r0-num'), r0 = document.querySelector('.r0'), pill = document.querySelector('.state-pill');
        if (!num || !r0) return null;
        const box = document.querySelector('.decide-box');
        const cb = (() => { const b = box.getBoundingClientRect(), s = getComputedStyle(box); return b.right - parseFloat(s.borderRightWidth) - parseFloat(s.paddingRight); })();
        const measure = (tag) => {
          const rg = document.createRange(); rg.selectNodeContents(num);
          const rects = [...rg.getClientRects()];
          const nb = num.getBoundingClientRect(), rb = r0.getBoundingClientRect(), pb = pill.getBoundingClientRect();
          return {
            tag,
            文本右缘: rects.length ? +Math.max(...rects.map(x => x.right)).toFixed(2) : null,
            面板右: +cb.toFixed(2),
            C越界: rects.length ? +(Math.max(...rects.map(x => x.right)) - cb).toFixed(2) : null,
            A溢出: num.scrollWidth - num.clientWidth,
            A行盒: rects.length,
            BΔ右: +(nb.right - rb.right).toFixed(2),
            num与pill同一行: Math.abs(nb.top - pb.top) <= 6,
            r0宽: +rb.width.toFixed(2),
          };
        };
        const out = [measure('原样')];
        const keep = { num: num.getAttribute('style'), pill: pill.getAttribute('style'), r0: r0.getAttribute('style') };
        num.style.minWidth = (num.getBoundingClientRect().width + 60) + 'px'; out.push(measure('数字需多 60px'));
        num.setAttribute('style', keep.num || ''); pill.style.minWidth = (pill.getBoundingClientRect().width + 130) + 'px'; out.push(measure('药丸多 130px'));
        pill.setAttribute('style', keep.pill || ''); r0.style.maxWidth = '150px'; out.push(measure('r0 限宽 150'));
        num.setAttribute('style', keep.num || ''); pill.setAttribute('style', keep.pill || ''); r0.setAttribute('style', keep.r0 || '');
        return out;
      });
      align = await page.evaluate(alignBoxes);
    }
    catch (e) { info = { fatal: String(e.message).slice(0, 200) }; }
    out.push({ viewport: vp.name, info, errs, data, fals, align });
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(root, 'docs', 'browser-acceptance', 'vaccept', '_v10probe.json'), JSON.stringify(out, null, 2), 'utf8');
  for (const o of out) {
    console.log('\n══ ' + o.viewport + ' ══ ' + JSON.stringify(o.info));
    if (o.errs.length) console.log('  pageerror: ' + o.errs.join(' | ').slice(0, 200));
    if (!o.data || o.data.missing) { console.log('  ' + JSON.stringify(o.data)); continue; }
    const d = o.data;
    console.log('  文本 "' + d.文本 + '"  fontSize ' + d.num.fontSize + '  flex ' + d.num.flex + '  overflow ' + d.num.overflowCss);
    console.log('  num  ' + JSON.stringify(d.num));
    console.log('  r0   ' + JSON.stringify(d.r0) + '   pill ' + (d.pill ? d.pill.width + 'px "' + d.pill.text + '"' : '—'));
    console.log('  行盒 ' + d.文本range.行盒数 + '  文本左 ' + d.文本range.textLeft + '  文本右 ' + d.文本range.textRight);
    console.log('  A 旧三条  ' + JSON.stringify(d.候选A_旧三条));
    console.log('  B Δ右     ' + JSON.stringify(d.候选B_Δ右));
    console.log('  C 文本可见 ' + JSON.stringify(d.候选C_文本可见));
    if (o.fals) for (const f of o.fals) console.log('  负向 ' + JSON.stringify(f));
    if (o.align) {
      console.log('  容器右缘候选 ' + JSON.stringify(o.align.variants));
      console.log('  num.left ' + o.align.numLeft + '  num.w ' + o.align.numW);
      console.log('  需要4名  ' + JSON.stringify(o.align.need4));
      console.log('  需要12名 ' + JSON.stringify(o.align.need12));
    }
  }
})();
