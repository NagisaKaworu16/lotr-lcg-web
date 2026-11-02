/* Real-browser check for the unified card library:
   player + encounter cards on one page behind the 玩家 / 战役 / 两者都 split,
   dense name list, card art + full text injected only when a row is opened.
   v0.16.2：玩家卡切全量（1315 张 / 98 系列，player-carddata.js）后列表分批渲染
   （首屏 CAT_BATCH=60 张 + 「显示更多」增量挂载），本脚本按分批语义断言：
   resultCount 仍报过滤后的完整计数，DOM 行数受批上限约束。 */
const path=require('path'),fs=require('fs');
const {chromium}=require('playwright-core');
const CHROME=process.env.CHROME_PATH||['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
const ROOT=path.resolve(__dirname,'..');
const OUT=path.join(ROOT,'docs','catalog-tabs');
const ACCEPT=path.join(ROOT,'docs','browser-acceptance');

(async()=>{
 fs.mkdirSync(OUT,{recursive:true});
 fs.mkdirSync(ACCEPT,{recursive:true});
 const browser=await chromium.launch({executablePath:CHROME,args:['--allow-file-access-from-files','--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 const report=[];
 const check=(label,cond,extra)=>report.push({label,ok:!!cond,...(cond?{}:{extra})});
 const count=()=>page.evaluate(()=>{const m=((document.querySelector('#resultCount')||{}).textContent||'').match(/\d+/);return m?Number(m[0]):-1;});
 const rows=()=>page.evaluate(()=>document.querySelectorAll('#catalogResults .cat-item').length);
 const groups=()=>page.evaluate(()=>[...document.querySelectorAll('#catalogResults .cat-group h2 span:first-child')].map(x=>x.textContent.trim()));
 const shot=(dir,n)=>page.screenshot({path:path.join(dir,'catalog-'+n+'.png')});
 /* 「显示更多」循环点到底（40 次足够覆盖 1315/60≈22 轮），用于需要全量 DOM 的断言。 */
 const loadAll=async()=>{for(let i=0;i<120;i++){const has=await page.evaluate(()=>!!document.querySelector('#catalogResults [data-action="catMore"]'));if(!has)break;await page.click('#catalogResults [data-action="catMore"]');await page.waitForTimeout(60);}};

 await page.goto('file:///'+path.join(ROOT,'index.html').replace(/\\/g,'/'));
 await page.waitForTimeout(300);
 /* v0.16.7：encounter 口径 = data.js 战役卡 + fetched 净增（去重键：非 quest normalize 英文名；quest 用 position==id + 英文名兜底） */
 const totals=await page.evaluate(()=>{const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');const dn=new Set(D.cards.map(x=>norm(x.en||x.name)));const qi=new Set(D.quests.map(q=>q.id));const qn=new Set(D.quests.map(q=>norm(q.name)));let fresh=0;const F=(typeof ENCOUNTER_CARDS_DATA!=='undefined'&&ENCOUNTER_CARDS_DATA.cards)||[];for(const k of F){const known=k.type==='quest'?(qi.has(Number(k.position))||(norm(k.name)&&qn.has(norm(k.name)))):dn.has(norm(k.name));if(!known)fresh++;}return {player:(typeof PLAYER_CARDS_DATA!=='undefined'?PLAYER_CARDS_DATA:RINGSDB_SNAPSHOT).cards.length,encounter:D.cards.length+D.quests.length+fresh,fetched:F.length,fresh};});

 /* 1. 页签进入 */
 await page.click('#catalogTab');
 await page.waitForTimeout(300);
 const head=await page.evaluate(()=>({h:(document.querySelector('#app h1')||{}).textContent||'',active:document.querySelector('#catalogTab').classList.contains('active'),badge:(document.querySelector('#catalogTab span')||{}).textContent||''}));
 check('点页签进入卡牌库',head.h==='卡牌库'&&head.active,head);
 check('页签数量按卡池回填',Number(head.badge)===totals.player+totals.encounter,{badge:head.badge,totals});
 check('进入时无脚本错误',errors.length===0,errors);

 /* 2. 默认两者都：计数为全量，DOM 首屏分批（≤60 行） */
 const both=await count();
 check('默认计数为全量卡牌',both===totals.player+totals.encounter,{both,totals});
 check('首屏 DOM 卡片数有上限（分批渲染生效）',(await rows())===Math.min(both,60),{rows:await rows(),both});
 const g0=await groups();
 check('首屏按组渲染且首组为玩家卡球色分组',g0.length>=1&&g0[0]==='玩家卡 · 领导',g0);
 check('系列包下拉存在且含基础包',await page.evaluate(()=>{const s=document.querySelector('#podFilter');return !!s&&[...s.options].some(o=>o.value==='Core'&&o.textContent.includes('基础包'));}));
 check('默认视图只列名称',await page.evaluate(()=>document.querySelectorAll('#catalogResults .cat-figure').length===0));
 check('每行显示名称与类型摘要',await page.evaluate(()=>{const s=document.querySelector('#catalogResults .cat-item summary');return !!s&&!!s.querySelector('.cat-name')&&!!s.querySelector('.cat-meta');}));
 check('计数文案标注分批',await page.evaluate(t=>document.querySelector('#resultCount').textContent.includes(`先显示前 ${Math.min(t.player+t.encounter,60)}`),totals));
 await shot(OUT,'all');

 /* 2.5 「显示更多」增量挂载，点到底恢复全量 DOM */
 await page.click('#catalogResults [data-action="catMore"]');
 await page.waitForTimeout(200);
 check('显示更多一次增量一批',(await rows())===Math.min(both,120),{rows:await rows(),both});
 await loadAll();
 check('加载到底后行数等于全量',(await rows())===both,{rows:await rows(),both});
 check('加载完不再有显示更多按钮',await page.evaluate(()=>!document.querySelector('#catalogResults [data-action="catMore"]')));
 const g=await groups();
 check('分组同时含玩家卡与遭遇卡',g.some(x=>x.startsWith('玩家卡 · '))&&g.some(x=>x.startsWith('遭遇卡 · ')),g);
 check('分组含探险卡',g.includes('探险卡'),g);
 await shot(OUT,'all-loaded');

 /* 3. 三档切换 */
 await page.click('button[data-action="catSide"][data-value="player"]');
 await page.waitForTimeout(250);
 check('玩家分类只含玩家卡',(await count())===totals.player,{n:await count(),want:totals.player});
 await loadAll();
 const pg=await groups();
 check('玩家分类按球色分组（五主色+护戒队+皮包）',pg.length===7&&pg[0]==='领导',pg);
 check('玩家分类不含战役卡',!(await page.evaluate(()=>document.querySelector('#catalogResults').innerHTML.includes('遭遇卡 · '))));
 await shot(OUT,'player');
 await page.click('button[data-action="catSide"][data-value="encounter"]');
 await page.waitForTimeout(250);
 check('战役分类只含遭遇与探险卡',(await count())===totals.encounter,{n:await count(),want:totals.encounter});
 /* v0.16.4 起战役卡 69 张 > 批上限 60：首屏截断，点「显示更多」补齐 */
 check('战役分类首屏受批上限（战役卡池>60）',(await rows())===60,{rows:await rows()});
 for(let i=0;i<120&&await page.locator('#catalogResults [data-action="catMore"]').count();i++){
   await page.click('#catalogResults [data-action="catMore"]');await page.waitForTimeout(60);
 }
 check('显示更多点到底后战役分类渲染完',(await rows())===totals.encounter,{rows:await rows(),want:totals.encounter});
 const eg=await groups();
 check('战役分类按类型分组',eg.includes('敌人')&&eg.includes('探险卡'),eg);
 await shot(OUT,'encounter');

 /* 4. 搜索跨两类（DOM 行数受批上限约束） */
 await page.click('button[data-action="catSide"][data-value="both"]');
 await page.waitForTimeout(200);
 await page.fill('#search','蛛');
 await page.waitForTimeout(300);
 const spider=await count();
 check('关键词筛选跨玩家与战役',spider>0&&spider<totals.player+totals.encounter,{spider});
 check('搜索后行数与计数一致（受批上限）',(await rows())===Math.min(spider,60),{rows:await rows(),spider});
 await shot(OUT,'search');
 await shot(ACCEPT,'full-search');
 await page.fill('#search','');
 await page.waitForTimeout(300);
 check('清空搜索恢复全量计数',(await count())===totals.player+totals.encounter);

 /* 4.5 按系列包（pod）筛选：99 个系列、计数拆分、与搜索叠加 */
 await page.selectOption('#podFilter','Core');
 await page.waitForTimeout(350);
 /* v0.16.5：期望值从数据现算——战役卡池增长（v0.16.4 并入 THfG）不该再牵动硬编码；文案三类分开（遭遇卡不含探险卡） */
 check('Core 包筛选含全部基础版卡牌',await page.evaluate(()=>{const coreCards=PLAYER_CARDS_DATA.cards.filter(x=>x.packCode==='Core').length,coreEnc=D.cards.filter(x=>x.pack==='Core').length,coreQ=D.quests.filter(q=>q.pack==='Core').length;return document.querySelector('#resultCount').textContent.includes(`玩家卡 ${coreCards} / 遭遇卡 ${coreEnc} / 探险卡 ${coreQ}`);}));
 check('系列包下三类分组齐全（分批后）',await page.evaluate(()=>{const t=document.querySelector('#catalogResults').textContent;return t.includes('玩家卡 · 领导');}));
 check('计数按三类拆分',await page.evaluate(()=>{const coreCards=PLAYER_CARDS_DATA.cards.filter(x=>x.packCode==='Core').length,coreEnc=D.cards.filter(x=>x.pack==='Core').length,coreQ=D.quests.filter(q=>q.pack==='Core').length;return document.querySelector('#resultCount').textContent.includes(`玩家卡 ${coreCards} / 遭遇卡 ${coreEnc} / 探险卡 ${coreQ}`);}));
 /* 战役卡带真实 pack 字段而非 'Core' 兜底：基础包 45+10 命中 Core，HfG 11+3 归 THfG */
 check('战役卡的 pack 字段全部有值且按包归属',await page.evaluate(()=>{const miss=[...D.cards,...D.quests].filter(c=>!c.pack);return miss.length===0&&D.cards.filter(c=>c.pack==='Core').length===45&&D.cards.filter(c=>c.pack==='THfG').length===11&&D.quests.filter(q=>q.pack==='Core').length===10&&D.quests.filter(q=>q.pack==='THfG').length===3;}));
 check('系列包下拉覆盖全系列（现算：玩家系列 + 战役/fetched 系列）',await page.evaluate(()=>{const want=new Set((typeof PLAYER_CARDS_DATA!=='undefined'?PLAYER_CARDS_DATA.packs:[]).map(p=>p.code));for(const c of D.cards)want.add(c.pack||'Core');for(const q of D.quests)want.add(q.pack||'Core');for(const k of (typeof ENCOUNTER_CARDS_DATA!=='undefined'&&ENCOUNTER_CARDS_DATA.cards)||[])want.add(k.packCode);const v=[...document.querySelector('#podFilter').options].filter(o=>o.value).map(o=>o.value);return v.length===want.size&&v.every(x=>want.has(x));}));
 await loadAll();
 check('Core 包全量行数=73 玩家卡+55 战役卡',(await rows())===128,{rows:await rows()});
 await shot(OUT,'pod');
 await page.fill('#search','蛛');
 await page.waitForTimeout(300);
 const podSpider=await rows();
 check('系列包与搜索叠加生效',podSpider>0&&podSpider<128,{podSpider});
 await page.fill('#search','');
 await page.selectOption('#podFilter','');
 await page.waitForTimeout(300);
 check('清空系列包恢复全量计数',(await count())===totals.player+totals.encounter);

 /* 4.6 切到扩展系列（HfG）：全系列已收录，一次渲染完 */
 await page.selectOption('#podFilter','HfG');
 await page.waitForTimeout(350);
 check('HfG 系列计数为 10',await page.evaluate(()=>document.querySelector('#resultCount').textContent.includes('The Hunt for Gollum')&&document.querySelector('#resultCount').textContent.includes('共 10 种')));
 check('HfG 行数=10 且无分批按钮',await page.evaluate(()=>document.querySelectorAll('#catalogResults .cat-item').length===10&&!document.querySelector('#catalogResults [data-action="catMore"]')));
 check('HfG 按球色分组渲染',await page.evaluate(()=>document.querySelectorAll('#catalogResults .cat-group').length>0));
 await shot(OUT,'pod-hfg');
 await shot(ACCEPT,'full-pack-hfg');
 await page.selectOption('#podFilter','');

 /* 5. 卡图视图（同样受批上限约束） */
 await page.click('button[data-action="catView"][data-value="art"]');
 await page.waitForTimeout(600);
 const figs=await page.evaluate(()=>document.querySelectorAll('#catalogResults .cat-figure').length);
 check('卡图视图渲染卡图网格（首屏一批）',figs===60,{figs});
 await page.selectOption('#podFilter','Core');
 await page.waitForTimeout(300);
 check('Core 玩家卡用本地中文卡图',await page.evaluate(()=>document.querySelector('#catalogResults').innerHTML.includes('assets/cards-zh-core/')));
 await shot(OUT,'art');
 await page.selectOption('#podFilter','');
 await page.click('button[data-action="catView"][data-value="list"]');
 await page.waitForTimeout(300);

 /* 6. 点开详情才注入卡图与全文（含全量数据的规则文本） */
 check('收起状态不加载详情图',await page.evaluate(()=>document.querySelectorAll('#catalogResults .cat-body img').length===0));
 const playerRow=page.locator('#catalogResults .cat-item[data-face="player"]').first();
 await playerRow.locator('summary').click();
 await page.waitForTimeout(500);
 const pd=await playerRow.evaluate(el=>({open:el.open,imgs:el.querySelectorAll('.cat-body img').length,text:el.querySelector('.cat-body').textContent.slice(0,60),len:el.querySelector('.cat-body').textContent.length}));
 check('玩家卡详情展开出卡图与文本',pd.open&&pd.imgs===1&&pd.text.length>10,pd);
 check('玩家卡详情含规则文本（全量数据源）',pd.len>100,pd);
 check('玩家卡详情用本地卡图',await playerRow.evaluate(el=>/assets\/cards-(zh-core|en)\//.test(el.querySelector('.cat-body img').src)));
 await shot(OUT,'detail-player');
 /* 战役/探险详情：切到战役侧再取行；全量数据下 quest 行落在首屏 60 行外，先点「显示更多」直到出现 */
 await page.click('button[data-action="catSide"][data-value="encounter"]');
 await page.waitForTimeout(300);
 for(let i=0;i<120&&!(await page.locator('#catalogResults .cat-item[data-face="quest"]').count());i++){
   const m=page.locator('#catalogResults [data-action="catMore"]');
   if(!await m.count())break;
   await m.click();await page.waitForTimeout(60);
 }
 const questRow=page.locator('#catalogResults .cat-item[data-face="quest"]').first();
 await questRow.locator('summary').click();
 await page.waitForTimeout(500);
 check('探险卡详情给出 A/B 两面',await questRow.evaluate(el=>{const t=el.querySelector('.cat-body').textContent;return t.includes('A面')&&t.includes('B面');}));
 const encRow=page.locator('#catalogResults .cat-item[data-face="encounter"]').first();
 await encRow.locator('summary').click();
 await page.waitForTimeout(500);
 check('遭遇卡详情含数值与规则',await encRow.evaluate(el=>{const t=el.querySelector('.cat-body').textContent;return t.includes('遭遇组')&&(t.includes('敌人')||t.includes('地点')||t.includes('诡计')||t.includes('目标'));}));
 await shot(OUT,'detail-encounter');
 /* 变值属性兜底：hero 五维 null（307002 Tom Bombadil）显示 'X' */
 await page.click('button[data-action="catSide"][data-value="player"]');
 await page.waitForTimeout(250);
 await page.fill('#search','Tom Bombadil');
 await page.waitForTimeout(300);
 const tomRow=page.locator('#catalogResults .cat-item[data-face="player"]').first();
 await tomRow.locator('summary').click();
 await page.waitForTimeout(400);
 check('英雄变值五维显示 X（307002）',await tomRow.evaluate(el=>el.querySelector('.cat-body').textContent.includes('X／')));
 await page.fill('#search','');

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
 check('放大图不越界且不拦指针',!!hv&&hv.x>=0&&hv.y>=0&&hv.right<=hv.vw&&hv.bottom<=hv.vh&&hv.pe==='none',hv);
 await shot(OUT,'hover-player');
 check('移开后收起放大图',(await away())===null);
 /* 战役侧悬停横版（全量数据下探险卡也在首屏 60 行外，同样先点「显示更多」） */
 await page.click('button[data-action="catSide"][data-value="encounter"]');
 await page.waitForTimeout(250);
 for(let i=0;i<120&&!(await page.locator('#catalogResults .cat-item[data-face="quest"]').count());i++){
   const m=page.locator('#catalogResults [data-action="catMore"]');
   if(!await m.count())break;
   await m.click();await page.waitForTimeout(60);
 }
 const hq=await hoverRow('#catalogResults .cat-item[data-face="quest"] summary');
 check('悬停探险卡按横版放大',!!hq&&hq.w>hq.h,hq);
 await shot(OUT,'hover-quest');
 check('悬停后离开仍收起',(await away())===null);
 await page.click('button[data-action="catSide"][data-value="both"]');
 await page.waitForTimeout(250);

 /* 7.5 v0.16.5：侧栏已删除——「系列包」下拉是唯一筛选入口，系列下拉中文本地化 */
 check('侧栏已删除（.cat-side 与 catNav 全部移除）',await page.evaluate(()=>document.querySelector('.cat-side')===null&&document.querySelectorAll('[data-action="catNav"]').length===0));
 check('卡牌主区占满全宽（无侧栏网格容器）',await page.evaluate(()=>document.querySelector('.catalog-layout')===null&&document.querySelector('.cat-main')===null&&!!document.querySelector('#catalogResults')));
 check('系列下拉中文本地化（抽样译名带 · 分隔）',await page.evaluate(()=>{const t=[...document.querySelector('#podFilter').options].map(o=>o.textContent).join('\n');return ['安格玛觉醒','追梦者','埃瑞德米斯林','黑骑手','前路黑暗','雾山奇缘'].every(z=>t.includes(z+' · '))&&t.includes('寻找咕噜 · The Hunt for Gollum')&&t.includes('基础包 · Core Set');}));

 /* 7.6 v0.16.7：fetched 遭遇卡接线——净增入库、抽样可显示、data.js 恒为权威 */
 await page.selectOption('#podFilter','');await page.waitForTimeout(250);
 const fetchedInfo=await page.evaluate(()=>{
   const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
   const dn=new Set(D.cards.map(x=>norm(x.en||x.name)));
   const fresh=ENCOUNTER_CARDS_DATA.cards.filter(k=>k.type!=='quest'&&!dn.has(norm(k.name)));
   const sample=fresh.find(k=>k.type==='enemy'&&k.rulesText)||fresh[0];
   return {total:catalogStats().total,fresh:fresh.length,sample:sample?{name:sample.name,code:sample.slug||sample.code,pod:sample.packCode}:null};
 });
 check('fetched 净增条目全部入库（徽标=现算总数）',await page.evaluate(n=>document.querySelector('#catalogTab span').textContent===String(n),fetchedInfo.total),fetchedInfo);
 check('抽样新卡可搜索可显示',!fetchedInfo.sample||await (async()=>{
   await page.fill('#search',fetchedInfo.sample.name);await page.waitForTimeout(350);
   /* 搜索是全文匹配（rulesText 也算），只要求目标行存在且详情可开 */
   const rowSel=page.locator('#catalogResults .cat-item[data-code="'+fetchedInfo.sample.code+'"][data-pod="'+fetchedInfo.sample.pod+'"] summary');
   if(!await rowSel.count())return false;
   await rowSel.click();await page.waitForTimeout(400);
   const t=await page.evaluate(()=>{const d=document.querySelector('#catalogResults .cat-item[open] .cat-body');return {text:d.textContent,html:d.innerHTML};});
   return t.text.includes('遭遇组')&&!t.html.includes('<b>When')&&!t.html.includes('<b>Shadow')&&!t.html.includes('<b>Setup');
 })(),fetchedInfo.sample);
 check('Old Ford 仍单条目且不被 HoB 坏值 254 污染',await (async()=>{
   await page.fill('#search','Old Ford');await page.waitForTimeout(350);
   /* 搜索是全文匹配（其它卡的 rulesText 可能提到 Old Ford）；卡名精确 'The Old Ford' 的应只有 data.js 一条 */
   const exact=await page.evaluate(()=>[...document.querySelectorAll('#catalogResults .cat-item')].filter(r=>r.querySelector('.cat-name').textContent.trim()==='The Old Ford').map(r=>r.dataset.code));
   if(exact.length!==1)return {n:exact.length,codes:exact};
   const fordSel=page.locator('#catalogResults .cat-item[data-code="'+exact[0]+'"] summary');
   await fordSel.click();await page.waitForTimeout(400);
   const t=await page.evaluate(()=>document.querySelector('#catalogResults .cat-item[open] .cat-body').textContent);
   return !t.includes('254');
 })());
 await page.fill('#search','');await page.waitForTimeout(250);
 await shot(OUT,'fetched-wiring');
 await shot(OUT,'catalog-full-width');

 /* 8. 排版与图片健康 */
 check('无横向溢出',await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
 check('无破图',await page.evaluate(()=>[...document.querySelectorAll('#catalogResults img')].filter(i=>i.complete&&i.naturalWidth===0).length===0));
 check('键盘可达（summary 可聚焦）',await page.evaluate(()=>{const s=document.querySelector('#catalogResults .cat-item summary');s.focus();return document.activeElement===s;}));
 check('无结果时给空状态',await (async()=>{await page.fill('#search','不存在的卡名xyz');await page.waitForTimeout(300);return page.evaluate(()=>document.querySelector('#catalogResults').innerHTML.includes('没有匹配的卡牌'));})());
 await page.fill('#search','');
 await page.waitForTimeout(200);
 check('重复进出页签不报错',await (async()=>{await page.click('#helpTab');await page.waitForTimeout(150);await page.click('#catalogTab');await page.waitForTimeout(300);return errors.length===0;})());

 /* 9. 移动端适配（480 宽：v0.16.5 起无侧栏，主区直接单列） */
 await page.setViewportSize({width:480,height:860});
 await page.waitForTimeout(350);
 check('移动端无横向溢出',await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
 check('移动端无侧栏且主区可用',await page.evaluate(()=>document.querySelector('.cat-side')===null&&!!document.querySelector('#search')&&!!document.querySelector('#catalogResults')));
 check('移动端搜索与列表仍可用',await (async()=>{await page.fill('#search','蛛');await page.waitForTimeout(250);const n=await count();await page.fill('#search','');await page.waitForTimeout(150);return n>0;})());
 await shot(OUT,'mobile-480');
 await page.setViewportSize({width:1440,height:1000});
 await page.waitForTimeout(250);

 /* 10. 验收截图（docs/browser-acceptance/）：全量列表 + 扩展系列 + 搜索 */
 await loadAll();
 await shot(ACCEPT,'full-list-all-loaded');
 await page.selectOption('#podFilter','HfG');
 await page.waitForTimeout(300);
 await loadAll();
 await shot(ACCEPT,'full-pack-hfg');
 await page.selectOption('#podFilter','');
 await page.fill('#search','Aragorn');
 await page.waitForTimeout(300);
 await shot(ACCEPT,'full-search-aragorn');
 await page.fill('#search','');

 await page.close();
 await browser.close();
 fs.writeFileSync(path.join(OUT,'catalog-report.json'),JSON.stringify(report,null,2));
 for(const r of report)console.log((r.ok?'PASS  ':'FAIL  ')+r.label+(r.ok?'':'  '+JSON.stringify(r.extra)));
 const bad=report.filter(r=>!r.ok).length;
 console.log(bad?`FAILED ${bad}`:'OK');
 process.exit(bad?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
