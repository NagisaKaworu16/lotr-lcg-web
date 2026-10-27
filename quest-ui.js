const QuestUI=(()=>{
 const R=ScenarioEngine.questing,P=ScenarioEngine.planning,esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const button=(text,kind,args='',disabled=false)=>`<button data-action="quest" data-quest="${kind}" ${args} ${disabled?'disabled':''}>${esc(text)}</button>`;
 // Draft selection belongs to this browser's UI; it never changes the game state.
 let draft={context:null,player:null,ids:[]};
 /* v0.15.70：draftFor 有副作用（会把 draft 重置成「这个 pid 的初始名单」），只给交互路径用。
    「只是看看」的地方（R0 合计、名单明细、勾选态）一律走纯函数 draftPeek——
    拿别人的 pid 调 draftFor 会让当前操作者勾好的名单当场消失，且不进 history、撤不回来。 */
 function draftFor(s,pid){if(draft.context!==s.questing||draft.player!==pid)draft={context:s.questing,player:pid,ids:[...(s.questing.deployments?.[pid]?.ids||[])]};const allowed=R.eligible(s,pid).map(c=>c.uid);draft.ids=draft.ids.filter(id=>allowed.includes(id));return [...draft.ids];}
 function draftPeek(s,pid){const allowed=R.eligible(s,pid).map(c=>c.uid);const ids=draft.context===s.questing&&draft.player===pid?draft.ids:[...(s.questing.deployments?.[pid]?.ids||[])];return ids.filter(id=>allowed.includes(id));}
 function setDraft(s,pid,ids){const allowed=R.eligible(s,pid).map(c=>c.uid);draft={context:s.questing,player:pid,ids:[...new Set(ids)].filter(id=>allowed.includes(id))};}
 const steps={beforeCommit:'投入前行动窗口',commit:'派遣名单',afterCommit:'投入后行动窗口',staging:'逐张探查',afterStaging:'探险结算前行动窗口',afterResult:'结算后行动窗口',completed:'阶段3验收完成'};

 /* ── 派遣名单（v0.15.71）──────────────────────────────────────────────
    一屏只留一个主操作，纵向四段（编号与验收口径一致）：
      R0 头部（状态·合计 + 玩家分段）· R1 名单区 · R2 主操作行 · R3 规则与名单
    状态枚举（唯一一支，不再用「两条并列 if 各追加一段」）：
      A  本人未提交                        1 绿【提交名单】（0 名时【提交空名单】）
      B  本人已提交、他人未提交            0 绿，ghost【修改名单】+ 行尾「还差 玩家2 提交」
      C1 全员已交、本人未确认              1 绿【确认派遣】+ ghost【修改名单】+「尚未横置角色」
      C2 本人已确认、他人未确认            0 绿，ghost【取消确认】+ 行尾「还差 玩家2 确认」
      D  deploymentLocked                  无按钮，只读
    单人局永远到不了 C：引擎在 submitDeployment 里提交即自动 approveDeployment。
    所有「全员」判据都走 liveOrder（排除已淘汰玩家），否则中途有人被淘汰会把全队永远卡在 B。 */
 const RULES='名单全部提交后才能二次确认；确认后仍可取消。任何修改会清除所有人的确认。全员确认后按起始玩家顺序横置，并结算投入响应。';
 const nameOf=(s,id)=>s.players[id]?.name||('玩家'+(id+1));
 const liveOrder=s=>(s.questing?.order||[]).filter(id=>!s.players[id]?.eliminated);
 /* R4 的展开态是纯视图偏好：render() 全量重建会把 <details open> 抹掉，所以要自己记住。 */
 let rulesOpen=false;
 function stateOf(s,pid){
  const q=s.questing,live=liveOrder(s),apr=q.deploymentApprovals||[];
  if(q.deploymentLocked)return 'D';
  if(!live.length)return 'D';
  if(!q.deployments?.[pid]?.confirmed)return 'A';
  if(!live.every(id=>q.deployments?.[id]?.confirmed))return 'B';
  if((q.order||[]).length>1&&q.discussion){
   if(!apr.includes(pid))return 'C1';
   if(!live.every(id=>apr.includes(id)))return 'C2';
  }
  return 'D';
 }
 /* R0 的数字 = Σ 已提交名单 + 本机草稿（未提交者按 0 计），所以草稿态也能看到「我勾了会怎样」。*/
 function tally(s,pid,ph){
  let n=0,will=0;
  for(const id of liveOrder(s)){const d=s.questing.deployments?.[id];if(!d?.confirmed)continue;n+=d.ids.length;will+=d.ids.reduce((a,uid)=>a+P.stats(s,uid).willpower,0);}
  if(ph==='A'){const ids=draftPeek(s,pid);n+=ids.length;will+=ids.reduce((a,uid)=>a+P.stats(s,uid).willpower,0);}
  return {n,will};
 }
/* 「已投入」只属于锁定态；未锁一律「暂定」。D 态前缀留空（pill 已写「执行中」），
   但数字模板与其它状态完全一致——跨状态比 .r0-num 的右缘与宽度都不会跳。 */
function statusParts(s,pid,ph){
 const {n,will}=tally(s,pid,ph),threat=ScenarioEngine.threat(s);
 return {label:ph==='D'?'':'暂定',num:`${n} 名 · 意志 ${will} ／ 威胁 ${threat}`};
}
const pillOf=(s,ph)=>{if(ph==='A')return '草稿';if(ph==='B')return '已提交';if(ph==='C1')return '待确认';if(ph==='C2'){const q=s.questing;return '已确认 '+((q.deploymentApprovals||[]).length)+'/'+liveOrder(s).length;}return '执行中';};
/* R0 头部：一行装「谁 · 交了多少」（pill + 前缀 + 数字）和「切换看谁的名单」（分段按钮组），
   行尾小字说「还差谁」。宽屏一行、窄屏自动落两行，但只算一段，不再多一层纵向分隔。
   数字右对齐 + tabular-nums + 等宽模板：前缀字数变化时数字不横跳。 */
function headRow(s,pid,ph){
 const {label,num}=statusParts(s,pid,ph),q=s.questing,live=liveOrder(s),apr=q.deploymentApprovals||[];
 let note='';
 if(ph==='B')note='还差 '+live.filter(id=>!q.deployments?.[id]?.confirmed).map(id=>nameOf(s,id)).join('、')+' 提交';
 if(ph==='C1')note='尚未横置角色';
 if(ph==='C2')note='还差 '+live.filter(id=>!apr.includes(id)).map(id=>nameOf(s,id)).join('、')+' 确认';
 const group=live.length<2?'':`<fieldset class="quest-actors" role="radiogroup" aria-label="当前操作玩家">${live.map(id=>{const sub=!!q.deployments?.[id]?.confirmed,ok=apr.includes(id),tone=ok?'ok':sub?'sub':'idle',label2=ok?'已确认':sub?'已提交':'未提交';
  return `<label class="actor-chip" data-state="${tone}"><input type="radio" name="quest-actor" value="${id}" data-quest-actor="${id}" data-focus-key="quest-actor-${id}" ${id===pid?'checked':''} aria-label="${esc(nameOf(s,id))}，${label2}"><span class="dot" aria-hidden="true"></span>${esc(nameOf(s,id))}</label>`;}).join('')}</fieldset>`;
 return `<div class="r-head"><div class="r0"><span class="state-pill" data-state="${ph}">${esc(pillOf(s,ph))}</span><span class="r0-label">${esc(label)}</span><span class="r0-num">${esc(num)}</span></div>${group}${note?`<span class="action-note">${esc(note)}</span>`:''}</div>`;
}
 /* R1 名单区（三条互斥分支，同一位置演化）：
   A 可勾选网格；B/C1/C2 一行只读「已提交：本人名单」；D「已投入：全队名单」。
   「已提交」与「已投入」在同一个位置演化，正好承载「提交 ≠ 投入」这个模型。 */
 function committedLine(s){
  const list=P.chars(s).filter(c=>c.state.committed).map(c=>esc(c.meta.nameZh)+'（意'+P.stats(s,c.uid).willpower+'）');
  if(!list.length)return '';
  return `<div class="quest-committed" title="已投入：${list.join('、')}">已投入：${list.join('、')}</div>`;
 }
 function listRow(s,pid,ph){
  if(ph==='D')return committedLine(s);
  if(ph!=='A'){
   const ids=s.questing.deployments?.[pid]?.ids||[],names=ids.map(uid=>P.find(s,uid)?.meta.nameZh).filter(Boolean);
   return `<div class="quest-submitted" title="已提交：${esc(names.join('、'))}">已提交：${esc(names.join('、')||'未派遣角色')}</div>`;
  }
  const mine=P.chars(s).filter(c=>c.controller===pid),selected=draftPeek(s,pid);
  if(!mine.length)return '<div class="quest-commit-list empty">本回合无可用角色</div>';
  return `<div class="quest-commit-list">${mine.map(c=>`<label data-state="${selected.includes(c.uid)?'on':''}"><input type="checkbox" data-commit="${c.uid}" data-focus-key="quest-commit-${c.uid}" ${c.state.exhausted?'disabled':''} ${selected.includes(c.uid)?'checked':''}><span>${esc(c.meta.nameZh)}</span><small>意${P.stats(s,c.uid).willpower}</small></label>`).join('')}</div>`;
 }
 /* R2 主操作：一屏唯一主操作。A/C1 一颗绿；B/C2 只有 ghost（撤销不是推进，给绿会让按钮同位置绿↔ghost 翻转）。*/
 function mainAction(s,pid,ph){
  if(ph==='D')return '';
  const green=(label,kind,key)=>`<button class="primary" data-action="quest" data-quest="${kind}" data-player="${pid}" data-focus-key="${key}">${esc(label)}</button>`;
  const ghost=(label,kind,key)=>`<button class="quest-ghost" data-action="quest" data-quest="${kind}" data-player="${pid}" data-focus-key="${key}">${esc(label)}</button>`;
  let main='',sub='';
  if(ph==='A')main=green(draftPeek(s,pid).length?'提交名单':'提交空名单','commit','quest-submit');
  else if(ph==='B')sub=ghost('修改名单','withdraw','quest-withdraw');
  else if(ph==='C1'){main=green('确认派遣','approveDeployment','quest-approve');sub=ghost('修改名单','withdraw','quest-withdraw');}
  else if(ph==='C2')sub=ghost('取消确认','unapproveDeployment','quest-unapprove');
  return `<div class="quest-main-action">${main}${sub}</div>`;
 }
 /* R3 规则与名单：规则正文 + 名单明细。明细用来说明 R0 的差额（未提交者按 0 计）。
   规则在任何状态都可查（只读态更需要）；明细在 D 态不渲染——上方已有全队「已投入：…」。
   summary 文案恒定，避免这一行横向抖。 */
 function roster(s){
  const live=liveOrder(s),viewer=typeof handView==='number'?handView:null,dep=s.questing.deployments||{};
  const rows=live.map(id=>{const name=esc(nameOf(s,id));
   if(dep[id]?.confirmed){const ids=dep[id].ids||[],will=ids.reduce((a,uid)=>a+P.stats(s,uid).willpower,0);
    return `<li data-roster-player="${id}"><span class="name">${name}</span><span class="num">${ids.length} 名 · 意志 ${will}</span><span class="st st-submitted">已提交</span></li>`;}
   if(id===viewer){const ids=draftPeek(s,id);if(ids.length){const will=ids.reduce((a,uid)=>a+P.stats(s,uid).willpower,0);
    return `<li data-roster-player="${id}"><span class="name">${name}</span><span class="num">${ids.length} 名 · 意志 ${will}</span><span class="st st-draft">草稿</span></li>`;}}
   return `<li data-roster-player="${id}"><span class="name">${name}</span><span class="num"></span><span class="st st-none">未提交</span></li>`;}).join('');
  return `<ul class="commit-roster quest-roster">${rows}</ul>`;
 }
function rulesRow(s,ph){
 return `<details class="commit-hint quest-rules" id="quest-rules"${rulesOpen?' open':''}><summary>规则与名单</summary><p>${esc(RULES)}</p>${ph==='D'?'':roster(s)}</details>`;
}
function deploySection(s,pid){
 const ph=stateOf(s,pid);
 return `<div class="quest-deploy" data-state="${ph}">${headRow(s,pid,ph)}${listRow(s,pid,ph)}${mainAction(s,pid,ph)}${rulesRow(s,ph)}</div>`;
}
 /* 勾选复选框只改本地草稿与摘要文字，绝不 render()——整页重绘会把焦点丢掉。 */
 function syncDraftBits(s,pid){
  if(typeof document==='undefined'||typeof document.querySelector!=='function')return;
  const ids=draftPeek(s,pid);
  const num=document.querySelector('.r0-num');
  if(num)num.textContent=statusParts(s,pid,'A').num;
  const commit=document.querySelector('[data-quest="commit"]');
  if(commit)commit.textContent=ids.length?'提交名单':'提交空名单';
  document.querySelectorAll('[data-commit]').forEach(el=>{const l=el.closest&&el.closest('label');if(l&&l.dataset)l.dataset.state=el.checked?'on':'';});
  /* 明细若正展开着，勾选也要跟着变，否则读屏与视觉都会停在旧数。 */
  const cell=document.querySelector('[data-roster-player="'+pid+'"]');
  if(cell){
   const will=ids.reduce((a,uid)=>a+P.stats(s,uid).willpower,0),numCell=cell.querySelector('.num'),st=cell.querySelector('.st');
   if(numCell)numCell.textContent=ids.length?`${ids.length} 名 · 意志 ${will}`:'';
   if(st){st.textContent=ids.length?'草稿':'未提交';st.className='st '+(ids.length?'st-draft':'st-none');}
  }
 }
 /* 牌桌角色卡与勾选双向同步：反向点卡本来就能同步，正向勾选以前只改摘要。 */
 function syncTableMarks(s,pid){
  if(typeof document==='undefined'||typeof document.querySelectorAll!=='function')return;
  const ids=draftPeek(s,pid);
  document.querySelectorAll('.character-card').forEach(card=>{
   const on=ids.includes(Number(card.dataset&&card.dataset.cardUid));
   if(card.classList){if(on)card.classList.add('selected');else card.classList.remove('selected');}
   const face=card.querySelector&&card.querySelector('.card-face');
   if(face&&face.setAttribute)face.setAttribute('aria-pressed',on?'true':'false');
   const mark=card.querySelector&&card.querySelector('.selection-mark');
   if(on&&!mark&&typeof document.createElement==='function'){
    const span=document.createElement('span');span.className='selection-mark';span.textContent='已选';if(face&&face.append)face.append(span);
   }else if(!on&&mark&&mark.remove)mark.remove();
  });
 }
 function bind(){
  if(typeof document==='undefined'||typeof document.querySelectorAll!=='function')return;
  const rules=document.querySelector('#quest-rules');
  if(rules&&rules.addEventListener)rules.addEventListener('toggle',()=>{rulesOpen=!!rules.open;});
  if(!state?.questing||state.questing.step!=='commit')return;
  const live=liveOrder(state),pid=live.includes(handView)?handView:live[0];
  if(pid===undefined)return;
  document.querySelectorAll('[data-commit]').forEach(el=>el.onchange=()=>{
   setDraft(state,pid,[...document.querySelectorAll('[data-commit]:checked')].map(x=>+x.dataset.commit));
   syncDraftBits(state,pid);syncTableMarks(state,pid);
  });
  document.querySelectorAll('[data-quest-actor]').forEach(el=>el.onchange=()=>{
   const next=Number(el.dataset.questActor);
   if(Number.isInteger(next)&&next!==handView){handView=next;render();}
  });
 }
 /* 播报：先清空再异步写入，#live 是 shell.html 里的 role=status 空节点（在 #app 之外，
    否则每次 render 都会把它连内容一起销毁）。同一句连播两次时浏览器只在内容变化时才读。 */
 function say(text){
  if(typeof document==='undefined'||typeof document.querySelector!=='function'||!text)return;
  const box=document.querySelector('#live');if(!box)return;
  box.textContent='';
  setTimeout(()=>{box.textContent=text;},30);
 }
 function deployedCount(s){return Object.values(s.questing.deployments||{}).reduce((n,d)=>n+((d.ids||[]).length),0);}
 /* 面板底部只留一个出口：本阶段还有必需操作时点它=列出还差什么；
    全部完成时点它=引擎自检并推进。撤销走顶栏「撤销一步」，这里不再重复。 */
 function panel(s,pid){if(s.phase!==2||!s.questing)return '';const q=s.questing,ch=P.choiceSpec(s),sp=R.spec(s),live=liveOrder(s),actor=live.includes(pid)?pid:(live[0]??null);const w=P.window(s);let body='';
  if(q.completed)return '<section class="panel deck-valid"><h2>阶段3 · 探险阶段验收完成</h2><p>探险结果与阶段结束效果已结算。点「结束阶段」进入第四阶段 · 旅行。</p></section>';
  if(ch)body+=`<div class="notice">${esc(ch.message)} <button data-action="planning" data-plan="choice" data-id="${ch.task.id}">处理卡牌响应</button></div>`;
  if(sp)body+=`<div class="notice">${esc(sp.message)} ${button('选择并结算','choice',`data-id="${sp.task.id}"`,!!ch)}</div>${q.tasks.filter(t=>t!==sp.task&&t.kind==='commitResponse').map(t=>button('先结算：'+(P.find(s,t.payload.uid)?.meta.nameZh||'投入响应'),'choice',`data-id="${t.id}"`,!!ch)).join('')}`;
  /* 派遣这一段整块交给 deploySection：状态枚举只有一份实现，详细模式与智能模式共用。
     有卡牌响应要处理时不出控件（避免在别人决定时提交名单），只留只读摘要。 */
  if(q.step==='commit'){
   if(sp||ch||actor===null){
    const lockedPh=q.deploymentLocked?'D':'A';
    body+=`<div class="quest-deploy" data-state="${lockedPh}">${headRow(s,actor,lockedPh)}${q.deploymentLocked?committedLine(s):''}${q.deploymentLocked?rulesRow(s,'D'):''}</div>`;
   }else body+=deploySection(s,actor);
  }else body+=committedLine(s);
  if(q.discussion&&(q.plannedActions?.length||q.actionLocked||q.actionError)){body+=`<section class="notice"><h3>暂定行动 · 交流缓冲区</h3><p>按下列顺序执行；全员二次确认前不支付、不弃牌、不抽牌。修改或撤销会清除全体二次确认。</p>${q.actionError?`<p>${esc(q.actionError)}</p>`:''}${(q.plannedActions||[]).map(a=>{const source=a.kind==='play'?s.players[a.player].hand.find(c=>c.uid===a.uid):P.find(s,a.uid)?.state;const m=source?P.data(s,{...source,owner:a.player}):null;return `<p>${esc(s.players[a.player].name)} · ${a.kind==='play'?'事件':'能力'}：${esc(m?.nameZh||'#'+a.uid)} ${button('撤销此暂定行动','cancelAction',`data-player="${a.player}" data-id="${a.id}"`,q.actionLocked)}</p>`;}).join('')}<div class="actions">${q.order.filter(id=>!s.players[id].eliminated).map(id=>button(s.players[id].name+(q.actionApprovals?.includes(id)?'：取消二次确认':'：二次确认行动'),q.actionApprovals?.includes(id)?'unapproveActions':'approveActions',`data-player="${id}"`,!q.plannedActions?.length||q.actionLocked||!!ch||!!sp)).join('')}</div>${q.actionLocked?'<p>全员已确认，正在执行；请先处理效果与响应。</p>':''}</section>`;}
  if(q.step==='staging'&&!sp&&!ch){if(q.current){const c=q.current.card;body+=`<div class="quest-reveal">${ImageLibrary.encounterArt(c.id)}<h3>${esc(c.name)}</h3><p>${esc(c.rule)}</p><p>厄运 ${c.doomed||0} · ${c.surge?'涌现':'无涌现'} · ${q.current.canceled?'翻开效果已取消':'等待结算'}</p><div class="actions">${R.cancelOptions(s).map(o=>button(o.label,'cancel',`data-value="${o.value}"`)).join('')}${button('结算此牌的关键词与效果','reveal')}</div></div>`;}else body+=button(q.remaining.length?'翻开下一张遭遇牌（待翻 '+q.remaining.length+'）':'结束探查，开放行动窗口','draw');}
  if(w.kind==='action'&&!q.actionLocked&&ScenarioEngine.windows.settings(s).mode==='detailed'&&actor!==null){body+=`<p class="small">事件与主动能力先进入暂定清单，全员二次确认后执行。${q.plannedActions?.length?'暂定行动尚未执行，请先二次确认或撤销。':'等待结束行动：'+(s.players.filter(p=>!p.eliminated&&!q.finalPasses.includes(p.id)).map(p=>esc(p.name)).join('、')||'全员已放弃，可以推进')}。放弃后仍可取消放弃。</p><div class="actions">${s.players.filter(p=>!p.eliminated).map(p=>button(p.name+(q.finalPasses.includes(p.id)?'：取消放弃行动':'：放弃本窗口行动'),q.finalPasses.includes(p.id)?'unpass':'pass',`data-player="${p.id}"`,false)).join('')}${button(q.step==='beforeCommit'?'开始投入角色':q.step==='afterCommit'?'开始探查':q.step==='afterStaging'?'自动结算探险':'结束探险阶段','move','',!!q.plannedActions?.length||!s.players.filter(p=>!p.eliminated).every(p=>q.finalPasses.includes(p.id)))}</div><label>使用行动的玩家 <select id="planning-actor">${s.players.filter(p=>!p.eliminated).map(p=>`<option value="${p.id}" ${p.id===actor?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><div class="actions">${P.abilities(s,actor).map(a=>`<button data-action="planning" data-plan="ability" data-player="${actor}" data-uid="${a.uid}" title="${esc(a.reason)}" ${a.legal?'':'disabled'}>${esc(a.name)}</button>`).join('')}</div><p class="small muted">事件在下方手牌区操作；任一行动会清除全体玩家的放弃标记。</p>`;}
  /* commit 这一段的数字在 R0 里，标题行不再重复「投入意志」；其他步骤（探查、结果）没有 R0。 */
  const head=q.step==='commit'?`<div class="panel-title"><h2>阶段3 · ${steps[q.step]}</h2></div>`:`<div class="panel-title"><h2>阶段3 · ${steps[q.step]}</h2><strong>投入意志 ${R.total(s)} ／ 探查区威胁 ${ScenarioEngine.threat(s)}</strong></div>`;
  return `<section class="panel questing-panel">${head}${q.result?`<p class="notice">本次结果：意志 ${q.result.willpower} − 威胁 ${q.result.threat} = ${q.result.delta}。${q.result.delta>0?'进度已自动分配':q.result.delta<0?'每位玩家威胁已增加'+(-q.result.delta):'平局，不放进度、不增加威胁'}。</p>`:''}${body}</section>`;
 }
 async function handle(b){const k=b.dataset.quest,pid=+b.dataset.player,id=+b.dataset.id;
  if(k==='back'){if(history.length){state=history.pop();save();render();}return;}
  if(k==='withdraw'){
   const q=state?.questing,was=(q?.deploymentApprovals||[]).length;
   /* 改名单会 invalidateAgreement 清空全队确认——这是本面板唯一需要二次确认的次操作。 */
   if(was>0){const ok=await choose('修改名单 · '+(state.players[pid]?.name||''),`<p>修改名单会清除全队已完成的 <b>${was}</b> 次确认，所有人需要重新确认。继续？</p>`,()=>true);if(!ok)return;}
   mutate(()=>R.withdrawDeployment(state,pid));
   if(was&&state?.questing&&!state.questing.deploymentLocked)say(`${nameOf(state,pid)} 改了名单，确认已重置，请重新确认`);
   return;
  }
  if(k==='clear'){setDraft(state,pid,[]);render();return;}
  if(k==='commit'){
   const ids=draftFor(state,pid),before=JSON.stringify(state);const selected=ids.map(id=>P.find(state,id));
   const solo=(state.questing.order||[]).length<2;
   const ok=await choose('提交名单 · '+state.players[pid].name,`<p>${selected.length?'将派遣以下角色：':'本次不派遣角色（0名）。'}</p><ul>${selected.map(c=>`<li>${esc(c.meta.nameZh)} · 意志 ${P.stats(state,c.uid).willpower}</li>`).join('')}</ul><p>当前意志合计 <b>${selected.reduce((n,c)=>n+P.stats(state,c.uid).willpower,0)}</b>。遭遇与后续行动可能改变此数值。</p><p>${solo?'单人局：提交即投入。':'只提交名单。全员确认后才横置。返回修改时勾选会保留。'}</p>`,()=>true);
   if(ok)mutate(()=>{if(JSON.stringify(state)!==before)throw Error('桌面已变化，请重新核对派遣名单。');R.submitDeployment(state,pid,ids);draft={context:null,player:null,ids:[]};});
   if(ok&&state?.questing){
    const q=state.questing,live=liveOrder(state);
    if(q.deploymentLocked)say(`已锁定，正在按顺序投入 ${deployedCount(state)} 名角色`);
    else if(q.step==='commit'){
     const wait=live.filter(x=>!q.deployments?.[x]?.confirmed);
     if(wait.length)say(`${nameOf(state,pid)} 已提交名单，还差 ${wait.map(x=>nameOf(state,x)).join('、')}`);
     else say(`名单已齐，等待 ${live.filter(x=>!(q.deploymentApprovals||[]).includes(x)).length} 人确认，尚未横置`);
    }
   }
   /* 提交后自动把操作权交给下一位未提交的玩家，否则第二个人永远轮不到提交。 */
   if(ok&&state?.questing?.step==='commit'&&!state.questing.deploymentLocked&&typeof handView!=='undefined'){
    const next=(state.questing.order||[]).find(x=>!state.questing.deployments?.[x]?.confirmed);
    if(next!==undefined&&next!==handView){handView=next;render();}
   }
   return;
  }
  if(k==='choice'){const sp=R.spec(state,id);if(!sp)return;let values=await choose(sp.message,sp.fields.map(f=>`<label>${esc(f.label)}<select id="quest-${f.key}">${f.options.map(o=>`<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}</select></label>`).join('')+(sp.task.optional?'<p><label><input id="quest-skip" type="checkbox">放弃此响应</label></p>':''),d=>({...Object.fromEntries(sp.fields.map(f=>[f.key,d.querySelector('#quest-'+f.key).value])),skip:!!d.querySelector('#quest-skip')?.checked}));if(values)mutate(()=>R.choose(state,id,values));return;}
  if(k==='approveDeployment'||k==='unapproveDeployment'){
   const before=(state.questing?.deploymentApprovals||[]).length,name=state?.players[pid]?.name||('玩家'+(pid+1));
   mutate(()=>{if(k==='approveDeployment')R.approveDeployment(state,pid);else R.withdrawDeploymentApproval(state,pid);});
   const q=state?.questing;
   if(q&&(q.deploymentApprovals||[]).length!==before){
    if(q.deploymentLocked)say(`已锁定，正在按顺序投入 ${deployedCount(state)} 名角色`);
    else if(k==='unapproveDeployment')say(`${name} 取消确认，尚未横置`);
    else say(`已确认 ${(q.deploymentApprovals||[]).length}／${liveOrder(state).length}，尚未横置`);
   }
   /* 确认后把操作权交给下一位未确认的玩家：确认是按人来的，不切换就只能看到「取消确认」。 */
   if(k==='approveDeployment'&&q&&!q.deploymentLocked&&typeof handView!=='undefined'){
    const next=liveOrder(state).find(x=>!(q.deploymentApprovals||[]).includes(x));
    if(next!==undefined&&next!==handView){handView=next;render();}
   }
   return;
  }
  mutate(()=>{if(k==='unpass')R.unpass(state,pid);if(k==='approveActions')R.approveActions(state,pid);if(k==='unapproveActions')R.withdrawActionApproval(state,pid);if(k==='cancelAction')R.cancelAction(state,pid,id);if(k==='pass')R.pass(state,pid);if(k==='move')R.move(state);if(k==='draw')R.drawNext(state);if(k==='reveal')R.resolveReveal(state);if(k==='cancel')R.cancel(state,b.dataset.value);});
 }
 /* 操作条只放这一步必须的输入：选角色投入 / 结算正在翻开的遭遇牌。
    其余说明、状态与「结束阶段」都在角色卡下方的完整面板里。 */
 function picker(s,pid){const q=s.questing;
  /* 投入前行动窗口也要给出「开始投入」入口：此前 picker 只在 step==='commit' 渲染，
     玩家在投入前窗口打完事件、全员确认后只能靠详细模式找到那个按钮——智能模式下就此永久卡住。 */
  if(!q||q.completed)return '';
  if(q.step==='beforeCommit'&&!q.deploymentLocked&&!R.spec(s)&&!P.choiceSpec(s)&&!q.actionLocked){
   const left=q.order.filter(id=>!q.finalPasses.includes(id));
   /* 全员放弃后才能投入：pass 只在 left 里，unpass 要覆盖已放弃的人 */
   const passed=q.order.filter(id=>q.finalPasses.includes(id));
   return `<section class="panel questing-panel compact"><div class="panel-title"><h2>投入前行动窗口</h2><strong class="small">意志 0 ／ 威胁 ${ScenarioEngine.threat(s)}</strong></div><p class="small muted">${q.plannedActions?.length?'暂定行动尚未执行，请先在上方二次确认或撤销。':left.length?'全队放弃本窗口行动后即可投入角色（可随时取消放弃）。':'全员已放弃，可以投入角色。'}</p><div class="actions">${left.map(id=>`<button data-action="quest" data-quest="pass" data-player="${id}">${esc(s.players[id].name)}：放弃本窗口行动</button>`).join('')}${passed.map(id=>`<button data-action="quest" data-quest="unpass" data-player="${id}">${esc(s.players[id].name)}：取消放弃</button>`).join('')}</div><div class="actions"><button class="primary" data-action="quest" data-quest="move" ${(!q.plannedActions?.length&&!left.length)?'':'disabled'}>开始投入角色 →</button></div></section>`;
  }
  if(q.step!=='commit'||q.deploymentLocked||R.spec(s)||P.choiceSpec(s))return '';
  const live=liveOrder(s),actor=live.includes(pid)?pid:(live[0]??null);
  if(actor===null)return '';
  /* 智能模式与详细模式共用同一份五态面板：以前这里是一份精简的重复实现，
     两处各改一半就成了「同一件事两个入口、两颗绿按钮」。 */
  return `<section class="panel questing-panel compact">${deploySection(s,actor)}</section>`;
 }
 function revealCard(s){const c=s.questing&&s.questing.current&&s.questing.current.card;if(!c)return '';
  return `<section class="panel questing-panel compact"><div class="panel-title"><h2>翻开的遭遇</h2><strong>${c.surge?'涌现':'无涌现'}</strong></div><p><b>${esc(c.name)}</b></p><p class="small muted">${esc(c.rule)}</p><div class="actions">${R.cancelOptions(s).map(o=>button(o.label,'cancel',`data-value="${o.value}"`)).join('')}${button('结算此牌的关键词与效果','reveal')}</div></section>`;
 }
 /* 决策弹窗的标题直接用这里的中文步骤名，免得两处各写一份文案、改一处漏一处。 */
 function stepName(step){return steps[step]||'';}
 return {panel,handle,bind,setDraft,draftFor,draftPeek,picker,revealCard,stepName,stateOf,liveOrder};
})();
