'use strict';
const E=ScenarioEngine,D=LOTR_DATA,$=s=>document.querySelector(s);
let state=null,history=[],tab='table',handView=0;
/* 日志显示范围：'round'（默认，仅本回合）| 'all'。纯视图偏好，不写入对局状态、
   不进撤销历史，刷新页面沿用本次会话内的选择；后续要加「按阶段筛选」等维度时，
   在这里扩成对象（如 {scope:'round',phases:[]}）再传给 PhaseLog.panel 即可。 */
let logScope='round';
/* 日志回退：history[j] 存的是第 j 次操作「之前」的状态，但并非每次操作都会写日志，
   所以两者不能按下标直接对应。logMarks[j] 记录第 j 次操作把日志从几条变成几条（[before,after]），
   日志条目据此精确定位到「产生它的那次操作」，回退时才能停在正确的前态。
   纯视图操作（切换查看玩家等）不入栈，因此不会出现在这里。 */
 /* logMarks 条目形如 {seq,before,after}：seq 是该次操作在 history 中的绝对序号。
    history 超过 80 步会从头裁掉，此时 history 下标不再等于 seq，
    所以定位回退点一律用 seq 反查（history[seq - baseSeq]）。 */
let logMarks=[],historyBase=0;
function APP_LOG_MARKS(){return {logMarks,base:historyBase,length:history.length};}
/* 供桌面右栏日志读取当前显示范围（纯视图偏好，见上方 logScope 注释）。 */
function APP_LOG_SCOPE(){return logScope;}
/* 竖轴上手动展开的阶段集合（默认空：未来阶段折叠，当前与已过阶段自动展开）。
   同样是纯视图偏好，刷新后重置，不写对局、不进撤销历史。 */
let railOpen=new Set();
function APP_RAIL_OPEN(){return railOpen;}
/* v0.15.49：日志抽屉开关（右栏只留阶段竖轴后，日志改为按需展开的浮层）。
   纯视图偏好，刷新重置，不入撤销历史。 */
let logOpen=false;
function APP_LOG_OPEN(){return logOpen;}
const setupDraft={players:1,seed:'',first:0,decks:['starter-leadership','starter-tactics','starter-spirit','starter-lore']};
function captureSetup(){if(state)return;const count=$('#playerCount');if(!count)return;const n=Number(count.value);if(Number.isInteger(n)&&n>=1&&n<=4)setupDraft.players=n;setupDraft.seed=$('#seed')?.value||'';setupDraft.first=Number($('#pc-first')?.value||0);if(setupDraft.first>=setupDraft.players)setupDraft.first=0;for(let i=0;i<4;i++){const value=$('#pc-deck-'+i)?.value;if(value)setupDraft.decks[i]=value;}}
function bindSetup(){if(state||tab!=='table')return;const count=$('#playerCount');if(!count)return;count.onchange=()=>{captureSetup();render();};for(const id of ['seed','pc-first','pc-deck-0','pc-deck-1','pc-deck-2','pc-deck-3']){const el=$('#'+id);if(el){el.onchange=captureSetup;if(id==='seed')el.oninput=captureSetup;}}}
const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const enc=escape;
try{let s=localStorage.getItem('lotr-core-v02');if(s){let v=JSON.parse(s);if(v.version===1){state=v;if(state.phase===2&&state.questing)E.questing.enableDiscussion(state);}}}catch{}
function save(){try{if(state)localStorage.setItem('lotr-core-v02',JSON.stringify(state));else localStorage.removeItem('lotr-core-v02');}catch{toast('浏览器未允许本地保存，可使用导出存档。');}}
function toast(t){$('#toast').textContent=t;$('#toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').style.display='none',5000);}
/* v0.15.57：状态一变就把「本阶段已经没有玩家决定要做」的阶段连着走完，
   直到下一个必须由玩家决定的地方（提交名单、选择防御者、要不要打牌……）。
   以前这些收尾挂在「结束阶段」按钮上，等于让玩家替引擎判断阶段做完了没有。 */
function autoAdvance(){if(!state)return 0;try{return E.autoAdvance(state);}catch(e){return 0;}}
function mutate(fn){let before=state?E.clone(state):null,logsBefore=before?before.log.length:0;try{fn();if(state){E.windows.run(state);autoAdvance();E.windows.run(state);}const seq=historyBase+history.length;history.push(before);logMarks.push({seq,before:logsBefore,after:state?state.log.length:0});if(history.length>80){history.shift();logMarks.shift();historyBase++;}save();render();}catch(e){state=before;toast(e.message);}}
function btn(text,action,args='',cls='',disabled=false){return `<button class="${cls}" data-action="${action}" ${args} ${disabled?'disabled':''}>${text}</button>`;}
function empty(t='此区域暂无卡牌'){return `<div class="empty">${t}</div>`;}
const types={Enemy:'敌人',Location:'地点',Treachery:'诡计',Objective:'目标'};
function card(c,zone='catalog'){
 const enemyStats=c.type==='Enemy'&&zone!=='catalog'&&state?.players.some(p=>p.heroStates)&&E.planning.find(state,c.uid)?E.planning.stats(state,c.uid):c;
 let stats=c.type==='Enemy'?`交战 ${c.engagement??'—'} · 威胁 ${c.threat??0}<br>攻击 ${enemyStats.attack} · 防御 ${enemyStats.defense} · 生命 ${enemyStats.health}`:c.type==='Location'?`威胁 ${c.threat} · 探索 ${c.quest}${c.progress!==undefined?' · 已有 '+c.progress:''}`:'';
 let actions='';
 if(state&&state.status==='playing'){
  if(zone==='staging'&&c.type==='Location')actions+=btn('旅行','travel',`data-uid="${c.uid}"`,'',state.phase!==3||!!state.pending.length||!!state.traveling&&!E.traveling.spec(state,c.uid).legal);
  if(zone==='staging'&&c.type==='Enemy')actions+=btn('主动交战','engage',`data-uid="${c.uid}"`,'',state.phase!==4||!!state.pending.length||!!state.encountering);
  if((zone==='staging'||zone==='engaged')&&c.type==='Enemy')actions+=btn('标记击败','defeat',`data-uid="${c.uid}"`,'',!!state.pending.length||!!state.questing);
  if(zone==='engaged'&&!state.combat){
   actions+=btn('翻开暗影','shadow',`data-uid="${c.uid}"`,'',state.phase!==5||!c.shadows||c.shadowRevealed||!!state.pending.length);
   actions+=btn('补发暗影','extraShadow',`data-uid="${c.uid}"`,'',state.phase!==5||!c.shadows||!!state.pending.length);
   actions+=btn('返回探查区','returnEnemy',`data-uid="${c.uid}"`,'',!!state.pending.length);
  }
  if(zone==='objective')actions+=c.holder?btn('放回探查区','returnObjective',`data-uid="${c.uid}"`,'',!!state.pending.length||!!state.questing):btn('领取目标','claim',`data-uid="${c.uid}"`,'',!!c.guard||!!state.pending.length);
  if(zone==='condition')actions+=btn('效果结束／弃掉','discardCondition',`data-uid="${c.uid}"`,'',!!state.pending.length||!!state.questing);
 }
 let extra='';
 if(c.guard&&zone==='objective'){let g=state.staging.find(x=>x.uid===c.guard)||state.players.flatMap(p=>p.engaged).find(x=>x.uid===c.guard);extra=`<p class="small warning-text">守卫：${enc(g?.name||'尚未清除')}</p>`;}
 if(c.holder)extra=`<p class="small">持有：${enc(state.players[c.holder.player].name)} · ${enc(state.players[c.holder.player].heroes[c.holder.hero])}</p>`;
 if(c.shadows){const visible=c.shadows.filter(x=>x.revealed||c.shadowRevealed);extra+=`<p class="small">暗影 ${c.shadows.length} 张 · 已翻开 ${visible.length} 张</p>${visible.map(x=>`<details><summary>${enc(x.name)}</summary>${ImageLibrary.encounterArt(x.id)}${enc(x.shadow||'无暗影效果')}${x.canceled?' · 暗影效果已取消':''}</details>`).join('')}`;}

 return `<article class="card ${c.type}"><div class="number"><span>${types[c.type]||'标记'}</span><span>${c.id?'#'+c.id:'临时'}${zone==='catalog'?' · ×'+c.quantity:''}</span></div>${ImageLibrary.encounterArt(c.id)}<h3>${enc(c.name)}</h3><div class="en">${enc(c.en)}</div>${stats?`<div class="stats">${stats}</div>`:''}<div class="body">${enc(c.rule)}</div>${c.bonus?`<span class="badge">本阶段威胁 +${c.bonus}</span>`:''}${c.victory?`<div class="small">胜利点 ${c.victory}</div>`:''}${zone==='catalog'?`<div class="small muted">${enc(D.sets[c.set])}</div>`:''}${extra}${c.shadow?`<details ${zone==='catalog'?'open':''}><summary>暗影效果</summary>${enc(c.shadow)}</details>`:zone==='catalog'?'<div class="small muted">无暗影效果</div>':''}<footer>${actions}</footer></article>`;
}
function cards(a,z){return `<div class="cards">${a.length?a.map(c=>card(c,z)).join(''):empty()}</div>`;}
let newGame=null,pendingSession=null;
const PODS=[{id:'mirkwood',cover:119},{id:'anduin',cover:126},{id:'dolguldur',cover:123}];
/* 官方只有三种模式（LOTR Easy Mode Rules / 后期规则书）：简单 Easy / 标准 Standard / 噩梦 Nightmare。
   没有「困难」。噩梦模式要用对应剧本的噩梦牌组替换遭遇牌组，本版未收录该数据，所以只开放前两种。 */
const DIFFICULTY={easy:'简单',normal:'标准'};
/* 产品封面：由 scripts/import-product-catalog.py 从 Hall of Beorn 目录生成。 */
const SCENARIO_ART='assets/scenarios/';
const PRODUCT_IMG='assets/products/';
function questArtUrl(qid){const rec=ImageLibrary.by['enc-'+qid];return ImageLibrary.safeUrl(rec&&(rec.faces&&rec.faces.A||rec.imageUrl))||'';}
const POD_READY=PODS.map(p=>{const sc=D.scenarios.find(s=>s.id===p.id);return {id:p.id,kind:'pod',name:sc.name,en:sc.en,ready:true,playable:true,art:questArtUrl(p.cover),meta:'难度 '+sc.difficulty+' · '+sc.stages.length+' 张探险卡'};});
const NEW_GAME_TABS=[
 {value:'revised',label:'新版扩展'},
 {value:'legacy',label:'旧版扩展'},
 {value:'pod',label:'支线剧情'},
 {value:'nightmare',label:'噩梦包'}
];
const NG_NOTE={
 revised:'新版扩展（Revised）：旧循环的重制版本，剧本按系列收录。',
 legacy:'旧版扩展：每个循环由一个大扩展加六到八个剧本组成，点开扩展挑选剧本。',
 pod:'支线剧情（POD）：官方单独发售的剧本与 ALeP 自制独立作品，可脱离循环单独游玩。',
 nightmare:'噩梦包：各循环的高难度变体，需配合对应剧本使用。'
};
const BASE_CORE={id:'core',kind:'campaign',ready:true,playable:true,name:'基础剧本合集',en:'Core Set Campaign',art:PRODUCT_IMG+'Revised-Core-Set.webp',meta:'3 个剧本 · 连续或单场'};
/* 旧版每个循环在目录里是「一个大盒 + 6 个冒险包」，传奇则是若干盒连成一条线。
   像诡镇那样：列表只列大盒，点进去在设置页里选具体剧本。
   预购特典、双人起始包不含新剧本，不进列表。 */
const PACK_SKIP=/Preorder Promotion|Two-Player Limited/;
let legacyCache=null;
function legacySeries(){
 if(legacyCache)return legacyCache;
 legacyCache=(PRODUCT_TABS.legacy||[]).map(ch=>{
  const name=ch.label.replace(/^CHAPTER\s+\d+\s+·\s*/,'');
  const items=ch.items.filter(x=>!PACK_SKIP.test(x.name));
  /* ch.box 是该章的大盒 id；核心包被移除后为 null，此时用章节名承载剩下的剧本。 */
  const deluxe=ch.box?(items.find(x=>x.id===ch.box)||null):null;
  const packs=deluxe?items.filter(x=>x!==deluxe):items;
  if(!packs.length)return null;
  const head=deluxe||{id:'chapter-'+(ch.key||name),name,en:'',zh:name,art:(packs[0]&&packs[0].art)||''};
  return {...head,kind:'legacy',ready:true,playable:false,packs,series:deluxe?name:''};
 }).filter(Boolean);
 return legacyCache;
}
/* 基础剧本合集与支线剧情的三个剧本共用同一份「系列」定义。 */
const CORE_SERIES={id:'core',kind:'campaign',ready:true,playable:true,name:'基础剧本合集',en:'Core Set Campaign',art:PRODUCT_IMG+'Revised-Core-Set.webp',series:'基础版',packs:POD_READY};
function seriesById(id){return id==='core'?CORE_SERIES:(legacySeries().find(s=>s.id===id)||CORE_SERIES);}
const CHAPTER_VIEWS={
 revised:[{label:'CHAPTER 1 · 基础版',items:[BASE_CORE]}].concat(PRODUCT_TABS.revised||[]),
 legacy:[],
 pod:(PRODUCT_TABS.pod||[]),
 nightmare:(PRODUCT_TABS.nightmare||[])
};
function ngArt(entry){
 const fb=`<span class="ng-art-fallback"><b>${enc(entry.zh||entry.en||entry.name)}</b><i>${entry.playable?'封面待替换':'占位封面'}</i></span>`;
 /* 方形框里完整显示封面，空出来的地方用同图放大模糊填充，避免竖版盒图被裁掉边角。 */
 const img=entry.art?`<img src="${enc(entry.art)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="const s=this.getAttribute('src')||'';if(/\.webp$/.test(s)){this.setAttribute('src',s.replace(/\.webp$/,'.jpg'))}else{this.remove()}">`:'';
 const badges=(entry.playable?'<span class="ng-ready-badge">可玩</span>':'')+(entry.pub==='community'?'<span class="ng-community-badge">社区</span>':'');
 const style=entry.art?` style="--ng-art:url('${enc(entry.art)}')"`:'';
 return `<div class="ng-card-art${entry.art?' has-art':''}"${style}>${fb}${img}${badges}</div>`;
}
function ngCard(entry){const attrs=entry.ready?`data-action="ngOpen" data-kind="${entry.kind}" data-id="${entry.id}"`:`data-action="ngLocked" data-id="${entry.id}" data-name="${enc(entry.zh||entry.name)}"`;
 const title=entry.zh||entry.name,en=entry.en===''?'':(entry.en||entry.name);
 const sub=entry.zh?[en,entry.series,entry.packs&&entry.packs.length?entry.packs.length+' 个剧本':''].filter(Boolean).join(' · '):(entry.meta||'');
 const go=entry.playable?'开始 →':entry.ready?'选择剧本 →':'尚未实现';
 return `<article class="ng-card${entry.ready?'':' locked'}" ${attrs} title="${enc(title)}${entry.zh?'｜'+enc(entry.name):''}">${ngArt(entry)}<div class="ng-card-body"><h3>${enc(title)}</h3><p class="small muted ng-card-en">${enc(sub)}</p></div><span class="ng-card-go">${go}</span></article>`;}
function ngPackCard(p,sel){const on=!!p.playable,title=p.zh||p.name;
 const attrs=on?`data-action="ngScenario" data-value="${p.id}"`:`data-action="ngLocked" data-id="${p.id}" data-name="${enc(title)}"`;
 return `<article class="ng-card ng-pack${on?'':' locked'}${sel?' selected':''}" ${attrs} aria-pressed="${!!sel}" title="${enc(title)}">${ngArt(p)}<div class="ng-card-body"><h3>${enc(title)}</h3><p class="small muted ng-card-en">${enc(p.en||p.name)}</p></div><span class="ng-card-go">${on?'可玩':'待实现'}</span></article>`;}
function ngChapters(list){return list.map(ch=>`<section class="ng-chapter"><div class="ng-chapter-head"><span>${enc(ch.label)}</span><span class="small muted">${ch.items.length} 项 · ${ch.items.filter(x=>x.playable).length} 可玩</span></div>${ch.items.length?`<div class="ng-grid">${ch.items.map(ngCard).join('')}</div>`:'<p class="empty">本批暂无条目</p>'}</section>`).join('');}
function ngCompat(){return `<div class="ng-compat" aria-hidden="true"><select id="playerCount">${[1,2,3,4].map(n=>`<option value="${n}" ${setupDraft.players===n?'selected':''}>${n}</option>`).join('')}</select><input id="seed" value="${enc(setupDraft.seed)}"><select id="pc-first">${Array.from({length:setupDraft.players},(_,i)=>`<option value="${i}" ${setupDraft.first===i?'selected':''}>玩家${i+1}</option>`).join('')}</select></div>`;}
function newGameList(){const tab=(newGame&&newGame.tab)||'revised';
 const legacy=tab==='legacy',series=legacy?legacySeries():null;
 const chapters=legacy?[]:(CHAPTER_VIEWS[tab]||CHAPTER_VIEWS.revised);
 const stats=legacy?`${series.length} 个大扩展 · ${series.reduce((n,s)=>n+s.packs.length,0)} 个剧本`
  :`共 ${chapters.reduce((n,c)=>n+c.items.length,0)} 项 · ${chapters.reduce((n,c)=>n+c.items.filter(x=>x.playable).length,0)} 可玩`;
 return `<div class="newgame"><div class="newgame-head"><div><div class="eyebrow">NEW GAME</div><h1>新游戏</h1><p class="muted">基础游戏（新版核心包）的三个剧本可以连成一条剧本线；扩展产品先以官方封面占位，规则逐步实现。</p></div><button data-action="ngBack">取消</button></div>
 <div class="ng-tabs" role="tablist">${NEW_GAME_TABS.map(t=>`<button role="tab" data-action="ngTab" data-value="${t.value}" class="${tab===t.value?'active':''}" aria-selected="${tab===t.value}">${t.label}</button>`).join('')}</div>
 <p class="small muted">${NG_NOTE[tab]||''}　${stats}</p>
 ${legacy?`<section class="ng-chapter"><div class="ng-chapter-head"><span>大扩展</span><span class="small muted">点开一个扩展，挑选其中的剧本</span></div><div class="ng-grid">${series.map(ngCard).join('')}</div></section>`:ngChapters(chapters)}${ngCompat()}</div>`;}
function newGameSettings(){const g=newGame,s=seriesById(g.series),packs=s.packs||[],first=packs[0]||{};
 const pick=g.mode==='standalone'?(packs.find(p=>p.id===g.pack)||first):first;
 const ready=!!pick.playable;
 return `<div class="newgame"><div class="newgame-head"><div><div class="eyebrow">NEW GAME · ${enc(s.series||s.name)}</div><h1>新游戏</h1></div><button data-action="ngBack">取消</button></div>
 <div class="ng-settings"><aside class="ng-cover"><div class="ng-cover-art">${s.art?`<img src="${enc(s.art)}" alt="" referrerpolicy="no-referrer">`:'<span class="ng-art-fallback">封面待替换</span>'}</div><h2>${enc(s.zh||s.name)}</h2><p class="small muted">${enc(s.en||'')}</p><p class="small">${packs.length} 个剧本 · ${packs.filter(x=>x.playable).length} 个可玩</p></aside>
 <section class="ng-form">
  <label class="ng-field"><span>游戏名称</span><input id="ng-name" maxlength="60" value="${enc(g.name||'')}" placeholder="例如：10月20日 中土远征"></label>
  <div class="ng-field"><span>玩家人数</span><div class="ng-seg">${[1,2,3,4].map(n=>`<button data-action="ngPlayers" data-value="${n}" class="${setupDraft.players===n?'active':''}" aria-pressed="${setupDraft.players===n}">${n}</button>`).join('')}</div></div>
  <div class="ng-field"><span>剧本类型</span><div class="ng-seg"><button data-action="ngMode" data-value="campaign" class="${g.mode==='campaign'?'active':''}" aria-pressed="${g.mode==='campaign'}">完整剧本</button><button data-action="ngMode" data-value="standalone" class="${g.mode==='standalone'?'active':''}" aria-pressed="${g.mode==='standalone'}">单场冒险模式</button></div>
   <p class="small muted">${g.mode==='campaign'?`完整剧本从「${enc(first.zh||first.name||'第一个剧本')}」开始，按顺序推进；本版只自动结算当前剧本。`:'在下方「选择冒险」里挑一个剧本单独游玩。'}</p></div>
  <div class="ng-field"><span>难度选择</span><div class="ng-seg">${Object.entries(DIFFICULTY).map(([k,v])=>`<button data-action="ngDifficulty" data-value="${k}" class="${g.difficulty===k?'active':''}">${v}</button>`).join('')}</div><p class="small muted">${g.difficulty==='easy'?'简单（官方 Easy Mode）：设置时每位英雄资源池 +1，并从遭遇牌库移除带难度标记的卡牌。':'标准（Standard）：按剧本原文设置与结算。'}　噩梦模式需要对应剧本的噩梦牌组（见「噩梦包」页签），本版尚未收录。</p></div>
  <details class="ng-advanced" ${g.advanced?'open':''}><summary>高级设置 · 事件窗口触发时机</summary><div class="ng-seg"><button data-action="ngWindow" data-value="smart" class="${g.windowMode==='smart'?'active':''}">智能：空窗口自动跳过</button><button data-action="ngWindow" data-value="detailed" class="${g.windowMode==='detailed'?'active':''}">详细：每个窗口都停下</button></div><p class="small muted">对应桌面操作栏的「行动窗口」模式，开局后也能随时切换。</p></details>
  <div class="ng-actions"><button data-action="ngBack">返回</button><button class="primary" data-action="ngNext" ${ready?'':'disabled'}>下一步：选择牌组</button></div>
  ${ready?'':`<p class="small muted">「${enc(pick.zh||pick.name||'该剧本')}」的剧本内容尚未实现；目前可玩的是基础版的三个剧本。</p>`}
 </section>
 ${g.mode==='standalone'?`<section class="ng-packs"><div class="ng-chapter-head"><span>选择冒险</span><span class="small muted">点一张封面切换剧本</span></div><div class="ng-pack-grid">${packs.map(p=>ngPackCard(p,p.id===g.pack)).join('')}</div></section>`:''}
 </div>${ngCompat()}</div>`;}
function setup(){return newGame&&newGame.step==='settings'?newGameSettings():newGameList();}
function phaseHint(){return ['新对局点击推进时，会自动为每名未被囚禁且存活的英雄收集1资源，并为每位玩家抽1张牌。魔法溪流会禁止抽牌；铁镣改写下一次抽牌。','按起始玩家顺序打出盟友和附属；点击手牌选择目标和资源支付。处理响应后结束各自出牌，再由所有玩家让过行动，结算计划阶段结束。','在上方探险面板按步骤操作：选择投入角色、处理响应、逐张翻开遭遇。窗口关闭后自动计算意志、威胁和进度，无需输入数值。','由起始玩家暂定旅行地点，全员二次确认后支付费用和移动地点。完成旅行强制效果与响应后才开放普通行动。','在上方暂定主动交战或不交战，全员二次确认。交战检定前后开放行动；检定逐人循环，强制效果先处理。安都因河航道只跳过检定。','在上方战斗面板暂定攻击／防御名单，全队二次确认。暗影逐张结算，系统计算伤害；各步骤之间保留行动窗口。','先暂定蛛网支付，全员二次确认后重置、增加威胁并轮换先手；行动结束后分开结算阶段结束及回合结束效果，再进入下一回合资源阶段。'][state.phase];}
function table(){return state?DesktopUI.render(state,handView):setup();}
/* 统一卡牌库（参照诡镇奇谈网页版的三档分类）：玩家卡与战役卡同页，「玩家 / 战役 / 两者都」切换。
   玩家卡来自 RingsDB 基础版快照（73 种），战役卡来自 D.cards（45 种遭遇）+ D.quests（10 张探险）。
   条目上百，默认只列名称（杂志式密集索引），点开某项才注入卡图与全文，避免一次性加载上百张图。
   v0.9 时这里只有遭遇卡，5647e83 重构还删掉了函数体，v0.15.23 恢复、v0.15.24 合并玩家卡。 */
const CAT_SIDES=[{id:'player',label:'玩家',note:'英雄 · 盟友 · 附属 · 事件'},{id:'encounter',label:'战役',note:'敌人 · 地点 · 诡计 · 目标 · 探险卡'},{id:'both',label:'两者都',note:'玩家卡与战役卡同屏'}];
const CAT_GROUP_ORDER=['领导','战术','精神','学识','中立','敌人','地点','诡计','目标','探险卡'];
const PLAYER_TYPES={hero:'英雄',ally:'盟友',attachment:'附属',event:'事件'};
const SPHERE_NAMES={leadership:'领导',tactics:'战术',spirit:'精神',lore:'学识',neutral:'中立'};
let catalogSide='both',catalogView='list',catalogQuery='',podFilter='',catalogCache=null,catSection='base',catalogNavCache=null;
/* 侧边栏导航：卡牌（基础卡牌库）是默认项；扩展包条目从产品目录动态生成做占位，
 * 以后某系列收录卡牌时，把 catalogSeriesPanel 的占位换成该系列的筛选结果即可。 */
function catalogNav(){
 if(catalogNavCache)return catalogNavCache;
 const revised=[],legacy=[];
 for(const ch of PRODUCT_TABS.revised||[])for(const it of ch.items||[])revised.push({id:it.id,name:it.zh||it.name,en:it.en&&it.en!==it.name?it.en:'',art:it.art||'',meta:it.meta||''});
 for(const s of legacySeries())legacy.push({id:s.id,name:s.name,en:s.en&&s.en!==s.name?s.en:'',art:s.art||'',meta:s.packs&&s.packs.length?`${s.packs.length} 个扩展`:'循环'});
 return catalogNavCache={revised,legacy};
}
function catNavItem(it){
 const icon=it.art?`<img src="${enc(it.art)}" alt="" loading="lazy" onerror="const s=this.getAttribute('src')||'';if(/\.webp$/.test(s)){this.setAttribute('src',s.replace(/\.webp$/,'.jpg'))}else{this.remove()}">`:'<span class="cat-nav-dot" aria-hidden="true"></span>';
 return `<button type="button" class="cat-nav-item" data-action="catNav" data-section="${enc(it.id)}" aria-current="${catSection===it.id?'page':'false'}">${icon}<span class="cat-nav-name">${enc(it.name)}</span></button>`;
}
function catNavHtml(){
 const nav=catalogNav();
 return `<aside class="cat-side"><nav class="cat-nav" aria-label="卡牌库系列导航"><div class="cat-nav-group"><h3>基础</h3><button type="button" class="cat-nav-item" data-action="catNav" data-section="base" aria-current="${catSection==='base'?'page':'false'}"><span class="cat-nav-dot" aria-hidden="true"></span><span class="cat-nav-name">卡牌<small> ${catalogStats().total} 种</small></span></button></div><div class="cat-nav-group"><h3>扩展包 · 预留</h3>${nav.revised.map(catNavItem).join('')}<details class="cat-nav-fold"${catSection!=='base'&&nav.legacy.some(x=>x.id===catSection)?' open':''}><summary>旧版扩展（${nav.legacy.length}）</summary>${nav.legacy.map(catNavItem).join('')}</details><p class="cat-nav-hint small">系列卡牌尚未收录，点击查看系列详情。</p></div></nav></aside>`;
}
function catalogSeriesPanel(id){
 const it=catalogNav().revised.concat(catalogNav().legacy).find(x=>x.id===id);if(!it)return '';
 const art=it.art?`<img class="cat-series-art" src="${enc(it.art)}" alt="" loading="lazy" onerror="const s=this.getAttribute('src')||'';if(/\.webp$/.test(s)){this.setAttribute('src',s.replace(/\.webp$/,'.jpg'))}else{this.remove()}">`:'';
 return `<div class="intro"><div><div class="eyebrow">SERIES · 即将收录</div><h1>${enc(it.name)}</h1>${it.en?`<p class="muted">${enc(it.en)}</p>`:''}</div></div><section class="panel cat-series-panel">${art}<div class="cat-series-text"><h2>该系列的卡牌尚未收录</h2><p>目前卡牌库收录的是基础版 ${catalogStats().total} 种卡牌（玩家卡与战役卡）。这一系列${it.meta?`（${enc(it.meta)}）`:''}的卡牌与规则将随版本更新加入，届时会出现在这里，并可直接按本系列筛选。</p><p class="small muted">想先了解它的剧本？回首页从「新版扩展／旧版扩展」进入对应章节。</p><button type="button" data-action="catNav" data-section="base">← 返回卡牌</button></div></section>`;
}
/* 系列包（pod）：卡牌印载的扩展盒。玩家卡用 RingsDB 的 packCode；
 * 战役卡（D.cards／D.quests）用 data.js 里的 pack 字段（规范同 packCode，基础版为 'Core'）。
 * 'Core' 兜底只对历史遗留的缺字段数据生效，新增数据必须写 pack。 */
const POD_NAMES={Core:'基础包 · Core Set'};
const podName=id=>POD_NAMES[id]||id;
function catalogEntries(){
 if(catalogCache)return catalogCache;
 const out=[],snap=(typeof RINGSDB_SNAPSHOT!=='undefined'&&RINGSDB_SNAPSHOT.cards)||[];
 for(const c of snap)out.push({side:'player',face:'player',code:c.code,pod:c.packCode||'Core',name:c.nameZh||c.name,en:c.name,group:SPHERE_NAMES[c.sphere]||c.sphereName||'中立',kind:PLAYER_TYPES[c.type]||c.type,
  meta:[PLAYER_TYPES[c.type]||c.type,c.cost!==null&&c.cost!==undefined?'费用 '+c.cost:'',c.startingThreat?'威胁 '+c.startingThreat:''].filter(Boolean).join(' · '),
  search:[c.nameZh,c.name,c.rulesText,c.traits,c.sphereName].filter(Boolean).join(' ').toLowerCase()});
 for(const c of D.cards)out.push({side:'encounter',face:'encounter',code:c.id,pod:c.pack||'Core',name:c.name,en:c.en||'',group:types[c.type]||'其他',kind:types[c.type]||'其他',
  meta:[types[c.type]||c.type,D.sets[c.set]||'',c.quantity?'×'+c.quantity:''].filter(Boolean).join(' · '),
  search:[c.name,c.en,c.rule,c.shadow].filter(Boolean).join(' ').toLowerCase()});
 for(const q of D.quests)out.push({side:'encounter',face:'quest',code:q.id,pod:q.pack||'Core',name:q.name,en:'',group:'探险卡',kind:'探险卡',
  meta:['探险卡','阶段 '+q.stage].join(' · '),search:[q.name,q.front,q.back].filter(Boolean).join(' ').toLowerCase()});
 return catalogCache=out;
}
function catalogPods(){
 const m=new Map;
 for(const e of catalogEntries())m.set(e.pod,(m.get(e.pod)||0)+1);
 return [...m.entries()].sort((a,b)=>b[1]-a[1]);
}
function catalogStats(){
 const all=catalogEntries(),player=all.filter(e=>e.side==='player'),encounter=all.filter(e=>e.side==='encounter'),tally=a=>a.reduce((m,e)=>(m[e.kind]=(m[e.kind]||0)+1,m),{});
 return {player:player.length,encounter:encounter.length,total:all.length,playerKinds:tally(player),encounterKinds:tally(encounter)};
}
function catalogGroups(side,pod){
 const map=new Map;
 /* 选了系列包（或两侧同屏）时，组名标明类别：玩家卡 / 遭遇卡 / 探险卡 */
 const showCat=side==='both'||!!pod;
 for(const e of catalogEntries()){
  if(side!=='both'&&e.side!==side)continue;
  if(pod&&e.pod!==pod)continue;
  const title=e.face==='quest'?'探险卡':(showCat?(e.face==='player'?'玩家卡 · ':'遭遇卡 · '):'')+e.group;
  if(!map.has(title))map.set(title,{title,order:CAT_GROUP_ORDER.indexOf(e.group),items:[]});
  map.get(title).items.push(e);
 }
 return [...map.values()].sort((a,b)=>(a.order<0?99:a.order)-(b.order<0?99:b.order));
}
function catalog(){
 const main=catSection==='base'?(()=>{
  const st=catalogStats(),kinds=m=>Object.entries(m).map(([k,v])=>enc(k)+' '+v).join(' / ');
  return `<div class="intro"><div><div class="eyebrow">CARD INDEX</div><h1>卡牌库</h1><p class="muted">玩家卡 ${st.player} 种（${kinds(st.playerKinds)}） · 战役卡 ${st.encounter} 种（${kinds(st.encounterKinds)}） · 合计 ${st.total} 种。鼠标停在卡名上直接显示卡图，点开看完整文本与机制；配牌请到「我的卡组 → 新建牌组」。中文为工作译名与机制摘要。</p></div></div><div class="cat-controls"><div class="cat-sides" role="group" aria-label="卡牌分类">${CAT_SIDES.map(s=>`<button type="button" data-action="catSide" data-value="${s.id}" aria-pressed="${s.id===catalogSide}" title="${enc(s.note)}">${s.label}</button>`).join('')}</div><select id="podFilter" aria-label="按系列包筛选"><option value="">全部系列包</option>${catalogPods().map(([id,n])=>`<option value="${enc(id)}" ${podFilter===id?'selected':''}>${enc(podName(id))}（${n}）</option>`).join('')}</select><input id="search" placeholder="搜索名称、规则或特性…" value="${enc(catalogQuery)}" aria-label="搜索卡牌"><div class="cat-views" role="group" aria-label="显示方式"><button type="button" data-action="catView" data-value="list" aria-pressed="${catalogView==='list'}">名称</button><button type="button" data-action="catView" data-value="art" aria-pressed="${catalogView==='art'}">卡图</button></div></div><div class="small muted" id="resultCount"></div><div class="cat-index" id="catalogResults"></div>`;
 })():catalogSeriesPanel(catSection);
 return `<div class="catalog-layout">${catNavHtml()}<div class="cat-main">${main}</div></div>`;
}
function catalogHover(e){
 const key=e.face==='player'?e.code:'enc-'+e.code,rec=ImageLibrary.by[key],url=rec?ImageLibrary.safeUrl(rec.imageUrl):null;
 return url?{src:url,shape:e.face==='quest'?'wide':'tall'}:null;
}
function catalogItem(e){const h=catalogHover(e);return `<details class="cat-item" data-code="${enc(e.code)}" data-face="${e.face}"><summary${h?` data-hover-src="${enc(h.src)}" data-hover-shape="${h.shape}"`:''}><span class="cat-name">${enc(e.name)}</span><span class="cat-meta">${enc(e.meta)}</span></summary><div class="cat-body"></div></details>`;}
function catalogArt(e){const a=e.face==='player'?ImageLibrary.art(e.code):e.face==='quest'?ImageLibrary.questFaces(e.code):ImageLibrary.encounterArt(e.code);return `<figure class="cat-figure"><figcaption><b>${enc(e.name)}</b><small>${enc(e.meta)}</small></figcaption>${a}</figure>`;}
function catalogFacts(rows){return `<dl class="cat-facts">${rows.filter(r=>r[1]!==null&&r[1]!==undefined&&r[1]!=='').map(([k,v])=>`<dt>${enc(k)}</dt><dd>${enc(v)}</dd>`).join('')}</dl>`;}
function catalogDetail(face,code){
 if(face==='player'){
  const c=((typeof RINGSDB_SNAPSHOT!=='undefined'&&RINGSDB_SNAPSHOT.cards)||[]).find(x=>x.code===code);if(!c)return '';
  const rows=[['类型',PLAYER_TYPES[c.type]||c.type],['球色',SPHERE_NAMES[c.sphere]||c.sphereName||'—'],['费用',c.cost],['初始威胁',c.startingThreat],['意志／攻击／防御／生命',c.type==='hero'?`${c.willpower}／${c.attack}／${c.defense}／${c.health}`:null],['特性',c.traits],['卡包',c.packName],['编号',c.code]];
  return `<div class="cat-detail">${ImageLibrary.art(code)}<div class="cat-text">${catalogFacts(rows)}<p class="small muted">规则文本为 RingsDB 英文原文，未作翻译。</p><p>${enc(c.rulesText||'（暂无规则文本）')}</p></div></div>`;
 }
 if(face==='quest'){
  const q=D.quests.find(x=>x.id===Number(code));if(!q)return '';
  const rows=[['阶段',q.stage],['进度',q.points||'特殊条件'],['编号',q.id]];
  return `<div class="cat-detail">${ImageLibrary.questFaces(q.id)}<div class="cat-text">${catalogFacts(rows)}<p><b>A面 / 入场</b><br>${enc(q.front)}</p><p><b>B面</b><br>${enc(q.back)}</p></div></div>`;
 }
 const c=D.cards.find(x=>x.id===Number(code));if(!c)return '';
 const rows=[['类型',types[c.type]||c.type],['遭遇组',D.sets[c.set]],['数量','×'+(c.quantity||1)]];
 if(c.type==='Enemy')rows.push(['交战／威胁',`${c.engagement??'—'}／${c.threat??0}`],['攻击／防御／生命',`${c.attack}／${c.defense}／${c.health}`]);
 if(c.type==='Location')rows.push(['威胁／探索',`${c.threat}／${c.quest}`]);
 if(c.victory)rows.push(['胜利点',c.victory]);
 return `<div class="cat-detail">${ImageLibrary.encounterArt(c.id)}<div class="cat-text">${catalogFacts(rows)}<p>${enc(c.rule)}</p>${c.shadow?`<p><b>暗影效果</b><br>${enc(c.shadow)}</p>`:''}</div></div>`;
}
function filterCatalog(){
 const input=$('#search');if(!input)return;
 catalogQuery=input.value;
 const q=catalogQuery.trim().toLowerCase();let shown=0;
 const tally={player:0,encounter:0,quest:0};
 const html=catalogGroups(catalogSide,podFilter).map(g=>{
  const hit=g.items.filter(e=>!q||e.search.includes(q));
  if(!hit.length)return '';
  shown+=hit.length;
  for(const e of hit)tally[e.face]++;
  return `<section class="cat-group"><h2><span>${enc(g.title)}</span><span class="cat-count">${hit.length}</span></h2>${catalogView==='art'?`<div class="cat-art-grid">${hit.map(catalogArt).join('')}</div>`:`<div class="cat-list">${hit.map(catalogItem).join('')}</div>`}</section>`;
 }).join('');
 const side=CAT_SIDES.find(s=>s.id===catalogSide)||CAT_SIDES[2];
 const rc=$('#resultCount');if(rc)rc.textContent=podFilter
  ?`${podName(podFilter)} · 玩家卡 ${tally.player} / 遭遇卡 ${tally.encounter} / 探险卡 ${tally.quest}${q?`，「${catalogQuery.trim()}」匹配 ${shown} 种`:`，共 ${shown} 种`}`
  :(q?`「${catalogQuery.trim()}」匹配 ${shown} 种`:`${side.note} · 共 ${shown} 种`);
 const cr=$('#catalogResults');if(cr){cr.innerHTML=html||empty(q?'没有匹配的卡牌，换个关键词。':podFilter?'该系列包暂无此类卡牌。':'这一类暂时没有卡牌。');ImageLibrary.bindErrors(cr);}
 bindCatalog();
}
function bindCatalog(){
 const root=$('#catalogResults');if(!root||typeof root.addEventListener!=='function')return;
 root.addEventListener('toggle',ev=>{
  const d=ev.target;
  if(!d.classList||typeof d.classList.contains!=='function'||!d.classList.contains('cat-item')||!d.open)return;
  const body=d.querySelector('.cat-body');if(!body||body.dataset.loaded)return;
  body.innerHTML=catalogDetail(d.dataset.face,d.dataset.code);
  body.dataset.loaded='1';
  ImageLibrary.bindErrors(body);
 },true);
}
function help(){return `<article class="panel help"><div class="eyebrow">VERSION 0.13.1 · MULTIPLAYER SETUP</div><h1>这次推进了什么</h1><p>新局默认智能行动窗口：空窗口自动继续；全队合法事件与能力集中显示，可设置本阶段不再提醒。实际操作的确认与即时响应保留；旧存档无设置时保留详细模式。详见 window-acceptance.md。</p><p>这是从原有桌面布局原型推进到的基础版剧本辅助桌面。规则范围为原版标准模式的独立剧本，并支持官方 Easy Mode（简单）：设置时每位英雄资源池 +1，并从遭遇牌库移除官方清单列出的难度标记卡。噩梦模式需另购对应剧本的噩梦牌组，本版未收录。不含新版战役的恩惠与负担。</p><table><tr><th>模块</th><th>本版状态</th></tr><tr><td>45种遭遇卡、10张双面探险卡</td><td>数量、数值、所属遭遇组、正面机制与暗影摘要已接入；新增45种遭遇卡图片及10张探险卡的A/B两面图片。无背景故事或官方中文译文。这些内容与基础版玩家卡一并收录在「卡牌」（基础卡牌库）：进入后按「玩家／战役／两者都」切换，默认只列卡名，点开某一行才载入卡图与全文。</td></tr><tr><td>组牌与开局</td><td>三个剧本按遭遇组组牌，处理固定开局牌、巨魔、守卫目标、场外戒灵和随机囚犯。</td></tr><tr><td>探险推进</td><td>管理地点吸收进度、随机第三阶段、巨魔/蜘蛛/戒灵门槛、目标持有与救援条件。</td></tr><tr><td>遭遇与暗影</td><td>人数翻牌、涌现、厄运、部分数值效果、交战检定、暗影分配与展示；第三阶段遭遇正面效果自动处理，需玩家决定的目标会弹出选择；战斗流程与基础版暗影已接入，第七阶段刷新与回合循环已接入。</td></tr><tr><td>玩家牌与完整规则引擎</td><td>已接入RingsDB基础版玩家牌查询、组牌与开局英雄/初始威胁。已实现起始手牌、资源阶段和计划阶段的出牌、支付、入场响应、主动能力及阶段结束处理。新增第三阶段投入响应、逐张遭遇与取消窗口、自动意志及进度结算；新增第四阶段旅行费用、旅行强制效果与响应、旅行后行动窗口。新增第五阶段主动交战确认、交战检定与行动窗口；新增第六阶段战斗、暗影与攻防流程；新增第七阶段重置、蛛网支付、威胁和先手轮换、回合结束效果与下一回合入口。联机待实现。</td></tr><tr><td>联机与私密手牌</td><td>未实现。当前为同一浏览器上的1–4人辅助桌面。</td></tr></table><h2>如何使用</h2><ol><li>解压后直接双击 index.html；无需 npm 或安装依赖。</li><li>点击任意预组牌开局测试，查看真实英雄和6张手牌，保留或调度后执行剧本设置；再推进到资源阶段结算。进入计划阶段后可打出盟友、附属和合法事件，完成各玩家出牌与行动选择；阶段2结算完成后点击进入探险阶段。</li><li>按顶部阶段进行操作；黄色事项必须按规则处理后再确认。卡牌文字仍需在适用时点自行触发。</li><li>战斗面板选择攻击、防御与响应；系统计算伤害并处理支持的基础版效果。旧手动辅助按钮不代表自动规则流程。</li><li>用“撤销一步”纠正误操作。浏览器尽量自动保存；重要进度请导出存档。切换浏览器或移动文件后建议导入存档。</li></ol><h2>本次验收范围</h2><p>第七阶段验收流程详见 phase7-acceptance.md；第六阶段详见 phase6-acceptance.md；第五阶段详见 phase5-acceptance.md；第四阶段详见 phase4-acceptance.md，第三阶段详见 phase3-acceptance.md。推荐新开四套规则书预组牌测试。安都因和多尔哥多的旧开局遭遇事项仍使用原手动确认入口；这些开局效果的取消窗口尚未迁移。</p><p>阶段2自动验证出牌时点、领域与费用、合法目标、独特和受限限制，并处理已支持的入场响应、行动能力与阶段结束效果。角色选择由玩家决定，资源和数值由程序计算。第三阶段按投入、探查、结果结算和行动窗口推进；完成后可进入第四阶段旅行；本版完成刷新后可进入下一回合资源阶段。</p><p>旧版遭遇、暗影与战斗辅助功能仍保留，不代表后续阶段已经完成。完整阶段2支持范围和操作步骤见 phase2-acceptance.md。</p><h2>玩家牌资料</h2><p>RingsDB基础版包含12名英雄、20种盟友、13种附属、28种事件。所有基础版盟友和附属的正常入场已接入；事件与能力按阶段2时点开放，不适用的触发不能在此使用。其他扩展目前仅供资料和图片查询。</p><h2>资料来源</h2><ul>${D.sources.map(s=>`<li><a href="${s.url}" target="_blank" rel="noreferrer">${s.title}</a></li>`).join('')}</ul><p class="small muted">非官方爱好者原型。未附带卡牌美术。名称和游戏相关权利属于其各自权利人。基础版73种英雄与玩家牌已内置中文卡图，放大后可切换英文版本。更多开发说明见 README.md 和 chinese-core-images.md。</p></article>`;}
let deckChooser=null;
function beginScenario(id){captureSetup();const n=setupDraft.players,seed=Number(setupDraft.seed)||Date.now(),first=setupDraft.first,ids=setupDraft.decks.slice(0,n),sess=pendingSession;let cfgs;try{cfgs=PlayerUI.configs(n,ids);}catch(e){toast(e.message);return;}mutate(()=>{state=E.create(id,n,seed,cfgs,{deferSetup:true,first,difficulty:(sess&&sess.difficulty)||'normal'});state.windowPrefs={mode:(sess&&sess.windowMode)||'smart',muted:[]};if(sess)state.session={name:sess.name||'',mode:sess.mode,difficulty:sess.difficulty,scenario:id};handView=0;});pendingSession=null;}
function openChooser(id){const n=setupDraft.players,fallback=['starter-leadership','starter-tactics','starter-spirit','starter-lore'],picks=Array.from({length:n},(_,i)=>{const want=setupDraft.decks[i]||fallback[i];return PlayerUI.deckById(want)?want:(PlayerUI.deckById(fallback[i])?fallback[i]:null);});deckChooser={scenario:id,players:n,player:Math.max(0,picks.findIndex(x=>!x)),tab:'existing',picks};tab='table';render();}
function chooserPage(){const c=deckChooser,sc=D.scenarios.find(x=>x.id===c.scenario)||{name:'剧本'},picks=c.picks,ready=picks.slice(0,c.players).every(Boolean);
 return `<div class="deck-chooser"><div class="chooser-head"><div><div class="eyebrow">SCENARIO SETUP</div><h1>选择你的牌组</h1><p class="muted">${enc(sc.name)} · ${c.players} 人同机 · 每位玩家各选一副</p></div><button data-action="chooserCancel">返回</button></div>
 <div class="chooser-tabs"><button data-action="chooserTab" data-value="existing" class="${c.tab==='existing'?'active':''}">使用已有牌组</button><button data-action="chooserTab" data-value="new" class="${c.tab==='new'?'active':''}">创建新卡组</button></div>
 ${c.players>1?`<div class="player-tabs chooser-players" role="group" aria-label="选择牌组的玩家">${Array.from({length:c.players},(_,i)=>`<button data-action="chooserPlayer" data-player="${i}" class="${i===c.player?'active':''}" aria-pressed="${i===c.player}">玩家${i+1}${picks[i]?' · 已选':' · 未选'}</button>`).join('')}</div>`:''}
 <div class="chooser-body">${c.tab==='existing'?PlayerUI.deckGrid(picks,c.player):`<div class="chooser-new"><p class="small muted">粘贴 RingsDB 牌组链接，导入后直接选给玩家${c.player+1}；也可以先去组卡器自己配牌，保存后再回到这里选用。</p><div class="actions"><input id="chooser-url" placeholder="RingsDB 牌组链接或编号" aria-label="RingsDB 牌组链接"><button class="primary" data-action="chooserImportUrl">导入并选用</button><button data-action="chooserBuilder">去组卡器创建</button></div></div>`}</div>
 <div class="chooser-foot"><span class="small muted">${picks.map((id,i)=>`玩家${i+1}：${id?enc(PlayerUI.deckName(id)):'未选择'}`).join(' · ')}</span><button class="primary" data-action="chooserConfirm" ${ready?'':'disabled'}>开始远征</button></div></div>`;}
async function handleNewGame(b){const a=b.dataset.action;
 const nameEl=$('#ng-name');if(nameEl&&newGame&&newGame.step==='settings'&&a!=='ngBack')newGame.name=String(nameEl.value||'');
 if(a==='ngOpen'){const kind=b.dataset.kind,id=b.dataset.id;
  const g={step:'settings',tab:(newGame&&newGame.tab)||'revised',series:'core',mode:'campaign',pack:null,name:'',difficulty:'normal',windowMode:'smart',advanced:false};
  if(kind==='legacy'){g.series=id;}
  else if(kind==='pod'){g.mode='standalone';g.pack=id;}
  newGame=g;render();return;}
 if(a==='ngTab'){newGame={...(newGame||{}),step:'list',tab:b.dataset.value};render();return;}
 if(a==='ngBack'){newGame=null;render();return;}
 if(a==='ngLocked'){toast('「'+(b.dataset.name||'该剧本')+'」目前只是封面占位，剧本内容待实现。');return;}
 if(a==='ngPlayers'){const sel=$('#playerCount');if(sel)sel.value=b.dataset.value;captureSetup();render();return;}
 if(a==='ngMode'){newGame.mode=b.dataset.value;if(newGame.mode==='campaign')newGame.pack=null;render();return;}
 if(a==='ngScenario'){newGame.mode='standalone';newGame.pack=b.dataset.value;render();return;}
 if(a==='ngDifficulty'){newGame.difficulty=b.dataset.value;render();return;}
 if(a==='ngWindow'){newGame.windowMode=b.dataset.value;render();return;}
 if(a==='ngNext'){newGame.name=String(newGame.name||'').trim();captureSetup();
  const s=seriesById(newGame.series),packs=s.packs||[];
  const target=newGame.mode==='standalone'?(packs.find(p=>p.id===newGame.pack)||packs[0]):packs[0];
  if(!target||!target.playable){toast('「'+((target&&(target.zh||target.name))||'该剧本')+'」的剧本内容尚未实现。');return;}
  pendingSession={name:newGame.name,mode:newGame.mode,difficulty:newGame.difficulty,windowMode:newGame.windowMode,scenario:target.id};newGame=null;openChooser(target.id);return;}
}
async function handleChooser(b){const a=b.dataset.action,c=deckChooser;if(!c)return;
 if(a==='chooserCancel'){deckChooser=null;render();return;}
 if(a==='chooserTab'){c.tab=b.dataset.value;render();return;}
 if(a==='chooserPlayer'){c.player=Number(b.dataset.player);render();return;}
 if(a==='chooserPick'){const p=Number(b.dataset.player),id=b.dataset.deck;c.picks[p]=id;const next=c.picks.findIndex(x=>!x);c.player=next>=0?next:Math.min(p,c.players-1);render();return;}
 if(a==='chooserBuilder'){deckChooser=null;PlayerUI.startBuild();tab='decks';render();toast('在「我的卡组 → 编辑牌组」配好牌并保存后，回到首页重新开始远征就能选用。');return;}
 if(a==='chooserImportUrl'){const input=document.querySelector('#chooser-url'),raw=String(input&&input.value||'').trim(),m=raw.match(/(?:decklist|deck)\/(?:view\/)?(\d+)/i)||raw.match(/^(\d+)$/);if(!m){toast('无法识别牌组编号；示例 https://ringsdb.com/decklist/view/12345');return;}const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),15000);try{const res=await fetch('https://ringsdb.com/api/public/decklist/'+m[1],{signal:ctrl.signal,headers:{Accept:'application/json'}});if(!res.ok)throw Error('RingsDB 返回 HTTP '+res.status);const saved=PlayerUI.saveDeck(PlayerCards.fromRingsdb(await res.json()));c.picks[c.player]=saved.id;const next=c.picks.findIndex(x=>!x);if(next>=0)c.player=next;render();toast('已导入并选给玩家'+(c.player+1)+'：'+saved.name);}catch(e){toast(e.name==='AbortError'?'RingsDB 请求超时（15秒）；国内网络通常无法访问':'导入失败：'+e.message);}finally{clearTimeout(timer);}return;}
 if(a==='chooserConfirm'){for(let i=0;i<c.players;i++)setupDraft.decks[i]=c.picks[i];const id=c.scenario;deckChooser=null;beginScenario(id);return;}
}
function render(){captureSetup();document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active'));const navBtn=$('#'+({table:'tableTab',decks:'decksTab',catalog:'catalogTab',help:'helpTab'}[tab]));if(navBtn)navBtn.classList.add('active');/* 弹窗状态跟着引擎走：每次重绘前先问一次「现在有没有要玩家决定的」。
     有且是新出现的就自动展开；已经收起过的不再反复弹，只留角标。 */
 if(tab==='table'&&state&&!deckChooser)DecisionUI.sync(state,handView);else DecisionUI.reset();
 $('#app').innerHTML=tab==='table'?(deckChooser?chooserPage():table()):tab==='decks'?(PlayerUI.isBuilding()?PlayerUI.builder():PlayerUI.decksPage()):tab==='catalog'?catalog():help();$('#undo').disabled=!history.length;$('#export').disabled=!state;if(tab==='table'&&state&&$('#hand-player'))$('#hand-player').onchange=ev=>{handView=Number(ev.target.value);render();};if(tab==='table'&&state&&$('#planning-actor'))$('#planning-actor').onchange=ev=>{handView=Number(ev.target.value);render();};if(tab==='table'&&state)QuestUI.bind();if(tab==='table'&&!state)bindSetup();if(tab==='decks'){PlayerUI.bindDecks();PlayerUI.bind();}ImageLibrary.bindErrors(document.querySelector('#app'));if(tab==='catalog'){filterCatalog();const si=$('#search');if(si)si.oninput=filterCatalog;const pf=$('#podFilter');if(pf)pf.onchange=()=>{podFilter=pf.value||'';render();};}trackView();}
async function choose(title,body,read){return new Promise(resolve=>{let d=document.createElement('dialog');d.innerHTML=`<h2>${enc(title)}</h2><div>${body}</div><div class="actions"><button class="primary" id="ok">确认</button><button id="cancel">取消</button></div>`;document.body.append(d);d.showModal();d.querySelector('#ok').onclick=()=>{let v=read(d);d.close();d.remove();resolve(v);};d.querySelector('#cancel').onclick=()=>{d.close();d.remove();resolve(null);};d.oncancel=()=>{d.remove();resolve(null);};});}
function playerOptions(){return state.players.filter(p=>!p.eliminated).map(p=>`<option value="${p.id}">${enc(p.name)}</option>`).join('');}
$('#app').onclick=async ev=>{const b=ev.target.closest('[data-action]');if(!b||b.disabled)return;const a=b.dataset.action,uid=Number(b.dataset.uid),id=Number(b.dataset.id),pid=Number(b.dataset.player);
 if(a==='decide'){DecisionUI.handle(b.dataset.decide);return;}
 if(a==='desktop'){DesktopUI.handle(b);return;}
 if(a==='logScope'){const v=b.dataset.scope;if(!['round','all'].includes(v))return;logScope=v;render();return;}
 if(a==='logToggle'){logOpen=!logOpen;render();return;}
 if(a==='undoLog'){const seq=Number(b.dataset.seq),j=seq-historyBase;
  if(!Number.isInteger(seq)||j<0||j>=history.length)return;
  /* 回退到该次操作之前：状态、历史、日志标记一起截断到那一刻。 */
  state=history[j];history=history.slice(0,j);logMarks=logMarks.filter(m=>m.seq<seq);save();render();return;}
 if(a==='windowFlow'){WindowUI.handle(b);return;}
 if(a==='refreshFlow'){await RefreshUI.handle(b);return;}
 if(a==='combatFlow'){await CombatUI.handle(b);return;}
 if(a==='encounterFlow'){await EncounterUI.handle(b);return;}
 if(a==='travelFlow'){await TravelUI.handle(b);return;}
 if(a==='quest'){await QuestUI.handle(b);return;}
 if(a==='planning'){await PlanningUI.handle(b);return;}
 if(a==='images'){ImageLibrary.handle(b);return;}
 if(a==='catSide'){catalogSide=b.dataset.value;render();return;}
 if(a==='catView'){catalogView=b.dataset.value;render();return;}
 if(a==='catNav'){catSection=b.dataset.section||'base';render();return;}
 if(a==='pc'){await PlayerUI.handle(b);return;}
 if(a==='start'){beginScenario(b.dataset.id);return;}
 if(a==='startOpen'){openChooser(b.dataset.id);return;}
 if(a.startsWith('ng')){await handleNewGame(b);return;}
 if(a.startsWith('chooser')){await handleChooser(b);return;}
 if(a.startsWith('deck')){if(await PlayerUI.handleDecks(b))return;if(a==='deckGoSetup'){tab='table';render();return;}}
 if(a==='starterTest'){captureSetup();const idx=Math.min(Math.max(Number(b.dataset.player||0),0),setupDraft.players-1),next='starter-'+b.dataset.sphere,prior=setupDraft.decks[idx],other=setupDraft.decks.indexOf(next);if(other>=0&&other!==idx)setupDraft.decks[other]=prior;setupDraft.decks[idx]=next;if($('#pc-deck-'+idx))$('#pc-deck-'+idx).value=next;if(other>=0&&other!==idx&&$('#pc-deck-'+other))$('#pc-deck-'+other).value=prior;render();toast('已为玩家'+(idx+1)+'选择'+(b.dataset.name||'预组牌')+'；请选择剧本并点击开始远征。');return;}
 if(a==='keepHand'||a==='mulligan'){mutate(()=>{E.openingChoice(state,pid,a==='mulligan');
  /* v0.15.67：全员已确认起始手牌时自动执行剧本设置，不再需要额外点确认按钮。 */
  if(state.players.every(p=>p.openingConfirmed))E.startScenario(state);});return;}
 if(a==='finishSetup'){mutate(()=>E.startScenario(state));return;}
 if(a==='setupDraw'){mutate(()=>E.setupRevealStep(state));return;}
 if(a==='setupResolve'){mutate(()=>E.setupRevealStep(state));return;}
 if(a==='setupCancel'){mutate(()=>E.setupCancel(state,b.dataset.value));return;}
 if(a==='reset'){if(confirm('结束当前桌面并重新选择剧本？建议先导出存档。'))mutate(()=>state=null);return;}
 if(a==='travel'&&state.traveling){await TravelUI.handle({dataset:{travel:'propose',uid:String(uid)}});return;}
 if(a==='travel'){let c=state.staging.find(c=>c.uid===uid),paid=false;if([77,78,94].includes(c.id)){paid=confirm(c.rule+'\n请确认费用可合法支付；角色/手牌费用须自行处理，山脉翻牌由程序处理。');if(!paid)return;}mutate(()=>E.travel(state,uid,paid));return;}
 if(a==='engage'&&state.encountering){toast('请在上方遭遇面板暂定交战玩家与敌人，全队确认后执行。');return;}
 if(a==='engage'){let p=await choose('选择主动交战玩家',`<p>每位玩家每遭遇阶段最多主动交战1名敌人。</p><select id="p">${playerOptions()}</select>`,d=>+d.querySelector('#p').value);if(p!==null)mutate(()=>E.engage(state,uid,p));return;}
 if(a==='claim'){let v=await choose('领取目标',`<p>请自行核对该英雄的其他受限附属；领取后该玩家威胁+2。</p><label>玩家 <select id="p">${playerOptions()}</select></label><p><label>英雄位置 <select id="h">${Array.from({length:Math.max(...state.players.map(p=>p.heroes.length))},(_,i)=>`<option value="${i}">第${i+1}名（须存在且非囚犯）</option>`).join('')}</select></label></p>`,d=>[+d.querySelector('#p').value,+d.querySelector('#h').value]);if(v)mutate(()=>E.claim(state,uid,...v));return;}
 if(a==='extraShadow'){let n=await choose('因卡牌效果补发暗影牌','<p>例如夜间集结的暗影效果，按玩家人数补发；之后继续翻开尚未结算的暗影。</p><input id="n" type="number" min="1" max="20" value="1">',d=>+d.querySelector('#n').value);if(n!==null)mutate(()=>E.extraShadow(state,uid,n));return;}
 if(a==='progress'){let n=await choose('卡牌效果：放置进度','<p>用于卡牌效果产生的额外进度；默认先进入当前地点。常规探险请使用“结算本回合探险”。</p><input id="n" type="number" min="0" value="1">',d=>+d.querySelector('#n').value);if(n!==null)mutate(()=>E.addProgress(state,n));return;}
 if(a==='defeat'&&!confirm('确认已手动完成合法的攻击、伤害计算及相关响应，并击败该敌人？'))return;
 if(a==='editPlayer'){const p=state.players[pid];let v=await choose('登记玩家与英雄',`<p class="small">仅登记名称及初始威胁，不导入或自动结算英雄能力。囚犯按英雄位置追踪。</p><p><input id="name" value="${enc(p.name)}" aria-label="玩家名称"></p>${p.heroes.map((h,i)=>`<p><input id="h${i}" value="${enc(h)}" aria-label="英雄${i+1}"></p>`).join('')}<p>威胁 <input id="n" type="number" min="0" max="100" value="${p.threat}"></p>`,d=>({name:d.querySelector('#name').value,heroes:[0,1,2].map(i=>d.querySelector('#h'+i).value),threat:+d.querySelector('#n').value}));if(v)mutate(()=>{if(!v.name||v.heroes.some(h=>!h)||!Number.isInteger(v.threat)||v.threat<0)throw Error('请填写有效名称与威胁。');p.name=v.name;p.heroes=v.heroes;E.adjustThreat(state,p,v.threat-p.threat);});return;}
 /* 智能推进：一次点击把本阶段结清并进入下一阶段。引擎只在「没有必须由玩家决定的事」时才往前走，
     走不动就把一句人话提示带回来（形如「等待玩家2 提交派遣名单」），不吞掉任何需要玩家做的选择。 */
 /* v0.15.46：endPhase 是现在唯一的阶段推进入口。以前只有 handlers.next 会调
    enableDiscussion，走「结束阶段」进探险时 discussion 没有置位，submitDeployment
    就把第二位玩家的提交当成「全员已确认」直接锁定执行，二次确认整段被跳过。
    在这里统一补上，两条推进路径行为一致。 */
 if(a==='endPhase'){mutate(()=>{const r=E.endPhase(state),said=r.steps.filter(Boolean);if(state.phase===2&&state.questing)E.questing.enableDiscussion(state);toast(said.length?said.join(' · '):'本阶段还有必须由你处理的事项，见角色卡下方的清单。');});if(state&&state.status==='playing'){const p=E.planning.active(state);if(p!==null&&p!==undefined)handView=p;}return;}
 const handlers={next:()=>{E.nextPhase(state);if(state.phase===2&&state.questing)E.questing.enableDiscussion(state);const p=E.planning.active(state);if(p!==null&&p!==undefined)handView=p;},stage:()=>E.stage(state),advance:()=>E.advance(state),questResult:()=>E.resolveQuest(state,+$('#willpower').value),checks:()=>E.encounterChecks(state),shadows:()=>E.shadows(state),shadow:()=>E.revealShadows(state,uid),defeat:()=>E.defeat(state,uid),returnEnemy:()=>E.returnEnemy(state,uid),returnObjective:()=>E.returnObjective(state,uid),rescue:()=>E.rescue(state,id),resolve:()=>E.resolve(state,id,$('#choice-'+id)?.value),threat:()=>{E.adjustThreat(state,state.players[pid],Number(b.dataset.n));},discardCondition:()=>{let i=state.conditions.findIndex(c=>c.uid===uid);if(i>=0)state.discard.push(...state.conditions.splice(i,1));}};
 if(handlers[a])mutate(handlers[a]);
};
const decksTab=$('#decksTab');if(decksTab)decksTab.onclick=()=>{tab='decks';render();};
$('#tableTab').onclick=()=>goHome();$('#catalogTab').onclick=()=>{tab='catalog';render();};$('#helpTab').onclick=()=>{tab='help';render();};
/* 页签上的卡池数量原为 shell.html 里写死的 55，卡池一扩就骗人，这里按数据回填。 */
const catalogBadge=document.querySelector('#catalogTab span');if(catalogBadge)catalogBadge.textContent=String(catalogStats().total);
$('#undo').onclick=()=>{if(history.length){state=history.pop();save();render();}};
$('#export').onclick=()=>{if(!state)return;let blob=new Blob([JSON.stringify({format:'lotr-scenario-save',version:1,state},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`lotr-${state.scenario}-round-${state.round}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('#import').onchange=async ev=>{const f=ev.target.files[0];if(!f)return;try{if(f.size>5000000)throw Error('存档过大。');const v=JSON.parse(await f.text());if(v.format!=='lotr-scenario-save'||v.version!==1||!v.state||!D.scenarios.some(s=>s.id===v.state.scenario)||!D.quests.some(q=>q.id===v.state.quest)||!Array.isArray(v.state.players)||v.state.players.length<1||v.state.players.length>4||!Array.isArray(v.state.deck)||!Array.isArray(v.state.pending))throw Error('不是此版本的有效存档。');if(state&&!confirm('导入将覆盖当前桌面；可撤销恢复。'))return;mutate(()=>{state=v.state;if(state.phase===2&&state.questing)E.questing.enableDiscussion(state);});tab='table';render();toast('存档已导入。');}catch(e){toast('导入失败：'+e.message);}finally{ev.target.value='';}};
if(state){const restored=E.clone(state);try{E.windows.run(state);autoAdvance();E.windows.run(state);save();}catch(e){state=restored;toast('自动推进已暂停：'+e.message);}}
/* 视图历史：tab + 新游戏步骤 + 选牌状态组成签名，只有签名变化才入栈，
   这样浏览器与顶栏的 ← → 都能在「列表 / 设置 / 选牌 / 各页签」之间前进后退。 */
const HAS_VIEW_HISTORY=typeof window!=='undefined'&&window.history&&typeof window.history.pushState==='function';
let viewKey='',viewMax=0,restoringView=false;
function viewSnapshot(){return {tab,ng:newGame?JSON.stringify(newGame):null,chooser:deckChooser?JSON.stringify(deckChooser):null};}
function viewSignature(){return tab+'|'+(newGame?[newGame.step,newGame.tab,newGame.series,newGame.mode,newGame.pack].join(':'):'')+'|'+(deckChooser?['c',deckChooser.scenario,deckChooser.player,deckChooser.tab].join(':'):'');}
function syncHistoryButtons(depth){const back=$('#navBack'),fwd=$('#navFwd');if(back)back.disabled=depth<=0;if(fwd)fwd.disabled=depth>=viewMax;}
function trackView(){if(!HAS_VIEW_HISTORY||restoringView)return;const key=viewSignature();if(key===viewKey)return;viewKey=key;
 const depth=((window.history.state&&window.history.state.depth)||0)+1;if(depth>viewMax)viewMax=depth;
 window.history.pushState({...viewSnapshot(),depth},'');syncHistoryButtons(depth);}
function restoreView(data){tab=(data&&data.tab)||'table';if(tab==='players')tab='decks';newGame=data&&data.ng?JSON.parse(data.ng):null;deckChooser=data&&data.chooser?JSON.parse(data.chooser):null;viewKey=viewSignature();render();}
function goHome(){tab='table';newGame=null;deckChooser=null;render();}
if(HAS_VIEW_HISTORY){
 window.history.replaceState({...viewSnapshot(),depth:0},'');viewKey=viewSignature();
 window.addEventListener('popstate',ev=>{restoringView=true;try{restoreView(ev.state);}finally{restoringView=false;}syncHistoryButtons((ev.state&&ev.state.depth)||0);});
}
const navBack=$('#navBack');if(navBack)navBack.onclick=()=>{if(HAS_VIEW_HISTORY)window.history.back();};
const navFwd=$('#navFwd');if(navFwd)navFwd.onclick=()=>{if(HAS_VIEW_HISTORY)window.history.forward();};
if(HAS_VIEW_HISTORY)syncHistoryButtons(0);
/* 分享链接（#deck=…）优先于恢复上次视图：拿到别人的链接就该看到那副牌。 */
if(typeof PlayerUI!=='undefined'&&PlayerUI.openSharedDeck&&PlayerUI.openSharedDeck())tab='decks';
/* 调试与自动化验收出口：仅暴露「让引擎重绘」的最小接口，避免外部直接改内部状态后界面不同步。 */
if(typeof window!=='undefined')window.LOTR={get state(){return state;},get E(){return E;},refresh:()=>render()};
render();
