const QuestUI=(()=>{
 const R=ScenarioEngine.questing,P=ScenarioEngine.planning,esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const button=(text,kind,args='',disabled=false)=>`<button data-action="quest" data-quest="${kind}" ${args} ${disabled?'disabled':''}>${esc(text)}</button>`;
 // Draft selection belongs to this browser's UI; it never changes the game state.
 let draft={context:null,player:null,ids:[]};
 function draftFor(s,pid){if(draft.context!==s.questing||draft.player!==pid)draft={context:s.questing,player:pid,ids:[...(s.questing.deployments?.[pid]?.ids||[])]};const allowed=R.eligible(s,pid).map(c=>c.uid);draft.ids=draft.ids.filter(id=>allowed.includes(id));return [...draft.ids];}
 function setDraft(s,pid,ids){const allowed=R.eligible(s,pid).map(c=>c.uid);draft={context:s.questing,player:pid,ids:[...new Set(ids)].filter(id=>allowed.includes(id))};}
 function bind(){if(!state?.questing||state.questing.step!=='commit')return;const pid=state.players[handView]&&!state.players[handView].eliminated?handView:state.first;document.querySelectorAll('[data-commit]').forEach(el=>el.onchange=()=>{setDraft(state,pid,[...document.querySelectorAll('[data-commit]:checked')].map(x=>+x.dataset.commit));const box=document.querySelector('#quest-draft-summary');if(box)box.textContent=draftSummary(state,pid);});}
 function draftSummary(s,pid){const ids=draftFor(s,pid);return '待确认：'+ids.length+'名角色，当前意志合计 '+ids.reduce((n,id)=>n+P.stats(s,id).willpower,0)+'。尚未横置角色或触发响应，可随时修改。';}
 const steps={beforeCommit:'投入前行动窗口',commit:'暂定派遣与全队确认',afterCommit:'投入后行动窗口',staging:'逐张探查',afterStaging:'探险结算前行动窗口',afterResult:'结算后行动窗口',completed:'阶段3验收完成'};
 /* 面板底部只留一个出口：本阶段还有必需操作时点它=列出还差什么；
    全部完成时点它=引擎自检并推进。撤销走顶栏「撤销一步」，这里不再重复。 */
 function panel(s,pid){if(s.phase!==2||!s.questing)return '';const q=s.questing,ch=P.choiceSpec(s),sp=R.spec(s),actor=s.players[pid]&&!s.players[pid].eliminated?pid:s.first;const w=P.window(s);let body='';
  if(q.completed)return '<section class="panel deck-valid"><h2>阶段3 · 探险阶段验收完成</h2><p>探险结果与阶段结束效果已结算。点「结束阶段」进入第四阶段 · 旅行。</p></section>';
  if(ch)body+=`<div class="notice">${esc(ch.message)} <button data-action="planning" data-plan="choice" data-id="${ch.task.id}">处理卡牌响应</button></div>`;
  if(sp)body+=`<div class="notice">${esc(sp.message)} ${button('选择并结算','choice',`data-id="${sp.task.id}"`,!!ch)}</div>${q.tasks.filter(t=>t!==sp.task&&t.kind==='commitResponse').map(t=>button('先结算：'+(P.find(s,t.payload.uid)?.meta.nameZh||'投入响应'),'choice',`data-id="${t.id}"`,!!ch)).join('')}`;
  /* v0.15.56：面板只有 ~150px，「徽章 + 说明 + 下拉 + 勾选 + 按钮」全塞进来必然要滚。
     这里只保留控件本身：玩家徽章与切换器一行、角色勾选一行（横滚）、提交按钮一行。 */
  if(q.step==='commit'&&!q.deploymentLocked&&!sp&&!ch){const id=actor,selected=draftFor(s,id),confirmed=!!q.deployments?.[id]?.confirmed;
   body+=`<div class="mat-commit"><div class="actions compact-chips"><select id="planning-actor" aria-label="查看／操作玩家">${q.order.map(pid=>`<option value="${pid}" ${pid===id?'selected':''}>${esc(s.players[pid].name)}${q.deployments?.[pid]?.confirmed?' ✓':''}</option>`).join('')}</select>${q.order.map(pid=>`<span class="badge">${esc(s.players[pid].name)}${q.deployments?.[pid]?.confirmed?' ✓':' ·'}</span>`).join('')}</div>${confirmed?'':`<div class="quest-commit-list">${P.chars(s).filter(c=>c.controller===id).map(c=>`<label><input type="checkbox" data-commit="${c.uid}" ${c.state.exhausted?'disabled':''} ${selected.includes(c.uid)?'checked':''}>${esc(c.meta.nameZh)}·意${P.stats(s,c.uid).willpower}</label>`).join('')}</div>`}<div class="actions">${confirmed?button('取消确认，修改派遣','withdraw',`data-player="${id}"`):button('提交暂定派遣名单 →','commit',`data-player="${id}"`)}</div></div>`;}
  if(q.discussion&&q.step==='commit'&&!q.deploymentLocked&&!sp&&!ch&&q.order.every(id=>q.deployments?.[id]?.confirmed)){body+=`<div class="notice"><b>派遣交流与缓冲期</b><p>名单已全部提交，但尚未投入。此时仍可取消确认并调整名单；任何修改会清除所有人的二次确认。</p><div class="actions">${q.order.map(id=>button(s.players[id].name+(q.deploymentApprovals?.includes(id)?'：取消二次确认':'：二次确认派遣'),q.deploymentApprovals?.includes(id)?'unapproveDeployment':'approveDeployment',`data-player="${id}"`)).join('')}</div></div>`;}
  if(q.discussion&&(q.plannedActions?.length||q.actionLocked||q.actionError)){body+=`<section class="notice"><h3>暂定行动 · 交流缓冲区</h3><p>按下列顺序执行；全员二次确认前不支付、不弃牌、不抽牌。修改或撤销会清除全体二次确认。</p>${q.actionError?`<p>${esc(q.actionError)}</p>`:''}${(q.plannedActions||[]).map(a=>{const source=a.kind==='play'?s.players[a.player].hand.find(c=>c.uid===a.uid):P.find(s,a.uid)?.state;const m=source?P.data(s,{...source,owner:a.player}):null;return `<p>${esc(s.players[a.player].name)} · ${a.kind==='play'?'事件':'能力'}：${esc(m?.nameZh||'#'+a.uid)} ${button('撤销此暂定行动','cancelAction',`data-player="${a.player}" data-id="${a.id}"`,q.actionLocked)}</p>`;}).join('')}<div class="actions">${q.order.filter(id=>!s.players[id].eliminated).map(id=>button(s.players[id].name+(q.actionApprovals?.includes(id)?'：取消二次确认':'：二次确认行动'),q.actionApprovals?.includes(id)?'unapproveActions':'approveActions',`data-player="${id}"`,!q.plannedActions?.length||q.actionLocked||!!ch||!!sp)).join('')}</div>${q.actionLocked?'<p>全员已确认，正在执行；请先处理效果与响应。</p>':''}</section>`;}
  if(q.step==='staging'&&!sp&&!ch){if(q.current){const c=q.current.card;body+=`<div class="quest-reveal">${ImageLibrary.encounterArt(c.id)}<h3>${esc(c.name)}</h3><p>${esc(c.rule)}</p><p>厄运 ${c.doomed||0} · ${c.surge?'涌现':'无涌现'} · ${q.current.canceled?'翻开效果已取消':'等待结算'}</p><div class="actions">${R.cancelOptions(s).map(o=>button(o.label,'cancel',`data-value="${o.value}"`)).join('')}${button('结算此牌的关键词与效果','reveal')}</div></div>`;}else body+=button(q.remaining.length?'翻开下一张遭遇牌（待翻 '+q.remaining.length+'）':'结束探查，开放行动窗口','draw');}
  if(w.kind==='action'&&!q.actionLocked&&ScenarioEngine.windows.settings(s).mode==='detailed'){body+=`<p class="small">事件与主动能力先进入暂定清单，全员二次确认后执行。${q.plannedActions?.length?'暂定行动尚未执行，请先二次确认或撤销。':'等待结束行动：'+(s.players.filter(p=>!p.eliminated&&!q.finalPasses.includes(p.id)).map(p=>esc(p.name)).join('、')||'全员已放弃，可以推进')}。放弃后仍可取消放弃。</p><div class="actions">${s.players.filter(p=>!p.eliminated).map(p=>button(p.name+(q.finalPasses.includes(p.id)?'：取消放弃行动':'：放弃本窗口行动'),q.finalPasses.includes(p.id)?'unpass':'pass',`data-player="${p.id}"`,false)).join('')}${button(q.step==='beforeCommit'?'开始投入角色':q.step==='afterCommit'?'开始探查':q.step==='afterStaging'?'自动结算探险':'结束探险阶段','move','',!!q.plannedActions?.length||!s.players.filter(p=>!p.eliminated).every(p=>q.finalPasses.includes(p.id)))}</div><label>使用行动的玩家 <select id="planning-actor">${s.players.filter(p=>!p.eliminated).map(p=>`<option value="${p.id}" ${p.id===actor?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><div class="actions">${P.abilities(s,actor).map(a=>`<button data-action="planning" data-plan="ability" data-player="${actor}" data-uid="${a.uid}" title="${esc(a.reason)}" ${a.legal?'':'disabled'}>${esc(a.name)}</button>`).join('')}</div><p class="small muted">事件在下方手牌区操作；任一行动会清除全体玩家的放弃标记。</p>`;}
  return `<section class="panel questing-panel"><div class="panel-title"><h2>阶段3 · ${steps[q.step]}</h2><strong>投入意志 ${R.total(s)} ／ 探查区威胁 ${ScenarioEngine.threat(s)}</strong></div><p class="small mat-only">已投入：${P.chars(s).filter(c=>c.state.committed).map(c=>esc(c.meta.nameZh)+'（意'+P.stats(s,c.uid).willpower+'）').join('、')||'无人'}</p>${q.result?`<p class="notice">本次结果：意志 ${q.result.willpower} − 威胁 ${q.result.threat} = ${q.result.delta}。${q.result.delta>0?'进度已自动分配':q.result.delta<0?'每位玩家威胁已增加'+(-q.result.delta):'平局，不放进度、不增加威胁'}。</p>`:''}${body}</section>`;
 }
 async function handle(b){const k=b.dataset.quest,pid=+b.dataset.player,id=+b.dataset.id;
  if(k==='back'){if(history.length){state=history.pop();save();render();}return;}
  if(k==='withdraw'){mutate(()=>R.withdrawDeployment(state,pid));return;}
  if(k==='clear'){setDraft(state,pid,[]);render();return;}
  if(k==='commit'){
   const ids=draftFor(state,pid),before=JSON.stringify(state);const selected=ids.map(id=>P.find(state,id));
   const ok=await choose('确认派遣 · '+state.players[pid].name,`<p>${selected.length?'将派遣以下角色：':'本次不派遣角色（0名）。'}</p><ul>${selected.map(c=>`<li>${esc(c.meta.nameZh)} · 意志 ${P.stats(state,c.uid).willpower}</li>`).join('')}</ul><p>当前意志合计 <b>${selected.reduce((n,c)=>n+P.stats(state,c.uid).willpower,0)}</b>。遭遇与后续行动可能改变此数值。</p><p>本次确认只提交名单；所有玩家提交名单并完成二次确认后才统一锁定，按起始玩家顺序横置并处理投入响应。全员确认前仍可取消确认并修改。点击取消可返回重新选择，当前勾选会保留。</p>`,()=>true);
   if(ok)mutate(()=>{if(JSON.stringify(state)!==before)throw Error('桌面已变化，请重新核对派遣名单。');R.submitDeployment(state,pid,ids);draft={context:null,player:null,ids:[]};});
   /* v0.15.56：提交后自动把操作权交给下一位未确认的玩家，否则第二个人永远轮不到提交。 */
   if(ok&&state?.questing?.step==='commit'&&!state.questing.deploymentLocked&&typeof handView!=='undefined'){
    const next=(state.questing.order||[]).find(x=>!state.questing.deployments?.[x]?.confirmed);
    if(next!==undefined&&next!==handView){handView=next;render();}
   }
   return;
  }
  if(k==='choice'){const sp=R.spec(state,id);if(!sp)return;let values=await choose(sp.message,sp.fields.map(f=>`<label>${esc(f.label)}<select id="quest-${f.key}">${f.options.map(o=>`<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}</select></label>`).join('')+(sp.task.optional?'<p><label><input id="quest-skip" type="checkbox">放弃此响应</label></p>':''),d=>({...Object.fromEntries(sp.fields.map(f=>[f.key,d.querySelector('#quest-'+f.key).value])),skip:!!d.querySelector('#quest-skip')?.checked}));if(values)mutate(()=>R.choose(state,id,values));return;}
  mutate(()=>{if(k==='unpass')R.unpass(state,pid);if(k==='approveDeployment')R.approveDeployment(state,pid);if(k==='unapproveDeployment')R.withdrawDeploymentApproval(state,pid);if(k==='approveActions')R.approveActions(state,pid);if(k==='unapproveActions')R.withdrawActionApproval(state,pid);if(k==='cancelAction')R.cancelAction(state,pid,id);if(k==='pass')R.pass(state,pid);if(k==='move')R.move(state);if(k==='draw')R.drawNext(state);if(k==='reveal')R.resolveReveal(state);if(k==='cancel')R.cancel(state,b.dataset.value);});
 }
 /* 操作条只放这一步必须的输入：选角色投入 / 结算正在翻开的遭遇牌。
    其余说明、状态与「结束阶段」都在角色卡下方的完整面板里。 */
 function picker(s,pid){const q=s.questing;
  /* v0.15.56：beforeCommit（投入前行动窗口）也要给出「开始投入」入口。
     此前 picker 只在 step==='commit' 渲染，玩家在投入前窗口打完事件、全员确认后，
     只能靠打开详细模式才能找到那个「开始投入角色」按钮——智能模式下就此永久卡住。
     现在投入前窗口直接把入口放到角色卡下方（与结束阶段同一处），点一下进 commit。 */
  if(!q||q.completed)return '';
  if(q.step==='beforeCommit'&&!q.deploymentLocked&&!R.spec(s)&&!P.choiceSpec(s)&&!q.actionLocked){
   const left=q.order.filter(id=>!q.finalPasses.includes(id));
   /* 全员放弃后才能投入：pass 只在 left 里，unpass 要覆盖已放弃的人 */
   const passed=q.order.filter(id=>q.finalPasses.includes(id));
   return `<section class="panel questing-panel compact"><div class="panel-title"><h2>投入前行动窗口</h2><strong class="small">意志 0 ／ 威胁 ${ScenarioEngine.threat(s)}</strong></div><p class="small muted">${q.plannedActions?.length?'暂定行动尚未执行，请先在上方二次确认或撤销。':left.length?'全队放弃本窗口行动后即可投入角色（可随时取消放弃）。':'全员已放弃，可以投入角色。'}</p><div class="actions">${left.map(id=>`<button data-action="quest" data-quest="pass" data-player="${id}">${esc(s.players[id].name)}：放弃本窗口行动</button>`).join('')}${passed.map(id=>`<button data-action="quest" data-quest="unpass" data-player="${id}">${esc(s.players[id].name)}：取消放弃</button>`).join('')}</div><div class="actions"><button class="primary" data-action="quest" data-quest="move" ${(!q.plannedActions?.length&&!left.length)?'':'disabled'}>开始投入角色 →</button></div></section>`;
  }
  if(q.step!=='commit'||q.deploymentLocked||R.spec(s)||P.choiceSpec(s))return '';
  const id=s.players[pid]&&!s.players[pid].eliminated?pid:s.first,confirmed=!!q.deployments?.[id]?.confirmed,selected=draftFor(s,id);
  /* v0.15.56：投入名单按玩家分别提交，必须能切换操作者；此前只有详细模式的面板带下拉框，
     智能模式的紧凑面板把玩家钉死在当前 handView，第二个人永远提交不了自己的名单。 */
  /* v0.15.56：面板只有 ~90px，先给按钮再给说明——按钮必须第一眼可见；
     角色勾选放进可横向滚动的窄条，文案压成 title 悬停提示。 */
  return `<section class="panel questing-panel compact"><div class="panel-title"><h2>投入角色</h2><strong class="small">意志 ${selected.reduce((n,uid)=>n+P.stats(s,uid).willpower,0)} ／ 威胁 ${ScenarioEngine.threat(s)}</strong></div><div class="actions compact-chips" title="${confirmed?'已提交暂定名单，可取消后修改。':'勾选重置角色后提交；全员二次确认后统一横置。'}">${q.order.map(x=>`<span class="badge">${esc(s.players[x].name)}${q.deployments?.[x]?.confirmed?' ✓':' ·'}</span>`).join('')}<select id="planning-actor" aria-label="查看／操作玩家">${q.order.map(x=>`<option value="${x}" ${x===id?'selected':''}>${esc(s.players[x].name)}</option>`).join('')}</select></div>${confirmed?'':`<div class="quest-commit-list">${P.chars(s).filter(c=>c.controller===id).map(c=>`<label><input type="checkbox" data-commit="${c.uid}" ${c.state.exhausted?'disabled':''} ${selected.includes(c.uid)?'checked':''}>${esc(c.meta.nameZh)}·意${P.stats(s,c.uid).willpower}</label>`).join('')}</div>`}<div class="actions">${confirmed?button('取消确认，修改派遣','withdraw',`data-player="${id}"`):button('提交暂定派遣名单 →','commit',`data-player="${id}"`)}</div></section>`;
 }
 function revealCard(s){const c=s.questing&&s.questing.current&&s.questing.current.card;if(!c)return '';
  return `<section class="panel questing-panel compact"><div class="panel-title"><h2>翻开的遭遇</h2><strong>${c.surge?'涌现':'无涌现'}</strong></div><p><b>${esc(c.name)}</b></p><p class="small muted">${esc(c.rule)}</p><div class="actions">${R.cancelOptions(s).map(o=>button(o.label,'cancel',`data-value="${o.value}"`)).join('')}${button('结算此牌的关键词与效果','reveal')}</div></section>`;
 }
 return {panel,handle,bind,setDraft,draftFor,picker,revealCard};
})();
