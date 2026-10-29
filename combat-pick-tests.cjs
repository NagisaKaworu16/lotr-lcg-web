/* 战斗选人网格回归（v0.15.83）：v0.15.81 把决策面板改成覆盖桌面的非模态浮层后，
   defense/attack 仍然要求「点桌面上的角色卡」——角色卡被浮层盖住，玩家只看到
   「点击角色暂定防御」却找不到任何角色可点（用户反馈）。
   修法：浮层体里补一段缩略图网格（.combat-pick），草稿仍走 DesktopUI.draft。
   覆盖：防御网格与候选数一致、点缩略图即入草稿并刷新预览、攻击先选目标再出角色网格、
   提交按钮在选人后可用、关掉浮层后点桌面卡不会把浮层弹回来（stableBody 归一）。 */
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
/* 直接摆出「敌人攻击 · 防御选择」/「玩家攻击选择」局面：引擎字段照 combat-engine 的 start/attack。 */
function combatAt(e,step){
 e.run(`{const cfg=['leadership','spirit'].map(sp=>PlayerCards.config(PlayerCards.starter(RINGSDB_SNAPSHOT,sp),RINGSDB_SNAPSHOT));
  state=E.create('mirkwood',2,12345,cfg,{deferSetup:true,openingTest:true});
  for(const p of state.players)E.openingChoice(state,p.id);E.startScenario(state);
  state.phase=5;const enemy={...E.byId[97],uid:++state.serial,shadows:[]};state.players[0].engaged.push(enemy);
  state.encountering={...(state.encountering||{}),completed:true};
  state.combat={round:state.round,step:'${step}',order:[0,1],turnOrder:[0,1],index:0,enemyIndex:0,playerIndex:0,
   doneEnemies:[],doneAttacks:[],finalPasses:[],queue:[],tasks:[],discussion:true,approvals:[],proposal:null,
   riders:[],stack:[],returnShadows:[],completed:false,closing:false,
   attack:{kind:'enemy',player:0,uid:enemy.uid,defenders:[],bonus:0,shadowIndex:0,usedResponses:[],attackers:[]}};
  handView=0;render();}`);
}
const html=e=>e.base.get('app').innerHTML;
/* v0.15.93：浮层搬进「队伍与手牌」标题行后，页尾不再是浮层独有——角色行紧跟在后面，
   每张卡都带 data-desktop="pick"，直接把尾巴全算进来会重复计数（实测 6 vs 3）。
   这里按 <div> 标签配平截到浮层自身闭合处。 */
const pop=e=>{const h=html(e),i=h.indexOf('id="decide-pop"');if(i<0)return null;
 const start=h.lastIndexOf('<div',i);let d=0;
 for(let k=start;k<h.length;k++){
  if(h.startsWith('<div',k)){d++;k+=3;}
  else if(h.startsWith('</div>',k)){d--;k+=5;if(d===0)return h.slice(i,k);}
 }
 return h.slice(i);};
const thumbs=e=>((pop(e)||'').match(/class="qp-card/g)||[]).length;

test('防御选择：浮层里给出全部候选角色的缩略图网格（不再要求去点被浮层盖住的桌面卡）',async()=>{
 const e=environment();combatAt(e,'defenseChoice');
 const d=e.run('E.combat.defenders(state).length');
 const p=pop(e);
 assert(p,'防御选择应有浮层（面板覆盖桌面，选人入口必须在浮层里）');
 assert(html(e).includes('战斗 · 选择防御角色'),'标题要说清是防御选择，不能还叫「选择要处理到的角色」');
 assert(p.includes('class="pick-panel combat-pick"'),'浮层体第一段是战斗选人网格');
 assert(p.includes('class="pick-grid"'),'有缩略图网格容器');
 assert.equal(thumbs(e),d,'缩略图数量 = 候选防御者数量');
 assert(p.includes('data-desktop="pick"'),'点缩略图走与桌面卡同一条 pick 路径');
 assert(/aria-label="防御者 [^"]*攻击 \d+ 防御 \d+ 生命 \d+[^"]*点击加入名单"/.test(p),'缩略图 aria-label 含攻防数值与动作');
 assert(p.includes('不选表示无人防御'),'无人防御的语义要写明');
 assert(p.includes('提交暂定防御名单'),'提交入口仍在浮层里');
});

test('防御选择：点缩略图即入草稿，预览与已选数同步刷新',async()=>{
 const e=environment();combatAt(e,'defenseChoice');
 const uid=e.run('E.combat.defenders(state)[0].uid');
 const before=e.run('JSON.stringify(state)');
 e.click({action:'desktop',desktop:'pick',uid:String(uid)});
 assert.equal(e.run('JSON.stringify(state)'),before,'暂定不改引擎状态（交互红线）');
 assert.equal(e.run('DesktopUI.draft(state,DesktopUI.mode(state,0)).ids.length'),1,'草稿记下 1 名');
 const p=pop(e);
 assert(p&&p.includes('暂定防御 '),'预览仍在浮层里');
 assert(/已选 1 名/.test(p),'已选数刷新');
 assert(/qp-card is-selected/.test(p),'缩略图出现已选态');
 e.click({action:'desktop',desktop:'clear'});
 assert.equal(e.run('DesktopUI.draft(state,DesktopUI.mode(state,0)).ids.length'),0,'清空选择仍可用');
});

test('攻击选择：先给目标敌人网格，选完目标才出角色网格，提交按钮随后可用',async()=>{
 const e=environment();combatAt(e,'attackChoice');
 let p=pop(e);
 assert(p,'攻击选择也要有浮层');
 assert(html(e).includes('战斗 · 选择攻击目标与角色'),'标题说明两步');
 assert(p.includes('data-desktop="target"'),'第一步：目标敌人缩略图');
 assert(p.includes('先选目标敌人'),'未选目标时给提示');
 assert.equal(((p.match(/data-desktop="pick"/g)||[]).length),0,'未选目标时不列角色');
 const enemy=e.run('E.combat.attackTargets(state,0)[0].uid');
 e.click({action:'desktop',desktop:'target',uid:String(enemy)});
 p=pop(e);
 const list=e.run(`E.combat.attackers(state,0,${enemy}).length`);
 assert.equal(((p.match(/data-desktop="pick"/g)||[]).length),list,'第二步：可选攻击者的缩略图数量');
 const uid=e.run(`E.combat.attackers(state,0,${enemy})[0].uid`);
 e.click({action:'desktop',desktop:'pick',uid:String(uid)});
 assert.equal(e.run('DesktopUI.draft(state,DesktopUI.mode(state,0)).ids.length'),1,'攻击者入草稿');
 assert(!/data-desktop="submit"[^>]*disabled/.test(pop(e)),'选完目标与角色后提交按钮可用');
});

test('关掉浮层后在桌面点角色卡，浮层不会自己弹回来（草稿数字不进 key）',async()=>{
 const e=environment();combatAt(e,'defenseChoice');
 e.click({action:'decide',decide:'close'});
 assert.equal(pop(e),null,'用户关掉浮层');
 const uid=e.run('E.combat.defenders(state)[0].uid');
 e.click({action:'desktop',desktop:'pick',uid:String(uid)});
 assert.equal(e.run('DesktopUI.draft(state,DesktopUI.mode(state,0)).ids.length'),1,'桌面卡仍可选');
 assert.equal(pop(e),null,'草稿变化不是新决策，浮层保持关闭');
});
