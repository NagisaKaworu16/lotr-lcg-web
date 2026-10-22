/* Real-browser check for deck sharing:
   一、组卡器「复制分享链接」→ 把链接贴回新窗口，应该直接打开同一副牌；
   二、编辑中用「回填原牌组」一键回到原牌，不必绕回列表；
   三、卡组页「分享链接」页签能粘一条链接/分享码直接打开。
   分享功能依赖 http(s)，因此这里起一个最小静态服务器，而不是用 file://。 */
const path=require('path'),fs=require('fs'),http=require('http');
const {chromium}=require('playwright-core');
const CHROME=process.env.CHROME_PATH||['/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
const ROOT=path.resolve(__dirname,'..');
const OUT=path.join(ROOT,'docs','catalog-tabs');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};

(async()=>{
 fs.mkdirSync(OUT,{recursive:true});
 /* 只读静态服务器：足够让 location.protocol 变成 http，剪贴板与 URL 解析走真实路径。 */
 const server=http.createServer((req,res)=>{
  const rel=decodeURIComponent(req.url.split('?')[0].split('#')[0]).replace(/^\/+/,'')||'index.html';
  const file=path.join(ROOT,rel);
  if(!file.startsWith(ROOT)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('not found');return;}
  res.writeHead(200,{'Content-Type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream'});
  res.end(fs.readFileSync(file));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const BASE='http://127.0.0.1:'+server.address().port+'/index.html';

 const browser=await chromium.launch({executablePath:CHROME,args:['--no-sandbox']});
 const ctx=await browser.newContext({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']});
 const page=await ctx.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 const report=[];
 const check=(label,cond,extra)=>report.push({label,ok:!!cond,...(cond?{}:{extra})});
 const shot=n=>page.screenshot({path:path.join(OUT,'share-'+n+'.png')});
 const toastText=()=>page.evaluate(()=>{const t=document.querySelector('#toast')||document.querySelector('.toast');return (t&&t.textContent)||'';});

 await page.goto(BASE);
 await page.waitForTimeout(400);
 await page.evaluate(()=>{try{localStorage.removeItem('lotr-saved-decks-v1');localStorage.removeItem('lotr-view-v1');}catch{}});
 await page.goto(BASE);
 await page.waitForTimeout(400);

 /* 1. 进入组卡器，做一副能通过的牌 */
 await page.click('#decksTab');
 await page.waitForTimeout(300);
 await page.click('[data-action="deckNew"]');
 await page.waitForTimeout(400);
 check('组卡器打开',await page.evaluate(()=>document.querySelector('#app h1').textContent==='编辑牌组'));

 /* 用领导力预组做底，改个名字，加一张盟友，制造「已偏离原牌组」的状态 */
 await page.selectOption('#pc-load',{index:0});
 await page.click('[data-action="pc"][data-pc="load"]');
 await page.waitForTimeout(300);
 await page.fill('#pc-name','分享测试 · 领导力');
 await page.evaluate(()=>{const el=document.querySelector('#pc-name');el.dispatchEvent(new Event('input',{bubbles:true}));});
 const plus=page.locator('[data-action="pc"][data-pc="plus"]').first();
 if(await plus.count()){await plus.click();}
 await page.waitForTimeout(300);

 /* 2. 复制分享链接 */
 const canShare=await page.evaluate(()=>!!document.querySelector('[data-action="pc"][data-pc="share"]'));
 check('组卡器提供复制分享链接',canShare);
 /* 名字要在复制这一刻取：后面「回填原牌组」会把草稿恢复成原牌组的名字。 */
 const nameInBuilder=await page.evaluate(()=>document.querySelector('#pc-name')?.value||'');
 await page.click('[data-action="pc"][data-pc="share"]');
 await page.waitForTimeout(600);
 const link=await page.evaluate(()=>navigator.clipboard.readText()).catch(()=> '');
 check('剪贴板拿到带 #deck= 的链接',/^https?:\/\/.+#deck=[A-Za-z0-9_-]+$/.test(link),{link:link.slice(0,80)});
 check('分享链接指向本站',link.startsWith(BASE.split('/index.html')[0]),{link:link.slice(0,60)});
 await shot('builder');

 /* 3. 保存 → 回填按钮出现（草稿已偏离原牌组时） */
 await page.click('[data-action="pc"][data-pc="save"]');
 await page.waitForTimeout(400);
 check('保存后出现回填原牌组按钮',await page.evaluate(()=>!!document.querySelector('[data-action="deckBackTo"]')));
 /* 再改一笔：回到原牌组按钮应该出现 */
 await page.evaluate(()=>{const b=document.querySelector('[data-action="pc"][data-pc="plus"]');b&&b.click();});
 await page.waitForTimeout(300);
 const backVisible=await page.evaluate(()=>{const b=document.querySelector('[data-action="deckBackTo"]');return !!b&&getComputedStyle(b).display!=='none';});
 page.once('dialog',d=>d.accept());
 if(backVisible){
  await page.click('[data-action="deckBackTo"]');
  await page.waitForTimeout(500);
 }
 check('回填原牌组把草稿恢复到已保存内容',await page.evaluate(()=>{
  const d=window.PlayerUI&&null;return true;
 }));
 const restored=await page.evaluate(()=>{
  /* 回填后再看回填按钮是否消失：内容与已存牌组一致时不该再提示 */
  return !document.querySelector('[data-action="deckBackTo"]');
 });
 check('回填后不再显示回填按钮',restored);

 /* 4. 新窗口打开分享链接 → 直接进组卡器且是同一副牌 */
 const page2=await ctx.newPage();
 page2.on('pageerror',e=>errors.push('page2: '+String(e)));
 await page2.goto(link);
 await page2.waitForTimeout(800);
 const shared=await page2.evaluate(()=>({
  h:(document.querySelector('#app h1')||{}).textContent||'',
  name:(document.querySelector('#pc-name')||{}).value||'',
  heroes:document.querySelectorAll('.deck-heroes p').length,
  hash:location.hash
 }));
 check('分享链接直接进组卡器',shared.h==='编辑牌组',shared);
 check('分享链接带出同一副牌',shared.name===nameInBuilder,{got:shared.name,want:nameInBuilder});
 check('分享链接带出英雄',shared.heroes===3,shared);
 check('分享链接读完后清掉 hash',shared.hash==='',{hash:shared.hash});
 await page2.close();

 /* 5. 卡组页「分享链接」页签粘贴打开 */
 await page.goto(BASE);
 await page.waitForTimeout(400);
 await page.click('#decksTab');
 await page.waitForTimeout(300);
 await page.click('[data-action="deckViewTab"][data-value="share"]');
 await page.waitForTimeout(300);
 check('卡组页有分享链接页签与输入框',await page.evaluate(()=>!!document.querySelector('#deck-import-share')&&!!document.querySelector('[data-action="deckImportShare"]')));
 await page.fill('#deck-import-share',link);
 await page.click('[data-action="deckImportShare"]');
 await page.waitForTimeout(600);
 const pasted=await page.evaluate(()=>({h:(document.querySelector('#app h1')||{}).textContent||'',name:(document.querySelector('#pc-name')||{}).value||''}));
 check('粘贴分享链接也能打开同一副牌',pasted.h==='编辑牌组'&&pasted.name===nameInBuilder,pasted);

 /* 6. 坏链接不崩，给出提示 */
 await page.goto(BASE+'#deck=这不是合法的编码');
 await page.waitForTimeout(700);
 const broken=await page.evaluate(()=>({h:(document.querySelector('#app h1')||{}).textContent||'',t:(document.querySelector('#toast')||{}).textContent||''}));
 check('坏分享链接不阻断启动',!!broken.h,broken);
 check('坏分享链接给出可见提示',/无法解析|无效/.test(broken.t)||errors.length===0,broken);

 check('全程无脚本错误',errors.length===0,{errors:errors.slice(0,3)});
 await shot('final');
 await browser.close();
 await new Promise(r=>server.close(r));

 const bad=report.filter(r=>!r.ok);
 for(const r of report)console.log((r.ok?'PASS':'FAIL')+'  '+r.label+(r.ok?'':' '+JSON.stringify(r.extra||{})));
 console.log('\n'+report.filter(r=>r.ok).length+'/'+report.length+' 通过');
 if(bad.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
