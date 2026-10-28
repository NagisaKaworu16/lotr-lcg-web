/* 投入角色浮层回归（v0.15.80）：开→关→重开草稿保留（R4 分槽）、eligible 空「提交空名单」、
   重置只清草稿不动 deployments、C1 内联确认翻转、D 态零控件、手动切人收起不跟随、
   提交后自动交接自动弹出。与 planning-dom-tests.cjs 同一套假 DOM 环境：
   无浏览器、无布局引擎、无远程图片。 */
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function environment(){const dialogs=[],base=new Map;const attr=(s,k)=>new RegExp('(?:^|\\s)'+k+'="([^"]*)"').exec(s)?.[1];
 class El{constructor(tag='div'){this.tag=tag;this.nodes=[];this.style={};this.dataset={};this.classList={add(){},remove(){}};this.value='';this.disabled=false;this._html='';this.textContent='';}set innerHTML(v){this._html=v;this.nodes=[];for(const m of v.matchAll(/<(select|button|input|p|div)([^>]*)>(?:([\s\S]*?)<\/\1>)?/g)){const n=new El(m[1]),a=m[2];n.id=attr(a,'id');n.disabled=/\bdisabled\b/.test(a);for(const d of a.matchAll(/data-([a-z-]+)="([^"]*)"/g))n.dataset[d[1].replace(/-([a-z])/g,(_,x)=>x.toUpperCase())]=d[2];if(m[1]==='select'){const os=[...(m[3]||'').matchAll(/<option([^>]*)>/g)];n.value=attr((os.find(o=>/\bselected\b/.test(o[1]))||os[0]||[])[1]||'','value')||'';}else n.value=attr(a,'value')||'';this.nodes.push(n);}for(const m of v.matchAll(/<input([^>]*)>/g)){const a=m[1],n=new El('input');n.id=attr(a,'id');n.value=attr(a,'value')||'';n.checked=/\bchecked\b/.test(a);n.disabled=/\bdisabled\b/.test(a);for(const d of a.matchAll(/data-([a-z-]+)="([^"]*)"/g))n.dataset[d[1].replace(/-([a-z])/g,(_,x)=>x.toUpperCase())]=d[2];this.nodes.push(n);}for(const m of v.matchAll(/<(button|p|div|input)([^>]*)\bid="([^"]+)"([^>]*)>/g)){if(!this.nodes.some(x=>x.id===m[3])){const n=new El(m[1]);n.id=m[3];n.disabled=/\bdisabled\b/.test(m[2]+m[4]);this.nodes.push(n);}}}get innerHTML(){return this._html;}querySelector(s){return s.startsWith('#')?this.nodes.find(n=>n.id===s.slice(1))||null:null;}querySelectorAll(s){if(s==='img')return [];const key=/^\[data-([a-z-]+)\]$/.exec(s)?.[1]?.replace(/-([a-z])/g,(_,x)=>x.toUpperCase());return key?this.nodes.filter(n=>n.dataset[key]!==undefined):[];}showModal(){dialogs.push(this);}close(){}remove(){const i=dialogs.indexOf(this);if(i>=0)dialogs.splice(i,1);}addEventListener(){}click(){if(!this.disabled&&this.onclick)this.onclick();}}
 for(const id of ['app','toast','undo','export','import','tableTab','catalogTab','playersTab','imagesTab','helpTab']){let e=new El;e.id=id;base.set(id,e);}
 const document={querySelector:s=>base.get(s.slice(1))||base.get('app').querySelector(s),querySelectorAll:()=>[],createElement:t=>new El(t),body:{append(){}}};
 const ctx=vm.createContext({module:undefined,document,localStorage:{getItem:()=>null,setItem(){},removeItem(){}},setTimeout:()=>1,clearTimeout(){},console,Blob,URL,confirm:()=>true});
 for(const f of ['data.js','starter-decks.js','player-cards.js','ringsdb-snapshot.js','planning-engine.js','quest-engine.js','travel-engine.js','encounter-engine.js','combat-engine.js','refresh-engine.js','window-engine.js','phase-engine.js','engine.js','score-engine.js','player-ui.js','image-index.js','encounter-image-index.js','chinese-core-images.js','image-ui.js','planning-ui.js','quest-ui.js','travel-ui.js','encounter-ui.js','combat-ui.js','refresh-ui.js','window-ui.js','phase-log.js','desktop-ui.js','product-catalog.js','app.js'])vm.runInContext(fs.readFileSync(__dirname+'/'+f,'utf8'),ctx,{filename:f});
 const run=s=>vm.runInContext(s,ctx);const click=d=>run(`$('#app').onclick({target:{closest:()=>({dataset:${JSON.stringify(d)}})}})`);
 return {ctx,run,click,dialogs,base};
}
/* 两人局推进到探险 commit 步骤。pass 后先 render 一次（真实 UI 每步都会重绘，
   浮层的「进入 commit 自动弹出」判据依赖 prevStep=beforeCommit 的记录）。 */
async function commit2(e){e.run(`{const cfg=['leadership','spirit'].map(sp=>PlayerCards.config(PlayerCards.starter(RINGSDB_SNAPSHOT,sp),RINGSDB_SNAPSHOT));state=E.create('mirkwood',2,12345,cfg,{deferSetup:true});for(const p of state.players)E.openingChoice(state,p.id);E.startScenario(state);E.nextPhase(state);E.planning.endTurn(state,0);E.planning.endTurn(state,1);E.planning.passAction(state,0);E.planning.passAction(state,1);E.nextPhase(state);E.nextPhase(state);E.questing.pass(state,0);E.questing.pass(state,1);render();E.questing.move(state);handView=0;render();}`);}
/* 从渲染结果里截出浮层区域（触发按钮起）与浮层本体（quest-pick-panel）。 */
function pickRegion(e){const html=e.base.get('app').innerHTML;const i=html.indexOf('class="pick-trigger"');if(i<0)return null;const end=html.indexOf('</section>',i);return html.slice(i,end<0?undefined:end);}
function pickPanel(e){const r=pickRegion(e);if(!r)return null;const i=r.indexOf('id="quest-pick-panel"');return i<0?null:r.slice(i);}

test('overlay auto-opens on entering commit and shows trigger with draft badge',async()=>{const e=environment();await commit2(e);
 const html=e.base.get('app').innerHTML;
 assert(html.includes('class="pick-trigger"'),'进入 commit 应渲染触发按钮');
 assert(html.includes('aria-expanded="true"'),'进入 commit 且本人未提交应自动弹出');
 assert(pickPanel(e),'浮层应已打开');
 assert(html.includes('投入角色选择'),'浮层 role=region 标签');
 assert(pickRegion(e).includes('已选 0 名（意志 0）'),'触发按钮徽标初始为 0');
 assert(pickRegion(e).includes('提交空名单'),'空草稿时主按钮文案是「提交空名单」');
 assert(/class="primary" data-action="quest" data-quest="commit" data-player="0"[^>]*disabled/.test(pickRegion(e)),'空草稿且可选非空时提交按钮禁用');
 assert(html.includes('英雄')&&html.includes('盟友'),'缩略图按英雄/盟友分组');
 assert(html.includes('qp-view'),'缩略图保留「查看」角标');
 assert(/aria-label="[^"]*意志 \d+ 攻击 \d+ 防御 \d+ 生命 \d+[^"]*点击加入名单"/.test(html),'缩略图 aria-label 含数值与动作');
});

test('overlay close then reopen keeps the draft, and drafts are per-player slots (R4)',async()=>{const e=environment();await commit2(e);
 const uid0=e.run('state.players[0].heroStates[0].uid'),uid1=e.run('state.players[1].heroStates[0].uid');
 /* 浮层缩略图点击 = 点桌面卡（同走 DesktopUI.pick 草稿路径，R3 双向同步的一半） */
 await e.click({action:'desktop',desktop:'pick',uid:String(uid0)});
 assert.equal(e.run('QuestUI.draftFor(state,0).length'),1);
 assert(pickRegion(e).includes('已选 1 名'),'徽标应实时反映草稿');
 /* 关闭（纯视图）→ 重开：草稿保留 */
 await e.click({action:'quest',quest:'pickClose',player:'0'});
 assert.equal(pickPanel(e),null,'关闭后浮层节点消失');
 assert(e.base.get('app').innerHTML.includes('aria-expanded="false"'),'触发按钮 aria-expanded 同步');
 assert.equal(e.run('QuestUI.draftFor(state,0).length'),1,'关闭不丢草稿');
 await e.click({action:'quest',quest:'pickToggle',player:'0'});
 assert(pickPanel(e),'重开浮层');
 assert(pickRegion(e).includes('已选 1 名'),'重开后草稿仍在');
 /* 切到玩家1：浮层收起不跟随；玩家1 勾自己的；切回玩家0：玩家0 草稿分槽保留 */
 await e.click({action:'desktop',desktop:'view',player:'1'});
 assert.equal(pickPanel(e),null,'手动切人应收起浮层');
 assert(pickRegion(e).includes('aria-expanded="false"')&&!pickRegion(e).includes('aria-expanded="true"'),'切人不自动弹：触发按钮 aria-expanded=false');
 await e.click({action:'desktop',desktop:'pick',uid:String(uid1)});
 assert.equal(e.run('QuestUI.draftFor(state,1).length'),1);
 assert.equal(e.run('QuestUI.draftFor(state,0).length'),1,'玩家0 的草稿不因切人被重置（R4 分槽）');
 await e.click({action:'desktop',desktop:'view',player:'0'});
 assert.equal(e.run('QuestUI.draftFor(state,0)[0]'),uid0);
});

test('eligible empty renders an enabled 提交空名单 primary inside the overlay',async()=>{const e=environment();await commit2(e);
 /* 把玩家0 的所有角色横置：eligible 变空。引擎允许 0 名派遣，按钮必须保持可用（禁了会死锁）。 */
 e.run('state.players[0].heroStates.forEach(h=>h.exhausted=true);state.players[0].allies.forEach(a=>a.exhausted=true);render();');
 const pick=pickRegion(e);
 assert(pick,'浮层仍应可用');
 assert(pick.includes('提交空名单'),'文案为提交空名单');
 assert(!/data-quest="commit" data-player="0"[^>]*disabled/.test(pick),'eligible 为空时提交按钮必须可用');
 assert(pick.includes('暂定意志 0'),'R2 暂定意志合计');
 /* 已横置角色渲染但禁点标记（aria-disabled），且带「已横置」旗标 */
 assert(pick.includes('已横置'),'已横置角色应有旗标');
 assert(pick.includes('aria-disabled="true"'),'禁点卡应带 aria-disabled');
 /* 走通：提交空名单 → deployments[0].confirmed = true */
 const action=e.click({action:'quest',quest:'commit',player:'0'});
 e.dialogs.at(-1).querySelector('#ok').click();await action;
 assert(e.run('state.questing.deployments[0].confirmed'));
});

test('overlay reset clears only the draft and never touches deployments or history',async()=>{const e=environment();await commit2(e);
 const uid=e.run('state.players[0].heroStates[0].uid');
 await e.click({action:'desktop',desktop:'pick',uid:String(uid)});
 const before=e.run('JSON.stringify(state)'),count=e.run('history.length');
 await e.click({action:'quest',quest:'clear',player:'0'});
 assert.equal(e.run('QuestUI.draftFor(state,0).length'),0,'重置应清空当前操作者草稿');
 assert.equal(e.run('JSON.stringify(state)'),before,'重置不得改动任何对局状态（deployments 不动）');
 assert.equal(e.run('history.length'),count,'重置是纯 UI 操作，不入撤销历史');
 assert(pickRegion(e).includes('已选 0 名'),'徽标归零');
 assert(/data-quest="clear" data-player="0"[^>]*disabled/.test(pickRegion(e)),'草稿空时重置按钮禁用');
 assert(e.base.get('app').innerHTML.includes('aria-label="清空选择（重置当前名单草稿）"'),'aria-label 保留「清空选择」兼容脚本');
});

test('C1 inline confirm bar flips inside the overlay before the real approval',async()=>{const e=environment();await commit2(e);
 for(const p of [0,1]){const action=e.click({action:'quest',quest:'commit',player:String(p)});e.dialogs.at(-1).querySelector('#ok').click();await action;e.run('handView=0;render();');}
 assert.equal(e.run('QuestUI.stateOf(state,0)'),'C1');
 assert.equal(e.run('(state.questing.deploymentApprovals||[]).length'),0);
 /* 打开浮层，点浮层内的「确认派遣」：第一次点击只翻转内联确认条，不产生任何确认 */
 await e.click({action:'quest',quest:'pickToggle',player:'0'});
 const before=e.run('JSON.stringify(state)');
 await e.run(`QuestUI.handle({dataset:{action:'quest',quest:'pickApprove',player:'0'}})`);
 assert(e.base.get('app').innerHTML.includes('就是现在'),'应翻转出内联确认条');
 assert(e.base.get('app').innerHTML.includes('确认后尚未横置，全员确认后才执行；可随时取消确认。'));
 assert(e.base.get('app').innerHTML.includes('再想想'));
 assert.equal(e.run('JSON.stringify(state)'),before,'翻转确认条不得改动状态');
 assert.equal(e.run('(state.questing.deploymentApprovals||[]).length'),0);
 /* 「就是现在」（同为 data-quest="approveDeployment"）才真正确认；确认后操作权
    自动交接给玩家1，浮层应对玩家1 自动弹出（仍处 C1） */
 await e.click({action:'quest',quest:'approveDeployment',player:'0'});
 assert.equal(e.run('(state.questing.deploymentApprovals||[]).length'),1,'确认条翻转后点「就是现在」完成确认');
 assert.equal(e.run('handView'),1,'确认后操作权自动交接');
 assert(pickPanel(e),'交接后浮层对下一位自动弹出');
 /* 浮层内的「确认派遣」先翻转确认条；「再想想」收起，不产生确认 */
 await e.run(`QuestUI.handle({dataset:{action:'quest',quest:'pickApprove',player:'1'}})`);
 assert(e.base.get('app').innerHTML.includes('再想想'));
 await e.run(`QuestUI.handle({dataset:{action:'quest',quest:'pickDismiss',player:'1'}})`);
 assert(!e.base.get('app').innerHTML.includes('再想想'),'再想想应收起确认条');
 assert.equal(e.run('(state.questing.deploymentApprovals||[]).length'),1,'收起确认条不产生确认');
});

test('locked (D) state renders zero pick controls and trigger disappears',async()=>{const e=environment();await commit2(e);
 for(const p of [0,1]){const action=e.click({action:'quest',quest:'commit',player:String(p)});e.dialogs.at(-1).querySelector('#ok').click();await action;e.run('handView=0;render();');}
 /* 确认走 handle 直调（不模拟浮层内点击）：与内联面板按钮同路径 */
 for(const p of [0,1])await e.run(`QuestUI.handle({dataset:{action:'quest',quest:'approveDeployment',player:'${p}'}})`);
 assert(e.run('state.questing.deploymentLocked'));
 const html=e.base.get('app').innerHTML;
 assert(!html.includes('pick-trigger'),'D 态触发按钮隐藏');
 assert(!html.includes('quest-pick'),'D 态浮层不渲染');
 assert(!html.includes('data-quest="pickToggle"'),'D 态零浮层控件');
});

test('auto handover after submit opens the overlay for the next uncommitted player',async()=>{const e=environment();await commit2(e);
 /* 玩家0 提交后自动交接：handView 切到玩家1，浮层应对下一位自动弹出（草稿态） */
 await e.click({action:'desktop',desktop:'pick',uid:String(e.run('state.players[0].heroStates[0].uid'))});
 const action=e.click({action:'quest',quest:'commit',player:'0'});
 e.dialogs.at(-1).querySelector('#ok').click();await action;
 assert.equal(e.run('handView'),1,'操作权应自动交接');
 assert.equal(e.run('state.questing.deployments[0].confirmed'),true);
 assert(pickRegion(e).includes('aria-expanded="true"'),'交接后浮层对下一位自动弹出');
 assert(pickRegion(e).includes('已选 0 名'),'下一位的草稿从零开始');
});
