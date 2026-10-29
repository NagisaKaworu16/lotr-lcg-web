/* R0 头部稳定性（v0.15.72）——真实浏览器，1440 / 390 / 320 三档 × 五态。
 *
 *   NODE_PATH="C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules" \
 *   node scripts/check-quest-r0.cjs
 *
 * 为什么单独一个脚本：这一组判据全是**排版量**（药丸实宽、数字文本起点、是否被省略），
 * planning-dom-tests 的假 DOM 量不出来；而 check-quest-panel.cjs 管的是交互与结构。
 *
 * 判据（每条都写「实测 / 期望」）：
 *   W1 五态 .state-pill 实宽全等（药丸吃掉自己的字数差，数字起点才不会跟着跳）
 *   W2 五态 .r0-num left 极差 ≤ 1px（内容宽 + 左锚：稳定的是文本起点，不是右缘）
 *   W3 每态 .r0-num scrollWidth − clientWidth ≤ 1（数字永不被省略）
 *   W4 每态 .r0-num getClientRects().length === 1（不折行）
 *   W5 每态 .r0 盒高 23.55 ± 1（.state-pill 是盒高唯一来源）
 *   W6 窄屏 .r0-label 仍在可访问性树里（sr-only，不是 display:none）
 *   W7 .door-go:disabled 背景不再是主色绿 rgb(47, 74, 59)（--accent-green #2f4a3b）
 *
 * 注意：`.r0` 容器的 scrollWidth − clientWidth 恒为 0（子元素 min-width 吸收），
 * 它在 bug 存在时也是 0——**不能单独当门禁**，这里只当回归守卫。
 *
 * 开局一律在 1440×950 走真实点击（320 档开局面板被阶段轨压住点不到，任务 #12），
 * 进 commit 之后再 setViewportSize 到目标档——量的是同一个状态在三种排版下的表现。
 */
'use strict';
const {chromium}=require('playwright-core'),fs=require('fs'),path=require('path'),ROOT=path.join(__dirname,'..');
const CHROME=['/usr/bin/chromium','/usr/bin/google-chrome','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'];
const VIEWS=[[1440,950],[390,844],[320,568]];
const GREEN='rgb(47, 74, 59)';

/* 五态构造：走引擎（submitDeployment / approveDeployment）+ render，可复现且不依赖点击。
   两人局 A 草稿 → B 玩家0已交 → C1 全员已交本人未确认 → C2 本人已确认 → D 锁定。
   顺序是累积的，必须按 A→B→C1→C2→D 依次执行。 */
const STATES=[
 {tag:'A', js:`(()=>{handView=0;render();})()`},
 {tag:'B', js:`(()=>{const Q=ScenarioEngine.questing;Q.submitDeployment(state,0,Q.eligible(state,0).map(c=>c.uid).slice(0,1));handView=0;render();})()`},
 {tag:'C1',js:`(()=>{const Q=ScenarioEngine.questing;Q.submitDeployment(state,1,Q.eligible(state,1).map(c=>c.uid).slice(0,1));handView=0;render();})()`},
 {tag:'C2',js:`(()=>{ScenarioEngine.questing.approveDeployment(state,0);handView=0;render();})()`},
 {tag:'D', js:`(()=>{ScenarioEngine.questing.approveDeployment(state,1);handView=0;render();})()`},
];

const measure=()=>{
 const dep=document.querySelector('.decide-box .quest-deploy');
 if(!dep)return null;
 const pill=dep.querySelector('.state-pill'),num=dep.querySelector('.r0-num'),r0=dep.querySelector('.r0'),label=dep.querySelector('.r0-label');
 const rb=e=>{const b=e.getBoundingClientRect();return {left:+b.left.toFixed(2),width:+b.width.toFixed(2),right:+b.right.toFixed(2)}};
 const door=document.querySelector('.door-go');
 return {state:dep.dataset.state,docOver:document.documentElement.scrollWidth-document.documentElement.clientWidth,
  pill:{w:+pill.getBoundingClientRect().width.toFixed(2),text:pill.textContent,over:pill.scrollWidth-pill.clientWidth},
  num:{...rb(num),client:num.clientWidth,scroll:num.scrollWidth,lines:num.getClientRects().length,text:num.textContent},
  r0:{h:+r0.getBoundingClientRect().height.toFixed(2),over:r0.scrollWidth-r0.clientWidth,w:+r0.getBoundingClientRect().width.toFixed(2)},
  label:{text:label.textContent,display:getComputedStyle(label).display,clip:getComputedStyle(label).clip,pos:getComputedStyle(label).position,w:+label.getBoundingClientRect().width.toFixed(2)},
  door:door?{disabled:door.disabled,bg:getComputedStyle(door).backgroundColor}:null};
};

/* 开局：与 check-quest-panel.cjs 同一套点击流程（2 人、基础剧本），进 commit 为止。 */
async function reachCommit(p){
 await p.goto('file:///'+path.join(ROOT,'index.html').replace(/\\/g,'/'));await p.waitForTimeout(450);
 await p.selectOption('#playerCount','2');
 await p.locator('.ng-tabs button',{hasText:'新版扩展'}).click();await p.waitForTimeout(250);
 await p.locator('.ng-card',{hasText:'基础剧本合集'}).first().click();await p.waitForTimeout(300);
 await p.locator('[data-action="ngNext"]').click();await p.waitForTimeout(300);
 await p.locator('[data-action="chooserConfirm"]').click();await p.waitForTimeout(700);
 for(const x of await p.locator('button[data-action="keepHand"]').all())await x.click();
 const finish=p.locator('button[data-action="finishSetup"]');
 if(await finish.count())await finish.click();
 await p.waitForTimeout(750);
 await p.evaluate(()=>{for(let i=0;i<10;i++){if(state.phase>=2)break;try{ScenarioEngine.endPhase(state)}catch(e){break}}render()});
 await p.waitForTimeout(250);
 await p.evaluate(()=>document.querySelector('.phase-door .door-go:not([disabled])')?.click());
 await p.waitForTimeout(450);
 return p.evaluate(()=>state.phase===2&&state.questing.step==='commit'&&!state.questing.deploymentLocked);
}

(async()=>{
 const exe=CHROME.find(p=>fs.existsSync(p));
 if(!exe)throw new Error('未找到本机 Chrome/Edge');
 const browser=await chromium.launch({executablePath:exe,headless:true,args:['--no-sandbox']});
 const rows=[];let failed=0;
 for(const [w,h] of VIEWS){
  const page=await (await browser.newContext({viewport:{width:1440,height:950}})).newPage();
  const errs=[];page.on('pageerror',e=>errs.push(e.message));
  if(!(await reachCommit(page))){console.log(`FAIL ${w}x${h} 未能进入 commit`);failed++;await page.context().close();continue;}
  await page.setViewportSize({width:w,height:h});await page.waitForTimeout(300);
  const got=[];
  for(const st of STATES){
   await page.evaluate(st.js);await page.waitForTimeout(200);
   /* v0.15.81：面板内容只存在于非模态浮层里，纯资讯的态（如名单锁定且无待结算响应）会被
      自动收起——量之前先确保浮层是开的（触发条就是唯一把手）。 */
   await page.evaluate(()=>{const t=document.querySelector('.decide-trigger[aria-expanded="false"]');if(t)t.click();});
   await page.waitForTimeout(150);
   const m=await page.evaluate(measure);
   if(!m||m.state!==st.tag){console.log(`FAIL ${w}x${h} ${st.tag} 态未渲染（实测 ${m&&m.state}）`);failed++;continue;}
   got.push({tag:st.tag,...m});
  }
  if(got.length<5){console.log(`FAIL ${w}x${h} 五态不全（${got.length}）`);failed++;await page.context().close();continue;}
  const pills=got.map(x=>x.pill.w),lefts=got.map(x=>x.num.left);
  const pillSpread=+(Math.max(...pills)-Math.min(...pills)).toFixed(2);
  const leftSpread=+(Math.max(...lefts)-Math.min(...lefts)).toFixed(2);
  const cut=got.filter(x=>x.num.scroll-x.num.client>1),multi=got.filter(x=>x.num.lines!==1);
  const doorStates=got.filter(x=>x.door&&x.door.disabled),doorGreen=doorStates.filter(x=>x.door.bg===GREEN);
  const hOk=got.every(x=>Math.abs(x.r0.h-23.55)<=1);
  /* W6：窄屏前缀转 sr-only。绝不能拿 display:none / visibility:hidden 收起来（那样读屏听不到
     「暂定／实际」这个限定词，D 态就会被读成「已投入」）。判据取 sr-only 四件套：
     display 仍是 block、rect 收到 1px、clip 生效、文本还在。 */
  const srOnly=x=>x.label.display!=='none'&&x.label.text.trim().length>0&&x.label.w<=2&&x.label.pos==='absolute'&&x.label.clip!=='auto';
  const pillOver=got.filter(x=>x.pill.over>1);
  const checks=[
   ['W1 五态药丸等宽', pillSpread<=0.5, `极差 ${pillSpread}｜${pills.join(' / ')}`],
   ['W2 五态数字起点不动', leftSpread<=1, `极差 ${leftSpread}｜${lefts.join(' / ')}`],
   ['W3 数字未被省略', cut.length===0, cut.length?cut.map(x=>`${x.tag} 缺 ${x.num.scroll-x.num.client}px`).join(';'):'五态 0 缺口'],
   ['W4 数字未折行', multi.length===0, multi.map(x=>x.tag).join(',')||'五态单行'],
   ['W5 R0 盒高 23.55±1', hOk, got.map(x=>`${x.tag}:${x.r0.h}`).join(' ')],
   ['W6 窄屏前缀仍在可访问性树里', w>600||got.every(srOnly), w>600?`${w}px 不适用（前缀可见）`:`display=${got[0].label.display} clip=${got[0].label.clip} w=${got[0].label.w} 文本「${got.map(x=>x.label.text).join('／')}」`],
   ['W7 禁用门禁不是绿底', doorGreen.length===0, doorStates.length?`禁用 ${doorStates.length} 态，bg=${[...new Set(doorStates.map(x=>x.door.bg))].join('/')}`:'无禁用态'],
   ['W8 药丸内容未被 min-width 挤掉', pillOver.length===0, pillOver.length?pillOver.map(x=>`${x.tag} 缺 ${x.pill.over}px`).join(';'):`五态 0 缺口（min-width ${got[0].pill.w}）`],
   /* W9：R0 在 320 是「刚好装下」（pill+gap+num 恰等于内容宽），必须证明它没把页面撑出横滚。 */
   ['W9 本档不出横向滚动条', got.every(x=>x.docOver<=0), `docOver=${[...new Set(got.map(x=>x.docOver))].join('/')}`],
  ];
  for(const [name,ok,detail] of checks){if(!ok)failed++;rows.push({vp:`${w}x${h}`,name,ok,detail});}
  console.log(`\n── ${w}x${h} ──`);
  for(const st of got)console.log(`  ${st.tag.padEnd(2)} pill ${String(st.pill.w).padStart(7)}「${st.pill.text}」 num left ${String(st.num.left).padStart(7)} w ${String(st.num.width).padStart(6)} right ${String(st.num.right).padStart(7)} 「${st.num.text}」 r0.w ${String(st.r0.w).padStart(6)}`);
  for(const [name,ok,detail] of checks)console.log(`${ok?'PASS':'FAIL'}  ${name}  [${detail}]`);
  if(errs.length){console.log('FAIL  页面脚本错误  ['+errs.slice(0,2).join(';')+']');failed++;}
  await page.context().close();
 }
 const total=rows.length+VIEWS.length; /* 每档另计一条页面错误 */
 console.log(`\n${total-failed}/${total} passed`);
 await browser.close();process.exit(failed?1:0);
})().catch(e=>{console.error('FAILED:',e.message);process.exit(2)});
