/* 「放弃本窗口行动」合并回归（v0.15.82）：
   主推进按钮（开始投入角色／继续战斗／结算刷新…）点一下 = 全队视为放弃本窗口 + 推进，
   不再要求玩家先逐个点「X：放弃本窗口行动」。
   覆盖：探险 beforeCommit 一次点击进派遣、有暂定行动时仍禁用、passWindow 跨阶段生效、
   窗口关着的 framework 步骤（afterStaging）也能记让过。
   与 quest-overlay-tests.cjs 同一套假 DOM 环境：无浏览器、无布局引擎、无远程图片。 */
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
/* 两人局推进到探险阶段起点（step=beforeCommit，没人放弃过窗口）。 */
function beforeCommit2(e){e.run(`{const cfg=['leadership','spirit'].map(sp=>PlayerCards.config(PlayerCards.starter(RINGSDB_SNAPSHOT,sp),RINGSDB_SNAPSHOT));state=E.create('mirkwood',2,12345,cfg,{deferSetup:true});for(const p of state.players)E.openingChoice(state,p.id);E.startScenario(state);E.nextPhase(state);E.planning.endTurn(state,0);E.planning.endTurn(state,1);E.planning.passAction(state,0);E.planning.passAction(state,1);E.nextPhase(state);E.nextPhase(state);render();}`);}
const html=e=>e.base.get('app').innerHTML;
const moveTag=e=>/<button[^>]*data-quest="move"[^>]*>/.exec(html(e));

test('beforeCommit: the main button advances to commit in one click, without pre-passing',async()=>{
 const e=environment();beforeCommit2(e);
 assert.equal(e.run('state.phase'),2);
 assert.equal(e.run('state.questing.step'),'beforeCommit');
 assert.equal(e.run('state.questing.finalPasses.length'),0,'起点：还没有人放弃窗口');
 const tag=moveTag(e);
 assert(tag,'投入前窗口应有主推进按钮');
 assert(!/\bdisabled\b/.test(tag[0]),'未全员放弃时主按钮也必须可点——点它就等于全队放弃');
 await e.click({action:'quest',quest:'move'});
 assert.equal(e.run('state.questing.step'),'commit','一次点击即进入派遣名单');
});

test('a pending planned action still blocks the main button (and passWindow refuses)',async()=>{
 const e=environment();beforeCommit2(e);
 e.run("state.questing.plannedActions=[{id:999,kind:'play',player:0,uid:0,params:{}}];render();");
 const tag=moveTag(e);
 assert(tag,'按钮仍应渲染');
 assert(/\bdisabled\b/.test(tag[0]),'有暂定行动未确认／撤销 → 主按钮必须禁用');
 assert.equal(e.run('E.passWindow(state)'),false,'passWindow 不替玩家跨过待确认的暂定行动');
 assert.equal(e.run('state.questing.finalPasses.length'),0,'没有偷偷记让过');
});

test('passWindow records every live player as passed in any phase window',async()=>{
 const e=environment();beforeCommit2(e);
 assert.equal(e.run('E.passWindow(state)'),true);
 assert.equal(e.run('state.questing.finalPasses.join(",")'),'0,1','探险：两名玩家都记为已让过');
 /* 战斗阶段：同一颗主按钮（关闭行动窗口／结算战斗阶段结束）走的是同一套让过逻辑 */
 e.run("state.phase=5;state.combat={round:state.round,step:'playerAction',order:[0,1],finalPasses:[],plannedActions:[],tasks:[],queue:[],completed:false};");
 assert.equal(e.run('E.passWindow(state)'),true);
 assert.equal(e.run('state.combat.finalPasses.join(",")'),'0,1','战斗：同样补齐全员让过');
 /* 刷新阶段 */
 e.run("state.phase=6;state.refreshing={round:state.round,step:'action',order:[0,1],finalPasses:[],plannedActions:[],tasks:[],queue:[],completed:false};");
 assert.equal(e.run('E.passWindow(state)'),true);
 assert.equal(e.run('state.refreshing.finalPasses.join(",")'),'0,1','刷新：同样补齐全员让过');
});

test('passWindow also covers a closed framework step (afterStaging) so move can finish',async()=>{
 const e=environment();beforeCommit2(e);
 /* afterStaging 的窗口是关着的：passAction 会拒绝，但主按钮仍要能推进 */
 e.run("state.questing.step='afterStaging';render();");
 assert.equal(e.run('E.passWindow(state)'),true,'窗口关着的 framework 步骤也要能记让过');
 e.run('E.questing.move(state)');
 assert.notEqual(e.run('state.questing.step'),'afterStaging','结算步骤完成，流程继续');
});
