/* 待结算的牌 / 响应，按钮文案只有两条语义（WINDOWS.md §8.2）：
     forced   → 处理强制效果：「卡名」   —— 必须处理，否则不能前进
     optional → 选择响应：「卡名」       —— 可以不用
   以前五个面板各写一套（处理卡牌响应 / 处理响应／选择 / 处理强制选择 / 处理强制效果／卡牌响应），
   同一颗按钮在不同阶段说法不同，玩家看不出它们其实是一回事。
   放在 planning-ui.js 里是因为它是第一个加载的 UI 模块，后面五个 *-ui 都能直接用。 */
const ChoiceUI=(()=>{
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 /* 卡名：任务的 payload 形状按 kind 不同（uid / card / target），按顺序试一遍，
    取不到就退回不带名字的文案——宁可少一个卡名，也不要编一个错的。 */
 function cardName(s,task){
  try{
   const d=(task&&task.payload)||{};
   const uid=[d.uid,d.card,d.target].find(x=>x!==undefined&&x!==null);
   if(uid===undefined)return '';
   const c=ScenarioEngine.planning.find(s,uid);
   const m=c&&(c.meta||c);
   return (m&&(m.nameZh||m.name))||'';
  }catch(e){return '';}
 }
 function label(s,task){const n=cardName(s,task);return (task&&task.optional?'选择响应':'处理强制效果')+(n?'：「'+n+'」':'');}
 /* attrs 由调用方给（各阶段的 data-action 不同），这里只管文字与层级。 */
 function button(s,task,attrs='',disabled=false,cls=''){
  return `<button${cls?` class="${cls}"`:''} ${attrs} ${disabled?'disabled':''}>${esc(label(s,task))}</button>`;
 }
 return {label,button,cardName};
})();
/* 主动作按钮统一写「结算〈本步名〉 →」，步名取 phase-log 的窗口 label（decision-ui 派生），
   不在这里另起名字。窗口判定只存在于 desktop-ui.js，而它在本文件之后加载，
   但调用发生在 render 期间（那时全部脚本已就绪）；取不到时降级成「结算本步 →」。 */
const settleLabel=s=>{try{
 if(typeof DecisionUI!=='undefined'&&DecisionUI.settleLabel)return DecisionUI.settleLabel(s);
}catch(e){}return '结算本步 →';};
const PlanningUI=(()=>{
 const R=ScenarioEngine.planning,esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function button(text,kind,attrs='',disabled=false){return `<button data-action="planning" data-plan="${kind}" ${attrs} ${disabled?'disabled':''}>${text}</button>`;}
 function handButton(p,x){if(!state||![1,2,3,4,5,6].includes(state.phase)||!state.planning)return '<button disabled>计划阶段可操作</button>';if(R.context(state)?.discussion&&R.context(state).plannedActions?.some(a=>a.kind==='play'&&a.uid===x.uid))return '<button disabled>已暂定，可在交流缓冲区撤销</button>';const sp=R.playSpec(state,p.id,x.uid);return `<p class="small muted">${esc(sp.legal?(sp.meta.type==='event'?sp.timing.label:'可打出'):sp.reason)}</p>${button(sp.meta?.type==='event'?([2,3,4,5,6].includes(state.phase)&&R.context(state)?.discussion?'暂定事件':'使用事件'):'打出', 'play',`data-player="${p.id}" data-uid="${x.uid}"`,!sp.legal)}`;}
 function heroStats(p,i){const h=p.heroStates?.[i];if(!h)return '';let v;try{v=R.stats(state,h.uid);}catch{return '<span class="badge">囚禁／已离场</span>'; }return `<span class="hero-state-line">资源 ${h.resources} · 伤害 ${h.damage}/${v.health} · ${h.exhausted?'横置':'重置'}${h.committed?' · 已投入探险':''}</span><span class="small">当前 意${v.willpower} 攻${v.attack} 防${v.defense} 血${v.health}</span>`;}
 /* v0.15.74：出牌阶段控制条——计划阶段不再弹任何浮层弹窗（用户要求：点手牌直接出牌，
    阶段控制以按钮形式收进角色区「结束阶段」旁）。这里只放引擎自己走不完的三件事：
    强制响应（处理强制选择／选择响应）、结束我的出牌步骤（多人）、放弃剩余行动（轮次走完后）。
    能力不在这里：角色卡与附属卡的卡面自带「使用能力」按钮（character()/附属 article）。 */
 function strip(s,pid){
  if(s.phase!==1||!s.planning||s.planning.completed)return '';
  const pl=s.planning,ch=R.choiceSpec(s),solo=s.players.filter(p=>!p.eliminated).length===1;
  /* 第 4 个参数是 disabled、第 5 个是语义层级类名（btn-ghost 等）。
     少了 cls 这个形参时，调用方多传的 'btn-ghost' 会被静默丢弃——按钮看起来是主操作，
     而它的语义是「我不用」（WINDOWS.md §8.1 把可逆的减损动作定为 ghost）。 */
  const btn=(label,kind,args='',disabled=false,cls='')=>`<button${cls?` class="${cls}"`:''} data-action="planning" data-plan="${kind}" ${args} ${disabled?'disabled':''}>${esc(label)}</button>`;
  const parts=[];
  if(pl.halted)parts.push(`<span class="small planning-halt">${esc(pl.halted)}</span>`);
  /* §8.2 / 拍板裁决②：计划阶段仍然豁免触发条（不把决策条搬回桌面），
     但**强制**效果必须可辨：按钮旁边给一颗 data-tone="forced" 的方块点 + 一行说明。
     可选响应拆成两颗：选择响应（secondary）+ 不使用响应（ghost）——
     只留一颗只能「打开弹窗」的按钮时，玩家找不到「我不用」这条路。 */
  if(ch){
   const attrs=`data-action="planning" data-plan="choice" data-id="${ch.task.id}"`;
   parts.push(`<b class="planning-choice-hint">${esc(ch.message)}</b>`);
   if(ch.task.optional){
    parts.push(ChoiceUI.button(s,ch.task,attrs,false,''),btn('不使用响应','choiceSkip',`data-id="${ch.task.id}"`,false,'btn-ghost'));
   }else{
    parts.push(`${ChoiceUI.button(s,ch.task,attrs,false,'btn-primary')}<span class="small planning-forced-note"><span class="decide-dot" data-tone="forced" aria-hidden="true"></span>必须先处理，否则不能结束计划阶段</span>`);
   }
  }
  if(solo)parts.push(btn('结束计划阶段','finish','',!!ch||pl.closing));
  else if(R.active(s)!==null)parts.push(btn('结束我的盟友／附属出牌步骤','endTurn',`data-player="${R.active(s)}"`,!!ch||pl.closing));
  else parts.push(...pl.order.filter(id=>!s.players[id].eliminated).map(id=>btn(s.players[id].name+(pl.finalPasses.includes(id)?' 已放弃剩余行动':'：放弃剩余行动'),'pass',`data-player="${id}"`,pl.finalPasses.includes(id)||!!ch||pl.closing)));
  if(!parts.length)return '';
  return `<div class="planning-strip" aria-label="计划阶段操作">${parts.join('')}</div>`;
 }
 function canFinish(s){const p=s.planning;return !!p&&(p.completed||!p.completed&&!p.queue.length&&R.active(s)===null&&s.players.filter(p=>!p.eliminated).every(x=>p.finalPasses.includes(x.id))&&!p.halted);}
 function title(kind){return kind==='play'?'选择目标与支付资源':kind==='ability'?'使用卡牌能力':'处理响应／强制效果';}
 function form(kind,pid,uid,taskId){return new Promise(resolve=>{
  const d=document.createElement('dialog');d.className='planning-dialog';document.body.append(d);let values={},allocation={},order=[],current=null;
  function finish(v){d.close();d.remove();resolve(v);}
  function refresh(){let sp=kind==='play'?R.playSpec(state,pid,uid,values):kind==='ability'?R.abilitySpec(state,pid,uid,values):R.choiceSpec(state,values);current=sp;const task=sp?.task;const fs=(sp?.fields||[]).filter(f=>f.key!=='order');
   for(const f of fs)if(f.options.length&&!f.options.some(o=>String(o.value)===String(values[f.key])))values[f.key]=f.options[0].value;
   // One second pass is required for dependent target lists and X-cost cards.
   sp=kind==='play'?R.playSpec(state,pid,uid,values):kind==='ability'?R.abilitySpec(state,pid,uid,values):R.choiceSpec(state,values);current=sp;
   for(const f of (sp?.fields||[]).filter(f=>f.key!=='order'))if(f.options.length&&!f.options.some(o=>String(o.value)===String(values[f.key])))values[f.key]=f.options[0].value;
   if(task?.kind==='search'){const rest=task.payload.cards.filter(id=>String(id)!==String(values.card));order=[...order.filter(id=>rest.includes(id)),...rest.filter(id=>!order.includes(id))];}
   const pay=sp?.payment;if(pay){const next={...pay.pay};for(const p of pay.pools)if(p.eligible&&allocation[p.uid]!==undefined&&allocation[p.uid]<=p.resources)next[p.uid]=allocation[p.uid];allocation=next;}
   const legal=kind==='choice'||sp?.legal;const m=sp?.meta||sp?.source?.meta;
   d.innerHTML=`<div class="panel-title"><h2>${title(kind)}</h2><button id="plan-cancel">取消</button></div>${m?`<h3>${esc(m.nameZh)} <span class="small muted">${esc(m.name)}</span></h3>`:''}${sp?.message?`<p>${esc(sp.message)}</p>`:''}${sp?.costText?`<p class="notice small">${esc(sp.costText)}</p>`:''}${m?`<details><summary class="small">本卡能力原文</summary><div class="small rules-text">${esc(m.rulesText)}</div></details>`:''}${!legal?`<p class="notice">${esc(sp?.reason||'无法使用')}</p>`:''}<div class="planning-fields">${(sp?.fields||[]).filter(f=>f.key!=='order').map(f=>`<label>${esc(f.label)}<select data-field="${f.key}">${f.options.map(o=>`<option value="${esc(o.value)}" ${String(values[f.key])===String(o.value)?'selected':''}>${esc(o.label)}</option>`).join('')}</select></label>`).join('')}</div>${task?.kind==='peek'?`<div class="peek-card">${ImageLibrary.encounterArt(state.deck.find(c=>c.uid===task.payload.uid)?.id)}</div>`:''}${task?.kind==='search'?`<div class="notice small">选择获得的牌后，调整其余牌的顺序（上方为牌库顶）。${task.payload.shuffleRest?'此效果会把其余牌洗回，次序不影响最终洗牌。':''}</div><div class="search-order">${order.map((id,i)=>{const p=state.players[task.payload.player],x=p.playerDeck.find(c=>c.uid===id);return `<div>${esc(R.data(state,x).nameZh)} <button data-up="${i}" ${i===0?'disabled':''}>↑</button><button data-down="${i}" ${i===order.length-1?'disabled':''}>↓</button></div>`;}).join('')}</div>`:''}${pay?`<section class="payment-panel"><h3>支付 ${pay.cost} 资源</h3><p class="small muted">只可使用本玩家匹配领域的英雄资源；可以从多个资源池支付。横置英雄仍可支付。</p>${pay.pools.map(p=>`<label class="payment-row"><span>${esc(p.name)} · 资源${p.resources} ${p.eligible?'':'（领域不匹配）'}</span><select data-pay="${p.uid}" ${p.eligible?'':'disabled'}>${Array.from({length:p.eligible?p.resources+1:1},(_,i)=>`<option value="${i}" ${numEq(allocation[p.uid]||0,i)?'selected':''}>${i}</option>`).join('')}</select></label>`).join('')}<p id="payment-total"></p></section>`:''}<div class="actions"><button class="primary" id="plan-confirm" ${legal?'':'disabled'}>${[2,3,4,5,6].includes(state.phase)&&R.context(state)?.discussion&&['play','ability'].includes(kind)?'加入暂定清单':'确认并执行'}</button>${kind==='choice'&&task?.optional?'<button id="plan-skip">放弃此响应</button>':''}</div><p class="small muted" id="plan-error"></p>`;
   d.querySelector('#plan-cancel').onclick=()=>finish(null);d.querySelectorAll('[data-field]').forEach(el=>el.onchange=()=>{values[el.dataset.field]=el.value;allocation={};if(el.dataset.field==='card')order=[];refresh();});d.querySelectorAll('[data-pay]').forEach(el=>el.onchange=()=>{allocation[el.dataset.pay]=Number(el.value);paymentTotal();});d.querySelectorAll('[data-up]').forEach(el=>el.onclick=()=>{const i=Number(el.dataset.up);[order[i-1],order[i]]=[order[i],order[i-1]];refresh();});d.querySelectorAll('[data-down]').forEach(el=>el.onclick=()=>{const i=Number(el.dataset.down);[order[i],order[i+1]]=[order[i+1],order[i]];refresh();});
   function paymentTotal(){if(!pay)return;const total=Object.values(allocation).reduce((a,b)=>a+b,0);d.querySelector('#payment-total').textContent=`已分配 ${total} / ${pay.cost}`;d.querySelector('#plan-confirm').disabled=!legal||total!==pay.cost;}
   paymentTotal();if(d.querySelector('#plan-skip'))d.querySelector('#plan-skip').onclick=()=>finish({skip:true});d.querySelector('#plan-confirm').onclick=()=>finish({...values,...(pay?{payment:allocation}:{}),...(task?.kind==='search'?{order}: {})});
   ImageLibrary.bindErrors(d);
  }
  d.oncancel=()=>{d.remove();resolve(null);};refresh();d.showModal();
 });}
 function numEq(a,b){return Number(a)===Number(b);}
 async function handle(b){const kind=b.dataset.plan,pid=Number(b.dataset.player),uid=Number(b.dataset.uid);
 /* 「不使用响应」：可选任务可以直接放弃（引擎的 resolveChoice({skip:true}) 就是这条路，
    强制任务会被引擎拒绝，所以这颗按钮只在 ch.task.optional 时渲染）。 */
 if(kind==='choiceSkip'){mutate(()=>R.resolveChoice(state,Number(b.dataset.id),{skip:true}));return;}
 if(kind==='finish'){mutate(()=>{
   /* v0.15.68：单人时出牌步骤与放弃行动没有决策点，一次点击完成；引擎断言保持严格，
      autoAdvance 仍会在计划阶段停手让玩家出牌。 */
   if(state.players.filter(p=>!p.eliminated).length===1){const solo=state.players.find(p=>!p.eliminated).id;
    while(R.active(state)!==null)R.endTurn(state,R.active(state));
    if(!state.planning.finalPasses.includes(solo))R.passAction(state,solo);}
   E.nextPhase(state);});return;}if(kind==='endTurn'){mutate(()=>{R.endTurn(state,pid);const next=R.active(state);if(next!==null)handView=next;});return;}if(kind==='pass'){mutate(()=>R.passAction(state,pid));return;}const a=await form(kind,pid,uid,Number(b.dataset.id));if(!a)return;mutate(()=>{if([2,3,4,5,6].includes(state.phase)&&R.context(state)?.discussion&&['play','ability'].includes(kind))E.questing.queueAction(state,kind,pid,uid,a);else if(kind==='play')R.play(state,pid,uid,a);else if(kind==='ability')R.activate(state,pid,uid,a);else R.resolveChoice(state,Number(b.dataset.id),a);});}
 return {strip,handButton,heroStats,handle,canFinish,form};
})();
