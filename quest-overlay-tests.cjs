/* 决策浮层回归（v0.15.81）：全部阶段的决策面板 =「一行触发条 + 非模态浮层」。
   覆盖：自动打开与触发条 hint、开→关→重开草稿保留（R4 分槽）、eligible 空「提交空名单」、
   重置只清草稿、C1 单颗确认→C2 翻转、D 态零派遣控件、纯资讯判据、Esc 关闭且 dialog 打开时让位、
   dialog 内 pointerdown 不误关、最后提交者进 C1 自动弹出、手动关闭后同 key 不再自动打开。
   与 planning-dom-tests.cjs 同一套假 DOM 环境：无浏览器、无布局引擎、无远程图片。 */
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
/* 两人局推进到探险 commit 步骤。move 之后 render 一次（真实 UI 每步都会重绘，
   浮层的 key 判据依赖「进入 commit」这一次重绘）。 */
async function commit2(e){e.run(`{const cfg=['leadership','spirit'].map(sp=>PlayerCards.config(PlayerCards.starter(RINGSDB_SNAPSHOT,sp),RINGSDB_SNAPSHOT));state=E.create('mirkwood',2,12345,cfg,{deferSetup:true});for(const p of state.players)E.openingChoice(state,p.id);E.startScenario(state);E.nextPhase(state);E.planning.endTurn(state,0);E.planning.endTurn(state,1);E.planning.passAction(state,0);E.planning.passAction(state,1);E.nextPhase(state);E.nextPhase(state);E.questing.pass(state,0);E.questing.pass(state,1);render();E.questing.move(state);handView=0;render();}`);}
const html=e=>e.base.get('app').innerHTML;
/* 触发条（一行）与浮层（.decide-pop）分开取：它们是两个独立的存在，验收也分开断言。 */
function trigger(e){const h=html(e),i=h.indexOf('class="decide-trigger"');if(i<0)return null;return h.slice(i,h.indexOf('</button>',i));}
function pop(e){const h=html(e),i=h.indexOf('id="decide-pop"');return i<0?null:h.slice(i);}
const box=e=>{const h=html(e),i=h.indexOf('class="decide-box"');return i<0?null:h.slice(i);};
const toggle=async e=>{await e.click({action:'decide',decide:'toggle'});};

test('entering commit auto-opens the pop; the trigger stays a single 40px line with the draft hint',async()=>{
 const e=environment();await commit2(e);
 const t=trigger(e);
 assert(t,'进入 commit 应渲染一行触发条');
 assert(t.includes('aria-expanded="true"'),'有可点控件时应自动弹出（aria-expanded=true）');
 assert(t.includes('data-tone="todo"'),'有待办 → 状态圆点是金色（todo）');
 assert(t.includes('探险阶段 · 派遣名单'),'标题沿用 pending() 的 title');
 assert(t.includes('已选 0 名（意志 0）'),'原 .pick-badge 的「已选 N 名（意志 X）」搬到触发条 hint 区');
 assert(!html(e).includes('pick-trigger'),'不再有第二条触发条（.pick-trigger 已退役）');
 const p=pop(e);
 assert(p,'浮层应已打开');
 assert(p.includes('class="decide-head"')&&p.includes('class="decide-close"'),'浮层头含 h2 标题与 × 关闭按钮');
 assert(p.includes('class="decide-body"'),'类名 .decide-body 必须保留（多个验收脚本与既有测试依赖）');
 assert(p.includes('class="pick-panel"'),'commit 步骤：选人网格内联进浮层体');
 assert(p.indexOf('class="pick-panel"')<p.indexOf('class="quest-deploy"'),'选人网格排在 deploySection 之前（先选人，再看名单与主操作）');
 assert(p.includes('英雄')&&p.includes('盟友'),'缩略图按英雄/盟友分组');
 assert(p.includes('qp-view'),'缩略图保留「查看」角标');
 assert(/aria-label="[^"]*意志 \d+ 攻击 \d+ 防御 \d+ 生命 \d+[^"]*点击加入名单"/.test(p),'缩略图 aria-label 含数值与动作');
 /* 一扇窗只装一件决策：浮层里不得再出现第二个浮层容器 */
 assert.equal((html(e).match(/id="decide-pop"/g)||[]).length,1,'同一时刻只允许一个浮层');
});

test('close then reopen keeps the draft; drafts are per-player slots (R4)',async()=>{
 const e=environment();await commit2(e);
 const uid0=e.run('state.players[0].heroStates[0].uid'),uid1=e.run('state.players[1].heroStates[0].uid');
 await e.click({action:'desktop',desktop:'pick',uid:String(uid0)});
 assert.equal(e.run('QuestUI.draftFor(state,0).length'),1);
 assert(trigger(e).includes('已选 1 名'),'触发条徽标实时反映草稿');
 /* 关闭（纯视图）→ 重开：草稿保留 */
 await e.click({action:'decide',decide:'close'});
 assert.equal(pop(e),null,'关闭后浮层节点消失');
 assert(trigger(e).includes('aria-expanded="false"'),'触发条 aria-expanded 同步');
 assert.equal(e.run('QuestUI.draftFor(state,0).length'),1,'关闭不丢草稿');
 await toggle(e);
 assert(pop(e),'重开浮层');
 assert(trigger(e).includes('已选 1 名'),'重开后草稿仍在');
 /* 切到玩家1：新操作者是新的决策上下文 → 浮层自动打开（key 变化） */
 await e.click({action:'desktop',desktop:'view',player:'1'});
 assert(pop(e),'切人后对新操作者自动弹出');
 assert(trigger(e).includes('已选 0 名'),'玩家1 的草稿从零开始（R4 分槽）');
 await e.click({action:'desktop',desktop:'pick',uid:String(uid1)});
 assert.equal(e.run('QuestUI.draftFor(state,1).length'),1);
 assert.equal(e.run('QuestUI.draftFor(state,0).length'),1,'玩家0 的草稿不因切人被重置（R4 分槽）');
 await e.click({action:'desktop',desktop:'view',player:'0'});
 assert.equal(e.run('QuestUI.draftFor(state,0)[0]'),uid0);
 assert(trigger(e).includes('已选 1 名'),'切回玩家0：分槽草稿原样恢复');
});

test('eligible empty keeps an enabled 提交空名单 inside the pop',async()=>{
 const e=environment();await commit2(e);
 /* 把玩家0 的所有角色横置：eligible 变空。引擎允许 0 名派遣，按钮必须保持可用（禁了会死锁）。 */
 e.run('state.players[0].heroStates.forEach(h=>h.exhausted=true);state.players[0].allies.forEach(a=>a.exhausted=true);render();');
 const p=pop(e);
 assert(p,'浮层仍应可用');
 assert(p.includes('提交空名单'),'文案为提交空名单');
 assert(!/data-quest="commit" data-player="0"[^>]*disabled/.test(p),'eligible 为空时提交按钮必须可用');
 assert(/<span class="r0-label">暂定<\/span><span class="r0-num">0 名 · 意志 0<\/span>/.test(p),'R0 合计（浮层里唯一的合计口径）');
 assert(p.includes('已横置'),'已横置角色应有旗标');
 assert(p.includes('aria-disabled="true"'),'禁点卡应带 aria-disabled');
 /* 走通：提交空名单 → deployments[0].confirmed = true */
 const action=e.click({action:'quest',quest:'commit',player:'0'});
 e.dialogs.at(-1).querySelector('#ok').click();await action;
 assert(e.run('state.questing.deployments[0].confirmed'));
});

test('重置选择 clears only the draft and never touches deployments or history',async()=>{
 const e=environment();await commit2(e);
 const uid=e.run('state.players[0].heroStates[0].uid');
 await e.click({action:'desktop',desktop:'pick',uid:String(uid)});
 const before=e.run('JSON.stringify(state)'),count=e.run('history.length');
 assert(!/data-quest="clear"[^>]*disabled/.test(pop(e)),'有草稿时重置可用');
 await e.click({action:'quest',quest:'clear',player:'0'});
 assert.equal(e.run('QuestUI.draftFor(state,0).length'),0,'重置应清空当前操作者草稿');
 assert.equal(e.run('JSON.stringify(state)'),before,'重置不得改动任何对局状态（deployments 不动）');
 assert.equal(e.run('history.length'),count,'重置是纯 UI 操作，不入撤销历史');
 assert(trigger(e).includes('已选 0 名'),'触发条徽标归零');
 assert(/data-quest="clear" data-player="0"[^>]*disabled/.test(pop(e)),'草稿空时重置按钮禁用');
 assert(html(e).includes('aria-label="清空选择（重置当前名单草稿）"'),'aria-label 保留「清空选择」兼容脚本');
});

test('C1 keeps exactly one 确认派遣 and flips to C2 after the click',async()=>{
 const e=environment();await commit2(e);
 for(const p of [0,1]){const action=e.click({action:'quest',quest:'commit',player:String(p)});e.dialogs.at(-1).querySelector('#ok').click();await action;e.run('handView=0;render();');}
 assert.equal(e.run('QuestUI.stateOf(state,0)'),'C1');
 assert.equal(e.run('(state.questing.deploymentApprovals||[]).length'),0);
 assert(pop(e),'最后提交者进入 C1 后浮层自动打开');
 const h=html(e);
 /* 去重：R2 的「确认派遣」是唯一一颗；v0.15.80 浮层脚部那颗 pickApprove 已退役 */
 assert.equal((h.match(/data-quest="approveDeployment"/g)||[]).length,1,'C1 全页只允许一颗【确认派遣】');
 assert(!h.includes('data-quest="pickApprove"')&&!h.includes('data-quest="pickDismiss"'),'两步内联确认退役，不再有两颗同义绿按钮');
 assert(!h.includes('data-quest="commit"'),'C 态不应再出现提交按钮');
 assert(h.includes('data-quest="withdraw"'),'C1 也要留一条改名单的路');
 const row=(h.match(/<div class="quest-main-action">[\s\S]*?<\/div>/)||[''])[0];
 assert.equal((row.match(/class="primary"/g)||[]).length,1,'主操作行只能有一颗 primary');
 assert(pop(e).includes('确认后尚未横置，全员确认后才执行；可随时取消确认。'),'防误触说明改由 .pick-note 静态文案承担');
 assert(pop(e).includes('pick-grid')&&pop(e).includes('aria-disabled="true"'),'C1 的缩略图退成只读（aria-disabled）供复核名单');
 /* 点击确认：状态真变，控件翻转到 C2 的「取消确认」 */
 await e.click({action:'quest',quest:'approveDeployment',player:'0'});
 assert.equal(e.run('(state.questing.deploymentApprovals||[]).length'),1,'点击后完成一次确认');
 assert.equal(e.run('handView'),1,'确认后操作权自动交接');
 assert.equal(e.run('QuestUI.stateOf(state,1)'),'C1');
 await e.run('handView=0;render();');
 const mid=html(e);
 assert(mid.includes('data-quest="unapproveDeployment"'),'本人已确认 → C2 的「取消确认」');
 assert(!mid.includes('data-quest="approveDeployment"'),'C2 不再给确认按钮');
});

test('locked (D) state drops every dispatch control and the pick grid',async()=>{
 const e=environment();await commit2(e);
 e.run('QuestUI.setDraft(state,0,[state.players[0].heroStates[0].uid]);render();');
 for(const p of [0,1]){const action=e.click({action:'quest',quest:'commit',player:String(p)});e.dialogs.at(-1).querySelector('#ok').click();await action;e.run('handView=0;render();');}
 for(const p of [0,1])await e.run(`QuestUI.handle({dataset:{action:'quest',quest:'approveDeployment',player:'${p}'}})`);
 assert(e.run('state.questing.deploymentLocked'));
 e.run('handView=0;render();');
 const h=html(e);
 assert(h.includes('class="decide-box"'),'D 态仍保留一行触发条（只读也要能查规则）');
 assert(!h.includes('class="pick-panel"'),'D 态不渲染选人网格');
 assert(!h.includes('data-quest="commit"')&&!h.includes('data-quest="approveDeployment"')&&!h.includes('data-quest="withdraw"'),'D 态零派遣控件');
 assert(!h.includes('data-quest="clear"'),'D 态也不再给「重置选择」');
 /* 手动打开仍可读只读面板：D 的只读状态卡不会把自己锁死 */
 if(!pop(e))await toggle(e);
 assert(pop(e).includes('class="quest-deploy" data-state="D"'),'D 态面板可展开查看');
 assert(pop(e).includes('实际'),'D 态前缀写「实际」');
});

test('pure-info bodies do not count as actionable (auto-collapse predicate)',async()=>{
 const e=environment();await commit2(e);
 assert.equal(e.run('DecisionUI.actionable(\'<button class="primary">提交名单</button>\')'),true,'可点按钮 = 有需要玩家做的事');
 assert.equal(e.run('DecisionUI.actionable(\'<button disabled>提交名单</button>\')'),false,'全部 disabled = 没有要做的事');
 assert.equal(e.run('DecisionUI.actionable(\'<p>引擎正在按顺序横置角色</p>\')'),false,'纯资讯没有按钮');
 assert.equal(e.run('DecisionUI.actionable(\'<button aria-disabled="true">卡</button>\')'),true,'缩略图的 aria-disabled 不算 disabled（它只是「这张卡此刻不能选」）');
});

test('Esc closes the pop, and yields to an open dialog',async()=>{
 const e=environment();await commit2(e);
 assert(pop(e),'前置：浮层已自动打开');
 const closed=e.run(`DecisionUI.escClose({key:'Escape'})`);
 assert.equal(closed,true,'Esc 应关闭浮层');
 assert.equal(pop(e),null,'Esc 后浮层节点消失');
 assert(trigger(e).includes('aria-expanded="false"'),'Esc 后 aria-expanded=false');
 await toggle(e);
 assert(pop(e),'重开');
 assert.equal(e.run(`DecisionUI.escClose({key:'Enter'})`),false,'非 Esc 键不处理');
 assert(pop(e),'浮层仍在');
 /* 有内层 dialog 时让 dialog 自己处理 Esc：浮层原样保留 */
 e.run(`document.__q=document.querySelector;document.querySelector=s=>s==='dialog[open]'?{tag:'dialog'}:(document.__q?s===undefined?null:document.__q(s):null)`);
 assert.equal(e.run(`DecisionUI.escClose({key:'Escape'})`),false,'dialog 打开时 Esc 不关浮层');
 assert(pop(e),'dialog 打开时浮层保留');
 e.run('document.querySelector=document.__q;delete document.__q');
 assert.equal(e.run(`DecisionUI.escClose({key:'Escape'})`),true,'dialog 关闭后 Esc 恢复生效');
 assert.equal(pop(e),null);
});

test('pointerdown inside a modal dialog must not close the pop',async()=>{
 const e=environment();await commit2(e);
 assert(pop(e),'前置：浮层已打开');
 /* 假 DOM 的 querySelector 只认 #id，这里给浮层/触发条装桩，使 outsidePointer 走真实分支 */
 e.run(`document.__q=document.querySelector;
  document.querySelector=s=>s==='id="decide-pop"'||s==='.decide-pop'?{contains:t=>!!(t&&t.inPop),remove(){}}
   :s==='.decide-trigger'?{contains:t=>!!(t&&t.inTrig),setAttribute(){}}
   :document.__q(s);`);
 e.run(`document.__q2=document.querySelector;document.querySelector=s=>s==='dialog[open]'?{tag:'dialog'}:document.__q2(s)`);
 assert.equal(e.run(`DecisionUI.outsidePointer({target:{inDialog:true}})`),false,'dialog 打开时的 pointerdown 不算点外部');
 assert(pop(e),'浮层在复核弹窗期间保持打开');
 /* dialog 关闭后，真正点外部才收起（只摘节点，不 render —— 免得吞掉同一次点击） */
 e.run(`document.querySelector=s=>s==='.decide-pop'?{contains:t=>!!(t&&t.inPop),remove(){}}:s==='.decide-trigger'?{contains:()=>false,setAttribute(){}}:document.__q(s)`);
 assert.equal(e.run(`DecisionUI.outsidePointer({target:{}})`)===true,true,'dialog 关闭后点外部应收起');
 e.run('render()');
 assert.equal(pop(e),null,'收起后重绘即离场');
 /* 浮层内部的点击不关 */
 await toggle(e);
 assert(e.run(`DecisionUI.outsidePointer({target:{inPop:true}})`)===false,true,'浮层内部点击不关闭');
 e.run('document.querySelector=document.__q;delete document.__q;delete document.__q2');
});

test('last submitter entering C1 re-opens the pop (key changed, same actor)',async()=>{
 const e=environment();await commit2(e);
 const a1=e.click({action:'quest',quest:'commit',player:'0'});
 e.dialogs.at(-1).querySelector('#ok').click();await a1;
 assert.equal(e.run('handView'),1,'先手交接');
 await e.click({action:'decide',decide:'close'});
 assert.equal(pop(e),null,'手动收起');
 const a2=e.click({action:'quest',quest:'commit',player:'1'});
 e.dialogs.at(-1).querySelector('#ok').click();await a2;
 assert.equal(e.run('QuestUI.stateOf(state,1)'),'C1','最后提交者进入 C1');
 assert.equal(e.run('handView'),1,'最后提交者无交接，视图不动');
 assert(pop(e),'key 变化（A→C1）→ 自动重新弹出');
 assert(trigger(e).includes('aria-expanded="true"'));
 assert(pop(e).includes('确认派遣'),'C1 的主操作是确认派遣');
});

test('after a manual close the same key stays closed — a draft click must not re-open it',async()=>{
 const e=environment();await commit2(e);
 await e.click({action:'decide',decide:'close'});
 assert.equal(pop(e),null,'手动关闭');
 const uid=e.run('state.players[0].heroStates[0].uid');
 /* 在桌面上点角色卡：草稿变了，但决策没变 —— key 的哈希已抹掉草稿片段，浮层不许弹回来 */
 await e.click({action:'desktop',desktop:'pick',uid:String(uid)});
 assert.equal(pop(e),null,'草稿变化不算新决策：浮层保持关闭（否则会盖住下一张要点卡）');
 assert.equal(e.run('QuestUI.draftFor(state,0).length'),1,'草稿照常记下');
 assert(trigger(e).includes('已选 1 名'),'触发条 hint 仍随草稿更新');
 /* 真正的状态变化（提交名单）才换 key → 重新自动打开 */
 const action=e.click({action:'quest',quest:'commit',player:'0'});
 e.dialogs.at(-1).querySelector('#ok').click();await action;
 assert(pop(e),'提交后进入新决策（下一位的草稿态）→ 自动弹出');
});
