/* Real-browser check for the unified card library:
   player + encounter cards on one page behind the 玩家 / 战役 / 两者都 split,
   dense name list by default, card art + full text injected only when a row is opened. */
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
 const check=(label,cond,extra)=>report.push({label,ok:!!cond,...(cond?{}:{extra})});
 const count=()=>page.evaluate(()=>{const m=((document.querySelector('#resultCount')||{}).textContent||'').match(/\d+/);return m?Number(m[0]):-1;});
 const rows=()=>page.evaluate(()=>document.querySelectorAll('#catalogResults .cat-item').length);
 const groups=()=>page.evaluate(()=>[...document.querySelectorAll('#catalogResults .cat-group h2 span:first-child')].map(x=>x.textContent.trim()));
 const shot=n=>page.screenshot({path:path.join(OUT,'catalog-'+n+'.png')});

 await page.goto('file:///'+path.join(ROOT,'index.html').replace(/\\/g,'/'));
 await page.waitForTimeout(300);
 const totals=await page.evaluate(()=>({player:RINGSDB_SNAPSHOT.cards.length,encounter:D.cards.length+D.quests.length}));

 /* 1. 页签进入 */
 await page.click('#catalogTab');
 await page.waitForTimeout(300);
 const head=await page.evaluate(()=>({h:(document.querySelector('#app h1')||{}).textContent||'',active:document.querySelector('#catalogTab').classList.contains('active'),badge:(document.querySelector('#catalogTab span')||{}).textContent||''}));
 check('点页签进入卡牌库',head.h==='卡牌库'&&head.active,head);
 check('页签数量按卡池回填',Number(head.badge)===totals.player+totals.encounter,{badge:head.badge,totals});
 check('进入时无脚本错误',errors.length===0,errors);

 /* 2. 默认两者都：玩家卡与战役卡同屏 */
 const both=await count();
 check('默认显示全部卡牌',both===totals.player+totals.encounter,{both,totals});
 check('名称列表行数等于总数',(await rows())===both,{rows:await rows(),both});
 const g=await groups();
 check('分组同时含玩家与战役',g.some(x=>x.startsWith('玩家 · '))&&g.some(x=>x.startsWith('战役 · ')),g);
 check('分组含探险卡',g.includes('战役 · 探险卡'),g);
 check('默认视图只列名称',await page.evaluate(()=>document.querySelectorAll('#catalogResults .cat-figure').length===0));
 check('每行显示名称与类型摘要',await page.evaluate(()=>{const s=document.querySelector('#catalogResults .cat-item summary');return !!s&&!!s.querySelector('.cat-name')&&!!s.querySelector('.cat-meta');}));
 await shot('all');

 /* 3. 三档切换 */
 await page.click('button[data-action="catSide"][data-value="player"]');
 await page.waitForTimeout(250);
 check('玩家分类只含玩家卡',(await count())===totals.player,{n:await count(),want:totals.player});
 const pg=await groups();
 check('玩家分类按球色分组',pg.length===5&&pg[0]==='领导',pg);
 check('玩家分类不含战役卡',!(await page.evaluate(()=>document.querySelector('#catalogResults').innerHTML.includes('战役 · '))));
 await shot('player');
 await page.click('button[data-action="catSide"][data-value="encounter"]');
 await page.waitForTimeout(250);
 check('战役分类只含遭遇与探险卡',(await count())===totals.encounter,{n:await count(),want:totals.encounter});
 const eg=await groups();
 check('战役分类按类型分组',eg.includes('敌人')&&eg.includes('探险卡'),eg);
 await shot('encounter');

 /* 4. 搜索跨两类 */
 await page.click('button[data-action="catSide"][data-value="both"]');
 await page.waitForTimeout(200);
 await page.fill('#search','蛛');
 await page.waitForTimeout(300);
 const spider=await count();
 check('关键词筛选跨玩家与战役',spider>0&&spider<totals.player+totals.encounter,{spider});
 check('搜索后行数与计数一致',(await rows())===spider,{rows:await rows(),spider});
 await shot('search');
 await page.fill('#search','');
 await page.waitForTimeout(300);
 check('清空搜索恢复全量',(await count())===totals.player+totals.encounter);

 /* 5. 卡图视图 */
 await page.click('button[data-action="catView"][data-value="art"]');
 await page.waitForTimeout(600);
 const figs=await page.evaluate(()=>document.querySelectorAll('#catalogResults .cat-figure').length);
 check('卡图视图渲染卡图网格',figs===totals.player+totals.encounter,{figs});
 check('玩家卡用本地中文卡图',await page.evaluate(()=>document.querySelector('#catalogResults').innerHTML.includes('assets/cards-zh-core/')));
 await shot('art');
 await page.click('button[data-action="catView"][data-value="list"]');
 await page.waitForTimeout(300);

 /* 6. 点开详情才注入卡图与全文 */
 check('收起状态不加载详情图',await page.evaluate(()=>document.querySelectorAll('#catalogResults .cat-body img').length===0));
 const playerRow=page.locator('#catalogResults .cat-item[data-face="player"]').first();
 await playerRow.locator('summary').click();
 await page.waitForTimeout(500);
 const pd=await playerRow.evaluate(el=>({open:el.open,imgs:el.querySelectorAll('.cat-body img').length,text:el.querySelector('.cat-body').textContent.slice(0,60)}));
 check('玩家卡详情展开出卡图与文本',pd.open&&pd.imgs===1&&pd.text.length>10,pd);
 check('玩家卡详情用本地卡图',await playerRow.evaluate(el=>/assets\/cards-(zh-core|en)\//.test(el.querySelector('.cat-body img').src)));
 await shot('detail-player');
 const questRow=page.locator('#catalogResults .cat-item[data-face="quest"]').first();
 await questRow.locator('summary').click();
 await page.waitForTimeout(500);
 check('探险卡详情给出 A/B 两面',await questRow.evaluate(el=>{const t=el.querySelector('.cat-body').textContent;return t.includes('A面')&&t.includes('B面');}));
 const encRow=page.locator('#catalogResults .cat-item[data-face="encounter"]').first();
 await encRow.locator('summary').click();
 await page.waitForTimeout(500);
 check('遭遇卡详情含数值与规则',await encRow.evaluate(el=>{const t=el.querySelector('.cat-body').textContent;return t.includes('遭遇组')&&(t.includes('敌人')||t.includes('地点')||t.includes('诡计')||t.includes('目标'));}));
 await shot('detail-encounter');

 /* 7. 悬停卡名直接看图（不点击、不跳转第三方站） */
 const hoverBox=()=>page.evaluate(()=>{const l=document.querySelector('.card-hover-layer'),b=document.querySelector('.card-hover-box'),i=b&&b.querySelector('img');if(!l||!l.classList.contains('on'))return null;const r=b.getBoundingClientRect();return{w:Math.round(r.width),h:Math.round(r.height),x:Math.round(r.x),y:Math.round(r.y),right:Math.round(r.right),bottom:Math.round(r.bottom),vw:innerWidth,vh:innerHeight,src:i&&i.getAttribute('src'),pe:getComputedStyle(l).pointerEvents};});
 const hoverRow=async(sel)=>{await page.locator(sel).first().hover();await page.waitForTimeout(450);return hoverBox();};
 const away=async()=>{await page.mouse.move(4,600);await page.waitForTimeout(320);return hoverBox();};
 /* 展开的行正文里本来就有卡图，先把上一段点开的行收起，才能测悬停 */
 await page.evaluate(()=>document.querySelectorAll('#catalogResults .cat-item[open]').forEach(d=>{d.open=false;}));
 await page.waitForTimeout(250);
 const hv=await hoverRow('#catalogResults .cat-item[data-face="player"] summary');
 check('悬停玩家卡名弹出竖版预览',!!hv&&hv.h>hv.w&&hv.w>=260&&hv.w<=340,hv);
 check('预览不超过视口六成高',!!hv&&hv.h<=hv.vh*0.62,hv);
 check('放大图用本地中文卡图',!!hv&&/assets\/cards-(zh-core|en)\//.test(hv.src||''),hv);
 check('放大图不越界且不拦指针',!!hv&&hv.x>=0&&hv.y>=0&&hv.right<=hv.vw&&hv.bottom<=hv.vh&&hv.pe==='none',hv);
 await shot('hover-player');
 check('移开后收起放大图',(await away())===null);
 const hq=await hoverRow('#catalogResults .cat-item[data-face="quest"] summary');
 check('悬停探险卡按横版放大',!!hq&&hq.w>hq.h,hq);
 await shot('hover-quest');
 check('悬停后离开仍收起',(await away())===null);

 /* 7.5 侧边导航：基础卡牌库默认项 + 扩展包预留条目 */
 check('侧栏渲染且基础卡牌库默认激活',await page.evaluate(()=>{const b=document.querySelector('.cat-nav-item[data-section="base"]');return !!b&&b.getAttribute('aria-current')==='page'&&!!document.querySelector('.cat-side nav')&&!!document.querySelector('.cat-main');}));
 check('扩展条目动态来自产品目录（基础项外 ≥21 条）',await page.evaluate(()=>document.querySelectorAll('.cat-nav-item[data-section]:not([data-section="base"])').length>=21));
 check('旧版扩展折叠在 details 且默认收起',await page.evaluate(()=>{const d=document.querySelector('.cat-nav-fold');return !!d&&d.tagName==='DETAILS'&&!d.open;}));
 const firstSeries=await page.evaluate(()=>document.querySelector('.cat-nav-item[data-section]:not([data-section="base"])').dataset.section);
 await page.click(`.cat-nav-item[data-section="${firstSeries}"]`);
 await page.waitForTimeout(350);
 check('点扩展条目出占位面板',await page.evaluate(()=>{const p=document.querySelector('.cat-series-panel');return !!p&&p.textContent.includes('尚未收录');}));
 check('激活态在侧栏同步切换',await page.evaluate(sec=>{const a=document.querySelector(`.cat-nav-item[data-section="${sec}"]`);return !!a&&a.getAttribute('aria-current')==='page'&&document.querySelector('.cat-nav-item[data-section="base"]').getAttribute('aria-current')!=='page';},firstSeries));
 await shot('sidebar-series');
 await page.click('.cat-nav-item[data-section="base"]');
 await page.waitForTimeout(350);
 check('返回基础卡牌库恢复搜索与列表',await page.evaluate(()=>!!document.querySelector('#search')&&!!document.querySelector('#catalogResults')&&document.querySelector('.cat-nav-item[data-section="base"]').getAttribute('aria-current')==='page'));
 await shot('sidebar-base');

 /* 8. 排版与图片健康 */
 check('无横向溢出',await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
 check('无破图',await page.evaluate(()=>[...document.querySelectorAll('#catalogResults img')].filter(i=>i.complete&&i.naturalWidth===0).length===0));
 check('键盘可达（summary 可聚焦）',await page.evaluate(()=>{const s=document.querySelector('#catalogResults .cat-item summary');s.focus();return document.activeElement===s;}));
 check('无结果时给空状态',await (async()=>{await page.fill('#search','不存在的卡名xyz');await page.waitForTimeout(300);return page.evaluate(()=>document.querySelector('#catalogResults').innerHTML.includes('没有匹配的卡牌'));})());
 await page.fill('#search','');
 await page.waitForTimeout(200);
 check('重复进出页签不报错',await (async()=>{await page.click('#helpTab');await page.waitForTimeout(150);await page.click('#catalogTab');await page.waitForTimeout(300);return errors.length===0;})());

 /* 9. 移动端适配（480 宽：侧栏从双栏变条目组） */
 await page.setViewportSize({width:480,height:860});
 await page.waitForTimeout(350);
 check('移动端无横向溢出',await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
 check('移动端侧栏取消 sticky 双栏',await page.evaluate(()=>getComputedStyle(document.querySelector('.cat-side')).position==='static'));
 check('移动端条目改为可换行的 chip',await page.evaluate(()=>getComputedStyle(document.querySelector('.cat-nav-item')).display==='inline-flex'));
 check('移动端搜索与列表仍可用',await (async()=>{await page.fill('#search','蛛');await page.waitForTimeout(250);const n=await count();await page.fill('#search','');await page.waitForTimeout(150);return n>0;})());
 await shot('mobile-480');
 await page.setViewportSize({width:1440,height:1000});
 await page.waitForTimeout(250);

 await page.close();
 await browser.close();
 fs.writeFileSync(path.join(OUT,'catalog-report.json'),JSON.stringify(report,null,2));
 for(const r of report)console.log((r.ok?'PASS  ':'FAIL  ')+r.label+(r.ok?'':'  '+JSON.stringify(r.extra)));
 const bad=report.filter(r=>!r.ok).length;
 console.log(bad?`FAILED ${bad}`:'OK');
 process.exit(bad?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
