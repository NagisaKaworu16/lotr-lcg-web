/* Refresh framework and distinct end-of-round triggers. */
const RefreshRulesFactory=(H,R,Q)=>{
 const need=(v,m)=>{if(!v)throw Error(m);},alive=s=>s.players.filter(p=>!p.eliminated),x=s=>s.refreshing,
 /* v0.15.67：没有蛛网要支付的玩家没有决策点，视为已确认（空确认），不阻塞二次确认结算。 */
 settled=s=>alive(s).every(p=>!webs(s,p.id).length||x(s).approvals.includes(p.id));
 const order=s=>alive(s).map(p=>p.id).sort((a,b)=>(a-s.first+s.players.length)%s.players.length-(b-s.first+s.players.length)%s.players.length);
 const log=(s,t)=>H.log(s,'刷新 · '+t,'P6');
 function check(s,step){need(s.phase===6&&x(s)?.round===s.round&&!x(s).completed&&s.status==='playing','当前没有进行中的刷新阶段');need(!s.pending.length&&!x(s).queue.length,'请先结算卡牌响应');if(step)need(x(s).step===step,'当前刷新步骤不允许此操作');}
 function start(s){need(s.phase===6&&s.combat?.completed,'请先完成战斗阶段');need(x(s)?.round!==s.round,'本回合刷新已初始化');const ids=order(s);s.refreshing={round:s.round,step:'ready',order:ids,index:ids.length,queue:[],tasks:[],finalPasses:[],approvals:[],payPlans:{},discussion:true,completed:false,closing:false};log(s,'先选择蛛网费用，全员确认后执行重置、威胁与先手轮换');
  /* v0.15.67：全员都无蛛网时没有决策点，直接结算；否则等待有蛛网的玩家确认。 */
  if(alive(s).every(p=>!webs(s,p.id).length)){log(s,'没有需支付的蛛网费用，自动完成刷新确认');approve(s,s.first);}}
 function webs(s,pid){return R.chars(s).filter(c=>c.kind==='hero'&&c.controller===pid&&c.state.exhausted).map(c=>({...c,cost:2*s.conditions.filter(a=>a.id===80&&String(a.target)===String(c.uid)).length})).filter(c=>c.cost);}
 function valid(s,pid,ids){need(alive(s).some(p=>p.id===pid)&&Array.isArray(ids)&&new Set(ids.map(String)).size===ids.length,'无效玩家或重复英雄');for(const uid of ids){const c=webs(s,pid).find(c=>String(c.uid)===String(uid));need(c&&c.state.resources>=c.cost,'蛛网费用必须由该英雄支付，每张2资源');}}
 function propose(s,pid,ids){check(s,'ready');valid(s,pid,ids);x(s).payPlans[pid]=[...ids];x(s).approvals=[];if(alive(s).length===1){log(s,'单人模式自动确认刷新方案');approve(s,pid);}}
 function approve(s,pid){check(s,'ready');need(alive(s).some(p=>p.id===pid)&&!x(s).approvals.includes(pid),'无效或重复确认');for(const p of alive(s))valid(s,p.id,x(s).payPlans[p.id]||[]);x(s).approvals.push(pid);if(!settled(s))return;
  const oldFirst=s.first;
  for(const c of R.chars(s)){const cost=webs(s,c.controller).find(h=>h.uid===c.uid)?.cost||0;if(cost){if((x(s).payPlans[c.controller]||[]).some(uid=>String(uid)===String(c.uid))){c.state.resources-=cost;c.state.exhausted=false;}}else c.state.exhausted=false;c.state.committed=false;}
  for(const c of [...R.attaches(s),...R.enemies(s),...R.locations(s)])c.state.exhausted=false;
  x(s).frameworkDone=true;const amount=s.active?.id===114?2:1;for(const p of [...alive(s)])R.changeThreat(s,p.id,amount);
  if(s.status!=='playing')return;
  for(let i=1;i<=s.players.length;i++){const pid=(oldFirst+i)%s.players.length;if(!s.players[pid].eliminated){s.first=pid;break;}}
  x(s).order=order(s);x(s).index=x(s).order.length;x(s).step='action';x(s).finalPasses=[];log(s,'重置和威胁已结算；起始玩家为'+s.players[s.first].name+'，开放行动窗口');
 }
 function unapprove(s,pid){check(s,'ready');need(x(s).approvals.includes(pid),'尚未确认');x(s).approvals=x(s).approvals.filter(id=>id!==pid);}
 function finish(s){check(s,'action');need(!x(s).plannedActions?.length&&!x(s).actionLocked,'请先处理暂定行动');R.finish(s);}
 function effects(s){return [...R.chars(s).filter(c=>c.kind==='ally'&&c.meta.code==='01073').map(c=>({kind:'gandalf',uid:c.uid,label:'弃掉甘道夫'})),...s.objectives.filter(o=>[109,110].includes(o.id)&&o.holder).map(o=>({kind:o.id===109?'torch':'key',uid:o.uid,player:o.holder.player,hero:s.players[o.holder.player].heroStates[o.holder.hero].uid,label:o.name+(o.id===109?'：威胁+2':'：英雄受1伤害')}))];}
 function apply(s,e){if(e.kind==='gandalf'){if(R.find(s,e.uid)?.kind==='ally')R.leaveAlly(s,e.uid,'playerDiscard',false);}else if(!s.players[e.player].eliminated){if(e.kind==='torch')R.changeThreat(s,e.player,2);else{const c=R.find(s,e.hero);if(c)R.damageCharacter(s,c,1);}}log(s,e.label);R.pump(s);}
 function spec(s){const a=x(s);if(s.phase!==6||a?.step!=='roundEnd'||a.queue.length||a.roundEffects?.length<2)return null;return {message:s.players[s.first].name+'选择下一个回合结束效果',options:a.roundEffects.map((e,i)=>({value:String(i),label:e.label}))};}
 function choose(s,index){check(s,'roundEnd');need(spec(s)&&Number.isInteger(index)&&x(s).roundEffects[index],'请选择合法回合结束效果');const e=x(s).roundEffects.splice(index,1)[0];apply(s,e);resume(s);}
 function resume(s){const a=x(s);if(s.phase!==6||!a||a.running||a.completed||a.queue.length||s.pending.length||s.status!=='playing')return;a.running=true;try{Q.resumeActions(s);if(a.step!=='roundEnd'||a.queue.length)return;if(!a.roundEffects)a.roundEffects=effects(s);if(a.roundEffects.length===1)apply(s,a.roundEffects.shift());if(!a.roundEffects.length&&!a.queue.length&&s.status==='playing'){a.completed=true;a.step='completed';s.roundsCompleted=(s.roundsCompleted||0)+1;log(s,'回合结束效果已完成，可进入下一回合资源阶段');}}finally{a.running=false;}}
 function nextRound(s){need(s.phase===6&&x(s)?.round===s.round&&x(s).completed&&!x(s).advanced&&s.status==='playing','请先完成刷新和回合结束效果');x(s).advanced=true;s.round++;s.phase=0;s.abilityUses={};s.phaseModifiers=[];s.phasePermissions=[];log(s,'进入新回合资源阶段，尚未收集资源或抽牌');}
 return {start,webs,propose,approve,unapprove,finish,spec,choose,resume,nextRound};
};
if(typeof module!=='undefined')module.exports=RefreshRulesFactory;
