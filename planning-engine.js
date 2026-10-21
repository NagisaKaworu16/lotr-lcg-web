/* Phase 2 rules only. Text is never parsed to execute abilities. */
const PlanningRulesFactory=(H)=>{
 const S=typeof RINGSDB_SNAPSHOT!=='undefined'?RINGSDB_SNAPSHOT:require('./ringsdb-snapshot.js');
 const BASE=Object.fromEntries(S.cards.map(c=>[c.code,c]));
 const clone=x=>JSON.parse(JSON.stringify(x)),need=(v,m)=>{if(!v)throw Error(m);};
 const num=x=>Number(x),same=(a,b)=>String(a)===String(b);
 const context=s=>s.phase===6?s.refreshing:s.phase===5?s.combat:s.phase===4?s.encountering:s.phase===3?s.traveling:s.phase===2?s.questing:s.planning;
 const log=(s,t)=>H.log(s,(s.phase===5?'战斗':s.phase===4?'遭遇':s.phase===3?'旅行':s.phase===2?'探险':'计划')+' · '+t);
 const alive=s=>s.players.filter(p=>!p.eliminated);
 function data(s,x){const p=s.players[x.owner??x.controller];return p?.heroCards?.find(c=>c.code===x.code)||p?.registeredDeck?.cards?.find(c=>c.code===x.code)||BASE[x.code];}
 function captured(s,p,index){return !s.rescued&&s.prisoner?.player===p&&s.prisoner?.hero===index;}
 function chars(s){const a=[];for(const p of alive(s)){for(const h of p.heroStates||[])if(!h.destroyed&&!captured(s,p.id,h.index))a.push({kind:'hero',uid:h.uid,controller:p.id,owner:p.id,state:h,meta:data(s,{...h,owner:p.id})});for(const c of p.allies||[])a.push({kind:'ally',uid:c.uid,controller:p.id,owner:c.owner,state:c,meta:data(s,c)});}return a;}
 function attaches(s){return alive(s).flatMap(p=>(p.attachments||[]).map(c=>({kind:'attachment',uid:c.uid,controller:p.id,owner:c.owner,state:c,meta:data(s,c)})));}
 function enemies(s){return [...s.staging,...alive(s).flatMap(p=>p.engaged),...(s.phase===5?s.combat?.riders||[]:[])].filter(c=>c.type==='Enemy').map(c=>({kind:'enemy',uid:c.uid,state:c,meta:c}));}
 function locations(s){return [...s.staging,...(s.active?[s.active]:[])].filter(c=>c.type==='Location').map(c=>({kind:'location',uid:c.uid,state:c,meta:c}));}
 const find=(s,uid)=>[...chars(s),...attaches(s),...enemies(s),...locations(s)].find(c=>same(c.uid,uid));
 function attached(s,uid){return attaches(s).filter(c=>same(c.state.target,uid));}
 function traits(s,c){let t=c.meta.traits||'';if(attached(s,c.uid).some(a=>a.meta.code==='01026'))t+=' Gondor.';return t;}
 function stats(s,uid){const c=find(s,uid);need(c,'目标已不在场');let v={willpower:c.meta.willpower??0,attack:c.meta.attack??0,defense:c.meta.defense??0,health:c.meta.health??0,threat:c.meta.threat??0};if(c.kind==='enemy'&&c.state.id===90)v.attack+=2*(c.state.resources||0);if(c.kind==='enemy'&&c.state.forestSpiderRound===s.round)v.attack+=c.state.forestSpiderBonus??1;if(c.meta.code==='01004')v.attack+=c.state.damage||0;
  for(const a of attached(s,uid))switch(a.meta.code){case'01027':v.willpower+=2;break;case'01040':v.health+=4;break;case'01041':v.attack+=traits(s,c).includes('Dwarf.')?2:1;break;case'01055':v.willpower++;break;case'01056':v.threat--;break;case'01071':v.willpower--;break;}
  for(const m of s.phaseModifiers||[])if(m.round===s.round&&m.phase===s.phase&&m.targets.includes(c.uid))v[m.stat]+=m.amount;
  if([2,3,4,5,6].includes(s.phase))for(const m of context(s)?.encounterModifiers||[]){const inStage=s.staging.some(x=>x.uid===c.uid);if(m.kind==='committed'&&c.state.committed||m.kind==='staging'&&inStage||m.kind==='stagingLocations'&&inStage&&c.kind==='location')v[m.stat]+=m.amount;}
  if([2,3,4,5,6].includes(s.phase)&&context(s)?.ignoredThreat?.includes(c.uid))v.threat=0;
  // 甘道夫的地图：持有英雄不能攻击或防御（用不可枚举属性标记，避免污染数值对象与序列化）
  if(c.kind==='hero'&&objectiveOn(s,uid)?.id===108){v.attack=0;v.defense=0;Object.defineProperty(v,'noCombat',{value:true,enumerable:false});}
  return v;
 }
 function icons(s,h){const a=[h.meta.sphere];if(h.meta.code==='01001'&&attached(s,h.uid).some(a=>a.meta.code==='01027'))a.push('spirit');return a;}
 function objectiveOn(s,target){const c=find(s,target);if(!c||c.kind!=='hero')return null;return (s.objectives||[]).find(o=>o.holder&&o.holder.player===c.controller&&o.holder.hero===c.state.index)||null;}
 function label(s,c){return (c.meta.nameZh||c.meta.name)+(c.controller!==undefined?' · '+s.players[c.controller].name:'')+' #'+c.uid;}
 const opt=(value,label)=>({value:String(value),label});
 function field(key,label,options){return {key,label,options};}
 const fieldsForTargets=(s,key,label,items)=>field(key,label,items.map(c=>opt(c.uid,labelFn(s,c))));
 const labelFn=(s,c)=>label(s,c);
 // Explicit Core timing manifest. Unknown events fail closed; never infer permission from effect text.
 const EVENT_TIMING=Object.freeze(Object.fromEntries([
  ...['01020','01021','01022','01023','01025','01032','01033','01035','01036','01038','01046','01049','01051','01052','01053','01054','01063','01064','01067','01068'].map(code=>[code,Object.freeze({kind:'action',label:'行动：任意玩家行动窗口'})]),
  ['01034',Object.freeze({kind:'action',phase:5,label:'战斗行动：仅战斗阶段行动窗口'})],
  ...['01065','01066'].map(code=>[code,Object.freeze({kind:'action',phase:2,label:'探险行动：仅探险阶段行动窗口'})]),
  ...[['01024','allyLeaves','盟友离场后'],['01037','defenderDeclared','声明防御者后'],['01047','travelled','旅行到地点后'],['01048','shadowEffect','暗影效果刚触发时（取消）'],['01050','whenRevealed','翻开效果刚触发时（取消）']].map(([code,trigger,label])=>[code,Object.freeze({kind:'response',trigger,label:'响应：'+label})])
 ]));
 function eventTiming(code){return EVENT_TIMING[code]||null;}
 function window(s){const pl=context(s);
  if(s.status!=='playing'||s.setupPending||![1,2,3,4,5,6].includes(s.phase)||pl?.round!==s.round||pl.completed)return {kind:'closed',label:'未开放的执行窗口'};
  if(s.pending.length)return {kind:'framework',label:'剧本强制事项结算中'};
  const t=pl.queue[0];if(t)return {kind:'resolution',taskId:t.id,trigger:t.kind==='leaveResponses'&&t.payload.kind==='ally'?'allyLeaves':null,label:'响应／效果结算中：不能插入普通行动'};
  if([2,3,4,5,6].includes(s.phase)&&pl.tasks?.length)return {kind:'framework',label:'探险响应／强制选择中'};
  if(s.phase===2&&!['beforeCommit','afterCommit','afterStaging','afterResult'].includes(pl.step))return {kind:'framework',label:'探险步骤／遭遇结算中'};
  if(s.phase===6&&pl.step!=='action')return {kind:'framework',label:'刷新框架／回合结束效果结算中'};
  if(s.phase===5&&!['enemyAction','beforeDefend','beforeShadows','beforeDamage','afterEnemy','playerAction','playerStrength','playerDamage','afterPlayer','endAction'].includes(pl.step))return {kind:'framework',label:'战斗框架／暗影／响应结算中'};
  if(s.phase===4&&!['beforeChecks','afterChecks'].includes(pl.step))return {kind:'framework',label:'交战选择／检定／强制效果结算中'};
  if(s.phase===3&&pl.step!=='action')return {kind:'framework',label:'旅行费用／旅行响应结算中'};
  if(pl.closing)return {kind:'framework',label:'阶段结束效果结算中'};
  return {kind:'action',phase:s.phase,label:(s.phase===5?'战斗阶段':s.phase===4?'遭遇阶段':s.phase===3?'旅行阶段':s.phase===2?'探险阶段':'计划阶段')+' · 玩家行动窗口'};
 }
 function requireEventWindow(s,code,responseTask){const timing=eventTiming(code);need(timing,'此事件尚未登记合法执行窗口');const w=window(s);
  if(timing.kind==='response'){need(responseTask&&context(s).queue[0]===responseTask&&w.taskId===responseTask.id&&w.trigger===timing.trigger,'当前没有该响应牌所要求的触发窗口：'+timing.label);return timing;}
  need(w.kind==='action','当前不是玩家行动窗口，不能插入行动事件');
  need(timing.phase===undefined||timing.phase===s.phase,timing.label+'，计划阶段不能使用');return timing;
 }
 function start(s){if(!s.players.every(p=>p.heroStates))return;s.planning={round:s.round,order:alive(s).map(p=>p.id).sort((a,b)=>(a-s.first+s.players.length)%s.players.length-(b-s.first+s.players.length)%s.players.length),index:0,finalPasses:[],queue:[],closing:false,completed:false};log(s,'开始；由起始玩家依次打出盟友和附属');}
 function plan(s){need([1,2,3,4,5,6].includes(s.phase)&&!s.setupPending&&s.status==='playing','当前不是计划或探险阶段');need(context(s)?.round===s.round,'请按阶段正常进入');need(!context(s).completed,'本阶段已结算完成');return context(s);}
 function free(s){const p=plan(s);need(!p.actionLocked||p.executingAction,'正在执行全员确认的行动');need(!p.halted,p.halted);need(!p.closing,'正在结算计划阶段结束效果');need(!s.pending.length,'请先处理剧本待结算事项');need(!p.queue.length,'请先完成响应或强制选择');if([2,3,4,5,6].includes(s.phase))need(window(s).kind==='action','当前不是玩家行动窗口');return p;}
 function active(s){return context(s)?.order[context(s).index]??null;}
 function touch(s){context(s).finalPasses=[];if([2,3,4,5,6].includes(s.phase)&&!context(s).executingAction){context(s).actionApprovals=[];context(s).deploymentApprovals=[];}}
 function useLimit(s,key){s.abilityUses??={};need(!s.abilityUses[key],'本轮／阶段使用次数已达上限');s.abilityUses[key]=true;}
 function used(s,key){return !!s.abilityUses?.[key];}
 function modifier(s,targets,stat,amount){s.phaseModifiers??=[];s.phaseModifiers.push({round:s.round,phase:s.phase,targets:[...targets],stat,amount});}
 function queue(s,kind,actor,payload={},optional=true){context(s).queue.push({id:++s.serial,kind,actor,payload,optional});}
 function unique(s,m){if(!m.isUnique)return true;return ![...chars(s),...attaches(s)].some(c=>c.meta.name===m.name);}
 function pools(s,pid,sphere){return chars(s).filter(c=>c.kind==='hero'&&c.controller===pid).map(c=>({uid:c.uid,name:c.meta.nameZh,resources:c.state.resources,eligible:sphere==='neutral'||icons(s,c).includes(sphere),icons:icons(s,c)}));}
 function payment(s,pid,sphere,cost,allocation,three=false){need(Number.isInteger(cost)&&cost>=0,'费用必须是非负整数');const ps=pools(s,pid,sphere);need(sphere==='neutral'||ps.some(p=>p.eligible),'没有匹配领域的可用英雄（0费用也需要资源匹配）');let pay={};
  if(allocation!==undefined){need(allocation&&typeof allocation==='object'&&!Array.isArray(allocation),'无效支付方案');for(const [id,n] of Object.entries(allocation)){need(Number.isInteger(n)&&n>=0,'支付数量须为非负整数');let p=ps.find(p=>same(p.uid,id));need(p&&p.eligible&&n<=p.resources,'不能使用其他玩家、不匹配领域或不足的资源');if(n)pay[id]=n;}need(Object.values(pay).reduce((a,b)=>a+b,0)===cost,'支付合计与费用不符');}
  else{let left=cost;for(const p of ps.filter(p=>p.eligible)){const n=three?Math.min(left,p.resources,1):Math.min(left,p.resources);if(n)pay[p.uid]=n;left-=n;}need(left===0,'匹配领域的资源不足');}
  if(three)need(Object.keys(pay).length===3&&Object.values(pay).every(n=>n===1),'此牌必须从3名不同英雄各支付1资源');return {pools:ps,pay,cost,sphere};
 }
 function spend(s,pay){for(const [uid,n] of Object.entries(pay)){const h=find(s,uid);h.state.resources-=n;}}
 function readyTarget(c){return !c.state.exhausted;}
 function chosen(fields,params){for(const f of fields){need(f.options.length,`没有合法目标：${f.label}`);need(params[f.key]!==undefined&&f.options.some(o=>same(o.value,params[f.key])),`请选择合法的${f.label}`);}}
 function sourceHand(s,pid,uid){const p=s.players[pid];need(p&&!p.eliminated&&p.hand,'无效玩家');const x=p.hand.find(c=>same(c.uid,uid));need(x,'卡牌不在该玩家手牌中');return {p,x,m:data(s,x)};}
 function handItem(s,uid){for(const p of alive(s)){const x=p.hand?.find(c=>same(c.uid,uid));if(x)return {p,x,m:data(s,x)};}return null;}
 function conditions(s){return [...attaches(s).filter(a=>traits(s,a).includes('Condition.')).map(a=>({uid:a.uid,label:label(s,a),kind:'player'})),...s.conditions.filter(c=>[80,105].includes(c.id)).map(c=>({uid:c.uid,label:c.name,kind:'encounter'}))];}
 function attachmentTargets(s,m){if(m.code==='01056')return locations(s);if(m.code==='01069')return enemies(s).filter(e=>e.state.id!==102&&alive(s).some(p=>p.engaged.some(c=>c.uid===e.uid)));if(m.code==='01072')return chars(s);return chars(s).filter(c=>c.kind==='hero');}
 const restricted=a=>['01027','01039','01040','01041','01042'].includes(a.meta?.code);
 function restrictedOn(s,target){const c=find(s,target);return [...attached(s,target).filter(restricted).map(c=>({kind:'player',uid:c.uid,label:label(s,c)})),...(c?.kind==='hero'?s.objectives.filter(o=>o.holder?.player===c.controller&&o.holder?.hero===c.state.index).map(o=>({kind:'objective',uid:o.uid,label:o.name})):[])];}
 function eligibleAttackEnemies(s,attacker){const own=s.players[attacker.controller].engaged.map(c=>c.uid);const ranged=attacker.meta.rulesText?.includes('Ranged.');return enemies(s).filter(e=>own.includes(e.uid)||(ranged&&alive(s).some(p=>p.engaged.some(c=>c.uid===e.uid)))||(attacker.meta.code==='01009'&&s.staging.some(c=>c.uid===e.uid)));}
 function actionFields(s,pid,code,params={}){
  const cs=chars(s),ps=alive(s),own=cs.filter(c=>c.controller===pid),players=items=>items.map(p=>opt(p.id,p.name));let f=[];
  switch(code){
   case'01020':f=[fieldsForTargets(s,'target','已横置盟友',cs.filter(c=>c.kind==='ally'&&c.state.exhausted))];break;
   case'01021':{const hs=own.filter(c=>c.kind==='hero'&&readyTarget(c));f=[fieldsForTargets(s,'exhaust','作为费用横置的己方英雄',hs)];const uid=params.exhaust??hs[0]?.uid;f.push(fieldsForTargets(s,'target','另一名已横置英雄',cs.filter(c=>c.kind==='hero'&&c.state.exhausted&&!same(c.uid,uid))));break;}
   case'01023':f=[field('ally','放入场中的己方手牌盟友',s.players[pid].hand.filter(c=>data(s,c).type==='ally'&&unique(s,data(s,c))).map(c=>opt(c.uid,data(s,c).nameZh)))];break;
   case'01032':f=[fieldsForTargets(s,'target','角色',cs)];break;
   case'01033':f=[fieldsForTargets(s,'exhaust','作为费用横置的远程角色',own.filter(c=>readyTarget(c)&&c.meta.rulesText?.includes('Ranged.'))),field('player','交战敌人受伤的玩家',players(ps.filter(p=>p.engaged.length)))];break;
   case'01035':{const as=own.filter(c=>readyTarget(c)&&eligibleAttackEnemies(s,c).length);f=[fieldsForTargets(s,'attacker','独自攻击的己方角色',as)];const a=find(s,params.attacker??as[0]?.uid);f.push(fieldsForTargets(s,'target','合法攻击目标',a?eligibleAttackEnemies(s,a):[]));break;}
   case'01036':case'01038':f=[field('player','玩家',players(ps))];break;
   case'01046':f=[field('mode','降低威胁方式',[opt('one','一名玩家降低6'),opt('all','每位玩家降低2')])];if((params.mode||'one')==='one')f.push(field('player','玩家',players(ps)));break;
   case'01049':f=[field('player','洗回弃牌的玩家',players(ps.filter(p=>p.playerDiscard?.length)))];break;
   case'01051':f=[field('ally','弃牌堆中的非中立盟友',ps.flatMap(p=>(p.playerDiscard||[]).filter(c=>{const m=data(s,c);return m.type==='ally'&&m.sphere!=='neutral'&&Number.isInteger(m.cost)&&unique(s,m);}).map(c=>opt(c.uid,data(s,c).nameZh+' · '+p.name+'弃牌 · 费用'+data(s,c).cost))))];break;
   case'01034':f=[fieldsForTargets(s,'target','本阶段不能攻击的已交战敌人',enemies(s).filter(c=>ps.some(p=>p.engaged.some(e=>e.uid===c.uid))))];break;
   case'01052':f=[fieldsForTargets(s,'target','已交战敌人',enemies(s).filter(c=>ps.some(p=>p.engaged.some(x=>x.uid===c.uid))))];break;
   case'01053':f=[field('card','己方精神领域弃牌',s.players[pid].playerDiscard.filter(c=>data(s,c).sphere==='spirit').map(c=>opt(c.uid,data(s,c).nameZh)))];break;
   case'01054':f=[field('hero','已阵亡英雄',ps.flatMap(p=>(p.heroStates||[]).filter(h=>h.destroyed&&unique(s,data(s,{...h,owner:p.id}))).map(h=>opt(h.uid,p.name+' · '+data(s,{...h,owner:p.id}).nameZh))))];break;
   case'01063':f=[fieldsForTargets(s,'target','受伤角色',cs.filter(c=>c.state.damage>0))];break;
   case'01064':f=[field('player','抽3张牌的玩家',players(ps.filter(p=>p.playerDeck?.length)))];break;
   case'01067':{const max=pools(s,pid,'lore').filter(p=>p.eligible).reduce((n,p)=>n+p.resources,0);f=[field('x','查看张数X',Array.from({length:max},(_,i)=>opt(i+1,String(i+1)))),field('player','被查看牌库的玩家',players(ps.filter(p=>p.playerDeck?.length)))];break;}
   case'01068':f=[field('player','受伤英雄的玩家',players(ps.filter(p=>cs.some(c=>c.kind==='hero'&&c.controller===p.id&&c.state.damage>0))))];break;
   case'01065':case'01066':f=[fieldsForTargets(s,'target',code==='01065'?'探查区敌人':'探查区地点',(code==='01065'?enemies(s):locations(s)).filter(c=>s.staging.some(x=>x.uid===c.uid)))];break;
   case'01022':case'01025':break;
   default:throw Error(['01034'].includes(code)?'此牌是战斗行动，计划阶段不能使用': ['01065','01066'].includes(code)?'此牌是探险行动，计划阶段不能使用':'当前没有该响应牌所要求的触发窗口');
  }return f;
 }
 function playSpec(s,pid,uid,params={}){let r={legal:false,fields:[],reason:''};try{const pl=free(s),{p,x,m}=sourceHand(s,pid,uid);r.meta=m;r.instance=x;if(m.type!=='event'){need(s.phase===1,'盟友和附属仅可在计划阶段正常打出');need(active(s)===pid,'仅当前计划玩家可以从手牌打出盟友或附属');need(unique(s,m),'场上已有同名独特牌');if(m.type==='ally'&&[123,124].includes(s.quest))need(s.alliesPlayed?.round!==s.round||s.alliesPlayed.count<1,'此剧本前两阶段全队每回合最多打出1名盟友');if(m.type==='attachment')r.fields=[fieldsForTargets(s,'target','附着目标',attachmentTargets(s,m))];}
   else {r.timing=requireEventWindow(s,m.code);r.fields=actionFields(s,pid,m.code,params);}
   need(r.fields.every(f=>f.options.length),'没有符合此牌条件的合法目标');
   let cost=m.cost;if(m.code==='01051'){const f=r.fields[0],value=params.ally??f.options[0]?.value;const c=alive(s).flatMap(p=>p.playerDiscard).find(c=>same(c.uid,value));cost=c?data(s,c).cost:null;}if(m.code==='01067')cost=num(params.x??r.fields.find(f=>f.key==='x').options[0]?.value);
   r.payment=payment(s,pid,m.sphere,cost,undefined,m.code==='01036');r.cost=cost;r.legal=true;
  }catch(e){r.reason=e.message;}return r;}
 function checkedPlay(s,pid,uid,params){const r=playSpec(s,pid,uid,params);need(r.legal,r.reason);chosen(r.fields,params);r.payment=payment(s,pid,r.meta.sphere,r.cost,params.payment,r.meta.code==='01036');return r;}
 function removeFrom(a,uid){const i=a.findIndex(c=>same(c.uid,uid));need(i>=0,'牌张已经离开原区域');return a.splice(i,1)[0];}
 function draw(s,pid,n){const p=s.players[pid];const k=H.drawPlayer(s,p,n);log(s,`${p.name}抽${k}张牌`);}
 function ownerZone(s,x,name){return s.players[x.owner][name];}
 function putAlly(s,pid,x,played=false){const p=s.players[pid];const m=data(s,x);need(unique(s,m),'同名独特角色已在场');x.controller=pid;x.exhausted=false;x.damage=0;x.committed=false;p.allies.push(x);if(played)s.alliesPlayed=s.alliesPlayed?.round===s.round?{round:s.round,count:s.alliesPlayed.count+1}:{round:s.round,count:1};log(s,`${p.name}${played?'打出':'放入'}盟友「${m.nameZh}」，以重置状态入场`);if(['01015','01016','01018','01061','01073'].includes(m.code)||(m.code==='01059'&&played))queue(s,'entry',pid,{uid:x.uid,code:m.code});}
 function play(s,pid,uid,params={}){need(![2,3,4,5,6].includes(s.phase)||!context(s)?.discussion||context(s).executingAction,'请先暂定事件并由全员二次确认');const r=checkedPlay(s,pid,uid,params),{meta:m,instance:x}=r;spend(s,r.payment.pay);removeFrom(s.players[pid].hand,uid);touch(s);log(s,`${s.players[pid].name}支付${r.cost}资源：${Object.entries(r.payment.pay).map(([id,n])=>find(s,id).meta.nameZh+'−'+n).join('、')||'0费用'}`);
  if(m.type==='ally')putAlly(s,pid,x,true);else if(m.type==='attachment'){x.controller=pid;x.target=num(params.target);x.exhausted=false;s.players[pid].attachments.push(x);log(s,`附加「${m.nameZh}」至${label(s,find(s,x.target))}`);if(restrictedOn(s,x.target).length>2)queue(s,'restricted',pid,{target:x.target},false);}
  else{applyEvent(s,pid,x,params);if(m.code==='01049')ownerZone(s,x,'playerRemoved').push(x);else ownerZone(s,x,'playerDiscard').push(x);}
  pump(s);return x;
 }
 function engageEnemy(s,uid,pid){const p=s.players[pid],c=find(s,uid);need(p&&!p.eliminated&&c?.kind==='enemy','交战目标或玩家已失效');const old=alive(s).find(p=>p.engaged.some(e=>same(e.uid,uid)));need(old?.id!==pid,'该敌人已与你交战');if(old)removeFrom(old.engaged,uid);else removeFrom(s.staging,uid);p.engaged.push(c.state);if(c.state.id===75)queue(s,'hummer',pid,{},false);if(c.state.id===96){c.state.forestSpiderBonus=(c.state.forestSpiderRound===s.round?(c.state.forestSpiderBonus??1):0)+1;c.state.forestSpiderRound=s.round;}log(s,p.name+'与「'+c.state.name+'」交战');}
 function changeThreat(s,pid,n){const p=s.players[pid];p.threat=Math.max(0,p.threat+n);log(s,`${p.name}威胁${n>=0?'+':''}${n} → ${p.threat}`);if(p.threat>=50)eliminate(s,pid);}
 function eliminate(s,pid){const p=s.players[pid];if(p.eliminated)return;const characterIds=(p.heroStates||[]).filter(h=>!h.destroyed).map(h=>h.uid).concat(p.allies.map(c=>c.uid));const attachments=[...attaches(s)].filter(a=>a.controller===pid||characterIds.includes(a.state.target));
  for(const a of attachments){const list=s.players[a.controller].attachments;if(list.some(c=>c.uid===a.uid)){removeFrom(list,a.uid);ownerZone(s,a.state,'playerDiscard').push(a.state);}}
  for(const x of p.allies.splice(0))ownerZone(s,x,'playerDiscard').push(x);for(const x of p.hand.splice(0))ownerZone(s,x,'playerDiscard').push(x);for(const x of p.playerDeck.splice(0))ownerZone(s,x,'playerDiscard').push(x);
  s.staging.push(...p.engaged.splice(0));for(const o of s.objectives)if(o.holder?.player===pid)o.holder=null;
  for(const c of [...s.conditions])if(c.targetPlayer===pid||characterIds.includes(c.target)){removeFrom(s.conditions,c.uid);s.discard.push(c);}
  p.eliminated=true;const pl=context(s),oldIndex=pl.order.indexOf(pid);if(oldIndex>=0){pl.order.splice(oldIndex,1);if(oldIndex<pl.index)pl.index--;}pl.finalPasses=pl.finalPasses.filter(id=>id!==pid);
  log(s,p.name+'被淘汰：手牌、牌库和控制的牌归入各自拥有者弃牌堆；交战敌人保留伤害返回探查区');
  if(!alive(s).length||(!s.rescued&&s.prisoner?.player===pid)){s.status='lost';pl.queue=[];log(s,'本局失败');}
  else if(s.first===pid){for(let i=1;i<=s.players.length;i++){const next=(pid+i)%s.players.length;if(!s.players[next].eliminated){s.first=next;break;}}}
 }
 function modify(s,cs,stat,n){modifier(s,cs.map(c=>c.uid),stat,n);}
 function heal(s,c,n){need(c&&c.state.damage>0,'目标没有可治疗伤害');const amount=Math.min(c.state.damage,n);c.state.damage-=amount;log(s,`${label(s,c)}治疗${amount}伤害`);}
 function applyEvent(s,pid,x,a){const code=x.code,cs=chars(s);switch(code){
  case'01020':find(s,a.target).state.exhausted=false;break;
  case'01021':find(s,a.exhaust).state.exhausted=true;find(s,a.target).state.exhausted=false;break;
  case'01022':modify(s,cs,'attack',1);modify(s,cs.filter(c=>traits(s,c).includes('Gondor.')),'defense',1);break;
  case'01023':{const ally=removeFrom(s.players[pid].hand,a.ally);putAlly(s,pid,ally);s.delayedEffects??=[];s.delayedEffects.push({id:++s.serial,kind:'sneak',uid:ally.uid,round:s.round,phase:s.phase});break;}
  case'01025':for(const c of cs)c.state.exhausted=false;break;
  case'01032':modifier(s,[num(a.target)],'attack',1);modifier(s,[num(a.target)],'defense',1);break;
  case'01033':find(s,a.exhaust).state.exhausted=true;for(const e of [...s.players[num(a.player)].engaged])damageEnemy(s,e.uid,1);break;
  case'01035':{const c=find(s,a.attacker),e=find(s,a.target);c.state.exhausted=true;let atk=stats(s,c.uid).attack;if(c.meta.code==='01009'&&s.staging.some(x=>x.uid===e.uid))atk++;if((e.meta.traits||'').includes('Orc.'))atk+=attached(s,c.uid).filter(a=>a.meta.code==='01039').length;const d=Math.max(0,atk-stats(s,e.uid).defense);const killed=damageEnemy(s,e.uid,d);log(s,`立即攻击：${atk}攻击 − ${e.meta.defense}防御 = ${d}伤害`);if(killed&&(c.meta.code==='01005'||attached(s,c.uid).some(a=>a.meta.code==='01039')))queue(s,'attackProgress',c.controller,{attacker:c.uid,legolas:c.meta.code==='01005',blades:attached(s,c.uid).filter(a=>a.meta.code==='01039').map(a=>a.uid)});break;}
  case'01034':{const p=alive(s).find(p=>p.engaged.some(c=>same(c.uid,a.target)));s.phasePermissions??=[];s.phasePermissions.push({type:'noEnemyAttacks',enemy:num(a.target),player:p.id,round:s.round,phase:s.phase});break;}
  case'01036':s.phasePermissions??=[];s.phasePermissions.push({type:'noEnemyAttacks',player:num(a.player),round:s.round,phase:s.phase});break;
  case'01038':s.phasePermissions??=[];s.phasePermissions.push({type:'multipleDefenders',player:num(a.player),round:s.round,phase:s.phase});break;
  case'01046':if(a.mode==='all')for(const p of alive(s))changeThreat(s,p.id,-2);else changeThreat(s,num(a.player),-6);break;
  case'01049':{const p=s.players[num(a.player)];p.playerDeck.push(...p.playerDiscard.splice(0));H.shuffle(s,p.playerDeck);break;}
  case'01051':{const p=alive(s).find(p=>p.playerDiscard.some(c=>same(c.uid,a.ally)));putAlly(s,pid,removeFrom(p.playerDiscard,a.ally));break;}
  case'01052':{let p=alive(s).find(p=>p.engaged.some(c=>same(c.uid,a.target)));s.staging.push(removeFrom(p.engaged,a.target));break;}
  case'01053':{const c=removeFrom(s.players[pid].playerDiscard,a.card);s.players[c.owner].hand.push(c);break;}
  case'01054':{const p=alive(s).find(p=>p.heroStates.some(h=>h.destroyed&&same(h.uid,a.hero)));const h=p.heroStates.find(h=>same(h.uid,a.hero));h.destroyed=false;h.damage=0;h.resources=0;h.exhausted=false;break;}
  case'01065':case'01066':context(s).ignoredThreat??=[];context(s).ignoredThreat.push(num(a.target));break;
  case'01063':heal(s,find(s,a.target),Infinity);break;
  case'01064':draw(s,num(a.player),3);break;
  case'01067':{const pid2=num(a.player),top=s.players[pid2].playerDeck.slice(0,num(a.x));queue(s,'search',pid,{player:pid2,cards:top.map(c=>c.uid),reason:'甘道夫的搜寻',shuffleRest:false},false);break;}
  case'01068':for(const c of cs.filter(c=>c.kind==='hero'&&c.controller===num(a.player)&&c.state.damage>0))heal(s,c,Infinity);break;
 }}
 function damageEnemy(s,uid,n){const e=find(s,uid);if(!e)return false;e.state.damage=(e.state.damage||0)+n;log(s,`${e.meta.name}受到${n}伤害（累计${e.state.damage}/${e.meta.health}）`);if(e.state.damage>=e.meta.health){for(const a of attached(s,uid))discardAttachment(s,a);H.defeatEnemy(s,e.uid);return true;}return false;}
 function locationProgress(s,uid,n){const l=find(s,uid);need(l?.kind==='location','地点不在场');l.state.progress=(l.state.progress||0)+n;log(s,`${l.meta.name}获得${n}进度`);if(l.state.progress>=l.meta.quest){if(s.active?.uid===l.uid)s.active=null;else removeFrom(s.staging,l.uid);for(const a of attached(s,uid))discardAttachment(s,a);for(const o of s.objectives)if(o.guard===uid)o.guard=null;
  if(l.state.id===113)s.deck.unshift(l.state);else if(l.state.victory)s.victory.push(l.state);else s.discard.push(l.state);if(l.state.id===78)for(const p of alive(s))if(p.playerDeck.length)queue(s,'search',p.id,{player:p.id,cards:p.playerDeck.slice(0,5).map(c=>c.uid),shuffleRest:true,reason:'幽暗密林山脉'});
 }}
 function discardAttachment(s,a){removeFrom(s.players[a.controller].attachments,a.uid);ownerZone(s,a.state,'playerDiscard').push(a.state);log(s,`弃掉「${a.meta.nameZh}」`);const host=find(s,a.state.target);if(host&&['hero','ally'].includes(host.kind)&&host.state.damage>=stats(s,host.uid).health)destroyCharacter(s,host);}
 function leaveWindow(s,c,destroyed){queue(s,'leaveResponses',s.first,{controller:c.controller,code:c.meta.code,kind:c.kind,traits:traits(s,c),destroyed,used:[]});}
 function removeCombatRole(s,uid){if(s.phase!==5||!s.combat)return;for(const a of [s.combat.attack,...s.combat.stack||[]])if(a){if(a.defenders)a.defenders=a.defenders.filter(id=>!same(id,uid));if(a.attackers)a.attackers=a.attackers.filter(id=>!same(id,uid));}}
 function leaveAlly(s,uid,destination,destroyed=destination==='playerDiscard'){const c=find(s,uid);if(!c)return;removeCombatRole(s,uid);const t=traits(s,c);removeFrom(s.players[c.controller].allies,c.uid);for(const a of attached(s,c.uid))discardAttachment(s,a);delete c.state.controller;delete c.state.exhausted;delete c.state.damage;delete c.state.committed;ownerZone(s,c.state,destination).push(c.state);if(destination==='playerDeck')H.shuffle(s,ownerZone(s,c.state,'playerDeck'));leaveWindow(s,{...c,meta:{...c.meta,traits:t}},destroyed);}
 function destroyCharacter(s,c,destroyed=true){removeCombatRole(s,c.uid);for(const o of s.objectives)if(o.holder?.player===c.controller&&c.kind==='hero'&&o.holder?.hero===c.state.index)o.holder=null;if(c.kind==='ally')leaveAlly(s,c.uid,'playerDiscard',destroyed);else{const t=traits(s,c);c.state.destroyed=true;for(const a of attached(s,c.uid))discardAttachment(s,a);leaveWindow(s,{...c,meta:{...c.meta,traits:t}},destroyed);if(s.players[c.controller].heroStates.every(h=>h.destroyed||captured(s,c.controller,h.index)))eliminate(s,c.controller);}}
 function damageCharacter(s,c,n){c.state.damage+=n;log(s,`${label(s,c)}受到${n}伤害`);if(c.state.damage>=stats(s,c.uid).health)destroyCharacter(s,c);if(c.meta.code==='01003'&&!c.state.destroyed)queue(s,'gloin',c.controller,{uid:c.uid,amount:n});}
 function abilityFields(s,pid,c,params={}){const cs=chars(s);switch(c.meta.code){
  case'01007':return [field('discard','弃掉己方手牌',s.players[pid].hand.map(x=>opt(x.uid,data(s,x).nameZh)))];
  case'01010':case'01060':case'01026':case'01031':case'01057':case'01072':return [];
  case'01011':return [fieldsForTargets(s,'target','受伤角色',cs.filter(c=>c.state.damage>0))];
  case'01012':case'01062':return [field('player','抽牌玩家',alive(s).filter(p=>p.playerDeck.length).map(p=>opt(p.id,p.name)))];
  case'01014':return [field('player','获得意志的玩家',alive(s).filter(p=>cs.some(c=>c.controller===p.id)).map(p=>opt(p.id,p.name)))];
  case'01043':return [field('player','另一名玩家',alive(s).filter(p=>p.id!==pid).map(p=>opt(p.id,p.name)))];
  case'01058':return [fieldsForTargets(s,'target','受伤英雄',cs.filter(c=>c.kind==='hero'&&c.state.damage>0))];
  case'01070':return [field('discard','弃掉己方手牌',s.players[pid].hand.map(x=>opt(x.uid,data(s,x).nameZh))),field('stat','本阶段提高的数值',[opt('willpower','意志+1'),opt('defense','防御+1')])];
  default:throw Error('该卡在计划阶段没有可主动使用的能力');
 }}
 function abilitySpec(s,pid,uid,params={}){const r={legal:false,reason:'',fields:[]};try{free(s);const c=find(s,uid);need(c&&['hero','ally','attachment'].includes(c.kind),'能力来源不在场');need(c.controller===pid||c.meta.code==='01007','不能使用其他玩家控制的卡牌能力');r.source=c;r.costText=['01010','01012','01014','01026','01057','01058','01060','01062','01072'].includes(c.meta.code)?'费用：横置此牌。':c.meta.code==='01011'?'费用：从葛罗芬戴尔自身资源池支付1资源。':['01007','01070'].includes(c.meta.code)?'费用：弃掉行动玩家自己的1张手牌。':c.meta.code==='01031'?'本阶段攻击+5；阶段结束时洗回牌库。':c.meta.code==='01043'?'转交控制权，自己威胁−3、对方威胁+3。':'';r.fields=abilityFields(s,pid,c,params);need(r.fields.every(f=>f.options.length),'没有合法目标');
  if(['01010','01012','01014','01026','01057','01058','01060','01062','01072'].includes(c.meta.code))need(!c.state.exhausted,'来源已经横置，不能再次支付横置费用');
  if(['01010','01060'].includes(c.meta.code))need(s.deck.length,'遭遇牌库为空');
  if(c.meta.code==='01011'){need(c.state.resources>=1,'葛罗芬戴尔自身资源不足');need(!used(s,`${uid}:glorfindel:${s.round}`),'本回合已使用治疗');}
  if(c.meta.code==='01012')need(!used(s,`${uid}:beravor:${s.round}`),'贝拉沃本回合已使用');
  if(c.meta.code==='01007')need(!used(s,`${uid}:eowyn:${pid}:${s.round}`),'该玩家本回合已触发伊欧玟');
  if(['01031','01043'].includes(c.meta.code))need(!used(s,`${uid}:${c.meta.code}:${s.round}`),'本回合已使用该能力');
  if(c.meta.code==='01057')need(find(s,c.state.target)?.state.exhausted,'附着英雄已经重置，无需重置');
  if(c.meta.code==='01072')need(find(s,c.state.target)?.state.damage>0,'附着角色没有伤害');
  if(c.meta.code==='01070')need((s.abilityUses?.[`${uid}:protector:${s.round}:${s.phase}`]||0)<3,'本阶段已达到3次上限');
  r.legal=true;
 }catch(e){r.reason=e.message;}return r;}
 function activate(s,pid,uid,a={}){need(![2,3,4,5,6].includes(s.phase)||!context(s)?.discussion||context(s).executingAction,'请先暂定能力并由全员二次确认');const r=abilitySpec(s,pid,uid,a);need(r.legal,r.reason);chosen(r.fields,a);const c=r.source,code=c.meta.code;touch(s);
  if(['01010','01012','01014','01026','01057','01058','01060','01062','01072'].includes(code))c.state.exhausted=true;
  switch(code){
   case'01007':useLimit(s,`${uid}:eowyn:${pid}:${s.round}`);s.players[pid].playerDiscard.push(removeFrom(s.players[pid].hand,a.discard));modifier(s,[c.uid],'willpower',1);break;
   case'01010':case'01060':queue(s,'peek',pid,{uid:s.deck[0].uid,bottom:code==='01010'},false);break;
   case'01011':useLimit(s,`${uid}:glorfindel:${s.round}`);c.state.resources--;heal(s,find(s,a.target),1);break;
   case'01012':useLimit(s,`${uid}:beravor:${s.round}`);draw(s,num(a.player),2);break;
   case'01014':modify(s,chars(s).filter(c=>c.controller===num(a.player)),'willpower',1);break;
   case'01026':find(s,c.state.target).state.resources+=2;break;
   case'01031':useLimit(s,`${uid}:${code}:${s.round}`);modifier(s,[c.uid],'attack',5);s.delayedEffects??=[];s.delayedEffects.push({id:++s.serial,kind:'beorn',uid:c.uid,round:s.round,phase:s.phase});break;
   case'01043':useLimit(s,`${uid}:${code}:${s.round}`);removeFrom(s.players[pid].allies,c.uid);s.players[num(a.player)].allies.push(c.state);c.state.controller=num(a.player);changeThreat(s,pid,-3);changeThreat(s,num(a.player),3);break;
   case'01057':find(s,c.state.target).state.exhausted=false;break;
   case'01058':heal(s,find(s,a.target),2);break;
   case'01062':draw(s,num(a.player),1);break;
   case'01070':s.abilityUses??={};s.abilityUses[`${uid}:protector:${s.round}:${s.phase}`]=(s.abilityUses[`${uid}:protector:${s.round}:${s.phase}`]||0)+1;s.players[pid].playerDiscard.push(removeFrom(s.players[pid].hand,a.discard));modifier(s,[c.state.target],a.stat,1);break;
   case'01072':heal(s,find(s,c.state.target),2);break;
  }log(s,`使用「${c.meta.nameZh}」能力`);pump(s);
 }
 function abilities(s,pid){return [...chars(s),...attaches(s)].filter(c=>c.controller===pid||c.meta.code==='01007').map(c=>({uid:c.uid,name:c.meta.nameZh,...abilitySpec(s,pid,c.uid)})).filter(c=>c.legal||!c.reason.includes('没有可主动使用'));}
 function responses(s,t){const a=[],ctx=t.payload;for(const c of attaches(s))if(c.meta.code==='01042'&&ctx.destroyed&&!ctx.used.includes(c.uid))a.push({value:String(c.uid),label:s.players[c.controller].name+' · 刚铎号角',type:'horn',pid:c.controller,uid:c.uid});
  for(const p of alive(s))for(const x of p.hand){if(ctx.used.includes(x.uid))continue;if(x.code==='01024'&&ctx.kind==='ally'&&!s.players[ctx.controller].eliminated){try{requireEventWindow(s,x.code,t);payment(s,p.id,'leadership',1);a.push({value:String(x.uid),label:p.name+' · 英勇牺牲（支付1，原控制者抽2）',type:'sacrifice',pid:p.id,uid:x.uid});}catch{}}
   if(x.code==='01019'&&ctx.kind==='hero'&&ctx.controller===p.id&&ctx.traits.includes('Dwarf.')&&unique(s,data(s,x)))a.push({value:String(x.uid),label:p.name+' · 布洛克铁拳免费入场',type:'brok',pid:p.id,uid:x.uid});}
  return a;
 }
 function choiceSpec(s,a={}){const t=context(s)?.queue[0];if(!t)return null;let fields=[],message='',paymentInfo=null;const d=t.payload,pid=t.actor;
  if(t.kind==='entry'){const c=find(s,d.uid);if(!c)return {task:t,stale:true,fields:[]};message='是否响应「'+c.meta.nameZh+'」入场？';if(d.code==='01018'&&!enemies(s).some(e=>(e.meta.traits||'').includes('Orc.')))return {task:t,stale:true,fields:[]};switch(d.code){
   case'01015':fields=[fieldsForTargets(s,'target','交战敌人',enemies(s).filter(e=>s.staging.some(c=>c.uid===e.uid)||alive(s).some(p=>p.id!==pid&&p.engaged.some(c=>c.uid===e.uid))))];break;
   case'01016':fields=[fieldsForTargets(s,'target','放置1进度的地点',locations(s))];break;
   case'01018':break;
   case'01059':fields=[field('card','某玩家弃牌中最上面的附属',alive(s).flatMap(p=>{const c=[...p.playerDiscard].reverse().find(c=>data(s,c).type==='attachment');return c?[opt(c.uid,p.name+' · '+data(s,c).nameZh)]:[];}))];break;
   case'01061':fields=[field('condition','弃掉的状态附属',conditions(s).map(c=>opt(c.uid,c.label)))];break;
   case'01073':fields=[field('mode','甘道夫入场响应',[opt('draw','抽3张'),opt('threat','降低自己5威胁'),...(enemies(s).length?[opt('damage','对1名敌人造成4伤害')]:[])])];if(a.mode==='damage')fields.push(fieldsForTargets(s,'target','敌人',enemies(s)));break;
  }}
  if(t.kind==='restricted'){message='目标有超过2张受限附属，必须选择弃掉其中1张（也可选择刚打出的牌）。';fields=[field('card','弃掉的受限附属',restrictedOn(s,d.target).map(c=>opt(c.uid,c.label)))];}
  if(t.kind==='hummer'){message='巨蜂交战后必须对己方1名英雄造成5伤害。';fields=[fieldsForTargets(s,'target','承受5伤害的英雄',chars(s).filter(c=>c.kind==='hero'&&c.controller===pid))];}
  if(t.kind==='peek'){message='查看遭遇牌库顶牌（不是翻开，不触发效果）：'+s.deck.find(c=>c.uid===d.uid)?.name;fields=[field('mode','处理牌库顶牌',d.bottom?[opt('keep','保留在牌库顶'),opt('bottom','放到牌库底')]:[opt('keep','查看完毕')])];}
  if(t.kind==='gloin'){message='是否响应葛罗因刚受到的伤害，增加'+d.amount+'资源？';}
  if(t.kind==='search'){const p=s.players[d.player];message=d.reason+'：选择1张交给原牌库拥有者。';fields=[field('card','获得的牌',d.cards.map(id=>{const c=p.playerDeck.find(c=>c.uid===id);return opt(id,data(s,c).nameZh+' #'+id);})),field('order','其余牌的次序',[])];}
  if(t.kind==='leaveResponses'){message='角色离场响应窗口。起始玩家决定响应次序；可以使用任一合法响应，或关闭窗口。';const rs=responses(s,t);fields=[field('response','使用的响应',rs.map(r=>opt(r.value,r.label)))];const selected=rs.find(r=>same(r.value,a.response??rs[0]?.value));if(selected?.type==='sacrifice')paymentInfo=payment(s,selected.pid,'leadership',1);}
  if(t.kind==='attackProgress'){message='攻击消灭敌人后的可选进度响应。';fields=[field('response','进度响应',[...(d.legolas?[opt('legolas','莱戈拉斯：放置2进度')]:[]),...d.blades.map(id=>opt(id,'刚多林之刃：放置1进度'))])];}
  if(t.kind==='endOrder'){message='多项阶段结束效果同时触发，由起始玩家选择下一项结算。';fields=[field('effect','下一项结束效果',context(s).endEffects.map(e=>opt(e.id,(e.kind==='beorn'?'比翁洗回牌库':'偷袭返回手牌')+' · '+(find(s,e.uid)?.meta.nameZh||'来源已离场'))))];}
  return {task:t,fields,message,payment:paymentInfo};
 }
 function resolveChoice(s,id,a={}){const pl=plan(s),t=pl.queue[0];need(t&&same(t.id,id),'此选择已经过期或不是当前响应');const spec=choiceSpec(s,a);if(a.skip){need(t.optional,'强制效果不能跳过');pl.queue.shift();pump(s);return;}
  if(t.kind==='search'){const f=spec.fields[0];chosen([f],a);const rest=t.payload.cards.filter(x=>!same(x,a.card));need(Array.isArray(a.order)&&a.order.length===rest.length&&new Set(a.order.map(String)).size===rest.length&&rest.every(x=>a.order.some(y=>same(x,y))),'请为其余被查看的牌给出完整、不重复的顺序');}
  else chosen(spec.fields,a);
  if(t.kind==='leaveResponses'){const r=responses(s,t).find(r=>same(r.value,a.response));need(r,'响应已不合法');let pay;if(r.type==='sacrifice'){requireEventWindow(s,'01024',t);pay=payment(s,r.pid,'leadership',1,a.payment);}t.payload.used.push(r.uid);
   if(r.type==='horn')find(s,find(s,r.uid).state.target).state.resources++;if(r.type==='brok')putAlly(s,r.pid,removeFrom(s.players[r.pid].hand,r.uid));if(r.type==='sacrifice'){spend(s,pay.pay);const x=removeFrom(s.players[r.pid].hand,r.uid);draw(s,t.payload.controller,2);ownerZone(s,x,'playerDiscard').push(x);}pump(s);return;}
  pl.queue.shift();const d=t.payload,pid=t.actor;
  if(t.kind==='entry')switch(d.code){
   case'01015':{engageEnemy(s,a.target,pid);break;}
   case'01016':locationProgress(s,num(a.target),1);break;
   case'01018':for(const e of enemies(s).filter(e=>(e.meta.traits||'').includes('Orc.')))damageEnemy(s,e.uid,1);break;
   case'01059':{const p=alive(s).find(p=>p.playerDiscard.some(c=>same(c.uid,a.card)));const x=removeFrom(p.playerDiscard,a.card);ownerZone(s,x,'hand').push(x);break;}
   case'01061':{const c=conditions(s).find(c=>same(c.uid,a.condition));if(c.kind==='player')discardAttachment(s,find(s,c.uid));else s.discard.push(removeFrom(s.conditions,c.uid));break;}
   case'01073':if(a.mode==='draw')draw(s,pid,3);else if(a.mode==='threat')changeThreat(s,pid,-5);else damageEnemy(s,num(a.target),4);break;
  }
  if(t.kind==='restricted'){const c=restrictedOn(s,d.target).find(c=>same(c.uid,a.card));if(c.kind==='objective')s.objectives.find(o=>o.uid===c.uid).holder=null;else discardAttachment(s,find(s,c.uid));}
  if(t.kind==='hummer')damageCharacter(s,find(s,a.target),5);
  if(t.kind==='peek'&&a.mode==='bottom')s.deck.push(removeFrom(s.deck,d.uid));
  if(t.kind==='gloin'){const c=find(s,d.uid);if(c)c.state.resources+=d.amount;}
  if(t.kind==='search'){const p=s.players[d.player];const picked=removeFrom(p.playerDeck,a.card);p.hand.push(picked);const remaining=a.order.map(id=>removeFrom(p.playerDeck,id));if(d.shuffleRest){p.playerDeck.push(...remaining);H.shuffle(s,p.playerDeck);}else p.playerDeck.unshift(...remaining);}
  if(t.kind==='attackProgress'){const amount=a.response==='legolas'?2:1;H.addProgress(s,amount);if(a.response==='legolas')d.legolas=false;else d.blades=d.blades.filter(id=>!same(id,a.response));if(d.legolas||d.blades.length)pl.queue.unshift({...t,id:++s.serial});}
  if(t.kind==='endOrder'){const e=pl.endEffects.find(e=>same(e.id,a.effect));pl.endEffects=pl.endEffects.filter(x=>x.id!==e.id);applyEnd(s,e);}
  log(s,'已结算：'+spec.message);pump(s);
 }
 function pump(s){const pl=context(s);if(!pl)return;if(s.status!=='playing'){pl.queue=[];return;}let guard=0;while(pl.queue.length&&guard++<100){const t=pl.queue[0],sp=choiceSpec(s);if(sp.stale||(t.kind!=='search'&&sp.fields.some(f=>!f.options.length))){need(t.optional||sp.stale,'强制效果没有合法目标，停止结算');pl.queue.shift();continue;}break;}
  if(pl.closing&&!pl.queue.length){if(pl.endEffects.length>1)queue(s,'endOrder',s.first,{},false);else if(pl.endEffects.length===1){const e=pl.endEffects.shift();applyEnd(s,e);pump(s);}else complete(s);}
  if(!pl.queue.length&&H.checkQuest)H.checkQuest(s);
 }
 function endTurn(s,pid){const p=free(s);need(active(s)===pid,'只有当前计划玩家可结束自己的出牌步骤');p.index++;touch(s);log(s,s.players[pid].name+'结束盟友／附属出牌步骤');}
 function passAction(s,pid){const pl=free(s);need(active(s)===null,'须先由每位玩家结束盟友／附属出牌步骤');need(alive(s).some(p=>p.id===pid),'无效玩家');need(!pl.finalPasses.includes(pid),'该玩家已经放弃剩余行动');pl.finalPasses.push(pid);log(s,s.players[pid].name+'放弃本阶段剩余行动');}
 function applyEnd(s,e){s.delayedEffects=s.delayedEffects.filter(x=>x.id!==e.id);if(find(s,e.uid)?.kind==='ally')leaveAlly(s,e.uid,e.kind==='beorn'?'playerDeck':'hand');}
 function complete(s){s.phaseModifiers=(s.phaseModifiers||[]).filter(m=>m.round!==s.round||m.phase!==s.phase);s.phasePermissions=(s.phasePermissions||[]).filter(m=>m.round!==s.round||m.phase!==s.phase);if(s.phase===6){context(s).closing=false;context(s).step='roundEnd';log(s,'阶段结束效果已完成，开始回合结束效果');return;}context(s).completed=true;context(s).closing=false;if([3,4,5].includes(s.phase)){context(s).step='completed';context(s).encounterModifiers=[];context(s).ignoredThreat=[];s.phaseThreat=0;}if(s.phase===2){context(s).step='completed';context(s).encounterModifiers=[];context(s).ignoredThreat=[];for(const c of chars(s))c.state.committed=false;s.phaseThreat=0;for(const c of s.staging)delete c.bonus;}log(s,'本阶段结束效果结算完成');}
 function finish(s){const pl=plan(s);need(!pl.halted,pl.halted);need(!pl.queue.length,'请先结算响应');if(!pl.closing){if(s.phase===6)need(pl.step==='action','刷新框架尚未完成');else if(s.phase===5)need(['endAction','ending'].includes(pl.step),'战斗尚未结束');else if(s.phase===4)need(pl.step==='afterChecks','交战检定尚未结束');else if(s.phase===3)need(pl.step==='action','旅行尚未结算');else if(s.phase===2)need(pl.step==='afterResult','探险尚未结算');else need(active(s)===null,'请先由每位玩家结束计划出牌步骤');need(alive(s).every(p=>pl.finalPasses.includes(p.id)),'请让每位玩家确认放弃剩余行动');pl.closing=true;pl.endEffects=(s.delayedEffects||[]).filter(e=>e.round===s.round&&e.phase===s.phase);}pump(s);return pl.completed;}
 return {destroyCharacter,discardAttachment,leaveAlly,engageEnemy,icons,checkedPlay,damageCharacter,damageEnemy,locationProgress,modifier,changeThreat,queue,pump,spend,draw,putAlly,context,eventTiming,window,start,active,playSpec,play,abilitySpec,activate,abilities,choiceSpec,resolveChoice,endTurn,passAction,finish,chars,attaches,enemies,locations,stats,find,data,payment,restrictedOn};
};
if(typeof module!=='undefined')module.exports=PlanningRulesFactory;
