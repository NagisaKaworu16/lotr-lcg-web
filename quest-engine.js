/* Core quest phase: explicit framework steps and per-card interruption windows. */
const QuestRulesFactory=(H,R)=>{
 const need=(v,m)=>{if(!v)throw Error(m);},same=(a,b)=>String(a)===String(b),q=s=>s.phase===6?s.refreshing:s.phase===5?s.combat:s.phase===4?s.encountering:s.phase===3?s.traveling:s.questing;
 const alive=s=>s.players.filter(p=>!p.eliminated),chars=s=>R.chars(s),committed=s=>chars(s).filter(c=>c.state.committed);
 const log=(s,t)=>{const k=s.phase===5?['P5','战斗']:s.phase===4?['P4','遭遇']:s.phase===3?['P3','旅行']:['P2','探险'];return H.log(s,k[1]+' · '+t,k[0]);},opt=c=>({value:String(c.uid),label:(c.meta?.nameZh||c.name||c.meta?.name)+' #'+c.uid});
 const field=(key,label,items)=>({key,label,options:items.map(opt)});
 const task=(s,kind,actor,payload={},optional=false)=>q(s).tasks.push({id:++s.serial,kind,actor,payload,optional});
 function check(s){need([2,3,4,5,6].includes(s.phase)&&q(s)?.round===s.round&&!q(s).completed&&s.status==='playing','当前没有进行中的探险阶段');need(!s.pending.length,'请先处理剧本事项');need(!q(s).queue.length,'请先处理卡牌响应');}
 function start(s){need(s.phase===2,'只能在第三阶段初始化探险');need(s.questing?.round!==s.round,'本回合探险阶段已经初始化，不能重复开始');need(s.players.every(p=>p.heroStates),'旧存档没有实际角色，请新开预组牌测试');const order=alive(s).map(p=>p.id).sort((a,b)=>(a-s.first+s.players.length)%s.players.length-(b-s.first+s.players.length)%s.players.length);s.questing={round:s.round,step:'beforeCommit',order,index:order.length,commitIndex:0,finalPasses:[],queue:[],tasks:[],remaining:[],closing:false,completed:false,revealed:0,encounterModifiers:[]};for(const c of chars(s))c.state.committed=false;log(s,'开始，投入前行动窗口开放');if(s.quest===125)for(const p of alive(s)){const x=p.playerDeck.shift();if(x)p.engaged.push({id:0,uid:x.uid,name:'兽人守卫',type:'Enemy',attack:1,defense:1,health:1,threat:0,synthetic:true,playerCard:x});}}
 function pass(s,pid){check(s);need(!q(s).tasks.length,'请先处理探险选择');R.passAction(s,pid);}
 function allPassed(s){return alive(s).every(p=>q(s).finalPasses.includes(p.id));}
 function move(s){need(s.phase===2,'请使用旅行阶段流程');check(s);const x=q(s);need(!planned(s).length&&!x.actionLocked,'请先撤销或二次确认并执行暂定行动');need(!x.tasks.length&&!x.current,'请先结算当前遭遇或响应');need(allPassed(s),'每位玩家须确认放弃本窗口行动');if(x.step!=='afterResult')x.finalPasses=[];
  if(x.step==='beforeCommit'){x.step='commit';log(s,'按起始玩家顺序投入角色');}
  else if(x.step==='afterCommit'){x.step='staging';s.stagedRound=s.round;x.remaining=s.quest===128?[]:Array.from({length:alive(s).length+(s.quest===127?1:0)},()=>({}));log(s,s.quest===128?'河岸伏击：跳过正常探查':'开始逐张探查');}
  else if(x.step==='afterStaging'){result(s);}
  else if(x.step==='afterResult'){R.finish(s);}
  else throw Error('此步骤不能推进');
 }
 function eligible(s,pid){return chars(s).filter(c=>c.controller===pid&&!c.state.exhausted&&!c.state.committed);}
 function enableDiscussion(s){need(s.phase===2&&q(s),'需要探险阶段');q(s).discussion=true;}
 function invalidateAgreement(s){q(s).actionApprovals=[];q(s).deploymentApprovals=[];}
 function unpass(s,pid){check(s);need(R.window(s).kind==='action'&&!q(s).actionLocked,'当前不能撤回放弃');need(q(s).finalPasses.includes(pid),'尚未放弃行动');q(s).finalPasses=q(s).finalPasses.filter(id=>id!==pid);invalidateAgreement(s);log(s,s.players[pid].name+'取消放弃行动');}
 function planned(s){return q(s).plannedActions||[];}
 function validatePlanItem(s,item){if(item.kind==='play'){const sp=R.checkedPlay(s,item.player,item.uid,item.params);need(sp.meta.type==='event','探险阶段只能暂定合法事件');return sp;}
  const sp=R.abilitySpec(s,item.player,item.uid,item.params);need(sp.legal,sp.reason);for(const f of sp.fields)need(f.options.some(o=>same(o.value,item.params[f.key])),'请选择合法目标');return sp;}
 function queueAction(s,kind,pid,uid,params={}){check(s);need(q(s).discussion&&R.window(s).kind==='action'&&!q(s).actionLocked,'当前不能暂定行动');need(['play','ability'].includes(kind),'无效行动');need(!planned(s).some(a=>a.kind===kind&&same(a.uid,uid)),'此卡已有暂定行动，请先撤销后修改');const item={kind,player:pid,uid,params:JSON.parse(JSON.stringify(params))};validatePlanItem(s,item);
  // Reserve event payments on a private clone, without executing effects or exposing hidden cards.
  validateReservations(s,[...planned(s),item]);item.id=++s.serial;q(s).plannedActions??=[];q(s).plannedActions.push(item);q(s).finalPasses=[];invalidateAgreement(s);log(s,'暂定'+(kind==='play'?'事件':'能力')+'，尚未执行');}
 function validateReservations(s,items=planned(s)){const copy=JSON.parse(JSON.stringify(s));q(copy).actionLocked=false;for(const a of items){const sp=validatePlanItem(copy,a);if(a.kind==='play')R.spend(copy,sp.payment.pay);}}
 function cancelAction(s,pid,id){check(s);need(!q(s).actionLocked,'行动已全员确认并开始执行');const item=planned(s).find(a=>same(a.id,id));need(item&&item.player===pid,'只能撤销自己的暂定行动');q(s).plannedActions=planned(s).filter(a=>a!==item);q(s).finalPasses=[];delete q(s).actionError;invalidateAgreement(s);log(s,'撤销暂定行动，不消耗资源、不移动卡牌');}
 function approveActions(s,pid){check(s);need(q(s).order.includes(pid)&&planned(s).length&&!q(s).actionLocked,'没有待二次确认的行动');validateReservations(s);q(s).actionApprovals??=[];need(!q(s).actionApprovals.includes(pid),'已二次确认');q(s).actionApprovals.push(pid);if(alive(s).every(p=>q(s).actionApprovals.includes(p.id))){q(s).actionLocked=true;resumeActions(s);}}
 function withdrawActionApproval(s,pid){check(s);need(!q(s).actionLocked&&q(s).order.includes(pid),'行动已经锁定或玩家无效');q(s).actionApprovals=(q(s).actionApprovals||[]).filter(id=>id!==pid);}
 function resumeActions(s){const x=q(s);if(!x?.actionLocked||x.runningAction||x.queue.length||x.tasks.length||s.pending.length||s.status!=='playing')return;
  while(planned(s).length&&!x.queue.length&&!x.tasks.length&&s.status==='playing'){const item=planned(s)[0];try{x.executingAction=true;validatePlanItem(s,item);const trial=JSON.parse(JSON.stringify(s));q(trial).runningAction=true;if(item.kind==='play')R.play(trial,item.player,item.uid,item.params);else R.activate(trial,item.player,item.uid,item.params);x.runningAction=true;if(item.kind==='play')R.play(s,item.player,item.uid,item.params);else R.activate(s,item.player,item.uid,item.params);x.plannedActions.shift();delete x.actionError;}catch(e){x.actionLocked=false;x.actionApprovals=[];x.actionError='后续暂定行动需重新选择：'+e.message;log(s,x.actionError);return;}finally{x.executingAction=false;x.runningAction=false;}}
  if(!planned(s).length){x.actionLocked=false;x.actionApprovals=[];x.finalPasses=[];log(s,'已确认的行动执行完成，请继续交流或结束本窗口');}
 }
 function withdrawDeploymentApproval(s,pid){check(s);need(q(s).discussion&&!q(s).deploymentLocked,'名单已锁定');need(q(s).order.includes(pid),'无效玩家');q(s).deploymentApprovals=(q(s).deploymentApprovals||[]).filter(id=>id!==pid);}
 function approveDeployment(s,pid){check(s);const x=q(s);need(x.discussion&&x.step==='commit'&&!x.deploymentLocked&&x.order.includes(pid),'当前不能二次确认派遣');need(x.order.every(id=>x.deployments?.[id]?.confirmed),'请先由每位玩家提交暂定派遣名单');for(const id of x.order)validateDeployment(s,id,x.deployments[id].ids);x.deploymentApprovals??=[];need(!x.deploymentApprovals.includes(pid),'已二次确认');x.deploymentApprovals.push(pid);if(x.order.every(id=>x.deploymentApprovals.includes(id))){x.deploymentLocked=true;log(s,'全员二次确认，正式执行投入');resumeDeployment(s);}}
 function validateDeployment(s,pid,uids){need(q(s).order.includes(pid),'无效玩家');need(Array.isArray(uids)&&new Set(uids.map(String)).size===uids.length,'投入名单不能重复');const allowed=eligible(s,pid);need(uids.every(id=>allowed.some(c=>same(c.uid,id))),'只能投入己方重置且可用的角色');}
 function submitDeployment(s,pid,uids){check(s);const x=q(s);need(x.step==='commit'&&!x.deploymentLocked&&!x.tasks.length,'派遣名单已锁定');need(!x.deployments?.[pid]?.confirmed,'请先取消确认再修改名单');validateDeployment(s,pid,uids);
  // Validate all earlier submissions before committing any of the table.
  for(const id of x.order)if(x.deployments?.[id]?.confirmed)validateDeployment(s,id,x.deployments[id].ids);
  x.deployments??={};x.deployments[pid]={ids:uids.map(Number),confirmed:true};log(s,s.players[pid].name+'确认派遣名单，等待全员确认');
  invalidateAgreement(s);if(!x.discussion&&x.order.every(id=>x.deployments[id]?.confirmed)){x.deploymentLocked=true;log(s,'全员已确认，锁定派遣名单并按起始玩家顺序执行投入');resumeDeployment(s);}
 }
 function withdrawDeployment(s,pid){check(s);const x=q(s);need(x.step==='commit'&&!x.deploymentLocked,'全员已确认，不能再修改派遣名单');need(x.deployments?.[pid]?.confirmed,'该玩家尚未确认');x.deployments[pid].confirmed=false;invalidateAgreement(s);log(s,s.players[pid].name+'取消派遣确认，可修改名单');}
 function resumeDeployment(s){const x=q(s);if(!x?.deploymentLocked||x.step!=='commit'||x.tasks.length||x.queue.length||s.pending.length||s.status!=='playing')return;while(x.step==='commit'&&!x.tasks.length&&!x.queue.length){const pid=x.order[x.commitIndex];commit(s,pid,x.deployments[pid].ids,true);}}
 function commit(s,pid,uids,fromBatch=false){check(s);const x=q(s);need(!x.deployments||(x.deploymentLocked&&fromBatch),'请先让所有玩家确认派遣名单');need(x.step==='commit'&&!x.tasks.length,'当前不是可投入角色的步骤');need(x.order[x.commitIndex]===pid,'请按起始玩家顺序投入');need(Array.isArray(uids)&&new Set(uids.map(String)).size===uids.length,'投入名单不能重复');const available=eligible(s,pid);need(uids.every(id=>available.some(c=>same(c.uid,id))),'只能投入己方重置且可用的角色');const chosen=uids.map(id=>available.find(c=>same(c.uid,id)));for(const c of chosen){c.state.exhausted=true;c.state.committed=true;}
  log(s,s.players[pid].name+'投入：'+(chosen.map(c=>c.meta.nameZh).join('、')||'无人'));
  for(const c of chosen)if(['01001','01002','01044','01045'].includes(c.meta.code))task(s,'commitResponse',pid,{uid:c.uid,code:c.meta.code},true);
  x.commitIndex++;if(x.commitIndex===x.order.length)x.step='afterCommit';
 }
 function drawNext(s){check(s);const x=q(s);need(x.step==='staging'&&!x.current&&!x.tasks.length,'请先完成当前翻牌');if(!x.remaining.length){x.step=x.returnStep||'afterStaging';delete x.returnStep;x.finalPasses=[];log(s,'探查完成，行动窗口开放');return null;}
  need(++x.revealed<400,'连续翻牌异常，已停止');const instruction=x.remaining.shift(),c=H.draw(s,s.phase===2);if(!c){log(s,'遭遇牌库无牌可翻');return null;}
  log(s,'翻开「'+c.name+'」');x.current={card:c,guard:instruction.guard||null,canceled:false,replacement:false};
  // Thalin is a constant effect before keywords or When Revealed (FAQ).
  if(c.type==='Enemy'&&committed(s).some(a=>a.meta.code==='01006')){c.damage=(c.damage||0)+1;if(c.damage>=c.health){if(c.id===115){delete c.damage;s.deck.push(c);H.shuffle(s,s.deck);}else if(c.victory)s.victory.push(c);else H.discardCard(s,c);log(s,'沙林在翻开时击败敌人，跳过涌现与翻开效果');x.current=null;return c;}}
  x.current.hasEffect=[74,76,79,80,86,89,92,93,98,104,105,112,116,117,118].includes(c.id);return c;
 }
 function cancelOptions(s){const cur=q(s)?.current;if(!cur?.hasEffect||cur.canceled)return [];const a=[];for(const p of alive(s)){for(const x of p.hand)if(x.code==='01050'){try{R.payment(s,p.id,'spirit',1);a.push({value:'will:'+x.uid,label:p.name+' · 意志考验（1资源）'});}catch{}}
  if(cur.card.type==='Treachery')for(const h of chars(s).filter(c=>c.controller===p.id&&c.meta.code==='01008'&&!c.state.exhausted))a.push({value:'eleanor:'+h.uid,label:p.name+' · 埃莉诺（横置，弃掉并补翻）'});
  }return a;
 }
 function cancel(s,value,payment){check(s);const cur=q(s).current;need(cancelOptions(s).some(c=>c.value===value),'此取消响应当前不合法');const [kind,id]=value.split(':');if(kind==='will'){const p=alive(s).find(p=>p.hand.some(x=>same(x.uid,id))),pay=R.payment(s,p.id,'spirit',1,payment);R.spend(s,pay.pay);const at=p.hand.findIndex(x=>same(x.uid,id));p.playerDiscard.push(p.hand.splice(at,1)[0]);}else{R.find(s,id).state.exhausted=true;cur.replacement=true;}cur.canceled=true;log(s,'取消「'+cur.card.name+'」的翻开效果；关键词仍会结算');}
 function resolveReveal(s){check(s);const x=q(s),cur=x.current;need(cur&&!x.tasks.length,'没有可结算的遭遇牌');const c=cur.card;
  if(s.phase===2&&c.doomed)for(const p of [...alive(s)])R.changeThreat(s,p.id,c.doomed);
  if(s.phase===2&&c.surge)x.remaining.unshift({});
  if(cur.replacement){H.discardCard(s,c);x.remaining.unshift({guard:cur.guard});x.current=null;return;}
  if(['Enemy','Location'].includes(c.type)){s.staging.push(c);if(cur.guard){const o=s.objectives.find(o=>o.uid===cur.guard);if(o){o.guard=c.uid;c.guard=o.uid;}}}
  if(c.type==='Objective'){c.holder=null;c.guard=null;s.objectives.push(c);x.remaining.unshift({guard:c.uid});}
  if(!cur.canceled&&cur.hasEffect)effect(s,c);
  if(c.type==='Treachery'&&!s.conditions.includes(c)&&!x.tasks.some(t=>t.payload.card?.uid===c.uid))H.discardCard(s,c);
  x.current=null;log(s,'已结算「'+c.name+'」');
 }
 function effect(s,c){const x=q(s);switch(c.id){
  case 74:for(const p of alive(s))if(chars(s).some(a=>a.controller===p.id&&!a.state.exhausted))task(s,'exhaust',p.id);break;
  case 76:x.encounterModifiers.push({kind:'committed',stat:'willpower',amount:-1});break;
  case 79:for(const p of alive(s)){const ev=p.hand.filter(c=>R.data(s,c).type==='event');p.hand=p.hand.filter(c=>!ev.includes(c));p.playerDiscard.push(...ev);}break;
  case 80:{const max=Math.max(...alive(s).map(p=>p.threat));task(s,'web',s.first,{card:c,players:alive(s).filter(p=>p.threat===max).map(p=>p.id)});break;}
  case 86:s.progress=Math.max(0,s.progress-4);break;
  case 89:if(committed(s).length)task(s,'damageCommitted',s.first);break;
  case 92:if(s.staging.some(c=>['Enemy','Location'].includes(c.type)))x.encounterModifiers.push({kind:'staging',stat:'threat',amount:1});else if(s.phase===2)x.remaining.unshift({});break;
  case 93:{const targets=chars(s).filter(c=>c.state.exhausted);for(const a of targets)if(R.find(s,a.uid))R.damageCharacter(s,a,1);R.pump(s);break;}
  case 98:for(const p of alive(s))if(committed(s).some(a=>a.controller===p.id))task(s,'removeCommitted',p.id);break;
  case 104:s.phaseThreat+=alive(s).length;break;
  case 105:c.targetPlayer=s.first;s.conditions.push(c);break;
  case 112:x.remaining.unshift(...alive(s).map(()=>({})));break;
  case 116:{const targets=chars(s).filter(a=>s.players[a.controller].threat>=35);for(const a of targets)if(R.find(s,a.uid))R.damageCharacter(s,a,1);R.pump(s);break;}
  case 117:for(const p of [...alive(s)])R.changeThreat(s,p.id,chars(s).filter(a=>a.controller===p.id&&!a.state.committed).length);break;
  case 118:x.encounterModifiers.push({kind:'stagingLocations',stat:'threat',amount:1});for(const p of alive(s))if(p.threat>=35&&p.hand.length)task(s,'discard',p.id);break;
 }}
 function spec(s,id){const t=id===undefined?q(s).tasks[0]:q(s).tasks.find(t=>same(t.id,id));if(!t)return null;let fields=[],message='',items=[];const d=t.payload;
  if(t.kind==='commitResponse'){const c=R.find(s,d.uid);message='投入探险响应：'+(c?.meta.nameZh||'来源已离场');if(d.code==='01002')fields=[field('target','获得1资源的已投入英雄',committed(s).filter(c=>c.kind==='hero'))];if(d.code==='01044'&&!s.active||d.code==='01045'&&!s.staging.some(l=>l.type==='Location'))return {task:t,message:'没有可放置进度的地点，请放弃响应',fields:[],unavailable:true};if(d.code==='01001'&&(!c||c.state.resources<1))return {task:t,message:'阿拉贡自身资源不足，可放弃响应',fields:[],unavailable:true};}
  if(t.kind==='exhaust'){message=s.players[t.actor].name+'选择横置1名己方角色';items=chars(s).filter(c=>c.controller===t.actor&&!c.state.exhausted);}
  if(t.kind==='damageCommitted'){message='起始玩家选择1名已投入角色，受到2伤害';items=committed(s);}
  if(t.kind==='removeCommitted'){message=s.players[t.actor].name+'选择移出探险的己方角色（保持横置）';items=committed(s).filter(c=>c.controller===t.actor);}
  if(t.kind==='web'){message='威胁最高的玩家选择己方英雄附着蛛网；并列由起始玩家决定';items=chars(s).filter(c=>c.kind==='hero'&&d.players.includes(c.controller));}
  if(t.kind==='jailor'){message='起始玩家选择无人持有的目标，由地牢狱卒洗回遭遇牌库';items=s.objectives.filter(o=>!o.holder&&d.candidates.includes(o.uid));}
  if(t.kind==='discard'){message=s.players[t.actor].name+'弃掉1张手牌';items=s.players[t.actor].hand.map(c=>({...c,meta:R.data(s,c)}));}
  if(items.length)fields=[field('target','目标',items)];return {task:t,message,fields,unavailable:!t.optional&&!items.length&&t.kind!=='commitResponse'};
 }
 function choose(s,id,a={}){check(s);const sp=spec(s,id);need(sp,'选择已过期');const t=sp.task,d=t.payload;need(q(s).tasks[0]===t||t.kind==='commitResponse','须先结算当前强制选择');if(a.skip)need(t.optional,'强制效果不可跳过');else{if(sp.unavailable&&!t.optional){q(s).tasks=q(s).tasks.filter(x=>x!==t);if(d.card)H.discardCard(s,d.card);log(s,'无合法目标：'+sp.message);return;}need(!sp.unavailable,'此响应无法支付，请放弃');for(const f of sp.fields)need(f.options.some(o=>same(o.value,a[f.key])),'请选择合法目标');
   if(t.kind==='commitResponse'){const c=R.find(s,d.uid);if(c&&c.state.committed){if(d.code==='01001'){need(c.state.resources>=1,'资源不足');c.state.resources--;c.state.exhausted=false;}if(d.code==='01002')R.find(s,a.target).state.resources++;if(d.code==='01044'&&s.active)R.locationProgress(s,s.active.uid,1);if(d.code==='01045')for(const l of [...s.staging].filter(c=>c.type==='Location'))R.locationProgress(s,l.uid,1);}}
   if(t.kind==='exhaust')R.find(s,a.target).state.exhausted=true;
   if(t.kind==='damageCommitted')R.damageCharacter(s,R.find(s,a.target),2);
   if(t.kind==='removeCommitted')R.find(s,a.target).state.committed=false;
   if(t.kind==='web'){d.card.target=Number(a.target);s.conditions.push(d.card);}
   if(t.kind==='jailor'){const o=s.objectives.find(o=>same(o.uid,a.target));s.objectives=s.objectives.filter(x=>x!==o);for(const g of s.staging)if(g.guard===o.uid)delete g.guard;o.guard=null;s.deck.push(o);H.shuffle(s,s.deck);}
   if(t.kind==='discard'){const p=s.players[t.actor],i=p.hand.findIndex(c=>same(c.uid,a.target));p.playerDiscard.push(p.hand.splice(i,1)[0]);}
  }q(s).tasks=q(s).tasks.filter(x=>x!==t);log(s,(a.skip?'放弃':'完成')+'：'+sp.message);R.pump(s);resumeDeployment(s);}
 function total(s){return committed(s).reduce((n,c)=>n+R.stats(s,c.uid).willpower,0);}
 function progress(s,n){if(s.active){const needPoints=Math.max(0,s.active.quest-(s.active.progress||0)),k=Math.min(n,needPoints);if(k)R.locationProgress(s,s.active.uid,k);n-=k;}s.progress+=n;log(s,'向探险卡放置'+n+'点进度');if(s.quest===124&&s.progress>0&&!s.rescued)H.task(s,'探险卡获得进度，可救出囚犯。','rescue');advanceIfReady(s);}
 function advanceIfReady(s){if(!s.pending.length&&!H.gate(s)&&s.status==='playing')H.advance(s);}
 function result(s){const x=q(s),willpower=total(s),threat=H.threat(s),delta=willpower-threat;x.result={willpower,threat,delta};x.step='afterResult';s.resolvedRound=s.round;log(s,`意志${willpower}，探查区威胁${threat}，差值${delta}`);if(delta>0)progress(s,delta);else if(delta<0){for(const p of [...alive(s)])R.changeThreat(s,p.id,-delta);for(const jailor of s.staging.filter(c=>c.id===101)){const candidates=s.objectives.filter(o=>!o.holder);if(candidates.length)task(s,'jailor',s.first,{candidates:candidates.map(o=>o.uid)});}}}
 return {withdrawDeploymentApproval,enableDiscussion,unpass,queueAction,cancelAction,approveActions,withdrawActionApproval,resumeActions,approveDeployment,submitDeployment,withdrawDeployment,resumeDeployment,start,pass,move,eligible,commit,drawNext,cancelOptions,cancel,resolveReveal,spec,choose,total,progress,advanceIfReady};
};
if(typeof module!=='undefined')module.exports=QuestRulesFactory;
