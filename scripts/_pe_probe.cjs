// 独立 DOM 语义探针：不加载项目页面，只在 about:blank 里验证「命中测试」的规则。
// 目的：判定 #9 判据 P2（elementsFromPoint 中不存在 .draw-toast）会不会被 pointer-events:none 骗绿。
// 用法：node scripts/_pe_probe.cjs
const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.setContent(`<!doctype html><html><body style="margin:0">
    <button id="btn" style="position:absolute;left:51px;top:400px;width:134px;height:47px">目标</button>
    <div id="mask" style="position:fixed;inset:0;z-index:60;background:#14291c40"></div>
  </body></html>`);

  const probe = async (label, maskStyle) => {
    await page.evaluate((s) => {
      const m = document.getElementById('mask');
      m.setAttribute('style', s);
    }, maskStyle);
    return await page.evaluate((lbl) => {
      const btn = document.getElementById('btn'), m = document.getElementById('mask');
      const r = btn.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      // 真实鼠标点击能否到达
      let clicked = 0;
      btn.addEventListener('click', () => { clicked++; }, { once: true });
      return {
        label: lbl,
        hitTop: (document.elementFromPoint(cx, cy) || {}).id || null,
        stack: document.elementsFromPoint(cx, cy).map(e => e.id || e.tagName),
        maskVisible: m.checkVisibility(),
        maskArea: (() => { const mr = m.getBoundingClientRect(); return +(mr.width * mr.height).toFixed(0); })(),
        maskPE: getComputedStyle(m).pointerEvents,
      };
    }, label);
  };

  const fullscreen = 'position:fixed;inset:0;z-index:60;background:#14291c40';
  const peNone = 'position:fixed;inset:0;z-index:60;background:#14291c40;pointer-events:none';
  const cardSize = 'position:fixed;left:80px;top:300px;width:230px;height:200px;z-index:60;background:#14291c40';

  const rows = [];
  rows.push(await probe('A 全屏遮罩（现状，吃掉点击）', fullscreen));
  rows.push(await probe('B 全屏遮罩 + pointer-events:none（点击已穿透）', peNone));
  rows.push(await probe('C 卡片尺寸载体（无全屏层）', cardSize));

  console.log('\n=== 命中测试语义 ===');
  for (const r of rows) {
    console.log(`${r.label}
  元素栈      ${JSON.stringify(r.stack)}
  栈顶        ${r.hitTop}
  遮罩仍在树  ${r.maskVisible}   遮罩面积 ${r.maskArea}px²   视口 329160px²
  P1 未被遮挡 ${r.hitTop === 'btn' ? 'PASS' : 'FAIL'}
  P2 栈中无遮罩 ${r.stack.includes('mask') ? 'FAIL' : 'PASS'}
`);
  }

  await browser.close();
})();
