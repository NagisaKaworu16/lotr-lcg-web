/* Real-browser check for the merged player-card page:
   the old 英雄与玩家牌 tab is gone, deck building lives under 我的卡组 → 新建牌组,
   and the builder reuses the card library's dense list with hover-to-enlarge art. */
const path=require('path'),fs=require('fs');
const {chromium}=require('playwright-core');
const CHROME=process.env.CHROME_PATH||['/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
const ROOT=path.resolve(__dirname,'..');
const OUT=path.join(ROOT,'docs','catalog-tabs');

(async()=>{
 fs.mkdirSync(OUT,{recursive:true});
 const browser=await chromium.launch({executablePath:CHROME,args:['--allow-file-access-from-files','--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 const report=[];
 const check=(label,cond,extra)=>report.push({label,ok:!!cond,...(cond?{}:{extra})});
 const shot=n=>page.screenshot({path:path.join(OUT,'decks-'+n+'.png')});
 const rows=()=>page.evaluate(()=>document.querySelectorAll('#pc-results .build-row').length);
 const countText=()=>page.evaluate(()=>(document.querySelector('#pc-result-count')||{}).textContent||'');
 const hoverBox=()=>page.evaluate(()=>{const l=document.querySelector('.card-hover-layer'),b=document.querySelector('.card-hover-box'),i=b&&b.querySelector('img');if(!l||!l.classList.contains('on'))return null;const r=b.getBoundingClientRect();return{w:Math.round(r.width),h:Math.round(r.height),x:Math.round(r.x),y:Math.round(r.y),right:Math.round(r.right),bottom:Math.round(r.bottom),vw:innerWidth,vh:innerHeight,src:i&&i.getAttribute('src')};});

 await page.goto('file:///'+path.join(ROOT,'index.html').replace(/\\/g,'/'));
 await page.waitForTimeout(300);
 await page.evaluate(()=>{try{localStorage.removeItem('lotr-saved-decks-v1');}catch{}});

 /* 1. 顶部导航只剩一个卡牌入口 */
 const nav=await page.evaluate(()=>[...document.querySelectorAll('nav button')].map(b=>b.textContent.trim()));
 check('顶部导航不再有英雄与玩家牌',!nav.some(t=>t.includes('英雄与玩家')),nav);
 check('导航项为五项',nav.length===5,nav);

 /* 2. 我的卡组 → 新建牌组 */
 await page.click('#decksTab');
 await page.waitForTimeout(350);
 const listHead=await page.evaluate(()=>({h:(document.querySelector('#app h1')||{}).textContent||'',newBtn:!!document.querySelector('[data-action="deckNew"]')}));
 check('卡组页提供新建牌组',listHead.h==='我的卡组'&&listHead.newBtn,listHead);
 await page.click('[data-action="deckNew"]');
 await page.waitForTimeout(450);
 const buildHead=await page.evaluate(()=>({h:(document.querySelector('#app h1')||{}).textContent||'',rows:document.querySelectorAll('#pc-results .build-row').length,groups:[...document.querySelectorAll('#pc-results .cat-group h2 span:first-child')].map(x=>x.textContent.trim()),total:RINGSDB_SNAPSHOT.cards.length}));
 check('新建牌组进入构建器',buildHead.h==='编辑牌组',{h:buildHead.h});
 check('构建器列出全部玩家卡',buildHead.rows===buildHead.total,{rows:buildHead.rows,total:buildHead.total});
 check('构建器按球色分组',buildHead.groups.length===5&&buildHead.groups[0]==='领导',buildHead.groups);
 check('每行给出类型与编号',await page.evaluate(()=>{const s=document.querySelector('#pc-results .build-row summary');return !!s&&!!s.querySelector('.cat-name')&&/#\d{5}/.test(s.querySelector('.cat-meta').textContent);}));
 await shot('builder');

 /* 3. 悬停卡名直接看图 */
 await page.locator('#pc-results .build-row summary').first().hover();
 await page.waitForTimeout(450);
 const hv=await hoverBox();
 check('悬停卡名弹出竖版大图',!!hv&&hv.h>hv.w,hv);
 check('放大图在视口内',!!hv&&hv.x>=0&&hv.y>=0&&hv.right<=hv.vw&&hv.bottom<=hv.vh,hv);
 await shot('hover');
 await page.mouse.move(4,600);
 await page.waitForTimeout(320);
 check('移开后收起',(await hoverBox())===null);

 /* 4. 搜索收窄 */
 const sampleName=await page.locator('#pc-results .build-row .cat-name').first().textContent();
 const key=sampleName.replace(/^◆\s*/,'').slice(0,2);
 await page.fill('#pc-search',key);
 await page.waitForTimeout(350);
 const narrowed=await rows();
 check('搜索收窄列表',narrowed>0&&narrowed<buildHead.total,{key,narrowed});
 const ct=await countText();
 check('计数与行数一致',ct.includes(String(narrowed)),{count:ct,narrowed});
 check('卡片仍可悬停看图',await page.evaluate(()=>!!document.querySelector('#pc-results .build-row summary[data-hover-src]')));
 await page.fill('#pc-search','');
 await page.waitForTimeout(350);

 /* 5. 加减牌与选英雄 */
 const allyRow=page.locator('#pc-results .build-row').filter({has:page.locator('.cat-meta',{hasText:'盟友'})}).first();
 await allyRow.locator('[data-pc="plus"]').click();
 await page.waitForTimeout(250);
 await allyRow.locator('[data-pc="plus"]').click();
 await page.waitForTimeout(250);
 const after=await page.evaluate(()=>({counts:[...document.querySelectorAll('.deck-counts strong')].map(x=>x.textContent.trim()),rowCount:(document.querySelector('#pc-results .build-row .build-count')||{}).textContent,deckRows:[...document.querySelectorAll('.deck-list div')].length}));
 check('加牌后牌库张数增加',Number(after.counts[2])>=2,after);
 const heroRow=page.locator('#pc-results .build-row').filter({has:page.locator('.cat-meta',{hasText:'英雄'})}).first();
 await heroRow.locator('[data-pc="hero"]').click();
 await page.waitForTimeout(300);
 check('选英雄后显示 1/3',(await page.evaluate(()=>(document.querySelector('.deck-counts strong')||{}).textContent))==='1/3');
 check('已在牌组中的行有标记',await page.evaluate(()=>document.querySelectorAll('#pc-results .build-row.in-deck').length>=1));

 /* 6. 展开详情注入卡图与文本 */
 await page.locator('#pc-results .build-row summary').first().click();
 await page.waitForTimeout(450);
 const det=await page.evaluate(()=>{const d=document.querySelector('#pc-results .cat-detail');return d?{imgs:d.querySelectorAll('.card-art img').length,text:d.textContent.length}:null;});
 check('展开后注入卡图与文本',!!det&&det.imgs===1&&det.text>80,det);
 await shot('detail');
 await page.locator('#pc-results .build-row summary').first().click();
 await page.waitForTimeout(250);

 /* 7. 未通过构筑校验时保存被拒绝 */
 await page.click('[data-pc="save"]');
 await page.waitForTimeout(350);
 const toast=await page.evaluate(()=>(document.querySelector('#toast')||{}).textContent||'');
 check('不合法牌组保存被拒绝',!!toast&&!toast.includes('已保存'),toast);

 /* 8. 返回卡组列表 */
 await page.click('[data-pc="deckBack"]');
 await page.waitForTimeout(400);
 check('返回后回到卡组列表',await page.evaluate(()=>(document.querySelector('#app h1')||{}).textContent==='我的卡组'));
 check('全程无横向溢出',await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
 check('无破图',await page.evaluate(()=>[...document.querySelectorAll('#pc-results img,#catalogResults img')].filter(i=>i.complete&&i.naturalWidth===0).length===0));
 check('全程无脚本错误',errors.length===0,errors);

 await page.close();
 await browser.close();
 fs.writeFileSync(path.join(OUT,'decks-report.json'),JSON.stringify(report,null,2));
 for(const r of report)console.log((r.ok?'PASS  ':'FAIL  ')+r.label+(r.ok?'':'  '+JSON.stringify(r.extra)));
 const bad=report.filter(r=>!r.ok).length;
 console.log(bad?`FAILED ${bad}`:'OK');
 process.exit(bad?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
