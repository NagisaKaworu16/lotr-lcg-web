/* 阶段3 投入面板回归：进入 commit 后，玩家切换器、角色勾选、提交按钮
   必须全部落在视口内且不需要滚动，否则第二个人无法提交名单。 */
const {chromium}=require('playwright-core'),path=require('path'),ROOT=path.join(__dirname,'..');
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const p=await (await b.newContext({viewport:{width:1440,height:950}})).newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file:///'+path.join(ROOT,'index.html'));await p.waitForTimeout(450);
 await p.selectOption('#playerCount','2');
 await p.locator('.ng-tabs button',{hasText:'新版扩展'}).click();await p.waitForTimeout(250);
 await p.locator('.ng-card',{hasText:'基础剧本合集'}).first().click();await p.waitForTimeout(300);
 await p.locator('[data-action="ngNext"]').click();await p.waitForTimeout(300);
 await p.locator('[data-action="chooserConfirm"]').click();await p.waitForTimeout(700);
 for(const x of await p.locator('button[data-action="keepHand"]').all())await x.click();
 await p.locator('button[data-action="finishSetup"]').click();await p.waitForTimeout(750);
 await p.evaluate(()=>{for(let i=0;i<10;i++){if(state.phase>=2)break;try{ScenarioEngine.endPhase(state)}catch(e){break}}render()});
 await p.waitForTimeout(250);
 await p.evaluate(()=>document.querySelector('.phase-door .door-go:not([disabled])')?.click());
 await p.waitForTimeout(450);
 const g=await p.evaluate(()=>{
  const r=e=>{const b=e.getBoundingClientRect();return {y:Math.round(b.y),bottom:Math.round(b.bottom),w:Math.round(b.width)}};
  const mp=document.querySelector('.mat-phase'),panel=mp?.querySelector('.questing-panel');
  const sub=[...mp.querySelectorAll('button')].find(x=>x.textContent.includes('提交暂定派遣名单'));
  const sel=mp.querySelector('#planning-actor');
  const boxes=[...mp.querySelectorAll('input[data-commit]')];
  return {step:state.questing?.step,vh:innerHeight,
   panel:panel?{...r(panel),sh:panel.scrollHeight,ch:panel.clientHeight}:null,
   submit:sub?r(sub):null,sel:sel?r(sel):null,checks:boxes.length,
   checksVisible:boxes.every(x=>{const b=x.getBoundingClientRect();return b.top>=0&&b.bottom<=innerHeight;}),
   matBottom:Math.round(document.querySelector('.player-mat').getBoundingClientRect().bottom)};});
 const vpw=g.vh;
 const inView=e=>!!e&&e.y>=0&&e.bottom<=vpw;
 const checks=[
  ['已进入投入名单步骤', g.step==='commit', g.step||'-'],
  ['面板不出现内部滚动', !!g.panel&&g.panel.sh<=g.panel.ch+1, g.panel?`${g.panel.sh}/${g.panel.ch}`:'无面板'],
  ['玩家切换器在视口内', inView(g.sel), g.sel?`${g.sel.y}-${g.sel.bottom}`:'无'],
  ['角色勾选可见（'+g.checks+' 个）', g.checks>0&&g.checksVisible, String(g.checksVisible)],
  ['提交按钮在视口内', inView(g.submit), g.submit?`${g.submit.y}-${g.submit.bottom}`:'无'],
  ['玩家区底部不越出视口', g.matBottom<=vpw+1, `${g.matBottom}/${vpw}`],
  ['无脚本错误', errs.length===0, errs.slice(0,2).join(';')||'0'],
 ];
 for(const [n,ok,d] of checks)console.log(`${ok?'PASS':'FAIL'}  ${n}  [${d}]`);
 const fail=checks.filter(c=>!c[1]).length;
 console.log(`\n${checks.length-fail}/${checks.length} passed`);
 await b.close();process.exit(fail?1:0);
})().catch(e=>{console.error('FAILED:',e.message);process.exit(2)});
