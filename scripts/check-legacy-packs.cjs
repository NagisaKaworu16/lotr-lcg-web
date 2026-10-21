/* Real-browser check for the legacy "one box -> its scenarios" flow. */
const path=require('path'),fs=require('fs');
const {chromium}=require('playwright-core');
const CHROME=process.env.CHROME_PATH||['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
const ROOT=path.resolve(__dirname,'..');
const OUT=path.join(ROOT,'docs','catalog-tabs');
const WIDTHS=[1440,768];

(async()=>{
 fs.mkdirSync(OUT,{recursive:true});
 const browser=await chromium.launch({executablePath:CHROME,args:['--allow-file-access-from-files','--no-sandbox']});
 const report=[];
 for(const width of WIDTHS){
  const page=await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:1});
  const remote=[],errors=[];
  page.on('request',r=>{if(/^https?:/.test(r.url()))remote.push(r.url());});
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('file:///'+path.join(ROOT,'index.html').replace(/\\/g,'/'));
  await page.waitForTimeout(300);

  await page.click('.ng-tabs button[data-value="legacy"]');
  await page.waitForTimeout(200);
  const list=await page.evaluate(async()=>{
   const imgs=[...document.querySelectorAll('.ng-card-art img')];
   imgs.forEach(i=>{i.loading='eager';});
   await Promise.all(imgs.map(i=>i.complete?null:new Promise(r=>{i.addEventListener('load',r,{once:true});i.addEventListener('error',r,{once:true});})));
   return {
    cards:[...document.querySelectorAll('.ng-grid .ng-card')].map(c=>c.querySelector('h3').textContent.trim()),
    subs:[...document.querySelectorAll('.ng-grid .ng-card .ng-card-en')].map(p=>p.textContent.trim()),
    open:document.querySelectorAll('[data-action="ngOpen"]').length,
    broken:[...document.querySelectorAll('.ng-card-art img')].filter(i=>i.naturalWidth===0).length,
    overflowX:document.documentElement.scrollWidth>document.documentElement.clientWidth,
   };
  });
  report.push({width,legacyList:list});
  if(list.cards.length!==15)report.push({width,error:"大扩展数量应为 15，实际 "+list.cards.length});
  if(list.broken)report.push({width,error:`列表 ${list.broken} 张封面未加载`});
  if(list.overflowX)report.push({width,error:'列表出现横向滚动'});
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:path.join(OUT,`${width}-legacy-list.png`)});

  await page.click('[data-id="Khazad-dum"]');
  await page.waitForTimeout(250);
  /* campaign mode hides the scenario grid: the run always starts at scenario one */
  const campaign=await page.evaluate(()=>({
   packCards:document.querySelectorAll('.ng-pack').length,
   hint:(document.querySelector('.ng-form')||{}).textContent||'',
   nextDisabled:!!document.querySelector('[data-action="ngNext"]').disabled,
  }));
  report.push({width,legacyCampaign:campaign});
  if(campaign.packCards)report.push({width,error:'完整剧本模式不应展示剧本网格，实际 '+campaign.packCards+' 张'});
  if(!campaign.hint.includes('红角门'))report.push({width,error:'完整剧本模式未说明起点剧本'});
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:path.join(OUT,`${width}-legacy-campaign.png`)});

  await page.click('[data-action="ngMode"][data-value="standalone"]');
  await page.waitForTimeout(250);
  const detail=await page.evaluate(async()=>{
   const imgs=[...document.querySelectorAll('.ng-card-art img')];
   imgs.forEach(i=>{i.loading='eager';});
   await Promise.all(imgs.map(i=>i.complete?null:new Promise(r=>{i.addEventListener('load',r,{once:true});i.addEventListener('error',r,{once:true});})));
   const next=document.querySelector('[data-action="ngNext"]');
   return {
    packs:[...document.querySelectorAll('.ng-pack')].map(c=>c.querySelector('h3').textContent.trim()),
    selected:document.querySelectorAll('.ng-pack.selected').length,
    playable:document.querySelectorAll('.ng-pack:not(.locked)').length,
    nextDisabled:!!(next&&next.disabled),
    broken:[...document.querySelectorAll('.ng-card-art img')].filter(i=>i.naturalWidth===0).length,
    overflowX:document.documentElement.scrollWidth>document.documentElement.clientWidth,
   };
  });
  report.push({width,legacyDetail:detail});
  if(detail.packs.length!==6)report.push({width,error:'卡兹杜姆应有 6 个剧本，实际 '+detail.packs.length});
  if(detail.broken)report.push({width,error:`剧本 ${detail.broken} 张封面未加载`});
  if(detail.overflowX)report.push({width,error:'设置页出现横向滚动'});
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:path.join(OUT,`${width}-legacy-packs.png`)});
  if(width===1440){
   await page.evaluate(()=>window.scrollTo(0,520));
   await page.screenshot({path:path.join(OUT,`${width}-legacy-packs-scrolled.png`)});
  }

  /* the base game must still be fully playable; it now lives under 新版扩展 */
  await page.click('[data-action="ngBack"]');
  await page.waitForTimeout(150);
  await page.click('.ng-tabs button[data-value="revised"]');
  await page.waitForTimeout(150);
  await page.click('[data-action="ngOpen"][data-id="core"]');
  await page.waitForTimeout(200);
  await page.click('[data-action="ngMode"][data-value="standalone"]');
  await page.waitForTimeout(200);
  const base=await page.evaluate(()=>({
   packs:[...document.querySelectorAll('.ng-pack')].map(c=>c.querySelector('h3').textContent.trim()),
   playable:document.querySelectorAll('.ng-pack:not(.locked)').length,
   nextDisabled:!!document.querySelector('[data-action="ngNext"]').disabled,
  }));
  report.push({width,baseDetail:base});
  if(base.packs.length!==3||base.playable!==3||base.nextDisabled)report.push({width,error:'基础三剧本应全部可玩且可以继续'});

  report.push({width,remoteRequests:remote.length,pageErrors:errors.length});
  await page.close();
 }
 await browser.close();
 const errors=report.filter(r=>r.error);
 fs.writeFileSync(path.join(OUT,'legacy-report.json'),JSON.stringify(report,null,2));
 for(const r of report)console.log(JSON.stringify(r));
 console.log(errors.length?`FAILED ${errors.length}`:'OK');
 process.exit(errors.length?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
