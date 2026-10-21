/* Real-browser check for view history (back / forward) and the brand-as-home button. */
const path=require('path'),fs=require('fs');
const {chromium}=require('playwright-core');
const CHROME=process.env.CHROME_PATH||['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
const ROOT=path.resolve(__dirname,'..');
const OUT=path.join(ROOT,'docs','catalog-tabs');

(async()=>{
 fs.mkdirSync(OUT,{recursive:true});
 const browser=await chromium.launch({executablePath:CHROME,args:['--allow-file-access-from-files','--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 const report=[];
 const shot=async n=>page.screenshot({path:path.join(OUT,`history-${n}.png`)});
 const state=async()=>page.evaluate(()=>({
  tab:document.querySelector('#tableTab').classList.contains('active')?'table':'other',
  newGame:typeof newGame==='undefined'?null:(newGame?newGame.step:'none'),
  chooser:typeof deckChooser==='undefined'?null:!!deckChooser,
  back:document.querySelector('#navBack').disabled,
  fwd:document.querySelector('#navFwd').disabled,
  heading:(document.querySelector('#app h1')||{}).textContent||'',
 }));
 const check=(label,cond,extra)=>report.push({label,ok:!!cond,...(cond?{}:{extra})});

 await page.goto('file:///'+path.join(ROOT,'index.html').replace(/\\/g,'/'));
 await page.waitForTimeout(300);
 let s=await state();
 check('初始：后退/前进均不可用',s.back&&s.fwd,s);
 check('初始：显示新游戏列表',s.heading==='新游戏',s);

 /* 1. tab 切换进入历史 */
 await page.click('.ng-tabs button[data-value="legacy"]');
 await page.waitForTimeout(200);
 s=await state();
 check('切到旧版扩展后可以后退',!s.back,s);
 await shot('legacy');

 /* 2. 进入设置页 */
 await page.click('[data-action="ngOpen"][data-id="Khazad-dum"]');
 await page.waitForTimeout(250);
 s=await state();
 check('进入设置页后可以前进/后退',!s.back,s);
 check('设置页有选择冒险前不显示网格',await page.evaluate(()=>document.querySelectorAll('.ng-pack').length===0));

 /* 3. 浏览器后退应回到列表 */
 await page.goBack();
 await page.waitForTimeout(250);
 s=await state();
 check('浏览器后退回到列表',s.newGame==='list'&&s.tab==='table',s);
 check('后退后可以前进',!s.fwd,s);

 /* 4. 浏览器前进应回到设置页 */
 await page.goForward();
 await page.waitForTimeout(250);
 s=await state();
 check('浏览器前进回到设置页',s.newGame==='settings',s);
 await shot('settings');

 /* 5. 顶栏 ← 按钮 */
 await page.click('#navBack');
 await page.waitForTimeout(250);
 s=await state();
 check('顶栏后退生效',s.newGame==='list',s);

 /* 6. 顶栏 → 按钮 */
 await page.click('#navFwd');
 await page.waitForTimeout(250);
 s=await state();
 check('顶栏前进生效',s.newGame==='settings',s);

 /* 7. 切到别的页签，再点「首页」回到剧本桌面 */
 await page.click('#decksTab');
 await page.waitForTimeout(200);
 s=await state();
 check('切到我的卡组',s.heading.includes('我的卡组'),s);
 await page.click('#tableTab');
 await page.waitForTimeout(250);
 s=await state();
 check('点首页回到剧本桌面',s.tab==='table'&&s.newGame==='none'&&s.chooser===false,s);
 check('回首页后页面不再是卡组页',!(await page.evaluate(()=>document.querySelector('#app').innerHTML.includes('我的卡组'))));
 await shot('home');

 /* 8. 再后退一次应回到卡组页 */
 await page.goBack();
 await page.waitForTimeout(250);
 s=await state();
 check('后退回到我的卡组',s.heading.includes('我的卡组'),s);

 /* 9. 旧版扩展里不应再有核心包 */
 await page.click('#tableTab');
 await page.waitForTimeout(200);
 await page.click('.ng-tabs button[data-value="legacy"]');
 await page.waitForTimeout(250);
 const legacy=await page.evaluate(()=>({
  hasCore:!!document.querySelector('[data-id="Core-Set"]'),
  first:(document.querySelector('.ng-grid .ng-card h3')||{}).textContent||'',
  cards:document.querySelectorAll('.ng-grid .ng-card').length,
 }));
 check('旧版扩展没有核心包',!legacy.hasCore,legacy);
 check('首张为黑森林的魔影',legacy.first.trim()==='黑森林的魔影',legacy);
 check('旧版扩展仍有 15 个系列',legacy.cards===15,legacy);

 await page.click('[data-id="chapter-shadows-of-mirkwood-cycle"]');
 await page.waitForTimeout(250);
 await page.click('[data-action="ngMode"][data-value="standalone"]');
 await page.waitForTimeout(250);
 const packs=await page.evaluate(()=>[...document.querySelectorAll('.ng-pack h3')].map(h=>h.textContent.trim()));
 check('黑森林的魔影仍有 6 个剧本',packs.length===6,packs);
 check('剧本从追捕咕噜开始',packs[0]==='追捕咕噜',packs);

 check('无脚本错误',errors.length===0,errors);
 await page.close();
 await browser.close();

 fs.writeFileSync(path.join(OUT,'history-report.json'),JSON.stringify(report,null,2));
 for(const r of report)console.log((r.ok?'PASS  ':'FAIL  ')+r.label+(r.ok?'':'  '+JSON.stringify(r.extra)));
 const bad=report.filter(r=>!r.ok).length;
 console.log(bad?`FAILED ${bad}`:'OK');
 process.exit(bad?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
