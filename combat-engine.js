/* Original Core / FAQ 1.9 combat. Proposals contain choices, never executed effects. */
const CombatRulesFactory=(H,R,Q)=>{
 const need=(v,m)=>{if(!v)throw Error(m);},eq=(a,b)=>String(a)===String(b),x=s=>s.combat,live=s=>s.players.filter(p=>!p.eliminated),log=(s,t)=>H.log(s,'战斗 · '+t);
 const actionSteps=['enemyAction','beforeDefend','beforeShadows','beforeDamage','afterEnemy','playerAction','playerStrength','playerDamage','afterPlayer','endAction'];
 const enemy=(s,uid)=>R.enemies(s).find(c=>eq(c.uid,uid))?.state,chars=s=>R.chars(s),own=(s,pid)=>chars(s).filter(c=>c.controller===pid),current=s=>x(s).attack;
 const held=(s,uid)=>R.attaches(s).filter(c=>eq(c.state.target,uid));
 const option=(value,label)=>({value:String(value),label}),field=(key,label,items)=>({key,label,options:items.map(c=>option(c.uid,(c.meta?.nameZh||c.name)+' #'+c.uid))});
 const task=(s,kind,actor,payload={})=>x(s).tasks.push({id:++s.serial,kind,actor,payload});
 function check(s){need(s.phase===5&&x(s)?.round===s.round&&!x(s).completed&&s.status==='playing','当前没有进行中的战斗阶段');need(!s.pending.length&&!x(s).queue.length,'请先结算剧本事项或卡牌响应');}
 function window(s,step){x(s).step=step;x(s).finalPasses=[];x(s).proposal=null;x(s).approvals=[];}
 function start(s){need(s.phase===5&&s.encountering?.completed,'须先完成第五阶段');need(x(s)?.round!==s.round,'本回合战斗阶段已初始化');const order=live(s).map(p=>p.id).sort((a,b)=>(a-s.first+s.players.length)%s.players.length-(b-s.first+s.players.length)%s.players.length);s.combat={round:s.round,step:'dealing',order:[...order],turnOrder:[...order],index:order.length,enemyIndex:0,playerIndex:0,doneEnemies:[],doneAttacks:[],finalPasses:[],queue:[],tasks:[],discussion:true,approvals:[],proposal:null,riders:[],stack:[],returnShadows:[],completed:false,closing:false,dealPlayer:0,dealDone:[]};s.shadowRound=s.round;for(const p of live(s))for(const e of p.engaged)e.shadows=[];deal(s);log(s,'开始，暗影牌面保持隐藏；分配完成后开放行动窗口');}
 function dealOne(s,e){const c=H.draw(s,false);e.shadows??=[];if(c)e.shadows.push(c);}
 function deal(s){const a=x(s);while(a.dealPlayer<a.turnOrder.length){const pid=a.turnOrder[a.dealPlayer];if(s.players[pid].eliminated){a.dealPlayer++;continue;}const cs=s.players[pid].engaged.filter(c=>!a.dealDone.includes(c.uid));if(!cs.length){a.dealPlayer++;continue;}const max=Math.max(...cs.map(c=>c.engagement??0)),ties=cs.filter(c=>(c.engagement??0)===max);if(ties.length>1&&s.deck.length){task(s,'dealTie',s.first,{player:pid,uids:ties.map(c=>c.uid)});return;}const e=ties[0];dealOne(s,e);a.dealDone.push(e.uid);}window(s,'enemyAction');}
 function activeEnemyPlayer(s){return x(s).turnOrder[x(s).enemyIndex];}
 function activePlayer(s){return x(s).turnOrder[x(s).playerIndex];}
 function prevented(s,e,pid){return held(s,e.uid).some(c=>c.meta.code==='01069')||(s.phasePermissions||[]).some(m=>m.round===s.round&&m.phase===5&&m.type==='noEnemyAttacks'&&m.player===pid&&(m.enemy===undefined||m.enemy===e.uid));}
 function pendingEnemies(s,pid){return s.players[pid]?.engaged.filter(e=>!x(s).doneEnemies.includes(e.uid)&&!prevented(s,e,pid))||[];}
 function defenders(s){const a=current(s);if(!a)return [];return chars(s).filter(c=>!c.state.exhausted&&(c.controller===a.player||c.meta.rulesText?.includes('Sentinel.')));}
 function liveDefenders(s){return (current(s)?.defenders||[]).map(uid=>R.find(s,uid)).filter(c=>c&&['hero','ally'].includes(c.kind));}
 function isUndefended(s){return !liveDefenders(s).length;}
 function attackTargets(s,pid){return R.enemies(s).filter(e=>!e.state.combatRider&&!x(s).doneAttacks.includes(pid+':'+e.uid)&&chars(s).some(c=>c.controller===pid&&!c.state.exhausted&&eligibleAttacker(s,pid,e.uid,c)));}
 function eligibleAttacker(s,pid,uid,c){const ownEnemy=s.players[pid].engaged.some(e=>eq(e.uid,uid)),engaged=live(s).some(p=>p.engaged.some(e=>eq(e.uid,uid))),staging=s.staging.some(e=>eq(e.uid,uid));if(staging)return c.controller===pid&&c.meta.code==='01009';if(!engaged)return false;if(c.controller===pid)return ownEnemy||!!c.meta.rulesText?.includes('Ranged.');return !!c.meta.rulesText?.includes('Ranged.');}
 function attackers(s,pid,uid){return chars(s).filter(c=>!c.state.exhausted&&eligibleAttacker(s,pid,uid,c));}
 function validate(s,p){const a=x(s);need(!a.tasks.length,'请先处理强制选择');if(p.kind==='enemy'){need(a.step==='enemyChoice'&&p.player===activeEnemyPlayer(s),'尚未轮到此玩家选择敌人');need(pendingEnemies(s,p.player).some(e=>eq(e.uid,p.uid)),'敌人已离场、攻击已完成或被禁止');}
  else if(p.kind==='defense'){need(a.step==='defenseChoice'&&p.player===current(s).player,'当前不能声明防御');need(Array.isArray(p.ids)&&new Set(p.ids.map(String)).size===p.ids.length,'防御名单不能重复');const ds=defenders(s);need(p.ids.every(id=>ds.some(c=>eq(c.uid,id))),'防御者必须重置，且为己方角色或警戒角色');if(p.ids.length>1){need(p.ids.every(id=>R.find(s,id).controller===p.player),'多名防御者必须由受攻击玩家控制');need((s.phasePermissions||[]).some(m=>m.type==='multipleDefenders'&&m.player===p.player&&m.round===s.round&&m.phase===5),'没有共同防御效果时只能声明1名防御者');}}
  else if(p.kind==='attack'){need(a.step==='attackChoice'&&p.player===activePlayer(s),'尚未轮到此玩家攻击');if(p.uid===null)return;need(attackTargets(s,p.player).some(e=>eq(e.uid,p.uid)),'本玩家已经攻击此目标，或没有合法攻击者');need(Array.isArray(p.ids)&&p.ids.length&&new Set(p.ids.map(String)).size===p.ids.length,'请选择不重复的攻击角色');need(p.ids.every(id=>attackers(s,p.player,p.uid).some(c=>eq(c.uid,id))),'攻击角色必须重置，并符合交战／远程限制');need(p.ids.some(id=>R.find(s,id).controller===p.player),'声明玩家必须派出至少1名自己的角色');if(s.staging.some(c=>eq(c.uid,p.uid)))need(p.ids.length===1&&R.find(s,p.ids[0]).meta.code==='01009','杜内希尔攻击探查区时必须独自攻击');}else throw Error('无效战斗方案');}
 function propose(s,player,kind,uid=null,ids=[]){check(s);need(!x(s).actionLocked&&!x(s).plannedActions?.length,'请先完成暂定行动');const p={player,kind,uid,ids:[...ids]};validate(s,p);x(s).proposal=p;x(s).approvals=[];log(s,'已暂定'+({enemy:'敌人攻击顺序',defense:'防御名单',attack:'玩家攻击方案'}[kind])+'；尚未横置或计算伤害');}
 function cancel(s){check(s);need(x(s).proposal,'没有可撤销方案');x(s).proposal=null;x(s).approvals=[];}
 function unapprove(s,pid){check(s);need(x(s).proposal&&x(s).approvals.includes(pid),'当前不能取消确认');x(s).approvals=x(s).approvals.filter(id=>id!==pid);}
 function approve(s,pid){check(s);need(live(s).some(p=>p.id===pid)&&!x(s).approvals.includes(pid),'玩家无效或已确认');const p=x(s).proposal;need(p,'请先暂定方案');validate(s,p);x(s).approvals.push(pid);if(!live(s).every(p=>x(s).approvals.includes(p.id)))return;x(s).proposal=null;x(s).approvals=[];
  if(p.kind==='enemy'){x(s).doneEnemies.push(p.uid);beginEnemy(s,p.uid,p.player);}
  else if(p.kind==='defense'){current(s).defenders=[...p.ids];for(const uid of p.ids)R.find(s,uid).state.exhausted=true;current(s).usedResponses=[];x(s).step='defenderResponses';resume(s);}
  else if(p.uid===null){x(s).playerIndex++;window(s,'playerAction');resume(s);}
  else{for(const uid of p.ids)R.find(s,uid).state.exhausted=true;x(s).doneAttacks.push(p.player+':'+p.uid);x(s).attack={kind:'player',uid:p.uid,player:p.player,attackers:[...p.ids]};window(s,'playerStrength');}
 }
 function beginEnemy(s,uid,pid,rider=false){const e=enemy(s,uid);if(!e)return;const a={kind:'enemy',uid,player:pid,defenders:[],bonus:0,ignoreDefense:false,shadowIndex:0,rider};x(s).attack=a;if(e.id===91)dealOne(s,e);if(e.id===84)R.changeThreat(s,pid,1);window(s,'beforeDefend');R.pump(s);}
 function requirePassed(s){need(!x(s).plannedActions?.length&&!x(s).actionLocked,'请先撤销或执行暂定行动');need(live(s).every(p=>x(s).finalPasses.includes(p.id)),'请所有玩家放弃本窗口行动');}
 function move(s){check(s);const a=x(s),step=a.step;need(actionSteps.includes(step),'此步骤须先完成选择或暗影结算');need(!a.tasks.length,'请先完成强制选择');requirePassed(s);
  if(step==='enemyAction'||step==='afterEnemy'){a.attack=null;a.step='enemyChoice';resume(s);}
  else if(step==='beforeDefend')window(s,'defenseChoice');
  else if(step==='beforeShadows'){a.step='shadows';nextShadow(s);}
  else if(step==='beforeDamage')enemyDamage(s);
  else if(step==='playerAction'||step==='afterPlayer'){a.attack=null;a.step='attackChoice';resume(s);}
  else if(step==='playerStrength'){current(s).strength=attackStrength(s);window(s,'playerDamage');}
  else if(step==='playerDamage')playerDamage(s);
  else if(step==='endAction')finish(s);
 }
 function responseOptions(s){const a=current(s),out=[];if(!a||x(s).step!=='defenderResponses')return out;for(const c of liveDefenders(s))if(c.meta.code==='01029'&&!a.usedResponses.includes('spear:'+c.uid))out.push(option('spear:'+c.uid,s.players[c.controller].name+' · 刚铎长矛兵造成1伤害'));for(const p of live(s))for(const card of p.hand)if(card.code==='01037'){try{R.payment(s,p.id,'tactics',2);out.push(option('swift:'+card.uid,p.name+' · 迅捷打击造成2伤害（2资源）'));}catch{}}return out;}
 function event(s,key,code,cost){const uid=Number(key.split(':')[1]),p=live(s).find(p=>p.hand.some(c=>c.uid===uid&&c.code===code));need(p,'响应牌已不在手中');const pay=R.payment(s,p.id,code==='01048'?'spirit':'tactics',cost);R.spend(s,pay.pay);const at=p.hand.findIndex(c=>c.uid===uid);p.playerDiscard.push(p.hand.splice(at,1)[0]);}
 function respond(s,value){check(s);need(x(s).step==='defenderResponses','防御响应窗口已结束');if(value==='skip'){window(s,'beforeShadows');return;}need(responseOptions(s).some(o=>o.value===value),'响应不合法');if(value.startsWith('swift:'))event(s,value,'01037',2);else current(s).usedResponses.push(value);R.damageEnemy(s,current(s).uid,value.startsWith('spear:')?1:2);R.pump(s);resume(s);}
 function nextShadow(s){const a=current(s),e=enemy(s,a.uid);if(!e||!engagedAttack(s)){abortAttack(s);return;}const cs=e.shadows||[];if(a.shadowIndex>=cs.length){window(s,'beforeDamage');return;}a.shadow=cs[a.shadowIndex++];a.shadow.revealed=true;x(s).step='shadowWindow';log(s,'翻开「'+a.shadow.name+'」暗影'+(a.shadow.shadow?'，等待取消或结算':'（无暗影效果）'));}
 function cancelOptions(s){if(x(s)?.step!=='shadowWindow'||!current(s)?.shadow?.shadow)return [];const out=[];for(const p of live(s))for(const card of p.hand)if(card.code==='01048'){try{R.payment(s,p.id,'spirit',1);out.push(option('hasty:'+card.uid,p.name+' · 仓促一击（1资源）'));}catch{}}return out;}
 function cancelShadow(s,value){check(s);need(cancelOptions(s).some(o=>o.value===value),'当前没有合法的暗影取消');event(s,value,'01048',1);current(s).shadow.canceled=true;current(s).shadow=null;x(s).step='shadows';nextShadow(s);}
 function attachmentItems(s,pid,targetIds=null){const out=R.attaches(s).filter(c=>targetIds?targetIds.includes(c.state.target):c.controller===pid);for(const o of s.objectives)if(o.holder&&(targetIds||o.holder.player===pid)){const h=s.players[o.holder.player].heroStates[o.holder.hero];if(!targetIds||targetIds.includes(h.uid))out.push({uid:o.uid,name:o.name,objective:true});}return out;}
 function discardItem(s,uid){const a=R.attaches(s).find(c=>eq(c.uid,uid));if(a)R.discardAttachment(s,a);else{const o=s.objectives.find(c=>eq(c.uid,uid));need(o?.holder,'目标附属已经离场');o.holder=null;}}
 function resolveShadow(s){check(s);need(x(s).step==='shadowWindow','请先翻开当前暗影');const a=current(s),c=a.shadow,undef=isUndefended(s),pid=a.player,e=enemy(s,a.uid);a.shadow=null;x(s).step='shadowEffects';if(!c.shadow){resume(s);return;}
  switch(c.id){
   case 74:task(s,'exhaust',pid,{left:undef?2:1});break;
   case 75:for(const char of [...own(s,pid)])if(R.find(s,char.uid))R.damageCharacter(s,char,undef?2:1);break;
   case 76:R.changeThreat(s,pid,undef?8:4);break;
   case 81:a.pendingRider=c.uid;x(s).returnShadows.push(c.uid);break;
   case 85:a.bonus+=undef?2:1;break;
   case 86:a.ignoreDefense=true;break;
   case 89:a.bonus+=undef?3:1;break;
   case 92:{const ids=liveDefenders(s).map(c=>c.uid),items=attachmentItems(s,pid,undef?null:ids);if(undef)for(const item of [...items])discardItem(s,item.uid);else if(items.length)task(s,'attachment',pid,{targets:ids});break;}
   case 96:if(attachmentItems(s,pid).length)task(s,'attachment',pid,{});break;
   case 97:a.bonus++;if(undef)R.changeThreat(s,pid,3);break;
   case 103:if(undef)for(const item of [...attachmentItems(s,pid)])discardItem(s,item.uid);else if(attachmentItems(s,pid).length)task(s,'attachment',pid,{});break;
   case 104:R.changeThreat(s,pid,s.players[pid].engaged.length);break;
   case 105:c.targetPlayer=s.first;s.conditions.push(c);if(e){e.shadows=e.shadows.filter(card=>card.uid!==c.uid);a.shadowIndex--;}break;
   case 111:s.progress=Math.max(0,s.progress-(undef?3:1));break;
   case 112:for(let i=0;i<live(s).length;i++)dealOne(s,e);break;
   case 115:a.bonus+=s.players[pid].threat>=35?2:1;break;
   case 117:if(own(s,pid).some(c=>c.kind==='ally'&&c.state.exhausted))task(s,'returnAlly',pid,{});else R.changeThreat(s,pid,3);break;
   default:throw Error('此基础暗影尚未登记：'+c.id);
  }
  if(e?.id===102&&!s.players[pid].eliminated)task(s,'discardCharacter',pid,{});R.pump(s);resume(s);
 }
 function engagedAttack(s){const a=current(s);return a&&(!s.players[a.player].eliminated)&&(a.rider?!!enemy(s,a.uid):s.players[a.player].engaged.some(e=>e.uid===a.uid));}
 function attackStrength(s){const a=current(s),e=enemy(s,a.uid);if(!e)return 0;return a.attackers.map(uid=>R.find(s,uid)).filter(c=>c&&['hero','ally'].includes(c.kind)).reduce((n,c)=>n+R.stats(s,c.uid).attack+(s.staging.some(e=>e.uid===a.uid)&&c.meta.code==='01009'?1:0)+((e.traits||'').includes('Orc.')?held(s,c.uid).filter(c=>c.meta.code==='01039').length:0),0);}
 function enemyDamage(s){const a=current(s),e=enemy(s,a.uid);if(!e||!engagedAttack(s)){abortAttack(s);return;}const ds=liveDefenders(s),def=a.ignoreDefense?0:ds.reduce((n,c)=>n+R.stats(s,c.uid).defense,0),amount=Math.max(0,R.stats(s,e.uid).attack+a.bonus-def);a.damage=amount;x(s).step='damageChoice';if(amount){const targets=ds.length?ds:own(s,a.player).filter(c=>c.kind==='hero');if(targets.length===1)applyDamage(s,targets[0].uid);else task(s,'combatDamage',a.player,{undef:!ds.length});}else afterAttack(s);R.pump(s);resume(s);}
 function applyDamage(s,uid){const a=current(s),e=enemy(s,a.uid),c=R.find(s,uid);need(c,'受伤角色已离场');const excess=e?.id===82?Math.max(0,a.damage-(R.stats(s,uid).health-(c.state.damage||0))):0;R.damageCharacter(s,c,a.damage);if(excess&&!s.players[a.player].eliminated)R.changeThreat(s,a.player,excess);log(s,'攻击伤害'+a.damage+(excess?'；山丘巨魔溢出增加'+excess+'威胁':''));afterAttack(s);}
 function afterAttack(s){const a=current(s),e=enemy(s,a.uid);if(e){if(e.id===90)e.resources=(e.resources||0)+1;if(e.id===111)s.progress=Math.max(0,s.progress-1);if(e.id===85&&!(e.shadows||[]).some(c=>c.shadow))returnToStaging(s,e);}
  if(a.rider){const virtual=x(s).riders.find(e=>e.uid===a.uid);if(virtual){for(const c of virtual.shadows||[])H.discardCard(s,c);x(s).riders=x(s).riders.filter(e=>e.uid!==a.uid);}const parent=x(s).stack.pop();x(s).attack=parent;x(s).step='shadowEffects';}else window(s,'afterEnemy');
 }
 function returnToStaging(s,e){for(const p of s.players){const at=p.engaged.findIndex(c=>c.uid===e.uid);if(at>=0){p.engaged.splice(at,1);if(e.synthetic){s.players[e.playerCard.owner].playerDiscard.push(e.playerCard);return;}s.staging.push(e);return;}}}
 function abortAttack(s){if(current(s)?.rider)afterAttack(s);else window(s,'afterEnemy');}
 function playerDamage(s){const a=current(s),e=enemy(s,a.uid);window(s,'afterPlayer');if(!e)return;const sources=a.attackers.map(uid=>R.find(s,uid)).filter(Boolean);const damage=Math.max(0,attackStrength(s)-R.stats(s,e.uid).defense);const killed=R.damageEnemy(s,e.uid,damage);log(s,'玩家攻击造成'+damage+'伤害');if(killed)for(const c of sources){const blades=held(s,c.uid).filter(a=>a.meta.code==='01039').map(a=>a.uid);if(c.meta.code==='01005'||blades.length)R.queue(s,'attackProgress',c.controller,{attacker:c.uid,legolas:c.meta.code==='01005',blades});}R.pump(s);resume(s);}
 function spec(s){const t=x(s)?.tasks[0];if(!t)return null;const d=t.payload;let items=[],message='';switch(t.kind){case'dealTie':message='由起始玩家选择同交战值敌人的暗影分配顺序（牌面仍隐藏）';items=d.uids.map(uid=>enemy(s,uid)).filter(Boolean);break;case'exhaust':message=s.players[t.actor].name+'再横置'+d.left+'名角色';items=own(s,t.actor).filter(c=>!c.state.exhausted);break;case'attachment':message='弃掉1张合法附属；目标卡返回探查区';items=attachmentItems(s,t.actor,d.targets);break;case'returnAlly':message='返回1名己方已横置盟友到拥有者手中';items=own(s,t.actor).filter(c=>c.kind==='ally'&&c.state.exhausted);break;case'discardCharacter':message='多尔哥多戒灵：弃掉1名己方角色';items=own(s,t.actor);break;case'combatDamage':message='所有'+current(s).damage+'伤害必须分配给同一名'+(d.undef?'己方英雄':'防御角色');items=d.undef?own(s,t.actor).filter(c=>c.kind==='hero'):liveDefenders(s);break;case'sniper':message='哥布林狙击手：对己方1名角色造成1伤害';items=own(s,t.actor);break;}return {task:t,message,fields:[field('target','选择目标',items)]};}
 function choose(s,id,params){check(s);const sp=spec(s);need(sp&&sp.task.id===id,'选择已过期');need(sp.fields[0].options.some(o=>eq(o.value,params.target)),'请选择合法目标');const t=sp.task,uid=Number(params.target),d=t.payload;x(s).tasks.shift();
  if(t.kind==='dealTie'){dealOne(s,enemy(s,uid));x(s).dealDone.push(uid);deal(s);}
  if(t.kind==='exhaust'){R.find(s,uid).state.exhausted=true;if(d.left>1)x(s).tasks.unshift({...t,id:++s.serial,payload:{...d,left:d.left-1}});}
  if(t.kind==='attachment')discardItem(s,uid);if(t.kind==='returnAlly')R.leaveAlly(s,uid,'hand');if(t.kind==='discardCharacter')R.destroyCharacter(s,R.find(s,uid),false);if(t.kind==='combatDamage')applyDamage(s,uid);if(t.kind==='sniper')R.damageCharacter(s,R.find(s,uid),1);R.pump(s);resume(s);
 }
 function finish(s){check(s);need(x(s).step==='endAction','玩家攻击尚未结束');requirePassed(s);x(s).step='ending';for(const sniper of s.staging.filter(c=>c.id===83))for(const p of live(s))task(s,'sniper',p.id,{});resume(s);}
 function cleanup(s){const returns=[];for(const e of R.enemies(s).map(c=>c.state)){for(const c of e.shadows||[]){if(x(s).returnShadows.includes(c.uid))returns.push(c);else H.discardCard(s,c);}delete e.shadows;delete e.shadowRevealed;}for(const c of returns.reverse()){delete c.revealed;delete c.canceled;s.deck.unshift(c);}x(s).cleaned=true;}
 function resume(s){const a=x(s);if(s.phase!==5||!a||a.completed||a.running||s.pending.length||a.queue.length||s.status!=='playing')return;a.running=true;try{
  let sp=spec(s);while(sp&&!sp.fields[0].options.length){a.tasks.shift();sp=spec(s);}if(a.tasks.length)return;
  if(current(s)?.kind==='enemy'&&!engagedAttack(s)){abortAttack(s);}
  if(a.step==='defenderResponses'&&!responseOptions(s).length)window(s,'beforeShadows');
  if(a.step==='shadowEffects'){const atk=current(s);if(atk?.pendingRider){const source=atk.pendingRider;delete atk.pendingRider;const card=H.byId[81],virtual={...card,uid:++s.serial,combatRider:true,sourceUid:source,shadows:[]};a.riders.push(virtual);dealOne(s,virtual);a.stack.push(atk);beginEnemy(s,virtual.uid,atk.player,true);}else{a.step='shadows';nextShadow(s);}}
  if(a.step==='enemyChoice'){while(a.enemyIndex<a.turnOrder.length&&(s.players[activeEnemyPlayer(s)].eliminated||!pendingEnemies(s,activeEnemyPlayer(s)).length))a.enemyIndex++;if(a.enemyIndex>=a.turnOrder.length)window(s,'playerAction');}
  if(['playerAction','attackChoice'].includes(a.step)){while(a.playerIndex<a.turnOrder.length&&s.players[activePlayer(s)].eliminated)a.playerIndex++;if(a.playerIndex>=a.turnOrder.length)window(s,'endAction');}
  if(a.step==='ending'&&!a.queue.length){if(!a.cleaned)cleanup(s);R.finish(s);}
  Q.resumeActions(s);
 }finally{a.running=false;}}
 return {start,actionSteps,activeEnemyPlayer,activePlayer,pendingEnemies,defenders,attackTargets,attackers,propose,cancel,approve,unapprove,move,responseOptions,respond,cancelOptions,cancelShadow,resolveShadow,attackStrength,spec,choose,finish,resume};
};
if(typeof module!=='undefined')module.exports=CombatRulesFactory;
