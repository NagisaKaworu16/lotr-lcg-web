/* 阶段3 投入面板回归：进入 commit 后，玩家分段按钮组、角色勾选、唯一主按钮
   必须全部落在视口内且不需要滚动，否则第二个人无法提交名单。
   v0.15.70：下拉框 + 并排徽章已换成 role=radiogroup 的玩家分段按钮组，
   面板就地渲染在手牌区「结束阶段」同一块（.decide-inline）。
   v0.15.71：接着验五段结构本身——R0 单行不横跳、R2 提交后换只读行、
   R4 明细按人一行、改名单要二次确认、390px 不出横向滚动条。 */
const {chromium}=require('playwright-core'),fs=require('fs'),path=require('path'),ROOT=path.join(__dirname,'..');
/* 跨平台浏览器探测：和 browser-check.cjs 用同一份候选表，不再写死 /usr/bin/chromium。 */
const CHROME=['/usr/bin/chromium','/usr/bin/google-chrome','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'];
const EXE=CHROME.find(p=>fs.existsSync(p));
(async()=>{
 if(!EXE)throw new Error('未找到本机 Chrome/Edge');
 const b=await chromium.launch({executablePath:EXE,headless:true,args:['--no-sandbox']});
 const p=await (await b.newContext({viewport:{width:1440,height:950}})).newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file:///'+path.join(ROOT,'index.html'));await p.waitForTimeout(450);
 await p.selectOption('#playerCount','2');
 await p.locator('.ng-tabs button',{hasText:'新版扩展'}).click();await p.waitForTimeout(250);
 await p.locator('.ng-card',{hasText:'基础剧本合集'}).first().click();await p.waitForTimeout(300);
 await p.locator('[data-action="ngNext"]').click();await p.waitForTimeout(300);
 await p.locator('[data-action="chooserConfirm"]').click();await p.waitForTimeout(700);
 for(const x of await p.locator('button[data-action="keepHand"]').all())await x.click();
 /* v0.15.64 起全员确认手牌后引擎自动执行剧本设置，「确认手牌并执行剧本设置」按钮随面板消失。 */
 const finish=p.locator('button[data-action="finishSetup"]');
 if(await finish.count())await finish.click();
 await p.waitForTimeout(750);
 await p.evaluate(()=>{for(let i=0;i<10;i++){if(state.phase>=2)break;try{ScenarioEngine.endPhase(state)}catch(e){break}}render()});
 await p.waitForTimeout(250);
 await p.evaluate(()=>document.querySelector('.phase-door .door-go:not([disabled])')?.click());
 await p.waitForTimeout(450);
 const g=await p.evaluate(()=>{
  const r=e=>{const b=e.getBoundingClientRect();return {y:Math.round(b.y),bottom:Math.round(b.bottom),w:Math.round(b.width)}};
  const panel=document.querySelector('.decide-inline .quest-deploy');
  const group=panel&&panel.querySelector('[role="radiogroup"]');
  const radios=group?[...group.querySelectorAll('input[type="radio"]')]:[];
  const submit=panel&&panel.querySelector('[data-quest="commit"]');
  const boxes=panel?[...panel.querySelectorAll('input[data-commit]')]:[];
  return {step:state.questing?.step,vh:innerHeight,
   panel:panel?{...r(panel),sh:panel.scrollHeight,ch:panel.clientHeight}:null,
   group:group?r(group):null,first:radios.length?r(radios[0]):null,radios:radios.length,
   submit:submit?r(submit):null,checks:boxes.length,
   primaries:panel?panel.querySelectorAll('button.primary').length:0,
   checksVisible:boxes.every(x=>{const b=x.getBoundingClientRect();return b.top>=0&&b.bottom<=innerHeight;}),
   matBottom:Math.round(document.querySelector('.player-mat').getBoundingClientRect().bottom)};});
 const vpw=g.vh;
 const inView=e=>!!e&&e.y>=0&&e.bottom<=vpw;
 const checks=[
  ['已进入投入名单步骤', g.step==='commit', g.step||'-'],
  ['面板不出现内部滚动', !!g.panel&&g.panel.sh<=g.panel.ch+1, g.panel?`${g.panel.sh}/${g.panel.ch}`:'无面板'],
  ['玩家分段按钮组（radiogroup）存在', !!g.group, g.group?`${g.radios} 人`:'无'],
  ['首个玩家 radio 在视口内', inView(g.first), g.first?`${g.first.y}-${g.first.bottom}`:'无'],
  ['角色勾选可见（'+g.checks+' 个）', g.checks>0&&g.checksVisible, String(g.checksVisible)],
  ['主按钮在视口内', inView(g.submit), g.submit?`${g.submit.y}-${g.submit.bottom}`:'无'],
  ['面板内绿色实心按钮 ≤1 颗', g.primaries<=1, String(g.primaries)],
  ['玩家区底部不越出视口', g.matBottom<=vpw+1, `${g.matBottom}/${vpw}`],
  ['无脚本错误', errs.length===0, errs.slice(0,2).join(';')||'0'],
 ];
 /* ── 第二段：五段结构（R0 单行 / R2 演化 / R4 明细 / 改名单确认 / 390px）── */
 const metrics=()=>p.evaluate(()=>{
  const panel=document.querySelector('.decide-inline .quest-deploy');
  const r0=panel&&panel.querySelector('.r0'),num=panel&&panel.querySelector('.r0-num');
  const det=panel&&panel.querySelector('details.quest-rules');
  const rows=panel?[...panel.querySelectorAll('.quest-roster li')]:[];
  const blocks=panel?[...panel.children].filter(x=>x.getBoundingClientRect().height>0.5).map(x=>x.className):[];
  const rect=e=>{const b=e.getBoundingClientRect();return {x:Math.round(b.x),y:Math.round(b.y),bottom:Math.round(b.bottom),w:Math.round(b.width),h:Math.round(b.height)}};
  return {state:panel?panel.dataset.state:null,pill:panel?panel.querySelector('.state-pill').textContent:'',
   num:num?num.textContent:'',numRect:num?rect(num):null,r0:r0?rect(r0):null,r0Clip:r0?r0.scrollWidth-r0.clientWidth:0,
   submitted:panel&&panel.querySelector('.quest-submitted')?panel.querySelector('.quest-submitted').textContent:null,
   committed:panel&&panel.querySelector('.quest-committed')?panel.querySelector('.quest-committed').textContent:null,
   checks:panel?panel.querySelectorAll('input[data-commit]').length:0,
   blocks:blocks,detailsExists:!!(panel&&panel.querySelector('details')),
   openDetail:!!(det&&det.open),detailH:det?Math.round(det.getBoundingClientRect().height):0,
   rosterVisible:rows.some(x=>x.getBoundingClientRect().height>0),rosterRows:rows.length,
   roster:rows.map(x=>x.textContent.trim()),
   docOverflow:document.documentElement.scrollWidth-innerWidth,vw:innerWidth,vh:innerHeight};
 });
 const d0=await metrics();
 /* 勾一名角色：数字要立刻跟着变，且不整页重绘（焦点还在那颗 checkbox 上）。 */
 await p.locator('.decide-inline .quest-commit-list input[data-commit]:not([disabled])').first().check();
 await p.waitForTimeout(150);
 const d1=await metrics();
 const focusOk=await p.evaluate(()=>!!document.activeElement&&document.activeElement.dataset.commit!==undefined);
 checks.push(
  ['勾选后 R0 数字随草稿更新', /^1 名 · 意志 \d+ ／ 威胁 \d+$/.test(d1.num), `${d0.num} → ${d1.num}`],
  /* 纵向只允许四段：头部（状态+合计+玩家 chip）/ 名单区 / 主操作 / 规则与名单。 */
  ['A 态纵向块数 = 4', d1.blocks.length===4, `${d1.blocks.length}: ${d1.blocks.join(',')}`],
  /* 12px × line-height 1.7 ≈ 20.4px，加 pill 的 1px padding + 1px 边框 = 24px 单行；
     折行会到 ~48px，所以 26px 是「没折」的硬阈值。 */
  ['R0 单行渲染（≤26px、不折行）', !!d1.r0&&d1.r0.h<=26, d1.r0?`${d1.r0.h}px`:'无'],
  ['R0 内容不横向裁切', d1.r0Clip<=0, String(d1.r0Clip)],
  ['勾选后不整页重绘（焦点仍在 checkbox）', focusOk, String(focusOk)],
 );
 /* 两人依次提交：玩家0 交 1 名，玩家1 交空名单。 */
 for(const who of [0,1]){
  const btn=p.locator('.decide-inline [data-quest="commit"]:not([disabled])').first();
  if(await btn.count()){await btn.click();await p.locator('dialog #ok').click();await p.waitForTimeout(320);}
 }
 await p.locator('.player-tabs button').first().click();await p.waitForTimeout(320);
 const d2=await metrics();
 checks.push(
  ['全员已交后进入 C1 待确认', d2.state==='C1', String(d2.state)],
  ['C1 的 R2 换成只读「已提交：…」', !!d2.submitted&&/^已提交：/.test(d2.submitted), d2.submitted||'无'],
  ['提交后勾选框全部撤走', d2.checks===0, String(d2.checks)],
  ['C1 主按钮是「确认派遣」', (await p.locator('.decide-inline [data-quest="approveDeployment"]').count())===1, ''],
  ['R4 默认折叠：只有 summary（高度 ≤30px）', !d2.openDetail&&d2.detailH<=30, `open=${d2.openDetail} h=${d2.detailH}`],
 );
 /* 展开 R4：每人一行明细，且不能把文档顶宽（出现横向滚动条即失败）。 */
 await p.locator('.decide-inline details.quest-rules > summary').click();await p.waitForTimeout(220);
 const d3=await metrics();
 checks.push(
  ['R4 展开后每人一行明细', d3.rosterRows===2&&d3.roster.every(t=>/已提交|草稿|未提交/.test(t)), d3.roster.join(' | ')],
  ['展开后不出横向滚动条', d3.docOverflow<=0, String(d3.docOverflow)],
 );
 /* 改名单要二次确认：先让玩家0 确认派遣，再从玩家1 的视角点「修改名单」。
    （deploymentApprovals 是二次确认名单；没确认过的人点修改不必打扰。） */
 await p.locator('.decide-inline [data-quest="approveDeployment"]').first().click();await p.waitForTimeout(350);
 await p.locator('.player-tabs button').nth(1).click();await p.waitForTimeout(320);
 const dPre=await metrics();
 await p.locator('.decide-inline [data-quest="withdraw"]').first().click();await p.waitForTimeout(300);
 const dlg=await p.locator('dialog').last().textContent().catch(()=>'');
 await p.locator('dialog #cancel').last().click();await p.waitForTimeout(280);
 const d4=await metrics();
 checks.push(
  ['确认后他人视角仍可改名单（C1）', dPre.state==='C1', String(dPre.state)],
  ['改名单前说明会清除全队确认', /清除全队已完成的\s*1\s*次确认/.test(dlg.replace(/\s+/g,' ')), dlg.replace(/\s+/g,' ').slice(0,40)],
  ['取消后仍是已提交（没有真的撤回）', d4.state==='C1'&&!!d4.submitted, `${d4.state}／${(d4.submitted||'').slice(0,14)}`],
 );
 await p.screenshot({path:path.join(ROOT,'docs/browser-acceptance/30-quest-panel-1440.png')});
 /* 390px：R0 仍单行，文档不出横向滚动条。 */
 await p.setViewportSize({width:390,height:844});await p.waitForTimeout(380);
 /* 窄屏面板在手牌区里，滚到视野内再截，否则截到的是上半张牌桌。 */
 await p.locator('.decide-inline .quest-deploy').scrollIntoViewIfNeeded();await p.waitForTimeout(250);
 const m=await metrics();
 checks.push(
  ['390px R0 仍单行（≤26px）', !!m.r0&&m.r0.h<=26, m.r0?`${m.r0.h}px`:'无'],
  ['390px 不出横向滚动条', m.docOverflow<=0, String(m.docOverflow)],
 );
 await p.screenshot({path:path.join(ROOT,'docs/browser-acceptance/31-quest-panel-390.png')});
 /* D 态（deploymentLocked）：只读、无派遣按钮、仍保留规则折叠，纵向块数 ≤4。 */
 await p.setViewportSize({width:1440,height:950});await p.waitForTimeout(320);
 const ap=p.locator('.decide-inline [data-quest="approveDeployment"]:not([disabled])').first();
 if(await ap.count()){await ap.click();await p.waitForTimeout(520);}
 const dD=await metrics();
 checks.push(
  ['锁定后进入 D 只读态', dD.state==='D', String(dD.state)],
  ['D 态纵向块数 ≤4', dD.blocks.length>0&&dD.blocks.length<=4, `${dD.blocks.length}: ${dD.blocks.join(',')}`],
  ['D 态保留规则折叠（只读也要能查规则）', !!dD.detailsExists, String(!!dD.detailsExists)],
  ['D 态无任何派遣按钮', (await p.locator('.decide-inline [data-quest="commit"],.decide-inline [data-quest="approveDeployment"],.decide-inline [data-quest="withdraw"]').count())===0, ''],
 );
 /* 跨状态数字不横跳：位数相同的两个状态（A 1 名/意志 2 → D 2 名/意志 4）里，
   .r0-num 的左缘、宽度、右缘都必须原地不动。pill 定宽 + 前缀定宽 + 状态竖线常驻，
   这三件缺一件就会挪十来像素。 */
 const nr1=d1.numRect,nrD=dD.numRect;
 checks.push(['跨状态数字列不动（左/宽/右 |Δ|≤1px）',
  !!nr1&&!!nrD&&Math.abs(nrD.x-nr1.x)<=1&&Math.abs(nrD.w-nr1.w)<=1&&Math.abs((nrD.x+nrD.w)-(nr1.x+nr1.w))<=1,
  nr1&&nrD?`${nr1.x}/${nr1.w} → ${nrD.x}/${nrD.w}`:'缺测量']);
 for(const [n,ok,d] of checks)console.log(`${ok?'PASS':'FAIL'}  ${n}  [${d}]`);
 const fail=checks.filter(c=>!c[1]).length;
 console.log(`\n${checks.length-fail}/${checks.length} passed`);
 await b.close();process.exit(fail?1:0);
})().catch(e=>{console.error('FAILED:',e.message);process.exit(2)});
