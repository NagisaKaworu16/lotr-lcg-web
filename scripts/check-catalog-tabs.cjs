/* Real-browser check for the four product tabs on the new-game screen. */
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
  const remote=[];
  page.on('request',r=>{const u=r.url();if(/^https?:/.test(u))remote.push(u);});
  await page.goto('file:///'+path.join(ROOT,'index.html').replace(/\\/g,'/'));
  await page.waitForTimeout(400);

  const tabs=await page.$$eval('.ng-tabs button',bs=>bs.map(b=>({label:b.textContent.trim(),active:b.classList.contains('active')})));
  report.push({width,tabs});
  if(JSON.stringify(tabs.map(t=>t.label))!==JSON.stringify(['新版扩展','旧版扩展','支线剧情','噩梦包']))
   report.push({width,error:'页签标签不符：'+JSON.stringify(tabs.map(t=>t.label))});

  for(const [name,val] of [['revised','revised'],['legacy','legacy'],['pod','pod'],['nightmare','nightmare']]){
   await page.click(`.ng-tabs button[data-value="${val}"]`);
   await page.waitForTimeout(250);
   /* lazy images only decode once near the viewport: force-eager, then wait for all of them. */
   await page.evaluate(async()=>{
    const imgs=[...document.querySelectorAll('.ng-card-art img')];
    imgs.forEach(i=>{i.loading='eager';i.scrollIntoView({block:'center'});});
    await Promise.all(imgs.map(i=>i.complete?null:new Promise(r=>{i.addEventListener('load',r,{once:true});i.addEventListener('error',r,{once:true});})));
    window.scrollTo(0,0);
   });
   await page.waitForTimeout(300);
   const info=await page.evaluate(()=>{
    const cards=[...document.querySelectorAll('.ng-card')];
    const broken=[...document.querySelectorAll('.ng-card-art img')].filter(i=>i.naturalWidth===0).map(i=>i.getAttribute('src'));
    return {
     chapters:[...document.querySelectorAll('.ng-chapter-head span:first-child')].map(s=>s.textContent.trim()),
     cards:cards.length,
     ready:document.querySelectorAll('.ng-ready-badge').length,
     locked:document.querySelectorAll('.ng-card.locked').length,
     community:document.querySelectorAll('.ng-community-badge').length,
     brokenImages:broken.length,
     brokenList:broken.slice(0,6),
     note:(document.querySelector('.newgame .small.muted')||{}).textContent||'',
     titles:cards.slice(0,4).map(c=>c.querySelector('h3').textContent.trim()),
     overflowX:document.documentElement.scrollWidth>document.documentElement.clientWidth,
    };
   });
   report.push({width,tab:name,...info});
   if(info.brokenImages)report.push({width,tab:name,error:`${info.brokenImages} 张封面未加载: `+JSON.stringify(info.brokenList||[])});
   if(info.overflowX)report.push({width,tab:name,error:'页面出现横向滚动'});
   await page.screenshot({path:path.join(OUT,`${width}-${name}.png`),fullPage:false});
  }
  report.push({width,remoteRequests:remote.length});
  await page.close();
 }
 await browser.close();
 const errors=report.filter(r=>r.error);
 fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));
 for(const r of report)console.log(JSON.stringify(r));
 console.log(errors.length?`FAILED ${errors.length}`:'OK');
 process.exit(errors.length?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
