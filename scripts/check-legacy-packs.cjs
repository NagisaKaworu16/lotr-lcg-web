/* Real-browser check for the legacy "one box -> its scenarios" flow. */
const path=require('path'),fs=require('fs');
const {chromium}=require('playwright-core');
const CHROME='C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const ROOT=path.resolve(__dirname,'..');
const OUT=path.join(ROOT,'docs','catalog-tabs');
const WIDTHS=[1440,768];

(async()=>{
 fs.mkdirSync(OUT,{recursive:true});
 const browser=await chromium.launch({executablePath:CHROME,args:['--allow-file-access-from-files']});
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
  if(list.cards.length!==11)report.push({width,error:'大扩展数量应为 11，实际 '+list.cards.length});
  if(list.broken)report.push({width,error:`列表 ${list.broken} 张封面未加载`});
  if(list.overflowX)report.push({width,error:'列表出现横向滚动'});
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:path.join(OUT,`${width}-legacy-list.png`)});

  await page.click('[data-id="Khazad-dum"]');
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
    hint:(document.querySelector('.ng-form .small.muted:last-of-type')||{}).textContent||'',
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

  /* the base game must still be selectable in standalone mode */
  await page.click('[data-action="ngBack"]');
  await page.waitForTimeout(150);
  await page.click('.ng-tabs button[data-value="pod"]');
  await page.waitForTimeout(150);
  await page.click('[data-id="anduin"]');
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
