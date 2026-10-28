const EncounterUI=(()=>{
 const E=ScenarioEngine,T=E.encountering,R=E.planning,Q=E.questing,esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const b=(label,kind,args='',disabled=false)=>`<button data-action="encounterFlow" data-encounter="${kind}" ${args} ${disabled?'disabled':''}>${esc(label)}</button>`;
 const NAME=['资源','计划','探险','旅行','遭遇','战斗','刷新'];
 /* 面板底部唯一出口：有必需操作时点它=列还差什么，全部完成时点它=引擎自检并推进。
    撤销统一走顶栏「撤销一步」，面板里不再放第二份重复控件。 */
 function panel(s,pid){if(s.phase!==4||!s.encountering)return '';const x=s.encountering,ps=s.players.filter(p=>!p.eliminated),actor=ps.some(p=>p.id===pid)?pid:ps[0]?.id,sp=R.choiceSpec(s);let body='';
  if(x.completed)return '<section class="panel deck-valid"><h2>阶段5 · 遭遇阶段验收完成</h2><p>交战敌人及角色状态已保留。点击下方「进入第六阶段 · 战斗」继续；不会重复交战检定。</p></section>';
  if(sp)body+=`<div class="notice">${esc(sp.message)} <button data-action="planning" data-plan="choice" data-id="${sp.task.id}">处理强制效果／卡牌响应</button></div>`;
  if(x.step==='optional'){body+='<p>每人可主动交战1名敌人，不受交战值限制。先暂定方案，按起始玩家顺序执行；全员二次确认之前可随时更改。</p>';for(const id of x.turnOrder){const p=s.players[id];if(p.eliminated)continue;const c=x.choices[id],enemy=s.staging.find(e=>e.uid===c?.uid);body+=`<div class="notice"><b>${esc(p.name)}</b>：${!c?'尚未选择':c.uid===null?'暂定不主动交战':esc(enemy?.name||'目标已离场')}<div class="actions">${s.staging.filter(e=>e.type==='Enemy').map(e=>b('暂定 '+e.name,'propose',`data-player="${id}" data-uid="${e.uid}"`)).join('')}${b('暂定不主动交战','skip',`data-player="${id}"`)}${b('撤销选择','cancel',`data-player="${id}"`,!c)}</div></div>`;}
   const ready=ps.every(p=>x.choices[p.id]);body+=`<div class="actions">${ps.map(p=>b(p.name+(x.approvals.includes(p.id)?'：取消二次确认':'：二次确认交战方案'),x.approvals.includes(p.id)?'unapprove':'approve',`data-player="${p.id}"`,!ready)).join('')}</div>`;
   /* v0.15.56：智能模式下没有详细面板，这一步原来只靠「结束阶段」按钮的 passAll 走，
      但确认按钮藏在 detailed 分支里，玩家看不到「全员确认后继续」。这里给一条明说的出口。 */
   if(ScenarioEngine.windows.settings(s).mode!=='detailed')body+=`<div class="actions">${b('全部确认交战方案，继续','approveAll',`data-player="${ps.find(p=>!x.approvals.includes(p.id))?.id??''}"`,!ready||ps.every(p=>x.approvals.includes(p.id)))}</div>`;}
  const task=x.tasks[0];if(task?.kind==='engagementTie')body+=`<div class="notice"><p>${esc(s.players[task.player].name)}检定遇到同值敌人，由起始玩家 ${esc(s.players[s.first].name)} 选择：</p>${task.uids.map(uid=>b(s.staging.find(c=>c.uid===uid)?.name||'#'+uid,'tie',`data-id="${task.id}" data-uid="${uid}"`)).join('')}</div>`;
  if(['beforeChecks','afterChecks'].includes(x.step)&&!sp&&!task){if(ScenarioEngine.windows.settings(s).mode==='detailed')body+=`<p>${x.step==='beforeChecks'?'交战检定前行动窗口：可先调整威胁、处理合法事件或能力。':'交战检定已完成：可使用合法事件与能力；此窗口返回探查区的敌人不会重新检定。'}</p><label>操作玩家 <select id="planning-actor">${ps.map(p=>`<option value="${p.id}" ${p.id===actor?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><div class="actions">${R.abilities(s,actor).map(a=>`<button data-action="planning" data-plan="ability" data-player="${actor}" data-uid="${a.uid}" ${a.legal?'':'disabled'} title="${esc(a.reason)}">${esc(a.name)}</button>`).join('')}</div>`;
   if(ScenarioEngine.windows.settings(s).mode==='detailed')body+=`<div class="actions">${ps.map(p=>b(p.name+(x.finalPasses.includes(p.id)?'：取消放弃行动':'：放弃本窗口行动'),x.finalPasses.includes(p.id)?'unpass':'pass',`data-player="${p.id}"`,!!x.actionLocked)).join('')}${b(x.step==='beforeChecks'?'开始交战检定':'结算遭遇阶段结束',x.step==='beforeChecks'?'checks':'finish','',!!x.plannedActions?.length||!!x.actionLocked)}</div>`;
   /* v0.15.56：智能模式下的同一组出口。缺了它，「结束阶段」把玩家带进 beforeChecks 之后就再无按钮，
       交战检定永远开不了——和探险阶段 beforeCommit 缺投入入口是同一类缺陷。
      v0.15.82：主按钮不再要求先逐个点「放弃本窗口行动」，点它即视为全队让过。 */
   else{
    body+=`<p class="small muted">${x.step==='beforeChecks'?'可先调整威胁或使用合法事件；点下方按钮即全队放弃本窗口并开始交战检定。':'交战检定已完成；点下方按钮即全队放弃本窗口并结束遭遇阶段。'}</p><div class="actions">${ps.map(p=>b(p.name+(x.finalPasses.includes(p.id)?'：取消放弃':'：放弃行动'),x.finalPasses.includes(p.id)?'unpass':'pass',`data-player="${p.id}"`,!!x.actionLocked)).join('')}</div><div class="actions">${b(x.step==='beforeChecks'?'开始交战检定 →':'结束遭遇阶段 →',x.step==='beforeChecks'?'checks':'finish','',!!x.plannedActions?.length||!!x.actionLocked)}</div>`;}
   if(x.plannedActions?.length||x.actionError)body+=`<div class="notice"><h3>暂定行动 · 交流缓冲区</h3>${x.actionError?`<p>${esc(x.actionError)}</p>`:''}${(x.plannedActions||[]).map(a=>{const c=a.kind==='play'?s.players[a.player].hand.find(c=>c.uid===a.uid):R.find(s,a.uid)?.state;return `<p>${esc(s.players[a.player].name)} · ${esc(c?R.data(s,{...c,owner:a.player}).nameZh:'#'+a.uid)} ${b('撤销暂定行动','cancelAction',`data-id="${a.id}" data-player="${a.player}"`,!!x.actionLocked)}</p>`;}).join('')}<div class="actions">${ps.map(p=>b(p.name+(x.actionApprovals?.includes(p.id)?'：取消二次确认':'：二次确认行动'),x.actionApprovals?.includes(p.id)?'unapproveActions':'approveActions',`data-player="${p.id}"`,!!x.actionLocked||!x.plannedActions?.length)).join('')}</div></div>`;}
  /* v0.15.62：'checks' 是引擎逐人掷骰的中间步。正常会瞬间过去，但如果本轮
     所有玩家都已无候选敌人（或都已横置/被消灭），resume() 就不再往前推，
     面板里两个分支都进不去（都只认 beforeChecks/afterChecks），弹窗只剩标题、
     一个可点控件都没有 —— 这就是「决策弹窗是空壳」的现场。
     给它一条明说的出口：继续结算（引擎自己会走到 afterChecks）。 */
  if(x.step==='checks'&&!task){body+=`<p class="small muted">正在逐人结算交战检定${x.tasks.length?'（有 '+x.tasks.length+' 项强制选择待处理）':'；本轮已无玩家需要交战'}。</p><div class="actions">${b('继续结算交战检定 →','continueChecks','',!!x.actionLocked)}</div>`;}
  const titles={optional:'暂定主动交战与全队确认',executing:'执行交战与强制效果',beforeChecks:'交战检定前行动窗口',checks:'交战检定',afterChecks:'检定后行动与阶段结束'};
  return `<section class="panel questing-panel"><h2>阶段5 · ${titles[x.step]||'遭遇'}</h2>${body}</section>`;
 }
 async function handle(el){const k=el.dataset.encounter,pid=+el.dataset.player,uid=+el.dataset.uid,id=+el.dataset.id;if(k==='back'){if(history.length){state=history.pop();save();render();}return;}
  /* v0.15.56：智能模式的「全部确认」——一次性替所有未确认玩家二次确认，省去逐个点。 */
  if(k==='approveAll'){mutate(()=>{const x=state.encountering;for(const p of state.players.filter(p=>!p.eliminated))if(!(x.approvals||[]).includes(p.id))T.approve(state,p.id);});return;}
  mutate(()=>{if(k==='propose')T.propose(state,pid,uid);if(k==='skip')T.propose(state,pid,null);if(k==='cancel')T.cancel(state,pid);if(k==='approve')T.approve(state,pid);if(k==='unapprove')T.unapprove(state,pid);if(k==='tie')T.tie(state,id,uid);if(k==='checks'){E.passWindow(state);T.beginChecks(state);}if(k==='continueChecks')T.resume(state);if(k==='finish'){E.passWindow(state);T.finish(state);}if(k==='pass')Q.pass(state,pid);if(k==='unpass')Q.unpass(state,pid);if(k==='cancelAction')Q.cancelAction(state,pid,id);if(k==='approveActions')Q.approveActions(state,pid);if(k==='unapproveActions')Q.withdrawActionApproval(state,pid);});}
 return {panel,handle};
})();
