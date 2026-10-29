const {chromium}=require('playwright-core');const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');const CHROME='C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await chromium.launch({executablePath:CHROME,headless:true,args:['--no-sandbox']});
for(const vp of [{w:1366,h:768},{w:1280,h:800}]){const p=await(await b.newContext({viewport:{width:vp.w,height:vp.h}})).newPage();
await p.goto('file:///'+path.join(ROOT,'index.html').replace(/\\/g,'/'));await sleep(400);
await p.selectOption('#playerCount','4');await sleep(150);
await p.locator('.ng-tabs button',{hasText:'新版扩展'}).click();await sleep(220);
await p.locator('.ng-card',{hasText:'基础剧本合集'}).first().click();await sleep(280);
await p.locator('[data-action="ngNext"]').click();await sleep(280);
await p.locator('[data-action="chooserConfirm"]').click();await sleep(600);
for(const x of await p.locator('button[data-action="keepHand"]').all())await x.click();
{const f=p.locator('button[data-action="finishSetup"]');if(await f.count())await f.click();}
await sleep(700);
await p.evaluate(()=>{const t=document.querySelector('.draw-toast');if(t)t.remove();});
await sleep(200);
const g=await p.evaluate(()=>{const R=s=>{const e=document.querySelector(s);if(!e)return null;const b=e.getBoundingClientRect();return {x:+b.x.toFixed(0),w:+b.width.toFixed(0),right:+b.right.toFixed(0),h:+b.height.toFixed(0)}};
return{header:R('header'),hud:R('#gameHud'),tabs:R('#gameHud .player-tabs'),reset:R('#gameHud button[data-desktop=reset]'),actions:R('.header-actions'),hw:R('.history-nav'),overflowX:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,scrollW:document.documentElement.scrollWidth}});
console.log(vp.w,JSON.stringify(g));
await p.screenshot({path:path.join(ROOT,'docs/browser-acceptance/_hudprobe',vp.w+'-4p.png')});
await p.context().close();}
await b.close();})().catch(e=>{console.error(e.message);process.exit(2)});
