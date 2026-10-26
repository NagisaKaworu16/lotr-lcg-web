/* Tabletop view: UI drafts never pay, exhaust, reveal, or bypass phase validation. */
/* 界面版本徽标唯一来源：须与 CHANGELOG.md 最新条目标题一致（planning-dom-tests 有校验）。 */
const APP_VERSION='v0.15.69';
/* ── 决策弹窗（v0.15.62）──────────────────────────────────────────────
   底部长住的那块阶段面板已经去掉（和角色区右上角的「结束阶段」重复，还白占一行高度）。
   需要玩家拍板的事不再常驻显示，改成「轮到你决定时才弹出来」。

   判据沿用 ArkhamHorror 的那条线，不是凭感觉分的：
     · 规则书写 must（强制结算、自动抽牌加资源）→ 引擎算完，只在日志留一句，绝不弹窗；
     · 规则书写 may / choose / up to（选目标、选响应、选防御者、定投入名单）→ 必须问人，才弹。
   所以 decide() 只认「引擎自己下不了结论的那些点」，其余一律返回 null，界面上什么也不出现。

   为什么不用 dialog.showModal()：PlanningUI.form() 内层已经占了一个 <dialog>，
   两层 showModal 叠在一起时，后开的会抢焦点、关掉时把前一层的 backdrop 也带走。
   这里改成普通定位层 + 自己管焦点，内层 dialog 才能正常浮在它上面（z-index 见 CSS）。 */
const DecisionUI=(()=>{
 /* 本模块独立于 DesktopUI 的闭包，所以依赖在这里自取，不靠外层作用域。
    早期版本直接写 esc()/setupPendingReveal()，一移出闭包就在 render() 里炸「not defined」——
    render() 的异常会被 mutate() 的 catch 吞掉并回滚整个状态，症状是「按钮点了没反应」。 */
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const setupOpen=s=>DesktopUI.setupPendingReveal(s);
 /* 测量必须在排版之后做（连续两帧），但 requestAnimationFrame 不是处处都有——
    Node 的 DOM 测试环境里就没有，直接调用会让 render() 抛 ReferenceError，
    而 render() 的异常会被 mutate() 吞掉并回滚，症状是「点了按钮没反应」。
    没有 rAF 时退化成同步调用：布局测量在测试里反正用不到，但绝不能因此中断渲染。 */
 const nextFrame=fn=>(typeof requestAnimationFrame==='function')?requestAnimationFrame(fn):(fn(),0);

 /* 当前是否真的需要玩家决定。返回 null 表示「没有要问的」，调用方据此决定弹不弹。 */
 function pending(s,pid,door){
  if(!s||s.status!=='playing')return null;
  /* 设置流程也归弹窗（v0.15.64）：开局弃牌与剧本设置揭示都只在轮到你决定时弹，
     底部 mat-phase 深色面板整个移除。揭示进行中不再弹弃牌面板（全员已确认）。 */
  /* 弃牌期（含全员已确认、尚未开始揭示）始终弹：面板里有唯一的「确认手牌并执行剧本设置」按钮 */
  if(s.setupPending&&!DesktopUI.setupPendingReveal(s)){
   const op=PlayerUI.openingPanel(s);
   if(op)return {kind:'opening',title:'开局 · 起始手牌',body:op};
  }
  const sp=DesktopUI.setupPanel(s);
  if(sp)return {kind:'setup',title:'剧本设置 · 翻开遭遇牌',body:sp};
  /* 开局弃牌与设置揭示属于设置流程，仍留在牌桌上，不进弹窗。 */
  const m=DesktopUI.mode(s,pid);
  /* quest 草稿的控制台由 QuestUI.picker 提供（阶段面板已接）；
     defense/attack 的草稿面板（含「基础伤害预估」与提交按钮）在这里进弹窗。
     v0.15.62 重构时误把 attack 也排除了，玩家在牌桌上点完目标与攻击者后
     看不到任何预览与提交按钮——selectTitle 里留着「选择攻击目标」就是证据。 */
  if(m&&m.kind!=='quest')return {kind:'select',title:selectTitle(m),body:DesktopUI.selection(s,m)};
  /* 阶段面板整块归弹窗：里面每一条都是「引擎没法替人下结论」的东西
     （放弃/取消放弃、开始投入、逐张翻牌、二次确认）。以前它同时渲染在操作条与底部，
     三处同一份内容，玩家得决定该看哪儿。 */
  const pnl=phasePanel(s,pid,m);
  if(pnl)return {kind:'phase'+(pnl.kind||''),title:pnl.title,body:pnl.html+windowTail(s)};
  /* 行动窗口（智能模式下可用的能力与「本次跳过」）在没有专属阶段面板时单独出现。
     v0.15.62 把阶段面板整体搬进弹窗后，这块原来由 DesktopUI.taskPanel 渲染，
     而 taskPanel 从此不再被调用——智能模式下玩家会看不到任何可用能力，
     也没法跳过某个窗口。这里兜一层：引擎说有事可做，就给它一个独立的「可做的事」。 */
  /* 只在智能模式下兜这一层：详细模式的各阶段面板自带完整控制，
     再拼一份会出现两个「放弃本窗口行动」之类的重复按钮。 */
  const win=windowTail(s);
  if(win)return {kind:'window',title:'可做的事',body:win};
  return null;
 }
 /* 智能模式下的行动窗口：可用的能力、以及每张的「本次跳过」。
    详细模式的阶段面板自带这些控制，重复拼接会出现两个「放弃本窗口行动」。 */
 function windowTail(s){
  try{
   if(ScenarioEngine.windows.settings(s).mode==='detailed')return '';
   return WindowUI.panel(s)||'';
  }catch(e2){ return ''; }
 }
 function selectTitle(m){return m.kind==='attack'?'选择攻击目标':'选择要处理到的角色';}
 /* 每个阶段挑「这块面板该不该给玩家看」。
   判据只有一条：这一步引擎自己能不能走完？
     · 能（如探险已结算完、只差一句「点结束阶段」）→ 不给面板，操作条只留摘要；
     · 不能（等谁放弃行动、等人选旅行点、等人提交名单）→ 给面板，弹窗里问。
   返回 {title,html,kind} 或缺省。 */
 function phasePanel(s,pid,m){
  const q=s.questing,t=s.traveling,e=s.encountering,c=s.combat,r=s.refreshing;
  if(s.phase===1){
   if(!s.planning||s.planning.completed)return null;
   const R=ScenarioEngine.planning;
   /* 计划阶段「轮到我出牌」是常驻状态而非突发事件：面板给，但不打断，只留角标。 */
   if(!R.choiceSpec(s)&&!s.players.some(p=>!p.eliminated&&p.hand.length&&!s.planning.finalPasses.includes(p.id)))return null;
   return {title:'计划阶段 · 出牌与响应',html:PlanningUI.panel(s,pid),kind:''};
  }
  if(s.phase===2){
   if(!q)return null;
   if(q.completed)return null;
   /* 智能模式下 QuestUI.panel 只给状态不给按钮（那组按钮历来由 picker 提供，
     以前渲染在操作条里）。现在操作条只剩摘要，所以这里必须把 picker 的内容接上，
     否则「投入前行动窗口」会变成一个只有「已投入：无人」、没有任何可点控件的空面板。 */
   const detail=ScenarioEngine.windows.settings(s).mode==='detailed';
   let html=detail?QuestUI.panel(s,pid):'';
   if(!detail){
    /* picker 是「控制 + 状态」的完整一块（自带意志／威胁行），但它只管到「提交名单」为止。
       全员提交之后的「二次确认派遣」在 QuestUI.panel 的 discussion 分支里，picker 从来不渲染——
       以前靠操作条之外的地方兜，现在只有弹窗，必须把它接上，否则名单齐了就再也点不动。 */
    /* 名单全部提交后的讨论期，picker 只剩一颗「取消确认，修改派遣」，而 panel 里有
       同样的这颗 + 两人的「二次确认派遣」。两份拼起来会看到两个一模一样的按钮，
       所以这一个阶段只取 panel，不拼 picker。 */
    const allIn=(q.order||[]).length>0&&q.order.every(id=>{const d=q.deployments&&q.deployments[id];return d&&d.confirmed;});
    if(q.deploymentLocked||allIn){
     /* 锁定后 picker 一律返回空（它只管「还没投」的那一段），控制全在 panel 里：
        投入响应「选择并结算」、逐张探查。所以锁定期和讨论期都取 panel。 */
     html=QuestUI.panel(s,pid)||'';
    }else{
     html=(QuestUI.picker(s,pid)||'')||(q.step==='staging'&&q.current?(QuestUI.revealCard(s)||''):'');
    }
    /* 这里不能再提前 return null：下面还有「名单锁定期只读状态卡」要兜。
       之前把 return 写在这个 if 里，锁定后 html 恒为空，弹窗和角标一起消失。 */
   }
   /* 名单锁定、正在按顺序横置与结算投入响应——这一段玩家没有选择可做，
      但也不能让弹窗彻底消失：刚点完「二次确认」就什么都不见了，人会以为卡住。
      给一张只读状态卡，说明引擎正在做什么、还差谁。 */
   if(!html&&!q.completed){
    const done=Object.keys(q.deployments||{}).filter(id=>q.deployments[id]?.confirmed).length,total=(q.order||[]).length;
    html=`<p class="small muted">引擎正在按起始玩家顺序横置已投入的角色并结算投入响应。这一步没有需要你决定的事，稍候即可。</p>
     <ul class="decide-list">${(q.order||[]).map(id=>`<li class="${q.deployments?.[id]?.confirmed?'ok':''}">${q.deployments?.[id]?.confirmed?'✓':'·'} ${esc(s.players[id]?.name||('玩家'+(id+1)))}</li>`).join('')}</ul>
     <p class="small">已确认 ${done}/${total} 人。</p>`;
   }
   if(!html)return null;
   return {title:'探险阶段 · '+(QuestUI.stepName(q.step)||'进行中'),html,kind:''};
  }
  if(s.phase===3){
   if(!t||t.completed)return null;
   return {title:'旅行阶段',html:TravelUI.panel(s,pid),kind:''};
  }
  if(s.phase===4){
   if(!e||e.completed)return null;
   return {title:'遭遇阶段',html:EncounterUI.panel(s,pid),kind:''};
  }
  if(s.phase===5){
   if(!c||c.completed)return null;
   return {title:'战斗阶段',html:CombatUI.panel(s,pid),kind:''};
  }
  if(s.phase===6){
   if(!r||r.completed)return null;
   return {title:'刷新阶段',html:RefreshUI.panel(s,pid),kind:''};
  }
  return null;
 }
 /* 放置弹窗：量一遍牌桌上真正可点的元素（手牌、角色卡、探查区卡牌、结束阶段），
    挑一个不压住它们的位置。窄屏放不下时退成底部抽屉（那时牌桌已是单列，上下滚动本来就要做）。 */
 function place(){
  const lay=document.querySelector('.decide-layer'),box=document.querySelector('.decide-box');
  if(!lay||!box)return;
  const vw=document.documentElement.clientWidth,vh=document.documentElement.clientHeight;
  /* 用实测判断「是不是单列」，不用写死的宽度阈值：
     单列时日志轴会掉到玩家区下方（rail.top 明显大于 mat.top），双列时两者顶对齐。
     1100~1280 这一段断点是「双列但很窄」，光看宽度会误判成双列，实测才不会。 */
  const mat=document.querySelector('.player-mat'),rail=document.querySelector('.tabletop-rail');
  const stacked=!mat||!rail||rail.getBoundingClientRect().top>=mat.getBoundingClientRect().bottom-8;

  /* 可点元素的右缘与下缘：弹窗必须让开这两条线。 */
  const boxes=[...document.querySelectorAll('.hand-card,.character-card,.encounter-card,.own-characters,.hand-zone')]
   .map(e=>e.getBoundingClientRect()).filter(r=>r.width&&r.height);
  const rightMost=boxes.reduce((m,r)=>Math.max(m,r.right),0);
  const bottomMost=boxes.reduce((m,r)=>Math.max(m,r.bottom),0);
  const gap=14;

  if(!stacked){
   /* 双列：往右列留白里塞。宽度＝屏幕右缘到可点区右缘。 */
   const avail=vw-rightMost-gap*2;
   if(avail>=300){
    const w=Math.min(560,Math.max(300,avail));
    box.style.setProperty('--decide-w',w+'px');
    lay.style.justifyContent='flex-end';lay.style.alignItems='flex-start';
    /* 优先贴日志轴左缘（挡住只读列代价最小），但绝不越过可点区右缘。 */
    const railLeft=rail?rail.getBoundingClientRect().left:vw;
    lay.style.paddingLeft=Math.max(rightMost+gap,railLeft-w-gap)+'px';
    lay.style.paddingRight=gap+'px';
    box.style.maxHeight='calc(100vh - 110px)';
    return;
   }
  }
  /* 单列 / 右侧没空间：留到牌桌下方的空白里。
     这里不用「贴屏幕底」，而是贴「可点区下缘 + 间距」——手牌下方通常还有一段空白，
     弹窗正好落在那儿；真没空白时再退回贴底。 */
  const roomBelow=vh-bottomMost-gap*2;
  lay.style.justifyContent='center';lay.style.alignItems='flex-start';
  box.style.setProperty('--decide-w','100%');
  lay.style.paddingLeft=gap+'px';lay.style.paddingRight=gap+'px';
  /* 只要下方还留得下一段（>=120px，够显示两行正文），就放在下方——
     宁可让弹窗矮一点要滚动，也不要去盖手牌：投名单、出牌都得点牌桌上的东西。
     以前这里用 200px 做门槛，1100×800 实测只有 156px 就被判成「放不下」，
     于是整块手牌被弹窗盖住，正是这一条踩过的坑。 */
  if(roomBelow>=120){
   lay.style.paddingTop=Math.round(bottomMost+gap)+'px';lay.style.paddingBottom=gap+'px';
   box.style.maxHeight=Math.round(roomBelow)+'px';
  }else{
   /* 下方真的只剩几十像素：只能覆盖屏幕下半截，牌桌上半部分仍可见可点。 */
   lay.style.alignItems='flex-end';lay.style.paddingTop='12px';lay.style.paddingBottom='12px';
   box.style.maxHeight='min(38vh,'+Math.round(vh*0.38)+'px)';
  }
 }

 /* 弹窗开合状态记在模块里，不进 state：它纯粹是视图态，不该污染存档与撤销栈。 */
 let openKind=null,lastKey='';
 function key(s,p){const d=pending(s,p.id===undefined?handView:p.id);return d?d.kind+'|'+d.title:'';}
 function html(s,pid){
  const d=pending(s,pid);if(!d)return '';
  /* v0.15.69：不再用浮层弹窗——待决定的内容就地渲染进手牌区「结束阶段」那块，
     标题行和按钮同行同处一块，玩家视线不用在屏幕两角之间来回跳。 */
  return `<section class="decide-inline" data-stop="1">
   <div class="decide-head"><h2>${esc(d.title)}</h2></div>
   <div class="decide-body">${d.body}</div>
  </section>`;
 }
 function handle(kind){
  /* 角标点开时也要重新定位：收起期间可能换过分辨率或转过屏。 */
  if(kind==='open'){openKind=key(state,handView).split('|')[0]||'phase';render();nextFrame(()=>{const b=document.querySelector('.decide-box');if(b)b.focus();place();});return false;}
  if(kind==='close'){openKind=null;render();return false;}
  return true;
 }
 /* 需要决定、且玩家没主动收起时，才自动展开——这是「轮到你决定时才弹」的落点。
   已经收起过就不反复弹出打断人，只留角标。 */
 function sync(s,pid){
  const k=key(s,pid);
  if(!k){openKind=null;lastKey='';return;}
  if(k!==lastKey){lastKey=k;openKind=k.split('|')[0];}
 }
 function reset(){openKind=null;lastKey='';}
 /* 转屏／改窗口时重算一次，否则弹窗还停在旧分辨率的坐标上。 */
 if(typeof window!=='undefined')window.addEventListener('resize',()=>{try{place();}catch(e){}});
 function isOpen(){return openKind!==null;}
 return {pending,html,handle,sync,reset,isOpen};
})();
const DesktopUI=(()=>{
 const E=ScenarioEngine,R=E.planning,Q=E.questing,C=E.combat,esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let combatDraft={key:'',target:null,ids:[]},draftState=null;
 const live=s=>s.players.filter(p=>!p.eliminated);
 const who=(s,id)=>esc(s.players[id]?.name||('玩家'+(id+1)));
 /* 日志回退标记由 app.js 提供（哪次操作产生了哪几条日志）；测试环境无此钩子时返回 null，只渲染不可回退的日志。 */
 const logMarks=()=>{try{return typeof APP_LOG_MARKS==='function'?APP_LOG_MARKS().logMarks:null;}catch(e){return null;}};
 /* 日志显示范围由 app.js 的视图偏好决定；模块单独加载（测试环境）时退回「本回合」。 */
 const logScope=()=>{try{return typeof APP_LOG_SCOPE==='function'?APP_LOG_SCOPE():'round';}catch(e){return 'round';}};
 /* 竖轴手动展开的阶段；模块单独加载（测试环境）时给空集合，走「未来阶段默认折叠」。 */
 const railOpen=()=>{try{return typeof APP_RAIL_OPEN==='function'?APP_RAIL_OPEN():null;}catch(e){return null;}};
 const chip=(text,tone='wait')=>`<span class="op-chip ${tone}">${esc(text)}</span>`;
 /* 诡镇网页版式代币：圆形徽章、数字居中，同型多枚层叠。数量由规则引擎结算，拖放仅作视觉表现。
    属性代币（意志/攻击/防御）是静态数值快照，不参与拖放。 */
 const tk=(type,n,drag=true)=>`<span class="tk tk-${type}${n>1?' stack':''}" data-n="${n}"><img src="assets/tokens/${type}.png" alt="" ${drag?`draggable="true" data-token="${type}"`:''}><b>${n}</b></span>`;
 const tokenRow=(cls,inner)=>inner?`<div class="card-tokens ${cls}" aria-hidden="true">${inner}</div>`:'';
 const chipRow=(s,order,done,ok,wait)=>(order||[]).map(id=>`<span class="op-chip ${(done||[]).includes(id)?'done':'wait'}">${who(s,id)} · ${(done||[]).includes(id)?ok:wait}</span>`).join('');
 const b=(label,kind,args='',disabled=false)=>`<button data-action="desktop" data-desktop="${kind}" ${args} ${disabled?'disabled':''}>${esc(label)}</button>`;
 function mode(s,pid){if(s.status!=='playing'||s.pending.length||R.context(s)?.queue?.length||R.context(s)?.tasks?.length)return null;
  if(s.phase===2&&s.questing?.step==='commit'&&!s.questing.deploymentLocked&&!s.questing.deployments?.[pid]?.confirmed)return {kind:'quest',player:pid,eligible:Q.eligible(s,pid).map(c=>c.uid)};
  if(s.phase===5&&s.combat&&!s.combat.proposal){if(s.combat.step==='defenseChoice')return {kind:'defense',player:s.combat.attack.player,eligible:C.defenders(s).map(c=>c.uid)};if(s.combat.step==='attackChoice')return {kind:'attack',player:C.activePlayer(s),eligible:[]};}return null;
 }
 function draft(s,m){const k=`${s.round}:${s.phase}:${s.combat?.step}:${m?.player}:${s.combat?.attack?.uid}`;if(draftState!==s||combatDraft.key!==k){draftState=s;combatDraft={key:k,target:null,ids:[]};}return combatDraft;}
 function ids(s,m){return m?.kind==='quest'?QuestUI.draftFor(s,m.player):draft(s,m).ids;}
 function eligible(s,m,uid){if(!m)return false;if(m.kind==='attack'){const d=draft(s,m);return d.target!==null&&C.attackers(s,m.player,d.target).some(c=>c.uid===uid);}return m.eligible.includes(uid);}
 function art(code){const rec=ImageLibrary.by[code],url=ImageLibrary.safeUrl(rec?.faces?.B||rec?.imageUrl);return url?`<img src="${esc(url)}" alt="${esc(rec.nameZhCard||rec.name||code)}" loading="lazy" referrerpolicy="no-referrer">`:'<span class="table-card-fallback">卡图暂缺<br>请查看牌名与数值</span>';}
 function inspect(code){return `<button class="inspect-card" data-action="images" data-image-action="open" data-code="${esc(code)}" aria-label="查看卡牌详情">查看</button>`;}
 function character(s,c,m){const h=c.state,v=R.find(s,c.uid)?R.stats(s,c.uid):c.meta,selectable=eligible(s,m,c.uid),selected=!!m&&ids(s,m).includes(c.uid),ability=R.abilitySpec(s,c.controller,c.uid),a=selectable?'data-action="desktop" data-desktop="pick"':!m&&ability.legal?'data-action="planning" data-plan="ability"':'',captured=c.kind==='hero'&&!s.rescued&&s.prisoner?.player===c.controller&&s.prisoner?.hero===h.index;
  return `<article class="table-card character-card ${h.exhausted?'exhausted':''} ${selectable?'selectable':''} ${selected?'selected':''} ${h.destroyed||captured?'unavailable':''}" data-card-uid="${c.uid}" aria-label="${esc(c.meta.nameZh)}：意志 ${v.willpower||0} 攻击 ${v.attack||0} 防御 ${v.defense||0} 生命 ${v.health||0}${c.kind==='hero'?' 资源 '+(h.resources||0):''} 伤害 ${h.damage||0}${selectable?'，点击选择':''}">${tokenRow('attr-tokens',tk('willpower',v.willpower||0,false)+tk('attack',v.attack||0,false)+tk('defense',v.defense||0,false)+tk('hitPoints',v.health||0,false))}<button class="card-face" ${a} data-player="${c.controller}" data-uid="${c.uid}" ${a?'':'disabled'} aria-label="${esc(c.meta.nameZh)}${selectable?'，点击选择':''}" aria-pressed="${selected}">${art(c.meta.code)}${selected?'<span class="selection-mark">已选</span>':''}</button><div class="table-card-caption"><b>${esc(c.meta.nameZh)}</b>${c.kind!=='hero'&&h.resources?`<span>资源 ${h.resources}</span>`:''}${h.destroyed||captured||h.committed?`<span>${[h.destroyed?'已离场':captured?'囚禁':'',h.committed?'已投入':''].filter(Boolean).join(' · ')}</span>`:''}</div>${tokenRow('state-tokens',c.kind==='hero'?tk('resource',h.resources||0)+tk('damage',h.damage||0):tk('damage',h.damage||0))}${inspect(c.meta.code)}</article>`;
 }
 function playerChars(s,p){return [...p.heroStates.map(h=>({kind:'hero',uid:h.uid,controller:p.id,owner:p.id,state:h,meta:R.data(s,{...h,owner:p.id})})),...p.allies.map(c=>({kind:'ally',uid:c.uid,controller:p.id,owner:c.owner,state:c,meta:R.data(s,c)}))];}
 function encounter(s,c,zone,m){const found=R.find(s,c.uid),v=found?R.stats(s,c.uid):c;let attrs='',legal=false,selected=false;
  if(s.status==='playing'&&!s.pending.length&&!R.context(s)?.queue?.length&&!R.context(s)?.tasks?.length){
   if(s.phase===3&&zone==='staging'&&c.type==='Location'&&E.traveling.spec(s,c.uid).legal){attrs='data-action="travelFlow" data-travel="propose"';legal=true;}
   else if(s.phase===4&&s.encountering?.step==='optional'&&zone==='staging'&&c.type==='Enemy'){try{E.encountering.propose(JSON.parse(JSON.stringify(s)),handView,c.uid);attrs=`data-action="desktop" data-desktop="engage" data-player="${handView}"`;legal=true;}catch{}}
   else if(s.phase===5&&s.combat?.step==='enemyChoice'&&C.pendingEnemies(s,C.activeEnemyPlayer(s)).some(e=>e.uid===c.uid)){attrs=`data-action="combatFlow" data-combat="enemy" data-player="${C.activeEnemyPlayer(s)}"`;legal=true;}
   else if(m?.kind==='attack'&&C.attackTargets(s,m.player).some(e=>e.uid===c.uid)){attrs='data-action="desktop" data-desktop="target"';legal=true;selected=draft(s,m).target===c.uid;}
  }
  const stats=c.type==='Enemy'?`威胁 ${v.threat||0} · 攻击 ${v.attack||0} · 防御 ${v.defense||0}<br>伤害 ${c.damage||0}/${v.health||0} · 交战 ${c.engagement??'—'}`:c.type==='Location'?`威胁 ${v.threat||0} · 进度 ${c.progress||0}/${c.quest}`:c.holder?`持有：${esc(s.players[c.holder.player].name)}`:c.guard?'守卫尚未清除':'可领取';
  return `<article class="table-card encounter-card ${legal?'selectable':''} ${selected?'selected':''}" data-card-uid="${c.uid}"><button class="card-face" ${attrs} data-uid="${c.uid}" ${legal?'':'disabled'} aria-label="${esc(c.name)}" aria-pressed="${selected}">${art('enc-'+c.id)}${selected?'<span class="selection-mark">目标</span>':''}</button><div class="table-card-caption"><b>${esc(c.name)}</b><span>${stats}</span>${c.shadows?`<span>暗影 ${c.shadows.length} · 已翻开 ${c.shadows.filter(x=>x.revealed||c.shadowRevealed).length}</span>`:''}</div>${tokenRow('state-tokens',c.type==='Enemy'?tk('damage',c.damage||0):c.type==='Location'?tk('progress',c.progress||0):'')}${inspect('enc-'+c.id)}${zone==='objective'&&!c.holder&&!c.guard?`<button data-action="claim" data-uid="${c.uid}" ${R.window(s).kind==='action'?'':'disabled'}>领取目标</button>`:''}<details><summary>牌文</summary><p>${esc(c.rule)}</p></details></article>`;
 }
 const row=(label,body,extra='')=>`<section class="table-zone ${extra}"><div class="zone-heading"><h2>${label}</h2></div><div class="table-card-row">${body||'<span class="zone-empty">暂无卡牌</span>'}</div></section>`;
 function selection(s,m){if(!m)return '';const selected=ids(s,m).map(uid=>R.find(s,uid)).filter(Boolean),d=draft(s,m);let preview='';
  if(m.kind==='quest')preview='暂定意志 '+selected.reduce((n,c)=>n+R.stats(s,c.uid).willpower,0);
  if(m.kind==='defense'){const defense=selected.reduce((n,c)=>n+R.stats(s,c.uid).defense,0),atk=R.find(s,s.combat.attack.uid);preview=`暂定防御 ${defense} · 敌人当前攻击 ${(atk?R.stats(s,atk.uid).attack:0)+(s.combat.attack.bonus||0)}（暗影与后续效果仍可能改变）`;}
  if(m.kind==='attack'){const attack=selected.reduce((n,c)=>n+R.stats(s,c.uid).attack,0),target=d.target?R.find(s,d.target):null;preview=`暂定基础攻击 ${attack}${target?' · 目标防御 '+R.stats(s,target.uid).defense+' · 基础伤害预估 '+Math.max(0,attack-R.stats(s,target.uid).defense):' · 请先点选目标敌人'}（特殊能力以正式结算为准）`;}
  return `<div class="table-selection"><b>${esc(s.players[m.player].name)} · ${m.kind==='quest'?'点击角色暂定投入':m.kind==='defense'?'点击角色暂定防御；不选表示无人防御':'先点敌人，再点参与攻击的角色'}</b><p aria-live="polite">${esc(preview)} · 已选 ${selected.length} 名</p><div class="actions">${b(m.kind==='quest'?'提交暂定派遣名单':m.kind==='defense'?'提交暂定防御名单':'提交暂定攻击名单','submit','',m.kind==='attack'&&(!d.target||!selected.length))}${b('清空选择','clear')}${m.kind==='attack'?`<button data-action="combatFlow" data-combat="endAttacks" data-player="${m.player}">暂定结束我的攻击</button>`:''}</div><p class="small muted">这里只暂定名单。全员二次确认后才横置、支付并执行。</p></div>`;
 }
 function next(s){const x=R.context(s),done=x?.completed;let label='',disabled=false;
 if(s.status==='won'||s.status==='lost')return `<span class="badge">${s.status==='won'?'剧本已结束 · 见上方结算':'远征已结束 · 见上方结算'}</span>`;
 if(s.setupPending||setupPendingReveal(s))return '';if(s.phase===0)label='收集资源、抽1张牌 → 计划阶段';else if(done)label=s.phase===6?'进入下一回合 · 资源阶段':'进入第'+['一','二','三','四','五','六','七'][s.phase+1]+'阶段 · '+E.phases[s.phase+1];else if(s.phase===1){label='结算计划阶段结束';disabled=!PlanningUI.canFinish(s);}else return '';
  return `<button class="primary" data-action="next" ${disabled||s.pending.length||s.status!=='playing'?'disabled':''}>${label}</button>`;
 }
 /* 待结算事项面板。历史上 tableHTML 直接调用 pending() 但从未定义，
    导致任何存在 s.pending 的时刻整个渲染抛 ReferenceError（mutate 回滚，玩家看不到结算按钮）。 */
 function pending(){
  const s=stateRef();if(!s||!s.pending.length)return '';
  const spiders=s.pending.filter(t=>t.kind==='spider');
  const spiderPool=spiders.length?[...new Set([...s.deck,...s.discard].filter(c=>(c.traits||'').includes('Spider')).map(c=>c.id))].map(id=>{const c=[...s.deck,...s.discard].find(x=>x.id===id);return `<option value="${c.uid}">${esc(c.name)}</option>`;}).join(''):'';
  const items=s.pending.map(t=>{
   const note=t.kind==='spider'?`<select id="choice-${t.id}" aria-label="选择蜘蛛">${spiderPool||'<option value="">牌库与弃牌堆中没有蜘蛛</option>'}</select>`
    :t.kind==='treachery'?`<span class="small muted">按牌面文字手动结算后确认</span>`
    :t.kind==='eliminate'?`<span class="small muted">该玩家将被淘汰，交战的敌人回到探查区</span>`
    :`<span class="small muted">按牌面文字手动结算后确认</span>`;
   return `<div class="pending-item"><p><b>${esc(String(t.text||t.kind).slice(0,120))}</b></p>${note}<div class="actions"><button class="primary" data-action="resolve" data-id="${t.id}" ${t.kind==='spider'&&!spiderPool?'disabled':''}>确认结算</button></div></div>`;
  }).join('');
  return `<section class="panel pending-panel"><div class="panel-title"><h2>待结算事项</h2><span class="badge">${s.pending.length} 项</span></div><p class="small">这些效果需要人工按牌面文字处理：处理后点「确认结算」才会继续推进。</p>${items}</section>`;
 }
 let currentState=null;
 function stateRef(){return currentState;}
 function setupPendingReveal(s){return !!(s&&s.setupReveal&&!s.setupReveal.finished);}
 function setupPanel(s){if(!setupPendingReveal(s))return '';const x=s.setupReveal,cur=x.current,opts=cur?E.setupCancelOptions(s):[];
  const card=cur?`<div class="setup-reveal">${ImageLibrary.encounterArt(cur.id)}<div><h3>${esc(cur.name)}</h3><p>${esc(cur.rule||'')}</p><p class="small">${esc({Enemy:'敌人',Location:'地点',Treachery:'诡计',Objective:'目标'}[cur.type]||cur.type)} · 厄运 ${cur.doomed||0} · ${cur.surge?'涌现':'无涌现'} · ${x.canceled?'翻开效果已取消（关键词仍结算）':'等待结算'}${x.kind==='tower'&&x.guard?' · 本张守卫目标':''}</p></div></div>`:'';
  return `<section class="panel setup-flow"><div class="panel-title"><h2>剧本设置 · 开局翻牌（${x.kind==='tower'?'每张目标各1张':'每位玩家各1张'}）</h2><span class="badge">剩 ${x.remaining} 张</span></div><p class="small">开局翻牌逐张结算：每张都可以在翻开时使用<b>意志考验</b>或<b>埃莉诺</b>取消其翻开效果。取消后关键词仍结算，然后翻下一张。</p>${card}<div class="actions">${cur?opts.map(o=>`<button data-action="setupCancel" data-value="${esc(o.value)}">${esc(o.label)}</button>`).join(''):''}${cur?`<button class="primary" data-action="setupResolve">结算此牌并继续</button>`:`<button class="primary" data-action="setupDraw">翻开下一张遭遇牌</button>`}</div></section>`;
 }
 /* 剧本结算计分面板：胜利后显示官方公式的完整分项明细。 */
 function scorePanel(s){
  if(!s||(s.status!=='won'&&s.status!=='lost'))return '';
  const r=(typeof ScoreEngine!=='undefined'?ScoreEngine:null)?.score(s);
  if(!r)return '';
  const rows=(typeof ScoreEngine!=='undefined'?ScoreEngine:null).lines(s).map(x=>`<tr class="score-row score-${x.key}"><th>${esc(x.label)}</th><td class="score-value">${x.sign}${x.value}</td><td class="small muted">${esc(x.note||'')}</td></tr>`).join('');
  const title=s.status==='won'?'剧本胜利 · 结算计分':'远征失败 · 过程计分';
  const verdict=s.status==='won'?`<div class="score-total"><span>总分</span><strong>${r.total}</strong><small>${esc(r.rating)} · ${esc(r.ratingNote)}</small></div>`
   :`<div class="score-total lost"><span>参考分</span><strong>${r.total}</strong><small>失败局不计入战绩，仅作过程参考</small></div>`;
  return `<section class="panel score-panel"><div class="panel-title"><h2>${title}</h2><span class="badge">${esc((E.quest(s)||{}).name||'')}</span></div><p class="small">按原版计分公式：威胁合计 + 回合数×10 + 淘汰人数×100 + 英雄伤害 − 胜利区点数。分数越低越好。</p><table class="score-table"><tbody>${rows}</tbody></table>${verdict}<p class="small muted">每名玩家归一化 ${r.perPlayer}（跨人数比较时参考）。${r.players} 人 · ${r.rounds} 回合 · ${({easy:'简单',normal:'标准',nightmare:'噩梦'}[r.difficulty]||'标准')}模式</p><div class="actions"><button class="primary" data-action="export">导出本局存档</button><button data-action="reset">开始新剧本</button></div></section>`;
 }
 function status(s){if(!s||s.status!=='playing')return null;
  if(s.setupPending)return {label:'确认起始手牌',chips:chipRow(s,s.players.map(p=>p.id),s.players.filter(p=>p.openingConfirmed).map(p=>p.id),'已确认','待确认')};
  if(setupPendingReveal(s)){const x=s.setupReveal;return {label:x.current?'开局翻开：'+x.current.name+'（可取消或结算）':'开局翻牌 · 还剩 '+x.remaining+' 张',chips:chip('剧本设置')};}
  if(s.pending.length)return {label:'先处理剧本待结算事项',chips:chip('待结算 '+s.pending.length+' 项')};
  const q=s.questing,c=s.combat,t=s.traveling,e=s.encountering,r=s.refreshing,ids=live(s).map(p=>p.id);
  if(q&&q.round===s.round&&!q.completed){
   if(q.step==='commit'&&!q.deploymentLocked){const order=q.order||[],done=order.filter(id=>q.deployments?.[id]?.confirmed),pend=order.filter(id=>!q.deployments?.[id]?.confirmed);
    if(pend.length)return {label:'等待 '+pend.map(id=>s.players[id]?.name||('玩家'+(id+1))).join('、')+' 提交派遣名单（'+done.length+'/'+order.length+'）',chips:chipRow(s,order,done,'已提交','待提交')};
    const app=q.deploymentApprovals||[];return {label:'名单已就绪 · 等待二次确认（'+app.length+'/'+order.length+'）',chips:chipRow(s,order,app,'已确认','待确认')};}
   if(q.actionLocked)return {label:'正在执行暂定行动',chips:chip('全员已确认','done')};
   if(q.plannedActions?.length){const app=q.actionApprovals||[];return {label:'暂定行动待确认（'+app.length+'/'+ids.length+'）',chips:chipRow(s,ids,app,'已确认','待确认')};}
  }
  if(s.phase===5&&c){const app=c.approvals||[];
   if(c.proposal)return {label:'战斗方案待确认（'+app.length+'/'+ids.length+'）',chips:chipRow(s,ids,app,'已确认','待确认')};
   if(c.step==='enemyChoice'){const pid=C.activeEnemyPlayer(s);return {label:esc(s.players[pid].name)+' 选择攻击敌人',chips:chip('剩余 '+C.pendingEnemies(s,pid).length+' 名')};}
   if(c.step==='attackChoice'){const pid=C.activePlayer(s);return {label:esc(s.players[pid].name)+' 声明玩家攻击',chips:chip('先点敌人再点角色')};}
  }
  if(s.phase===3&&t&&t.step==='choice'){const app=t.approvals||[];
   if(t.proposal)return {label:'旅行选择待确认（'+app.length+'/'+ids.length+'）',chips:chipRow(s,ids,app,'已确认','待确认')};
   return {label:esc(s.players[s.first].name)+' 选择旅行地点',chips:chip('暂定后再全员确认')};}
  if(s.phase===4&&e&&e.step==='optional'){const app=e.approvals||[],picked=Object.keys(e.choices||{}).length;
   return {label:picked?'主动交战方案待确认（'+app.length+'/'+ids.length+'）':'选择主动交战或不交战',chips:chipRow(s,ids,app,'已确认','待确认')};}
  if(s.phase===6&&r&&r.step==='ready'&&r.approvals){const app=r.approvals;
   return {label:'刷新方案待确认（'+app.length+'/'+ids.length+'）',chips:chipRow(s,ids,app,'已确认','待确认')};}
  return null;
 }
 function prompt(s,m){if(s.status!=='playing')return s.status==='won'?'剧本胜利':'远征失败';if(s.setupPending)return '每位玩家确认起始手牌';if(setupPendingReveal(s))return s.setupReveal.current?'开局翻开「'+s.setupReveal.current.name+'」：先取消或结算，再翻下一张':'剧本设置：翻开下一张遭遇牌';if(s.pending.length)return '先处理剧本待结算事项';if(m)return m.kind==='quest'?'选择投入角色':m.kind==='defense'?'选择防御者':'选择攻击目标与角色';const st=status(s);if(st)return st.label;if(s.phase===2&&s.questing?.step==='commit'&&!s.questing.deploymentLocked){const pend=(s.questing.order||[]).filter(id=>!s.questing.deployments?.[id]?.confirmed).map(id=>s.players[id]?.name).filter(Boolean);if(pend.length)return '等待 '+pend.join('、')+' 提交派遣名单（顶部按钮切换）';}const x=R.context(s);if(x?.completed)return '本阶段已完成';if(x?.queue?.length)return '处理卡牌效果或即时响应';if(x?.tasks?.length)return '选择强制效果目标';return ['收集资源与抽牌','打出卡牌或使用行动','探险与遭遇结算','选择旅行地点','主动交战与交战检定','敌人攻击与玩家攻击','刷新与回合结束'][s.phase];}
 /* 操作条用的「当前一件事」：只留本阶段必需的输入（选目标／提交名单／激活卡牌），
    说明文字、清单、结束阶段按钮都归角色卡下方的常驻面板，不再重复。 */
 function taskPanel(s,pid){
  /* 只在确实有输入可给时才渲染：任务条本来就窄，塞进一段没有控件的说明只会挤掉真正的按钮。
     v0.15.48：行动窗口面板并入这里——只在智能模式且有可选项时出现，
     空壳（标题+长说明）已删除，与阶段竖轴不再重复。 */
  try{
   if(s.phase===2){const q=s.questing;
    /* v0.15.57：这里原来写死 step==='commit'，把 picker 内部新加的 beforeCommit
       入口整个挡住——「开始投入角色」因此从未真正渲染过，智能模式到这一步仍然卡死。
       改成交给 picker 自己判断：它已经不满足条件时返回空串，这里保持原样回落到行动窗口。 */
    if(q&&!q.completed&&!q.deploymentLocked&&!q.tasks.length){
     const picked=QuestUI.picker(s,pid)||'';
     if(picked)return picked;}
    if(q&&q.step==='staging'&&q.current)return QuestUI.revealCard(s)||'';}
   return WindowUI.panel(s)||'';
  }catch(e){return '';}
  return '';
 }
/* 角色区右上角的「结束阶段」：唯一常驻的推进按钮。
   它同时也是本阶段的验收口——点不动时把「还差什么」写进 title，玩家不用去别处找原因。 */
 function phaseDoor(s){
  if(!s||s.status!=='playing'||s.setupPending||setupPendingReveal(s))return '';
  const R2=typeof E.phaseRules!=='undefined'?E.phaseRules:null;if(!R2)return '';
  /* v0.15.62：阶段已收尾（completed）时，checks() 里那些「窗口期内才存在」的项
     （提交名单／二次确认／逐张探查／窗口放弃行动）已经没有意义。把它们继续列在
     悬停清单里，玩家会看到「· 玩家1 提交派遣名单」这种明明做完了却打叉的条目，
     而按钮又是亮的——自相矛盾。收尾后只保留真正可复查的项。 */
  const list=(R2.checks(s)||[]).filter(x=>!(s.questing&&s.questing.completed&&/^(deploy|dconfirm|commit|reveal|pass):?/.test(x.key)));
  const left=list.filter(x=>!x.check()),ready=!left.length&&!s.pending.length;
  const full=list.map(x=>(x.check()?'✓ ':'· ')+x.label).join('\n');
  /* 探险阶段的投入名单是「必须玩家定」的选择：引擎不会替人挑角色，
     所以按钮要禁用并直接点名等谁，不能让玩家点了没反应。
     注意判据要带上 !q.completed 和 step 限定：名单锁定走完 commit 段之后，
     即使有人 deployments 里缺 confirmed 也不该再拦门（那是引擎自己该收的尾）。 */
  const q=s.questing,waiting=s.phase===2&&q&&!q.completed&&q.step==='commit'&&!q.deploymentLocked
   ?(q.order||[]).filter(id=>!q.deployments?.[id]?.confirmed).map(id=>s.players[id]?.name||('玩家'+(id+1))):[];
  const blocked=waiting.length>0;
  const tail=s.pending.length?'有剧本事项待结算':blocked?'等 '+waiting.join('、')+' 提交投入名单':left.length?'还差 '+left.length+' 项':'必需操作已全部完成';
  /* '· ' 前缀把「已通过」的项也画成待办，收尾后一条都不剩时不要拼出一个空标题。 */
  const tipFull=full?(list.some(x=>!x.check())?full:list.map(x=>'✓ '+x.label).join('\n')):'';
  return `<span class="phase-door${ready?' ready':''}" aria-label="结束阶段"><span class="door-state" hidden>${esc(tail)}</span><button class="primary door-go" data-action="endPhase" ${s.pending.length||blocked?'disabled':''} title="${esc((s.pending.length?'先结算剧本事项\n':blocked?'等 '+waiting.join('、')+' 提交投入名单\n':left.length?'还差 '+left.length+' 项必需操作\n':'可以结束\n')+(tipFull||'本阶段没有必需操作'))}">${esc(ready&&!blocked?'结束阶段 → '+phaseAfterName(s):'结束阶段')}</button></span>`;
 }
 function phaseAfterName(s){if(s.phase>=6)return '下一回合';return phasesName[s.phase+1];}
 const phasesName=['资源','计划','探险','旅行','遭遇','战斗','刷新'];
 /* v0.15.62：操作条只剩两样东西——剧本强制事项，和一行「现在该做什么」。
      阶段面板、投入名单、翻牌控件全部搬进了决策弹窗（DecisionUI）。
      以前这三处（底部 mat-phase、操作条、弹窗）是同一份内容渲染三遍，
      玩家要在三个地方看同一件事、点同一个按钮。 */
 function phasePanel(s,pid){return s.pending.length?pending():'';}
 function tableHTML(s,pid){
  currentState=s;if(!s.players.every(p=>p.heroStates))return legacyTable();const p=s.players[pid]||s.players[0],m=mode(s,p.id),q=E.quest(s),sc=LOTR_DATA.scenarios.find(c=>c.id===s.scenario);
  if(!m)draft(s,null);
  const others=s.players.filter(x=>x.id!==p.id).map(o=>`<section class="other-player"><div class="zone-heading"><h3>${esc(o.name)}${s.first===o.id?' · 起始玩家':''}</h3><span>威胁 ${o.threat}${o.eliminated?' · 已淘汰':''}</span>${b('查看手牌与完整区域','view',`data-player="${o.id}"`)}</div><div class="table-card-row peer-cards">${playerChars(s,o).map(c=>character(s,c,m)).join('')}${o.engaged.map(c=>encounter(s,c,'engaged',m)).join('')}</div></section>`).join('');
  const hand=p.hand.map(c=>{const meta=R.data(s,{...c,owner:p.id}),sp=R.playSpec(s,p.id,c.uid);
   /* 置灰判据用 playSpec 的 affordable：只要手上付不起就灰掉，不管此刻轮不轮得到你出牌。
      以前靠正则匹配 reason 里的「资源不足」，可那时 playSpec 往往先被时机断言拦掉
      （「仅当前计划玩家可以…」「当前不是计划或探险阶段」），于是一手牌全亮着，点下去才发现没钱。 */
   const unaff=sp.affordable===false;
   const reason=unaff?`资源不足：还差 ${sp.short} 点`:(sp.legal?'点击选择目标与费用':sp.reason);
   const probe=unaff?(()=>{const rec=ImageLibrary.by[c.code],url=rec?ImageLibrary.safeUrl(rec.faces?.B||rec.imageUrl):null;return url?` data-hover-src="${esc(url)}" data-hover-shape="tall"`:'';})():'';
   return `<article class="table-card hand-card ${sp.legal?'selectable':''}${unaff?' unaffordable':''}"${probe}><button class="card-face" data-action="planning" data-plan="play" data-player="${p.id}" data-uid="${c.uid}" ${sp.legal?'':'disabled'} aria-label="使用${esc(meta.nameZh)}">${art(c.code)}</button><div class="table-card-caption"><b>${esc(meta.nameZh)}</b><span>费用 ${meta.cost??'—'} · ${esc(meta.sphereName||meta.sphere)}</span></div>${inspect(c.code)}<span class="card-legality">${esc(reason)}</span></article>`;}).join('');
  /* 玩家状态条：BGA 式汇总每位玩家的威胁／资源／伤害，点按即切换查看（复用 view 动作）。 */
 const tabStats=o=>{const res=o.heroStates?o.heroStates.reduce((n,h)=>n+h.resources,0):0,dmg=o.heroStates?o.heroStates.reduce((n,h)=>n+(h.damage||0),0):0;
  return `<span class="tab-stats">威胁 <b>${o.threat}</b> · 资源 <b>${res}</b> · 伤害 <b>${dmg}</b></span>${s.first===o.id?'<span class="first-mark">起始</span>':''}${o.eliminated?'<span class="elim-mark">淘汰</span>':''}`;};
 return `<div class="desktop-table"><div class="expedition-title"><div><span class="eyebrow">MIDDLE-EARTH EXPEDITION · ${APP_VERSION}</span><h1>${esc(s.session&&s.session.name||sc.name)}</h1></div><span>${s.session&&s.session.name?esc(sc.name)+' · ':''}第 ${s.round} 回合 · ${s.players.length} 人同机${s.session&&s.session.difficulty?' · '+({easy:'简单',normal:'标准',nightmare:'噩梦'}[s.session.difficulty]||''):''}</span><div class="player-tabs" role="group" aria-label="查看玩家">${s.players.map(o=>`<button data-action="desktop" data-desktop="view" data-player="${o.id}" class="${o.id===p.id?'active':''}" aria-pressed="${o.id===p.id}"><b class="tab-name">${esc(o.name)}</b>${tabStats(o)}</button>`).join('')}</div>${b('重新选择剧本','reset')}</div><div class="tabletop-layout"><div class="tabletop-main"><div class="operation-dock" role="region" aria-label="当前操作"><div class="operation-title"><span class="operation-indicator"></span><strong>${esc(prompt(s,m))}</strong><div class="operation-chips">${status(s)?.chips||''}</div><span class="small">第 ${s.phase+1}/7 阶段 · ${E.phases[s.phase]}</span>${next(s)}</div><details class="phase-hint-wrap"><summary>本阶段说明</summary><p class="small phase-hint">${esc(phaseHint())}</p></details><div class="operation-content">${scorePanel(s)}${phasePanel(s,p.id,m)}</div></div><div class="public-table"><div class="quest-location-row"><section class="table-zone quest-zone"><div class="zone-heading"><h2>当前探险 · ${esc(q.stage)}</h2><strong>${q.points?s.progress+' / '+q.points+' 进度':'特殊胜利条件'}</strong></div><div class="quest-display"><div class="quest-art-wrap">${ImageLibrary.art('enc-'+q.id,'',s.setupPending?'A':'B')}${q.points?`<div class="card-tokens quest-tokens" aria-hidden="true">${tk('progress',s.progress)}</div>`:''}</div><div><h3>${esc(q.name)}</h3><p>${esc(s.setupPending?q.front:q.back)}</p><span class="small muted">${esc(E.gate(s)||'满足条件后由规则自动推进')}</span></div></div>${q.points?`<div class="quest-progress" role="progressbar" aria-label="探险进度" aria-valuemin="0" aria-valuemax="${q.points}" aria-valuenow="${s.progress}"><div class="quest-progress-fill" style="width:${Math.min(100,Math.round(s.progress/q.points*100))}%"></div><span class="quest-progress-label">${s.progress} / ${q.points}</span></div>`:''}</section>${row('当前地点',s.active?encounter(s,s.active,'active',m):'','active-zone')}</div>${row('探查区 <span class="threat-total">总威胁 '+E.threat(s)+'</span>',s.staging.map(c=>encounter(s,c,'staging',m)).join(''))}${s.objectives.length?row('剧本目标',s.objectives.map(c=>encounter(s,c,'objective',m)).join('')):''}${others}</div><section class="player-mat"><div class="zone-heading"><h2>${esc(p.name)} · ${esc(p.registeredDeck?.name||'玩家区域')}</h2><span class="own-piles">威胁 ${p.threat}${s.first===p.id?' · 起始玩家':''} · <span class="pile-chip">牌库 <b>${p.playerDeck.length}</b></span> · <span class="pile-chip">弃牌 <b>${p.playerDiscard.length}</b></span></span></div>${p.engaged.length?row('交战区',p.engaged.map(c=>encounter(s,c,'engaged',m)).join('')):''}<section class="table-zone bottom-deck" aria-label="队伍与手牌"><div class="zone-heading"><h2>队伍与手牌 <span class="small muted">英雄 ${p.heroStates.length} · 盟友 ${p.allies.length} · 附属 ${p.attachments.length} · 手牌 ${p.hand.length}</span></h2>${phaseDoor(s)}</div>${DecisionUI.html(s,p.id)}<div class="table-card-row own-characters">${playerChars(s,p).map(c=>character(s,c,m)).join('')}${p.attachments.map(c=>{const meta=R.data(s,c),host=R.find(s,c.target),legal=R.abilitySpec(s,p.id,c.uid).legal;return `<article class="table-card"><button class="card-face" data-action="planning" data-plan="ability" data-player="${p.id}" data-uid="${c.uid}" ${legal?'':'disabled'}>${art(c.code)}</button><div class="table-card-caption"><b>${esc(meta.nameZh)}</b><span>附于 ${esc(host?.meta.nameZh||host?.meta.name||'目标已离场')}</span></div>${inspect(c.code)}</article>`;}).join('')}</div>${(!s.setupPending||s.players.every(p=>p.openingConfirmed))?PlanningUI.board(p):''}<div class="table-card-row hand-zone">${hand}</div></section></section></div><aside class="tabletop-rail">${PhaseLog.rail(s,railOpen())}<section class="table-log" aria-label="远征日志">${PhaseLog.panel(s,logMarks(),logScope(),railOpen(),false)}</section></aside></div></div>`;
 }
 function handle(el){const k=el.dataset.desktop,uid=+el.dataset.uid,pid=+el.dataset.player,m=mode(state,handView),d=draft(state,m);
  if(k==='view'){handView=pid;render();return;}if(k==='reset'){if(confirm('结束当前桌面并重新选择剧本？建议先导出存档。'))mutate(()=>state=null);return;}
  if(k==='pick'){if(!eligible(state,m,uid)){toast('此角色当前不能加入名单');return;}if(m.kind==='quest'){const a=QuestUI.draftFor(state,m.player);QuestUI.setDraft(state,m.player,a.includes(uid)?a.filter(x=>x!==uid):[...a,uid]);}else d.ids=d.ids.includes(uid)?d.ids.filter(x=>x!==uid):[...d.ids,uid];render();return;}
  if(k==='target'){if(m?.kind!=='attack'||!C.attackTargets(state,m.player).some(e=>e.uid===uid)){toast('该敌人不是合法攻击目标');return;}d.target=uid;d.ids=[];render();return;}
  if(k==='clear'){if(m?.kind==='quest')QuestUI.setDraft(state,m.player,[]);else d.ids=[];render();return;}
  if(k==='submit'&&m){const kind=m.kind,chosen=[...ids(state,m)];mutate(()=>{if(kind==='quest')Q.submitDeployment(state,m.player,chosen);else C.propose(state,m.player,kind,d.target,chosen);});if(kind==='quest'&&state?.questing?.step==='commit'&&!state.questing.deploymentLocked){const pid=(state.questing.order||[]).find(id=>!state.questing.deployments?.[id]?.confirmed);if(pid!==undefined&&pid!==handView){handView=pid;render();}}return;}
  if(k==='withdraw'){mutate(()=>Q.withdrawDeployment(state,pid));return;}
  if(k==='engage')mutate(()=>E.encountering.propose(state,pid,uid));
 }
 /* 拖放表现：代币可拖起、可放到卡面上（与诡镇网页版一致的手感），但本作代币数量
    一律由规则引擎结算——放置只给提示，不改动任何状态（交互红线）。 */
 document.addEventListener?.('dragstart',e=>{const t=e.target.closest?.('.tk');if(t&&e.dataTransfer){e.dataTransfer.setData('text/plain','lotr-token');e.dataTransfer.effectAllowed='copy';}});
 document.addEventListener?.('dragover',e=>{if(e.dataTransfer&&[...e.dataTransfer.types].includes('text/plain')&&e.target.closest?.('.table-card,.quest-art-wrap')){e.preventDefault();e.dataTransfer.dropEffect='copy';}});
 document.addEventListener?.('drop',e=>{if(e.dataTransfer?.getData('text/plain')==='lotr-token'&&e.target.closest?.('.table-card,.quest-art-wrap')){e.preventDefault();toast('代币数量由规则引擎自动结算，暂不支持手动拖放。');}});
 return {render:tableHTML,handle,mode,draft,eligible,selection,status,setupPanel,setupPendingReveal,scorePanel};
})();
