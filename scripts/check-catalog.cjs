/* Real-browser check for the "基础卡牌库" tab: it must render, not throw, and its filters must work.
   Regression for the v0.9 → v0.15 refactor that dropped catalog() while keeping the tab button. */
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
 const count=()=>page.evaluate(()=>{const m=(document.querySelector('#resultCount')||{}).textContent||'';const n=m.match(/\d+/);return n?Number(n[0]):-1;});
 const cards=()=>page.evaluate(()=>document.querySelectorAll('#catalogResults article.card').length);
 const shot=n=>page.screenshot({path:path.join(OUT,'catalog-'+n+'.png')});

 await page.goto('file:///'+path.join(ROOT,'index.html').replace(/\\/g,'/'));
 await page.waitForTimeout(300);

 /* 1. 点页签必须真的切过去（原缺陷：catalog is not defined，页面毫无变化） */
 await page.click('#catalogTab');
 await page.waitForTimeout(300);
 const heading=await page.evaluate(()=>({h:(document.querySelector('#app h1')||{}).textContent||'',active:document.querySelector('#catalogTab').classList.contains('active')}));
 check('点页签后切到基础卡牌库',heading.h==='基础卡牌库'&&heading.active,heading);
 check('页签切换未抛脚本错误',errors.length===0,errors);
 check('页签数量按卡池回填',await page.evaluate(()=>{const t=(document.querySelector('#catalogTab span')||{}).textContent||'';return t.trim()===String(D.cards.length+D.quests.length);}));

 /* 2. 数量与卡池一致 */
 const expected=await page.evaluate(()=>D.cards.length+D.quests.length);
 check('结果数等于卡池总数',(await count())===expected&&(await cards())===expected,{count:await count(),cards:await cards(),expected});
 check('顶部说明按数据统计而非硬编码',await page.evaluate(()=>{const p=document.querySelector('#app .intro .muted');return !!p&&p.textContent.includes(String(D.cards.length))&&p.textContent.includes(String(D.quests.length));}));
 await shot('all');

 /* 3. 关键词筛选 */
 await page.fill('#search','蛛');
 await page.waitForTimeout(250);
 const spider=await count();
 check('关键词筛选收窄结果',spider>0&&spider<expected,{spider,expected});
 await shot('search');
 await page.fill('#search','');
 await page.waitForTimeout(250);
 check('清空关键词后恢复全集',(await count())===expected,{count:await count()});

 /* 4. 类型筛选：探险卡按剧本阶段命中 */
 await page.selectOption('#typeFilter','Quest');
 await page.waitForTimeout(250);
 check('探险卡筛选只留探险卡',(await count())===10&&(await cards())===10,{count:await count(),cards:await cards()});
 check('探险卡给出 A/B 两面',await page.evaluate(()=>{const t=document.querySelector('#catalogResults').innerHTML;return t.includes('查看A面')&&t.includes('B面');}));
 await shot('quests');
 await page.selectOption('#typeFilter','');
 await page.waitForTimeout(250);

 /* 5. 遭遇组筛选：含该组的剧本阶段一并命中 */
 await page.selectOption('#setFilter','Spiders of Mirkwood');
 await page.waitForTimeout(250);
 const want=await page.evaluate(()=>D.cards.filter(c=>c.set==='Spiders of Mirkwood').length+D.quests.filter(q=>D.scenarios.some(s=>s.sets.includes('Spiders of Mirkwood')&&s.stages.includes(q.id))).length);
 check('遭遇组筛选按组+相关阶段命中',(await count())===want,{count:await count(),want});
 await shot('set');

 /* 6. 无结果空状态 */
 await page.fill('#search','不存在的卡名xyz');
 await page.waitForTimeout(250);
 check('无匹配时显示空状态',await page.evaluate(()=>document.querySelector('#catalogResults').innerHTML.includes('没有匹配的卡牌')));
 await page.fill('#search','');
 await page.selectOption('#setFilter','');
 await page.waitForTimeout(300);

 /* 7. 卡图不得破版：本地图存在且无 404 */
 const broken=await page.evaluate(()=>[...document.querySelectorAll('#catalogResults img')].filter(i=>i.complete&&i.naturalWidth===0).length);
 check('卡牌图片全部加载',broken===0,{broken});
 check('重复进出页签不报错',await (async()=>{await page.click('#helpTab');await page.waitForTimeout(150);await page.click('#catalogTab');await page.waitForTimeout(250);return errors.length===0;})());

 await page.close();
 await browser.close();
 fs.writeFileSync(path.join(OUT,'catalog-report.json'),JSON.stringify(report,null,2));
 for(const r of report)console.log((r.ok?'PASS  ':'FAIL  ')+r.label+(r.ok?'':'  '+JSON.stringify(r.extra)));
 const bad=report.filter(r=>!r.ok).length;
 console.log(bad?`FAILED ${bad}`:'OK');
 process.exit(bad?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
