/* 竖轴截图：开局后抓右栏日志面板，输出到 /workspace/shots。 */
const path=require('path'),fs=require('fs');
const {chromium}=require('playwright-core');
const ROOT=path.dirname(__dirname);
const CHROME=['/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome'].find(p=>fs.existsSync(p));
const FILE='file:///'+path.join(ROOT,'index.html').replace(/\\/g,'/');
(async()=>{
 const b=await chromium.launch({executablePath:CHROME,args:['--no-sandbox','--disable-dev-shm-usage']});
 const p=await b.newPage({viewport:{width:1440,height:900}});
 const errs=[];p.on('pageerror',e=>errs.push(String(e)));
 await p.goto(FILE,{waitUntil:'load',timeout:60000});
 await p.evaluate(()=>localStorage.clear());
 await p.reload({waitUntil:'load'});
 await p.waitForTimeout(600);
 /* 走正式开局流程：选人数 → 新版扩展 → 基础剧本合集 → 下一步 → 确认 → 保留起手 → 完成设置 */
 await p.selectOption('#playerCount','2');
 await p.locator('.ng-tabs button',{hasText:'新版扩展'}).click(); await p.waitForTimeout(250);
 await p.locator('.ng-card',{hasText:'基础剧本合集'}).first().click(); await p.waitForTimeout(300);
 await p.locator('[data-action="ngNext"]').click(); await p.waitForTimeout(300);
 await p.locator('[data-action="chooserConfirm"]').click(); await p.waitForTimeout(700);
 for(const x of await p.locator('button[data-action="keepHand"]').all())await x.click();
 {const fin=p.locator('button[data-action="finishSetup"]');if(await fin.count())await fin.click();};
 await p.waitForTimeout(800);
 const info=await p.evaluate(()=>{
  const rail=document.querySelector('.phase-rail-v'),hit=document.querySelector('.rail-win.hit');
  const r=rail?.getBoundingClientRect();
  return {phase:(window.APP_STATE&&APP_STATE().phase)??null,
   railW:r?+r.width.toFixed(1):0,railH:r?+r.height.toFixed(1):0,
   railScroll:rail?rail.scrollHeight:0,
   hit:hit?hit.querySelector('.rail-win-no').textContent:null,
   heads:[...document.querySelectorAll('.rail-head>span')].map(x=>x.textContent),
   winCount:document.querySelectorAll('.rail-win').length,
   logCount:document.querySelectorAll('.log-entry').length,
   railBox:(()=>{const b=document.querySelector('.tabletop-rail')?.getBoundingClientRect();return b?{y:+b.y.toFixed(0),h:+b.height.toFixed(0)}:null})(),
   logBox:(()=>{const b=document.querySelector('.table-log')?.getBoundingClientRect();return b?{y:+b.y.toFixed(0),h:+b.height.toFixed(0)}:null})(),
   deckBox:(()=>{const b=document.querySelector('.deck-rail')?.getBoundingClientRect();return b?{y:+b.y.toFixed(0),h:+b.height.toFixed(0)}:null})(),
   dockBox:(()=>{const b=document.querySelector('.operation-dock')?.getBoundingClientRect();return b?{y:+b.y.toFixed(0),h:+b.height.toFixed(0)}:null})(),
   vh:innerHeight,
   railW2:(()=>{const b=document.querySelector('.tabletop-rail')?.getBoundingClientRect();return b?+b.width.toFixed(1):0})(),
   contentW:(()=>{const b=document.querySelector('.rail-content')?.getBoundingClientRect();return b?+b.width.toFixed(1):0})(),
   logW:(()=>{const b=document.querySelector('.table-log')?.getBoundingClientRect();return b?+b.width.toFixed(1):0})(),
   streamW:(()=>{const b=document.querySelector('.log-stream')?.getBoundingClientRect();return b?+b.width.toFixed(1):0})(),
   layoutCols:getComputedStyle(document.querySelector('.tabletop-layout')).gridTemplateColumns};
 });
 await p.screenshot({path:'/workspace/shots/60-rail-full.png'});
 const box=await p.evaluate(()=>{const r=document.querySelector('.tabletop-rail>.phase-rail-v')?.getBoundingClientRect();return r?{x:r.x,y:r.y,w:r.width,h:r.height}:null;});
 if(box)await p.screenshot({path:'/workspace/shots/61-rail-zoom.png',clip:{x:Math.max(0,box.x-2),y:Math.max(0,box.y-2),width:Math.min(box.w+4,1200),height:box.h+4,scale:3}});
 console.log(JSON.stringify({...info,errors:errs.slice(0,3)},null,1));
 await b.close();
})();
