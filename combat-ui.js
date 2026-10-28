const CombatUI=(()=>{
 const E=ScenarioEngine,T=E.combat,R=E.planning,Q=E.questing,esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const b=(label,kind,args='',disabled=false)=>`<button data-action="combatFlow" data-combat="${kind}" ${args} ${disabled?'disabled':''}>${esc(label)}</button>`;
 const names=(s,ids)=>ids.map(uid=>R.find(s,uid)?.meta.nameZh||'#'+uid).join('、')||'无人防御';
 /* ── 图形化空态与步骤条（v0.15.86）─────────────────────────────────────
    用户反馈：浮层里「没有合法攻击目标」「该目标没有可派出的角色」只是一行灰字，
    读起来像报错，也分不清「这一步本来就没事可做」和「我操作错了」。
    改成「图标 + 结论 + 出路」的空态卡：结论一眼可辨（斜杠靶心＝没有目标、斜杠卡牌＝没有角色），
    出路写清下一步该点哪里。图标全部内联 SVG：不额外请求、跟随文字色、缩放不失真。 */
 const VOID_ICON={
  none:'<circle cx="12" cy="12" r="6.8"/><circle cx="12" cy="12" r="2.2"/><path d="M5.6 18.4 18.4 5.6"/>',
  card:'<rect x="7.6" y="3.6" width="8.8" height="16.8" rx="1.6"/><path d="M7.6 9h8.8M7.6 15h8.8"/><path d="M4.2 19.8 19.8 4.2"/>',
  aim:'<path d="M12 3.4v6"/><path d="m9.2 6.8 2.8 2.8 2.8-2.8"/><rect x="7.6" y="12.6" width="8.8" height="8" rx="1.6"/><path d="M10.4 16.6h3.2"/>',
 };
 function voidCard(icon,title,why){
  return `<div class="pick-void" role="note"><span class="pick-void-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${VOID_ICON[icon]||VOID_ICON.none}</svg></span><span class="pick-void-copy"><b>${esc(title)}</b><em>${esc(why)}</em></span></div>`;
 }
 /* 步骤圆点：编号 + 状态色（已完成绿勾／当前金圈／未开始灰）。
    攻击选择改成左右两栏后，它同时充当列头——「左 1 选打谁、右 2 选谁去打」，
    顺序与进度都在图上一眼可见，不再需要「第一步 · 选择攻击目标」这类纯文字小标题。 */
 const CHECK='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3.6 8.4 3 3 5.8-6.4"/></svg>';
 function dotHTML(n,done,active){return `<span class="pick-step-dot${done?' is-done':''}${active?' is-active':''}">${done?CHECK:n}</span>`;}
 function colHead(n,label,done,active,count){
  return `<div class="pick-col-head"${active?' data-current="step"':''}>${dotHTML(n,done,active)}<span class="pick-col-label">${esc(label)}</span>${count?`<b class="pick-step-count">${count}</b>`:''}</div>`;
 }
 /* ── 防御／攻击的选人网格（v0.15.83）────────────────────────────────
    病灶：v0.15.81 起决策面板是覆盖桌面的非模态浮层，而 defense/attack 的选人方式
    仍是「点桌面上的角色卡」——浮层一开，角色卡全被盖住，玩家只看到一句
    「点击角色暂定防御」却找不到任何角色可点（用户反馈截图：面板里只有文字与提交按钮）。
    修法：与探险投入角色共用同一套缩略图视觉（.pick-panel/.pick-grid/.qp-card），
    草稿仍走 DesktopUI.draft 的既有路径——点缩略图 = 点桌面卡，桌面卡与缩略图双向同步。 */
 const qtk=(type,n)=>`<span class="tk tk-${type}"><img src="assets/tokens/${type}.png" alt=""><b>${n}</b></span>`;
 function faceImg(code){const rec=ImageLibrary.by[code],url=rec?ImageLibrary.safeUrl(rec.faces?.B||rec.imageUrl):null;return url?`<img src="${esc(url)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:'<span class="qp-noart">卡图暂缺</span>';}
 function thumb(s,c,m,label){
  const v=R.stats(s,c.uid),st=c.state||{},selected=DesktopUI.draft(s,m).ids.includes(c.uid);
  const exhausted=!!st.exhausted,gone=!!st.destroyed;
  const cls=['qp-card',selected?'is-selected':'',exhausted?'is-exhausted':'',gone?'is-gone':''].filter(Boolean).join(' ');
  const name=c.meta.nameZh||c.meta.name;
  const text=`${name}：攻击 ${v.attack||0} 防御 ${v.defense||0} 生命 ${v.health||0}，${gone||exhausted?'当前不能选择':selected?'点击移出名单':'点击加入名单'}`;
  return `<div class="${cls}" data-card-uid="${c.uid}"><button class="card-face" data-action="desktop" data-desktop="pick" data-uid="${c.uid}" data-player="${c.controller}" aria-pressed="${selected}"${gone||exhausted?' aria-disabled="true"':''} aria-label="${esc(label+text)}">${faceImg(c.meta.code)}${selected?'<span class="selection-mark">已选</span>':''}</button><button class="qp-view" data-action="images" data-image-action="open" data-code="${esc(c.meta.code)}" aria-label="查看${esc(name)}详情">查看</button><span class="qp-name" title="${esc(name)}">${esc(name)}</span><div class="card-tokens attr-tokens">${qtk('attack',v.attack||0)+qtk('defense',v.defense||0)+qtk('hitPoints',v.health||0)}</div></div>`;
 }
 /* 攻击目标（敌人）的缩略图：点它走 data-desktop="target"，与桌面敌人卡同一条路径。 */
 function targetThumb(s,e,m){
  const v=R.stats(s,e.uid),selected=DesktopUI.draft(s,m).target===e.uid,name=e.meta.name;
  return `<div class="qp-card ${selected?'is-selected':''}" data-card-uid="${e.uid}"><button class="card-face" data-action="desktop" data-desktop="target" data-uid="${e.uid}" aria-pressed="${selected}" aria-label="攻击目标 ${esc(name)}：攻击 ${v.attack||0} 防御 ${v.defense||0} 生命 ${v.health||0}，${selected?'当前目标':'点击选为目标'}">${faceImg('enc-'+e.meta.id)}${selected?'<span class="selection-mark">目标</span>':''}</button><button class="qp-view" data-action="images" data-image-action="open" data-code="${esc('enc-'+e.meta.id)}" aria-label="查看${esc(name)}详情">查看</button><span class="qp-name" title="${esc(name)}">${esc(name)}</span><div class="card-tokens attr-tokens">${qtk('attack',v.attack||0)+qtk('defense',v.defense||0)+qtk('hitPoints',v.health||0)}</div></div>`;
 }
 /* 浮层体里的选人段；只在引擎确实停在防御选择／攻击选择且尚无暂定方案时给。 */
 function popExtra(s,pid){
  if(!s||s.phase!==5||!s.combat)return '';
  if(s.combat.completed||s.combat.proposal)return '';
  const m=DesktopUI.mode(s,pid);
  if(!m||(m.kind!=='defense'&&m.kind!=='attack'))return '';
  const d=DesktopUI.draft(s,m);
  if(m.kind==='defense'){
   const list=T.defenders(s);
   const head=`<div class="pick-bar"><span class="pick-bar-title">选择防御者 · ${esc(s.players[m.player].name)}</span><span class="pick-note">不选表示无人防御；普通防御至多 1 名</span></div>`;
   const grid=list.length?`<div class="pick-grid">${list.map(c=>thumb(s,c,m,'防御者 ')).join('')}</div>`:voidCard('card','没有可防御的角色','角色都已横置或已离场，这一击只能直接结算伤害');
   return `<div class="pick-panel combat-pick" role="group" aria-label="选择防御者">${head}${grid}</div>`;
  }
  const targets=T.attackTargets(s,m.player);
  const hasTarget=d.target!==null,list=hasTarget?T.attackers(s,m.player,d.target):[];
  /* 攻击选择做成左右两栏：左栏选打谁（1），右栏选谁去打（2）。
     上下堆叠时目标行 + 角色行 + 摘要卡会把浮层顶到 62vh 上限并内部滚动，
     「提交暂定攻击名单」被挤到可视区之外；并排后高度减半，顺序也变成左右关系，更直观。 */
  const targetBody=targets.length?`<div class="pick-grid pick-grid-target">${targets.map(e=>targetThumb(s,e,m)).join('')}</div>`:voidCard('none','没有可攻击的敌人','敌人已离场，或本回合已经攻击过它；可选「暂定结束我的攻击」');
  /* 一个目标都没有时不再摆出「参与角色」栏——那栏永远填不满，只会多一块自相矛盾的提示。 */
  if(!targets.length)return `<div class="pick-panel combat-pick" role="group" aria-label="选择攻击目标"><div class="pick-col">${colHead(1,'攻击目标',false,true,0)}${targetBody}</div></div>`;
  const actorBody=!hasTarget
   ?voidCard('aim','先选目标敌人','左栏点一张敌人卡，这里才会列出这个敌人能派出的角色')
   :list.length?`<div class="pick-grid">${list.map(c=>thumb(s,c,m,'攻击者 ')).join('')}</div>`:voidCard('card','该目标没有可派出的角色','角色都已横置，或不在这个敌人的攻击范围内');
  return `<div class="pick-panel combat-pick" role="group" aria-label="选择攻击目标与角色"><div class="pick-cols">
   <div class="pick-col pick-col-target">${colHead(1,'攻击目标',hasTarget,!hasTarget&&targets.length>0,targets.length>1?targets.length:0)}${targetBody}</div>
   <div class="pick-col pick-col-actor">${colHead(2,'参与角色',hasTarget&&d.ids.length>0,hasTarget,d.ids.length)}${actorBody}</div>
  </div></div>`;
 }
 function panel(s,pid){if(s.phase!==5||!s.combat)return '';const x=s.combat,ps=s.players.filter(p=>!p.eliminated),actor=ps.some(p=>p.id===pid)?pid:ps[0]?.id,sp=R.choiceSpec(s),task=T.spec(s),a=x.attack;let body='';
  if(x.completed)return '<section class="panel deck-valid"><h2>阶段6 · 战斗阶段验收完成</h2><p>暗影与阶段结束效果已处理，角色保持横置与伤害状态。可进入第七阶段刷新。</p></section>';
  if(sp)body+=`<div class="notice">${esc(sp.message)} <button data-action="planning" data-plan="choice" data-id="${sp.task.id}">处理卡牌响应</button></div>`;
  if(task)body+=`<div class="notice">${esc(task.message)} ${b('处理强制选择','choice',`data-id="${task.task.id}"`,!!sp)}</div>`;
  if(a){const e=R.find(s,a.uid);body+=`<p><b>${a.kind==='enemy'?'敌人攻击':'玩家攻击'}：${esc(e?.meta.name||'来源已离场')}</b> · ${esc(s.players[a.player].name)}${a.kind==='enemy'?' · 防御：'+esc(names(s,a.defenders||[])):' · 攻击者：'+esc(names(s,a.attackers))+' · 当前攻击 '+T.attackStrength(s)}</p>`;}
  if(x.step==='enemyChoice'&&!task&&!sp){const pid=T.activeEnemyPlayer(s);body+=`<p>${esc(s.players[pid].name)}选择下一名攻击敌人；被禁止攻击的敌人自动跳过。</p><div class="actions">${T.pendingEnemies(s,pid).map(c=>b('暂定 '+c.name,'enemy',`data-player="${pid}" data-uid="${c.uid}"`)).join('')}</div>`;}
  if(x.step==='defenseChoice'&&!task&&!sp)body+=b('选择防御者／无人防御','defense',`data-player="${a.player}"`);
  /* v0.15.56：智能模式原来也走这一段，但它只渲染「暂定攻击 X」——
     一个都打不了的时候（角色全横置／已攻击过）整段就只剩玩家自己放弃行动的按钮，
     而该按钮在没人可攻击时是禁用的，阶段五于是彻底走不动。现在补一颗
     「暂定结束我的攻击」，两位玩家都声明结束后战斗流程才会继续。 */
  if(x.step==='attackChoice'&&!task&&!sp){const pid=T.activePlayer(s);body+=`<p>${esc(s.players[pid].name)}声明攻击。远程可协助其他玩家，杜内希尔独自攻击时可选探查区。</p><div class="actions">${T.attackTargets(s,pid).map(c=>b('暂定攻击 '+c.meta.name,'attack',`data-player="${pid}" data-uid="${c.uid}"`)).join('')}${b(T.attackTargets(s,pid).length?'暂定结束我的攻击':'本回合不攻击，交给下一位',"endAttacks",`data-player="${pid}"`)}</div>`;}
  if(x.proposal){const p=x.proposal;body+=`<div class="notice"><b>暂定${p.kind==='enemy'?'敌人攻击':p.kind==='defense'?'防御方案':'攻击方案'}：</b>${p.kind==='defense'?esc(names(s,p.ids)):p.uid===null?'结束本玩家攻击':esc(R.find(s,p.uid)?.meta.name||'#'+p.uid)+(p.kind==='attack'?' · '+esc(names(s,p.ids)):'')}<p>正式执行前可以取消、更改。暂定时不横置角色、不翻开暗影。</p><div class="actions">${b('撤销／重新选择','cancel')}${ps.map(p=>b(p.name+(x.approvals.includes(p.id)?'：取消二次确认':'：二次确认'),x.approvals.includes(p.id)?'unapprove':'approve',`data-player="${p.id}"`)).join('')}</div></div>`;}
  if(x.step==='defenderResponses'&&!sp)body+=`<div class="notice"><p>声明防御后的即时响应。这里的效果会立即支付和结算。</p>${T.responseOptions(s).map(o=>b(o.label,'respond',`data-value="${o.value}"`)).join('')}${b('关闭防御响应窗口','respond','data-value="skip"')}</div>`;
  if(x.step==='shadowWindow'&&!sp&&!task){const card=a.shadow;body+=`<div class="notice">${ImageLibrary.encounterArt(card.id)}<h3>本次暗影：${esc(card.name)}</h3><p>${esc(card.shadow||'没有暗影效果；正面能力与关键词不结算。')}</p><div class="actions">${T.cancelOptions(s).map(o=>b(o.label,'cancelShadow',`data-value="${o.value}"`)).join('')}${b('结算本张暗影／继续','resolveShadow')}</div></div>`;}
  if(T.actionSteps.includes(x.step)&&!sp&&!task){if(ScenarioEngine.windows.settings(s).mode==='detailed')body+=`<p>玩家行动窗口：手牌事件与主动能力先加入暂定清单，全员二次确认后执行。已翻开的暗影不会因改方案而收回。</p><label>操作玩家 <select id="planning-actor">${ps.map(p=>`<option value="${p.id}" ${p.id===actor?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><div class="actions">${R.abilities(s,actor).map(a=>`<button data-action="planning" data-plan="ability" data-player="${actor}" data-uid="${a.uid}" ${a.legal?'':'disabled'} title="${esc(a.reason)}">${esc(a.name)}</button>`).join('')}</div>`;
   if(ScenarioEngine.windows.settings(s).mode==='detailed')body+=`<div class="actions">${ps.map(p=>b(p.name+(x.finalPasses.includes(p.id)?'：取消放弃行动':'：放弃本窗口行动'),x.finalPasses.includes(p.id)?'unpass':'pass',`data-player="${p.id}"`,!!x.actionLocked)).join('')}${b(x.step==='endAction'?'结算战斗阶段结束':'关闭本行动窗口，继续战斗','move','',!!x.plannedActions?.length||!!x.actionLocked)}</div>`;
   /* v0.15.82：主按钮不再要求先逐个点「放弃本窗口行动」，点它即视为全队让过。 */
   else{
    body+=`<p class="small muted">事件与主动能力会进入暂定清单，全员二次确认后执行；点下方按钮即全队放弃本窗口并继续。</p><div class="actions">${ps.map(p=>b(p.name+(x.finalPasses.includes(p.id)?'：取消放弃':'：放弃行动'),x.finalPasses.includes(p.id)?'unpass':'pass',`data-player="${p.id}"`,!!x.actionLocked)).join('')}</div><div class="actions">${b(x.step==='endAction'?'结算战斗阶段结束 →':'关闭行动窗口，继续战斗 →','move','',!!x.plannedActions?.length||!!x.actionLocked)}</div>`;}
   if(x.plannedActions?.length||x.actionError)body+=`<div class="notice"><h3>暂定行动 · 交流缓冲区</h3>${x.actionError?`<p>${esc(x.actionError)}</p>`:''}${(x.plannedActions||[]).map(a=>{const c=a.kind==='play'?s.players[a.player].hand.find(c=>c.uid===a.uid):R.find(s,a.uid)?.state;return `<p>${esc(s.players[a.player].name)} · ${esc(c?R.data(s,{...c,owner:a.player}).nameZh:'#'+a.uid)} ${b('撤销暂定行动','cancelAction',`data-id="${a.id}" data-player="${a.player}"`,!!x.actionLocked)}</p>`;}).join('')}<div class="actions">${ps.map(p=>b(p.name+(x.actionApprovals?.includes(p.id)?'：取消二次确认':'：二次确认行动'),x.actionApprovals?.includes(p.id)?'unapproveActions':'approveActions',`data-player="${p.id}"`,!!x.actionLocked||!x.plannedActions?.length)).join('')}</div></div>`;}
  const titles={dealing:'分配暗影',enemyAction:'敌人攻击前行动',enemyChoice:'选择攻击敌人',beforeDefend:'声明防御前行动',defenseChoice:'防御选择',defenderResponses:'防御响应',beforeShadows:'暗影翻开前行动',shadowWindow:'暗影取消／结算',shadowEffects:'暗影效果',beforeDamage:'敌人伤害结算前行动',damageChoice:'伤害目标',afterEnemy:'敌人攻击后行动',playerAction:'玩家攻击前行动',attackChoice:'玩家攻击选择',playerStrength:'攻击声明后行动',playerDamage:'伤害结算前行动',afterPlayer:'玩家攻击后行动',endAction:'战斗结束前行动',ending:'阶段结束效果'};
  return `<section class="panel questing-panel"><h2>阶段6 · ${titles[x.step]||x.step}</h2><p class="small muted">未翻开的暗影：${R.enemies(s).reduce((n,e)=>n+(e.state.shadows||[]).filter(c=>!c.revealed).length,0)}</p>${body}</section>`;
 }
 async function handle(el){const k=el.dataset.combat,pid=+el.dataset.player,uid=+el.dataset.uid,id=+el.dataset.id;
  if(k==='back'){if(history.length){state=history.pop();save();render();}return;}
  if(k==='defense'||k==='attack'){const cs=k==='defense'?T.defenders(state):T.attackers(state,pid,uid),ids=await choose(k==='defense'?'暂定防御名单':'暂定攻击名单',`<p>${k==='defense'?'不选角色表示无人防御；普通防御至多1名。':'至少选择1名声明玩家的角色，协助角色必须符合远程规则。'}</p>${cs.map(c=>`<label><input type="checkbox" data-combat-select="${c.uid}"> ${esc(state.players[c.controller].name)} · ${esc(c.meta.nameZh)} · 攻${R.stats(state,c.uid).attack} 防${R.stats(state,c.uid).defense}</label>`).join('')}`,d=>[...d.querySelectorAll('[data-combat-select]')].filter(n=>n.checked).map(n=>+n.dataset.combatSelect));if(ids)mutate(()=>T.propose(state,pid,k,uid||null,ids));return;}
  if(k==='choice'){const sp=T.spec(state);if(!sp||sp.task.id!==id){toast('选择已过期');return;}const v=await choose(sp.message,sp.fields.map(f=>`<label>${esc(f.label)}<select id="combat-${f.key}">${f.options.map(o=>`<option value="${o.value}">${esc(o.label)}</option>`).join('')}</select></label>`).join(''),d=>Object.fromEntries(sp.fields.map(f=>[f.key,d.querySelector('#combat-'+f.key).value])));if(v)mutate(()=>T.choose(state,id,v));return;}
  mutate(()=>{if(k==='enemy')T.propose(state,pid,'enemy',uid);if(k==='endAttacks')T.propose(state,pid,'attack',null);if(k==='cancel')T.cancel(state);if(k==='approve')T.approve(state,pid);if(k==='unapprove')T.unapprove(state,pid);if(k==='respond')T.respond(state,el.dataset.value);if(k==='cancelShadow')T.cancelShadow(state,el.dataset.value);if(k==='resolveShadow')T.resolveShadow(state);if(k==='pass')Q.pass(state,pid);if(k==='unpass')Q.unpass(state,pid);if(k==='move'){E.passWindow(state);T.move(state);}if(k==='cancelAction')Q.cancelAction(state,pid,id);if(k==='approveActions')Q.approveActions(state,pid);if(k==='unapproveActions')Q.withdrawActionApproval(state,pid);});
 }
function selectTitle(m){return m.kind==='attack'?'战斗 · 选择攻击目标与角色':'战斗 · 选择防御角色';}
 return {panel,handle,popExtra,selectTitle};
})();
