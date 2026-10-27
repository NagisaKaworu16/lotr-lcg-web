const QuestUI=(()=>{
 const R=ScenarioEngine.questing,P=ScenarioEngine.planning,esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const button=(text,kind,args='',disabled=false)=>`<button data-action="quest" data-quest="${kind}" ${args} ${disabled?'disabled':''}>${esc(text)}</button>`;
 // Draft selection belongs to this browser's UI; it never changes the game state.
 let draft={context:null,player:null,ids:[]};
 function draftFor(s,pid){if(draft.context!==s.questing||draft.player!==pid)draft={context:s.questing,player:pid,ids:[...(s.questing.deployments?.[pid]?.ids||[])]};const allowed=R.eligible(s,pid).map(c=>c.uid);draft.ids=draft.ids.filter(id=>allowed.includes(id));return [...draft.ids];}
 function setDraft(s,pid,ids){const allowed=R.eligible(s,pid).map(c=>c.uid);draft={context:s.questing,player:pid,ids:[...new Set(ids)].filter(id=>allowed.includes(id))};}
 const steps={beforeCommit:'投入前行动窗口',commit:'派遣名单',afterCommit:'投入后行动窗口',staging:'逐张探查',afterStaging:'探险结算前行动窗口',afterResult:'结算后行动窗口',completed:'阶段3验收完成'};

 /* ── 派遣名单：四态枚举（v0.15.70）────────────────────────────────────
    旧版是「两条并列的 if 各往 body 追加一段」，于是状态重叠时同一件事渲染两遍：
    详细模式里同时有下拉框、并排徽章、逐人「二次确认派遣」按钮和两块说明文字，
    牌桌操作条里还有第三颗「提交暂定派遣名单」。现在一次算出唯一状态，
    纵向四段只在一处渲染：
      R0 状态行 · R1 玩家分段按钮组 · R2 名单勾选区 · R3 主操作行 · R4 折叠说明
    状态判据（lock=deploymentLocked，sub=本人已提交，allSub=全队已提交，ok=本人已确认）：
      A    !lock && !sub                              草稿
      B    !lock && sub && !allSub                    已提交，等别人
      C-in !lock && allSub && discussion && !ok       待确认（唯一主操作=确认派遣）
      C-out!lock && allSub && discussion && ok        已确认，等别人
      D    lock                                       只读，不渲染主操作
    单人局永远到不了 C：引擎在 submitDeployment 里提交即自动 approveDeployment。 */
 const HINT='名单全部提交后才能二次确认；确认后仍可取消。任何修改都会清除所有人的确认。全员确认后按起始玩家顺序横置，并结算投入响应。';
 const nameOf=(s,id)=>s.players[id]?.name||('玩家'+(id+1));
 /* 已淘汰的玩家不再参与「全员提交／全员确认」判据：否则中途被淘汰会让全队永远卡在 B/C。 */
 const aliveOrder=s=>(s.questing.order||[]).filter(id=>!s.players[id]?.eliminated);
 function stateOf(s,pid){
  const q=s.questing,alive=aliveOrder(s),apr=q.deploymentApprovals||[];
  if(q.deploymentLocked)return 'D';
  if(!q.deployments?.[pid]?.confirmed)return 'A';
  if(alive.length&&!alive.every(id=>q.deployments?.[id]?.confirmed))return 'B';
  if((q.order||[]).length>1&&q.discussion){
   if(!apr.includes(pid))return 'C-in';
   if(!alive.every(id=>apr.includes(id)))return 'C-out';
  }
  return 'D';
 }
 /* R0 的数字 = Σ 已提交名单 + 本机草稿（未提交者按 0 计），所以草稿态也能看到「我勾了会怎样」。 */
 function tally(s,pid,ph){
  let n=0,will=0;
  /* 已淘汰玩家的名单不会再被横置（引擎在 resumeDeployment 里跳过），所以也不计入合计。 */
  for(const id of aliveOrder(s)){const d=s.questing.deployments?.[id];if(!d?.confirmed)continue;n+=d.ids.length;will+=d.ids.reduce((a,uid)=>a+P.stats(s,uid).willpower,0);}
  if(ph==='A'){const ids=draftFor(s,pid);n+=ids.length;will+=ids.reduce((a,uid)=>a+P.stats(s,uid).willpower,0);}
  return {n,will};
 }
 /* 「已投入」三字只允许出现在锁定态；草稿态一律写「暂定」。 */
 function statusText(s,pid,ph){
  const {n,will}=tally(s,pid,ph);
  return ph==='D'?`已投入 ${n} 名 · 意志 ${will}`:`暂定 ${n} 名 · 意志 ${will} ／ 威胁 ${ScenarioEngine.threat(s)}`;
 }
 const PILL={A:'草稿',B:'已提交','C-in':'待确认','C-out':'待确认'};
 function statusRow(s,pid,ph){const pill=PILL[ph]?`<span class="state-pill">${PILL[ph]}</span>`:'';return `<p class="quest-status">${pill}<span data-quest-status>${esc(statusText(s,pid,ph))}</span></p>`;}
 /* R1：一颗分段按钮（role=radiogroup）替代「下拉框 + 并排徽章」——后者是同屏两份同一信息。
    三态圆点纯 CSS：空心环=未提交、实心=已提交、实心加金环=已二次确认。
    点击只改 this browser 的 handView（视图态），零游戏状态变更、不进 history。 */
 function actorGroup(s,pid){
  const q=s.questing,order=aliveOrder(s),apr=q.deploymentApprovals||[];
  if(order.length<2)return '';
  const chips=order.map(id=>{const sub=!!q.deployments?.[id]?.confirmed,ok=apr.includes(id),tone=ok?'ok':sub?'sub':'idle',label=ok?'已确认':sub?'已提交':'未提交';
   return `<label class="actor-chip" data-state="${tone}"><input type="radio" name="quest-actor" value="${id}" data-quest-actor="${id}" data-focus-key="quest-actor-${id}" ${id===pid?'checked':''} aria-label="${esc(nameOf(s,id))}，${label}"><span class="dot" aria-hidden="true"></span>${esc(nameOf(s,id))}</label>`;}).join('');
  return `<fieldset class="quest-actors" role="radiogroup" aria-label="当前操作玩家">${chips}</fieldset>`;
 }
 /* R2：只用原生 checkbox（复用 [data-commit] 绑定），勾选不重绘整页。 */
 function commitList(s,pid,ph){
  if(ph!=='A')return '';
  const mine=P.chars(s).filter(c=>c.controller===pid),selected=draftFor(s,pid);
  if(!mine.length)return '<div class="quest-commit-list empty">本回合无可用角色</div>';
  return `<div class="quest-commit-list">${mine.map(c=>`<label data-state="${selected.includes(c.uid)?'on':''}"><input type="checkbox" data-commit="${c.uid}" data-focus-key="quest-commit-${c.uid}" ${c.state.exhausted?'disabled':''} ${selected.includes(c.uid)?'checked':''}><span>${esc(c.meta.nameZh)}</span><small>意${P.stats(s,c.uid).willpower}</small></label>`).join('')}</div>`;
 }
 /* R3：一屏唯一主操作。左侧最多一颗绿色主按钮，右侧是 ghost 次操作，行尾一句小字说「还差谁」。 */
 function mainAction(s,pid,ph){
  if(ph==='D')return '';
  const q=s.questing,alive=aliveOrder(s),apr=q.deploymentApprovals||[];
  const done=alive.filter(id=>q.deployments?.[id]?.confirmed).length,waitSub=alive.filter(id=>!q.deployments?.[id]?.confirmed),waitApr=alive.filter(id=>!apr.includes(id));
  let main='',ghost='',note='';
  if(ph==='A'){
   const n=draftFor(s,pid).length;
   main=`<button class="primary" data-action="quest" data-quest="commit" data-player="${pid}" data-focus-key="quest-submit">${n?'提交名单':'提交空名单'}</button>`;
   note=`已提交 ${done}/${alive.length} 人`;
  }else if(ph==='B'){
   ghost=`<button class="quest-ghost" data-action="quest" data-quest="withdraw" data-player="${pid}" data-focus-key="quest-withdraw">修改名单</button>`;
   note=`还差 ${waitSub.map(id=>nameOf(s,id)).join('、')} 提交`;
  }else if(ph==='C-in'){
   main=`<button class="primary" data-action="quest" data-quest="approveDeployment" data-player="${pid}" data-focus-key="quest-approve">确认派遣</button>`;
   note='尚未横置';
  }else if(ph==='C-out'){
   ghost=`<button class="quest-ghost" data-action="quest" data-quest="unapproveDeployment" data-player="${pid}" data-focus-key="quest-unapprove">取消确认</button>`;
   note=`还差 ${waitApr.map(id=>nameOf(s,id)).join('、')} 确认`;
  }
  return `<div class="quest-main-action">${main}${ghost}<span class="action-note">${esc(note)}</span></div>`;
 }
 /* R4：方法论收进折叠，默认不占高度。 */
 function hintRow(){return `<details class="commit-hint"><summary>规则说明</summary><p>${esc(HINT)}</p></details>`;}
 function deploySection(s,pid){
  const ph=stateOf(s,pid);
  if(ph==='D')return `<div class="quest-deploy" data-state="D">${statusRow(s,pid,ph)}</div>`;
  return `<div class="quest-deploy" data-state="${ph}">${statusRow(s,pid,ph)}${actorGroup(s,pid)}${commitList(s,pid,ph)}${mainAction(s,pid,ph)}${hintRow()}</div>`;
 }
 /* 勾选复选框只改本地草稿与摘要文字，绝不 render()——整页重绘会把焦点丢掉。 */
 function syncDraftBits(s,pid){
  if(typeof document==='undefined'||typeof document.querySelector!=='function')return;
  const ids=draftFor(s,pid);
  const box=document.querySelector('[data-quest-status]');
  if(box)box.textContent=statusText(s,pid,'A');
  const commit=document.querySelector('[data-quest="commit"]');
  if(commit)commit.textContent=ids.length?'提交名单':'提交空名单';
  document.querySelectorAll('[data-commit]').forEach(el=>{const l=el.closest&&el.closest('label');if(l&&l.dataset)l.dataset.state=el.checked?'on':'';});
 }
 /* 牌桌角色卡与勾选双向同步：反向点卡本来就能同步，正向勾选以前只改摘要，
    牌桌上的「已选」角标不动，玩家会以为没勾上。 */
 function syncTableMarks(s,pid){
  if(typeof document==='undefined'||typeof document.querySelectorAll!=='function')return;
  const ids=draftFor(s,pid);
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
  if(!state?.questing||state.questing.step!=='commit')return;
  const pid=state.players[handView]&&!state.players[handView].eliminated?handView:state.first;
  document.querySelectorAll('[data-commit]').forEach(el=>el.onchange=()=>{
   setDraft(state,pid,[...document.querySelectorAll('[data-commit]:checked')].map(x=>+x.dataset.commit));
   syncDraftBits(state,pid);syncTableMarks(state,pid);
  });
  document.querySelectorAll('[data-quest-actor]').forEach(el=>el.onchange=()=>{
   const next=Number(el.dataset.questActor);
   if(Number.isInteger(next)&&next!==handView){handView=next;render();}
  });
 }
 /* 播报：先清空再异步写入，#live 是 shell.html 里的 role=status 空节点。
    同一句话连续播两次时，浏览器只在内容「变化」时才读，所以必须先清空。 */
 function say(text){
  if(typeof document==='undefined'||typeof document.querySelector!=='function'||!text)return;
  const box=document.querySelector('#live');if(!box)return;
  box.textContent='';
  setTimeout(()=>{box.textContent=text;},30);
 }
 function deployedCount(s){return Object.values(s.questing.deployments||{}).reduce((n,d)=>n+((d.ids||[]).length),0);}
 /* 面板底部只留一个出口：本阶段还有必需操作时点它=列出还差什么；
    全部完成时点它=引擎自检并推进。撤销走顶栏「撤销一步」，这里不再重复。 */
 function panel(s,pid){if(s.phase!==2||!s.questing)return '';const q=s.questing,ch=P.choiceSpec(s),sp=R.spec(s),actor=s.players[pid]&&!s.players[pid].eliminated?pid:s.first;const w=P.window(s);let body='';
  if(q.completed)return '<section class="panel deck-valid"><h2>阶段3 · 探险阶段验收完成</h2><p>探险结果与阶段结束效果已结算。点「结束阶段」进入第四阶段 · 旅行。</p></section>';
  if(ch)body+=`<div class="notice">${esc(ch.message)} <button data-action="planning" data-plan="choice" data-id="${ch.task.id}">处理卡牌响应</button></div>`;
  if(sp)body+=`<div class="notice">${esc(sp.message)} ${button('选择并结算','choice',`data-id="${sp.task.id}"`,!!ch)}</div>${q.tasks.filter(t=>t!==sp.task&&t.kind==='commitResponse').map(t=>button('先结算：'+(P.find(s,t.payload.uid)?.meta.nameZh||'投入响应'),'choice',`data-id="${t.id}"`,!!ch)).join('')}`;
  /* 派遣这一段整块交给 deploySection：状态枚举只有一份实现，详细模式与智能模式共用。 */
  if(q.step==='commit')body+=sp||ch?`<div class="quest-deploy" data-state="${q.deploymentLocked?'D':'A'}">${statusRow(s,actor,q.deploymentLocked?'D':'A')}</div>`:deploySection(s,actor);
  if(q.discussion&&(q.plannedActions?.length||q.actionLocked||q.actionError)){body+=`<section class="notice"><h3>暂定行动 · 交流缓冲区</h3><p>按下列顺序执行；全员二次确认前不支付、不弃牌、不抽牌。修改或撤销会清除全体二次确认。</p>${q.actionError?`<p>${esc(q.actionError)}</p>`:''}${(q.plannedActions||[]).map(a=>{const source=a.kind==='play'?s.players[a.player].hand.find(c=>c.uid===a.uid):P.find(s,a.uid)?.state;const m=source?P.data(s,{...source,owner:a.player}):null;return `<p>${esc(s.players[a.player].name)} · ${a.kind==='play'?'事件':'能力'}：${esc(m?.nameZh||'#'+a.uid)} ${button('撤销此暂定行动','cancelAction',`data-player="${a.player}" data-id="${a.id}"`,q.actionLocked)}</p>`;}).join('')}<div class="actions">${q.order.filter(id=>!s.players[id].eliminated).map(id=>button(s.players[id].name+(q.actionApprovals?.includes(id)?'：取消二次确认':'：二次确认行动'),q.actionApprovals?.includes(id)?'unapproveActions':'approveActions',`data-player="${id}"`,!q.plannedActions?.length||q.actionLocked||!!ch||!!sp)).join('')}</div>${q.actionLocked?'<p>全员已确认，正在执行；请先处理效果与响应。</p>':''}</section>`;}
  if(q.step==='staging'&&!sp&&!ch){if(q.current){const c=q.current.card;body+=`<div class="quest-reveal">${ImageLibrary.encounterArt(c.id)}<h3>${esc(c.name)}</h3><p>${esc(c.rule)}</p><p>厄运 ${c.doomed||0} · ${c.surge?'涌现':'无涌现'} · ${q.current.canceled?'翻开效果已取消':'等待结算'}</p><div class="actions">${R.cancelOptions(s).map(o=>button(o.label,'cancel',`data-value="${o.value}"`)).join('')}${button('结算此牌的关键词与效果','reveal')}</div></div>`;}else body+=button(q.remaining.length?'翻开下一张遭遇牌（待翻 '+q.remaining.length+'）':'结束探查，开放行动窗口','draw');}
  if(w.kind==='action'&&!q.actionLocked&&ScenarioEngine.windows.settings(s).mode==='detailed'){body+=`<p class="small">事件与主动能力先进入暂定清单，全员二次确认后执行。${q.plannedActions?.length?'暂定行动尚未执行，请先二次确认或撤销。':'等待结束行动：'+(s.players.filter(p=>!p.eliminated&&!q.finalPasses.includes(p.id)).map(p=>esc(p.name)).join('、')||'全员已放弃，可以推进')}。放弃后仍可取消放弃。</p><div class="actions">${s.players.filter(p=>!p.eliminated).map(p=>button(p.name+(q.finalPasses.includes(p.id)?'：取消放弃行动':'：放弃本窗口行动'),q.finalPasses.includes(p.id)?'unpass':'pass',`data-player="${p.id}"`,false)).join('')}${button(q.step==='beforeCommit'?'开始投入角色':q.step==='afterCommit'?'开始探查':q.step==='afterStaging'?'自动结算探险':'结束探险阶段','move','',!!q.plannedActions?.length||!s.players.filter(p=>!p.eliminated).every(p=>q.finalPasses.includes(p.id)))}</div><label>使用行动的玩家 <select id="planning-actor">${s.players.filter(p=>!p.eliminated).map(p=>`<option value="${p.id}" ${p.id===actor?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><div class="actions">${P.abilities(s,actor).map(a=>`<button data-action="planning" data-plan="ability" data-player="${actor}" data-uid="${a.uid}" title="${esc(a.reason)}" ${a.legal?'':'disabled'}>${esc(a.name)}</button>`).join('')}</div><p class="small muted">事件在下方手牌区操作；任一行动会清除全体玩家的放弃标记。</p>`;}
  /* 「已投入：阿拉贡（意3）」——无人时不渲染这一行（旧版会印一句「无人」）。 */
  const committed=P.chars(s).filter(c=>c.state.committed).map(c=>esc(c.meta.nameZh)+'（意'+P.stats(s,c.uid).willpower+'）');
  const doneLine=committed.length?`<p class="small mat-only">已投入：${committed.join('、')}</p>`:'';
  /* commit 这一段的数字在 R0 状态行里，标题行不再重复「投入意志」；
     其他步骤（探查、结果）没有 R0，仍在标题行给出意志／威胁。 */
  const head=q.step==='commit'?`<div class="panel-title"><h2>阶段3 · ${steps[q.step]}</h2></div>`:`<div class="panel-title"><h2>阶段3 · ${steps[q.step]}</h2><strong>投入意志 ${R.total(s)} ／ 探查区威胁 ${ScenarioEngine.threat(s)}</strong></div>`;
  return `<section class="panel questing-panel">${head}${doneLine}${q.result?`<p class="notice">本次结果：意志 ${q.result.willpower} − 威胁 ${q.result.threat} = ${q.result.delta}。${q.result.delta>0?'进度已自动分配':q.result.delta<0?'每位玩家威胁已增加'+(-q.result.delta):'平局，不放进度、不增加威胁'}。</p>`:''}${body}</section>`;
 }
 async function handle(b){const k=b.dataset.quest,pid=+b.dataset.player,id=+b.dataset.id;
  if(k==='back'){if(history.length){state=history.pop();save();render();}return;}
  if(k==='withdraw'){const q=state?.questing,was=(q?.deploymentApprovals||[]).length;mutate(()=>R.withdrawDeployment(state,pid));
   if(was&&state?.questing&&!state.questing.deploymentLocked)say(`${nameOf(state,pid)} 改了名单，确认已重置，请重新确认`);return;}
  if(k==='clear'){setDraft(state,pid,[]);render();return;}
  if(k==='commit'){
   const ids=draftFor(state,pid),before=JSON.stringify(state);const selected=ids.map(id=>P.find(state,id));
   const solo=(state.questing.order||[]).length<2;
   const ok=await choose('提交名单 · '+state.players[pid].name,`<p>${selected.length?'将派遣以下角色：':'本次不派遣角色（0名）。'}</p><ul>${selected.map(c=>`<li>${esc(c.meta.nameZh)} · 意志 ${P.stats(state,c.uid).willpower}</li>`).join('')}</ul><p>当前意志合计 <b>${selected.reduce((n,c)=>n+P.stats(state,c.uid).willpower,0)}</b>。遭遇与后续行动可能改变此数值。</p><p>${solo?'单人局：提交即投入。':'只提交名单。全员确认后才横置。返回修改时勾选会保留。'}</p>`,()=>true);
   if(ok)mutate(()=>{if(JSON.stringify(state)!==before)throw Error('桌面已变化，请重新核对派遣名单。');R.submitDeployment(state,pid,ids);draft={context:null,player:null,ids:[]};});
   if(ok&&state?.questing){
    const q=state.questing,alive=aliveOrder(state);
    if(q.deploymentLocked)say(`已锁定，正在按顺序投入 ${deployedCount(state)} 名角色`);
    else if(q.step==='commit'){
     const wait=alive.filter(x=>!q.deployments?.[x]?.confirmed);
     if(wait.length)say(`${nameOf(state,pid)} 已提交名单，还差 ${wait.map(x=>nameOf(state,x)).join('、')}`);
     else say(`名单已齐，等待 ${alive.filter(x=>!(q.deploymentApprovals||[]).includes(x)).length} 人确认，尚未横置`);
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
    else say(`已确认 ${(q.deploymentApprovals||[]).length}／${aliveOrder(state).length}，尚未横置`);
   }
   /* 确认后把操作权交给下一位未确认的玩家：确认是按人来的，不切换就只能看到「取消确认」。 */
   if(k==='approveDeployment'&&q&&!q.deploymentLocked&&typeof handView!=='undefined'){
    const next=aliveOrder(state).find(x=>!(q.deploymentApprovals||[]).includes(x));
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
  const actor=s.players[pid]&&!s.players[pid].eliminated?pid:s.first;
  /* 智能模式与详细模式共用同一份四段式面板：以前这里是一份精简的重复实现，
     两处各改一半就成了「同一件事两个入口、两颗绿按钮」。 */
  return `<section class="panel questing-panel compact">${deploySection(s,actor)}</section>`;
 }
 function revealCard(s){const c=s.questing&&s.questing.current&&s.questing.current.card;if(!c)return '';
  return `<section class="panel questing-panel compact"><div class="panel-title"><h2>翻开的遭遇</h2><strong>${c.surge?'涌现':'无涌现'}</strong></div><p><b>${esc(c.name)}</b></p><p class="small muted">${esc(c.rule)}</p><div class="actions">${R.cancelOptions(s).map(o=>button(o.label,'cancel',`data-value="${o.value}"`)).join('')}${button('结算此牌的关键词与效果','reveal')}</div></section>`;
 }
 /* 决策弹窗的标题直接用这里的中文步骤名，免得两处各写一份文案、改一处漏一处。 */
 function stepName(step){return steps[step]||'';}
 return {panel,handle,bind,setDraft,draftFor,picker,revealCard,stepName,stateOf};
})();
