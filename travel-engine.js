/* Core travel framework. Travel decision is made by the first player; consensus is a UI buffer. */
const TravelRulesFactory=(H,R,Q)=>{
 const need=(v,m)=>{if(!v)throw Error(m);},same=(a,b)=>String(a)===String(b),live=s=>s.players.filter(p=>!p.eliminated),t=s=>s.traveling;
 const spirit=(s,c)=>c.meta.sphere==='spirit'||c.kind==='hero'&&R.icons(s,c).includes('spirit');
 const log=(s,m)=>H.log(s,'旅行 · '+m),opt=(v,label)=>({value:String(v),label}),f=(key,label,options)=>({key,label,options});
 function check(s){need(s.phase===3&&t(s)?.round===s.round&&!t(s).completed&&s.status==='playing','当前没有进行中的旅行阶段');need(!s.pending.length&&!t(s).queue.length,'请先结算剧本事项或卡牌响应');}
 function start(s){need(s.phase===3&&s.questing?.completed,'须先完成第三阶段');need(s.traveling?.round!==s.round,'本回合旅行阶段已初始化');const order=live(s).map(p=>p.id).sort((a,b)=>(a-s.first+s.players.length)%s.players.length-(b-s.first+s.players.length)%s.players.length);s.traveling={round:s.round,step:'choice',order,index:order.length,finalPasses:[],queue:[],tasks:[],remaining:[],encounterModifiers:[],discussion:true,approvals:[],proposal:null,completed:false,closing:false,revealed:0,traveled:false};log(s,'开始，先由起始玩家决定旅行地点；普通行动窗口在旅行步骤之后');}
 function spec(s,uid){let out={legal:false,fields:[],reason:''};try{check(s);need(t(s).step==='choice'&&!t(s).traveled,'本次旅行步骤已经结束');if(uid===null||uid==='skip'){need(s.active||!s.staging.some(c=>c.id===88),'东湾强制旅行，不能跳过');out.legal=true;return out;}
  need(!s.active,'已有当前地点，不能再次旅行');const c=s.staging.find(c=>same(c.uid,uid)&&c.type==='Location');need(c,'地点已不在探查区');need(!s.staging.some(c=>c.id===88)||c.id===88,'必须优先旅行至东湾');out.card=c;
  if(c.id===77)for(const p of live(s)){const hs=R.chars(s).filter(c=>c.controller===p.id&&c.kind==='hero'&&!c.state.exhausted);need(hs.length,p.name+'没有可横置的英雄，无法支付旅行费用');out.fields.push(f('hero'+p.id,p.name+'横置1名英雄',hs.map(c=>opt(c.uid,c.meta.nameZh))));}
  if(c.id===94)need(s.players[s.first].hand.length>=2,'起始玩家手牌不足2张，不能支付随机弃牌费用');
  if(c.id===78)need(s.deck.length,'遭遇牌库为空，不能支付翻开1张牌的旅行费用');out.legal=true;
 }catch(e){out.reason=e.message;}return out;}
 function validate(s,uid,params){const sp=spec(s,uid);need(sp.legal,sp.reason);for(const field of sp.fields)need(field.options.some(o=>same(o.value,params[field.key])),'请选择合法的旅行费用：'+field.label);return sp;}
 function propose(s,pid,uid,params={}){check(s);need(pid===s.first,'旅行地点由起始玩家决定');validate(s,uid,params);t(s).proposal={uid:uid===null||uid==='skip'?null:Number(uid),params:JSON.parse(JSON.stringify(params))};t(s).approvals=[];log(s,'暂定'+(uid===null||uid==='skip'?'不旅行':'旅行至所选地点')+'，费用尚未支付');}
 function cancel(s,pid){check(s);need(t(s).step==='choice'&&pid===s.first,'只能由起始玩家在执行前修改旅行选择');t(s).proposal=null;t(s).approvals=[];}
 function unapprove(s,pid){check(s);need(t(s).step==='choice'&&t(s).order.includes(pid),'旅行已经执行');t(s).approvals=t(s).approvals.filter(id=>id!==pid);}
 function approve(s,pid){check(s);const x=t(s);need(x.step==='choice'&&x.proposal&&x.order.includes(pid),'请先暂定旅行选择');need(!x.approvals.includes(pid),'已二次确认');validate(s,x.proposal.uid,x.proposal.params);x.approvals.push(pid);if(live(s).every(p=>x.approvals.includes(p.id)))execute(s);}
 function execute(s){const x=t(s),{uid,params}=x.proposal,sp=validate(s,uid,params);if(uid===null){x.step='action';log(s,'确认不旅行，开放旅行后行动窗口');return;}
  x.target=uid;x.step='cost';const c=sp.card;
  if(c.id===77)for(const p of live(s))R.find(s,params['hero'+p.id]).state.exhausted=true;
  if(c.id===94){const p=s.players[s.first];for(let i=0;i<2;i++){const at=Math.floor(H.rng(s)*p.hand.length),card=p.hand.splice(at,1)[0];s.players[card.owner].playerDiscard.push(card);}log(s,'起始玩家已随机弃掉2张手牌，费用只支付一次');}
  if(c.id===78){x.step='staging';x.returnStep='paid';x.remaining=[{}];log(s,'先逐张结算旅行费用的遭遇翻牌，再成为当前地点');return;}
  arrive(s);
 }
 function arrive(s){const x=t(s);if(s.status!=='playing')return;need(!s.active,'支付费用后出现了其他当前地点，停止旅行');const at=s.staging.findIndex(c=>c.uid===x.target);need(at>=0,'旅行目标已离场');const c=s.staging.splice(at,1)[0];s.active=c;c.progress??=0;x.traveled=true;x.step='responses';log(s,'旅行至「'+c.name+'」，保留原有'+c.progress+'点进度');
  // Forced effects precede all optional after-travelling responses (FAQ 1.09).
  if(c.id===87)R.locationProgress(s,c.uid,1);
  if(c.id===107)for(const p of live(s)){const card=p.playerDeck.shift();if(card){p.engaged.push({id:0,uid:card.uid,name:'兽人守卫',type:'Enemy',threat:0,attack:1,defense:1,health:1,synthetic:true,playerCard:card});log(s,p.name+'牌库顶牌背面成为兽人守卫（无特性）');}}
  x.tasks.push({id:++s.serial,kind:'travelResponses',actor:s.first,payload:{uid:c.uid,location:c.id,used:[]},optional:true});resume(s);
 }
 function options(s,task){const d=task.payload,a=[],cs=R.chars(s);if(R.find(s,d.uid)&&d.location===99&&!d.used.includes('road')&&cs.some(c=>c.controller===s.first&&c.state.exhausted))a.push(opt('road','古老森林道路：起始玩家重置1名己方角色'));
  if(R.find(s,d.uid)&&d.location===100&&!d.used.includes('gate')&&s.players[s.first].playerDeck.length)a.push(opt('gate','森林大门：起始玩家抽2张牌'));
  if(R.find(s,d.uid)?.kind==='location')for(const p of live(s))for(const card of p.hand)if(card.code==='01047'&&!d.used.includes(String(card.uid))&&cs.some(c=>c.controller===p.id&&spirit(s,c)&&!c.state.exhausted)){try{R.payment(s,p.id,'spirit',0);a.push(opt(card.uid,p.name+' · 意志之力：横置精神角色，向该地点放置2进度'));}catch{}}
  return a;
 }
 function responseSpec(s,params={}){const task=t(s).tasks[0];if(task?.kind!=='travelResponses')return null;const choices=options(s,task),mode=String(params.response??choices[0]?.value);let fields=[f('response','旅行响应（由起始玩家决定次序）',choices)];const cs=R.chars(s);if(mode==='road')fields.push(f('target','重置的己方角色',cs.filter(c=>c.controller===s.first&&c.state.exhausted).map(c=>opt(c.uid,c.meta.nameZh))));else if(mode!=='gate'&&choices.some(o=>o.value===mode)){const p=live(s).find(p=>p.hand.some(c=>same(c.uid,mode)));fields.push(f('target','支付横置费用的己方精神角色',cs.filter(c=>c.controller===p.id&&spirit(s,c)&&!c.state.exhausted).map(c=>opt(c.uid,c.meta.nameZh))));}
  return {task,message:'旅行后的可选响应；强制效果已先执行。可以选择响应或关闭窗口。',fields};
 }
 function respond(s,id,params={}){check(s);const sp=responseSpec(s,params);need(sp&&same(sp.task.id,id),'旅行响应已过期');if(params.skip){t(s).tasks.shift();resume(s);return;}for(const f of sp.fields)need(f.options.some(o=>same(o.value,params[f.key])),'请选择合法旅行响应与目标');const mode=String(params.response),task=sp.task;
  if(mode==='road')R.find(s,params.target).state.exhausted=false;else if(mode==='gate')R.draw(s,s.first,2);else{const p=live(s).find(p=>p.hand.some(c=>same(c.uid,mode))),at=p.hand.findIndex(c=>same(c.uid,mode));R.payment(s,p.id,'spirit',0);R.find(s,params.target).state.exhausted=true;p.playerDiscard.push(p.hand.splice(at,1)[0]);R.locationProgress(s,task.payload.uid,2);}
  task.payload.used.push(mode);log(s,'已执行旅行响应：'+mode);R.pump(s);resume(s);
 }
 function resume(s){const x=t(s);if(s.phase!==3||!x||x.completed||x.queue.length||s.pending.length||s.status!=='playing')return;if(x.step==='paid'&&!x.current&&!x.tasks.length)arrive(s);
  if(x.step==='responses'){while(x.tasks[0]?.kind==='travelResponses'&&!options(s,x.tasks[0]).length)x.tasks.shift();if(!x.tasks.length){x.step='action';x.finalPasses=[];log(s,'旅行响应结束，开放玩家行动窗口');}}
  Q.resumeActions(s);
 }
 function finish(s){check(s);const x=t(s);need(x.step==='action'&&!x.tasks.length&&!x.current,'请先完成旅行及响应');need(!x.plannedActions?.length&&!x.actionLocked,'请先处理暂定行动');R.finish(s);}
 function draw(s){Q.drawNext(s);resume(s);}function reveal(s){Q.resolveReveal(s);resume(s);}function choose(s,id,a){Q.choose(s,id,a);resume(s);}
 return {start,spec,propose,cancel,approve,unapprove,responseSpec,respond,resume,finish,draw,reveal,choose};
};
if(typeof module!=='undefined')module.exports=TravelRulesFactory;
