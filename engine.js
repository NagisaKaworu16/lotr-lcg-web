/* Scenario engine: automated deck/stage handling; character and combat effects use explicit manual tasks. */
const ScenarioEngine = (()=>{
const D=typeof LOTR_DATA!=='undefined'?LOTR_DATA:require('./data.js');
const PlanningFactory=typeof PlanningRulesFactory!=='undefined'?PlanningRulesFactory:require('./planning-engine.js');
const P2=PlanningFactory({log,drawPlayer,shuffle,checkQuest:s=>{if(s.questing&&s.phase===2&&!s.questing.queue.length){P3.advanceIfReady(s);P3.resumeDeployment(s);P3.resumeActions(s);}if(s.traveling&&s.phase===3){P3.advanceIfReady(s);P4.resume(s);}if(s.encountering&&s.phase===4){P3.advanceIfReady(s);P5.resume(s);}if(s.combat&&s.phase===5){P3.advanceIfReady(s);P6.resume(s);}if(s.refreshing&&s.phase===6){P7.resume(s);}},defeatEnemy:(s,uid)=>defeat(s,uid,true),addProgress:(s,n)=>[2,3,4,5,6].includes(s.phase)&&P2.context(s)?P3.progress(s,n):addProgress(s,n,true)});
const QuestFactory=typeof QuestRulesFactory!=='undefined'?QuestRulesFactory:require('./quest-engine.js');
const P3=QuestFactory({log,draw,shuffle,discardCard,task,gate,advance:(s)=>advance(s,true),threat,stageDef,questOf,mill,take:findTake,timeEnter,sorceryStrike},P2);
const TravelFactory=typeof TravelRulesFactory!=='undefined'?TravelRulesFactory:require('./travel-engine.js');
const P4=TravelFactory({log,rng},P2,P3);
const EncounterFactory=typeof EncounterRulesFactory!=='undefined'?EncounterRulesFactory:require('./encounter-engine.js');
const P5=EncounterFactory({log,stageDef,questOf,engageHooks},P2,P3);
const CombatFactory=typeof CombatRulesFactory!=='undefined'?CombatRulesFactory:require('./combat-engine.js');
const P6=CombatFactory({log,draw,discardCard,get byId(){return byId;},mill},P2,P3);
const RefreshFactory=typeof RefreshRulesFactory!=='undefined'?RefreshRulesFactory:require('./refresh-engine.js');
const P7=RefreshFactory({log,tickTime,stageDef,scenarioFlag,mill},P2,P3);
const byId=Object.fromEntries(D.cards.map(x=>[x.id,x]));
const phases=['资源','计划','探险','旅行','遭遇','战斗','刷新'];
const clone=x=>JSON.parse(JSON.stringify(x));
const roster=[['阿拉贡','希奥德雷德','葛罗因'],['金雳','莱戈拉斯','沙林'],['伊欧玟','埃莉诺','杜内希尔'],['丹内梭尔','葛罗芬戴尔','贝拉沃']];
function rng(s){let x=s.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.seed=x>>>0;return s.seed/4294967296;}
function shuffle(s,a){for(let i=a.length-1;i>0;i--){let j=Math.floor(rng(s)*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
/* 日志条目 = 「回合N · [阶段标记]文本」。阶段标记 §P3§ 供右栏日志按阶段着色分组，
   纯文本消费方（存档外部工具）可直接按 § 切掉；不带标记时按当前阶段归组。 */
function log(s,t,phaseMark){s.log.unshift(`回合${s.round} · ${phaseMark?'§'+phaseMark+'§':''}${t}`);}
function task(s,text,kind='manual',args={}){s.pending.push({id:++s.serial,text,kind,args});}
function assert(v,msg){if(!v)throw Error(msg);}
function ready(s){assert(!s.setupPending,'请先确认起始手牌并执行剧本设置。');assert(s.status==='playing','对局已经结束。');assert(!s.pending.length,'请先处理待结算事项。');}
function quest(s){return D.quests.find(q=>q.id===s.quest);}
/* ── 剧本数据访问（v0.16.3 数据化改造）────────────────────────────────────
   剧本特判的唯一事实源是 data.js 的 scenarios[]（setup/flags/easyRemove/stages）。
   访问助手对缺失定义、未知枚举值一律 assert 报错（fail loud）——
   这是给后续新剧本（如《寻找咕噜》）铺路的护栏，不许静默跳过。 */
function scenarioOf(s){const sc=D.scenarios.find(x=>x.id===s.scenario);assert(sc,'剧本数据缺失：'+s.scenario);return sc;}
function stageDef(s,qid){const st=scenarioOf(s).stages.find(x=>x.id===qid);assert(st,`剧本 ${s.scenario} 缺少探险卡 ${qid} 的 stage 定义`);return st;}
function questOf(s){return quest(s);}
function scenarioFlag(s,name){const f=scenarioOf(s).flags||{};return !!f[name];}
function live(s){return s.players.filter(p=>!p.eliminated);}
function remove(a,uid){let i=a.findIndex(c=>c.uid===uid);assert(i>=0,'找不到该牌。');return a.splice(i,1)[0];}
function findTake(s,id){for(const a of [s.deck,s.discard]){let i=a.findIndex(c=>c.id===id);if(i>=0)return a.splice(i,1)[0];}return null;}
function inplay(s,id){return [...s.staging,...s.players.flatMap(p=>p.engaged),...(s.active?[s.active]:[])].some(c=>c.id===id);}
function adjustThreat(s,p,n){p.threat=Math.max(0,p.threat+n);if(p.threat>=50&&!p.eliminated){task(s,`${p.name}威胁达到50。按规则淘汰该玩家，并手动处理其所有角色、附属及交战敌人的离场/转移效果。`,'eliminate',{player:p.id});}}
function draw(s,refill=true){if(!s.deck.length&&refill&&s.discard.length){s.deck=shuffle(s,s.discard.splice(0));log(s,'遭遇弃牌堆洗回牌库');}return s.deck.shift()||null;}
function discardCard(s,c){delete c.damage;delete c.progress;delete c.guard;delete c.bonus;delete c.shadows;delete c.revealed;delete c.shadowRevealed;delete c.beastmasterRound;delete c.resources;delete c.forestSpiderRound;delete c.forestSpiderBonus;delete c.canceled;delete c.timeLeft;s.discard.push(c);}
function release(s,uid){for(const o of s.objectives){if(o.guard===uid){o.guard=null;log(s,`${o.name}的守卫已清除`);}}}
/* ── v0.16.10《安格玛觉醒》批次1 引擎原语 ──────────────────────────────
   mill / deckOut / time 倒计时 / engageHooks / sorceryStrike。
   所有卡 id 特判与全库风格一致（硬编码 id，数据未落地时由测试夹具覆盖）。 */
/* deckOutElimination（DD）：需要抽/弃而牌库空 → 该玩家走现有淘汰事项路径。 */
function deckOut(s,pid){if(!scenarioFlag(s,'deckOutElimination'))return;const p=s.players[pid];if(!p||p.eliminated)return;log(s,`${p.name}的牌库已耗尽`);task(s,`${p.name}需要抽牌但牌库已空。按规则淘汰该玩家，并手动处理其所有角色、附属及交战敌人的离场/转移效果。`,'eliminate',{player:pid});}
/* mill 原语：把玩家牌库顶 n 张逐张移入其弃牌堆（逐张触发 mill 钩子，如 167）；
   牌库中途空则停止；deckOutElimination 剧本下空牌库即淘汰。返回实际 mill 张数。 */
function mill(s,pid,n=1){assert(Number.isInteger(n)&&n>=0,'mill 数量须为非负整数。');const p=s.players[pid];assert(p,'无效玩家。');if(p.eliminated)return 0;let count=0;while(count<n){if(!p.playerDeck.length){deckOut(s,pid);break;}const c=p.playerDeck.shift();p.playerDiscard.push(c);count++;log(s,`${p.name}弃掉牌库顶的牌（mill ${count}/${n}）`);millHooks(s,pid,c);}return count;}
function millHooks(s,pid,c){/* 167 福诺斯特广场：第一玩家从牌库顶弃牌后，在此放置1枚资源标记；威胁+=其上资源数（见 threat()）。 */
 if(pid!==s.first)return;const sq=s.staging.find(x=>x.id===167);if(sq){sq.resources=(sq.resources||0)+1;log(s,'福诺斯特广场获得1资源');}}
/* time 倒计时：卡入场（探查区/目标/交战区）放置计数；离场由 discardCard/defeat 清除。 */
function timeEnter(s,c){if(Number.isInteger(c.time)&&c.time>0&&!c.timeLeft)c.timeLeft=c.time;}
function inPlayCards(s){return [...s.staging,...(s.active?[s.active]:[]),...s.objectives,...s.players.flatMap(p=>p.engaged)];}
/* 刷新阶段末尾统一时点（refresh-engine approve 调用）：在场 time 卡各移除 1 个计数，
   移除最后 1 个立即结算 timeExpire（millEach/discard 通用 + 150/189 id 特判）。 */
function tickTime(s){for(const c of inPlayCards(s)){if(!Number.isInteger(c.timeLeft)||c.timeLeft<=0)continue;c.timeLeft--;log(s,`「${c.name}」时间计数剩${c.timeLeft}`);if(c.timeLeft===0)timeExpire(s,c);}}
function timeExpire(s,c){
 if(c.id===150){/* 营救伊亚里安：时间耗尽，弃掉压在本关下的伊亚里安；伊亚里安离场 → 玩家输掉本局（161 规则文本）。 */
  const lost=(s.underQuest||[]).some(x=>x.id===161);
  for(const x of (s.underQuest||[]).splice(0))discardCard(s,x);log(s,`「${c.name}」时间耗尽，压在关卡下的卡被弃掉`);
  if(lost){s.status='lost';log(s,'伊亚里安离场，玩家输掉本局游戏');}return;}
 if(c.id===189){/* 寻觅庇护（永续）：每位玩家对其控制的1名英雄造成4点伤害（程序化取第一名可用英雄），再重置计数。 */
  for(const p of live(s)){const h=(p.heroStates||[]).find(h2=>!h2.destroyed&&!(s.prisoner&&!s.rescued&&s.prisoner.player===p.id&&s.prisoner.hero===h2.index));if(h)P2.damageCharacter(s,P2.find(s,h.uid),4);}
  P2.pump(s);c.timeLeft=c.time;log(s,`「${c.name}」时间耗尽：每名玩家1名英雄受4点伤害，时间标记重置`);return;}
 const te=c.timeExpire;
 if(te&&te.type==='millEach'){assert(Number.isInteger(te.n)&&te.n>=0,'timeExpire millEach 需要非负整数 n');for(const p of live(s))mill(s,p.id,te.n);if(Number.isInteger(te.reset))c.timeLeft=Math.max(c.timeLeft,te.reset);return;}
 if(te&&te.type==='discard'){log(s,`「${c.name}」时间耗尽，离场`);const zone=[s.staging,s.objectives,...s.players.map(p=>p.engaged)].find(a=>a.includes(c));if(zone)zone.splice(zone.indexOf(c),1);if(s.active&&s.active.uid===c.uid)s.active=null;discardCard(s,c);return;}
 throw new Error(`time 卡「${c.name}」（id ${c.id}）缺少可结算的 timeExpire 定义：请提供 timeExpire.type（millEach/discard）或登记 id 特判`);
}
/* 交战钩子（encounter-engine/framework 与 engine.engage 手动路径共用）：
   163 索尔迪尔的诅咒之徒：交战时 mill 2，按印花费总和分配伤害给己方角色（逐点轮转）。
   174 死灵领主：交战时弃牌堆顶的不死敌人入场与该玩家交战。 */
function engageHooks(s,pid,c){if(!c)return;
 if(c.id===163){const k=mill(s,pid,2);const cards=s.players[pid].playerDiscard.slice(-k);const totalCost=cards.reduce((n,x)=>n+(P2.data(s,{code:x.code,owner:pid})?.cost||0),0);const own=P2.chars(s).filter(x=>x.controller===pid);for(let i=0;i<totalCost&&own.length;i++)P2.damageCharacter(s,own[i%own.length],1);P2.pump(s);log(s,`「${c.name}」交战：mill 2 张（印花费合计${totalCost}），已按费用分配伤害`);}
 if(c.id===174){const i=[...s.discard].reverse().findIndex(x=>x.type==='Enemy'&&/Undead/.test(x.traits||''));if(i>=0){const x=s.discard.splice(s.discard.length-1-i,1)[0];delete x.damage;delete x.timeLeft;s.players[pid].engaged.push(x);log(s,`弃牌堆顶的不死敌人「${x.name}」入场与${s.players[pid].name}交战`);}
 else log(s,'「死灵领主」交战：弃牌堆没有不死敌人');}
}
/* 162 索尔迪尔：Sorcery 诡计翻开后立即攻击第一玩家（无防御，伤害由1名英雄承担）。
   注：「不可附着」的打出校验在 planning 层，本批不改 planning-engine，暂缺（已知缺口）。 */
function sorceryStrike(s,card){if(!inplay(s,162))return;if(!/Sorcery/.test(card.traits||''))return;const th=inPlayCards(s).find(x=>x.id===162);const n=th?(th.attack??0):0;if(!n)return;const hs=P2.chars(s).filter(x=>x.controller===s.first&&x.kind==='hero');const t=hs[0]||P2.chars(s).find(x=>x.controller===s.first);log(s,'索尔迪尔因 Sorcery 诡计立即攻击第一玩家');if(t)P2.damageCharacter(s,t,n);P2.pump(s);}
const manualReveal=new Set([74,76,79,80,89,93,98,105,116,117,118,149,160,171,177,181,190,191,192,193,158]);
function reveal(s,count=1,guardFor=null){
 for(let i=0;i<count;i++){
  assert(++s.revealSteps<400,'连续翻牌异常，请撤销并检查牌库。');
  const c=draw(s);if(!c){log(s,'没有可翻开遭遇牌');continue;}
  log(s,`翻开「${c.name}」`);
  for(const p of live(s))if(c.doomed)adjustThreat(s,p,c.doomed);
  if(c.type==='Enemy'||c.type==='Location'||c.type==='Side Quest'||c.type==='Quest'){
   s.staging.push(c);timeEnter(s,c);if(guardFor&&i===0){guardFor.guard=c.uid;c.guard=guardFor.uid;}
  }else if(c.type==='Objective'){
   c.holder=null;c.guard=null;s.objectives.push(c);reveal(s,1,c);
  }else if(c.type==='Treachery'){
   if(manualReveal.has(c.id)){    if(c.id===118)for(const x of s.staging.filter(x=>x.type==='Location'))x.bonus=(x.bonus||0)+1;
    s.resolving.push(c);task(s,`${c.name}：${c.rule}${c.id===118?'（地点威胁已由程序增加，只需处理弃牌。）':''}`,'treachery',{uid:c.uid});
   }else{
    if(c.id===86)s.progress=Math.max(0,s.progress-4);
    if(c.id===92){let targets=s.staging.filter(x=>x.type==='Enemy'||x.type==='Location');for(const x of targets)x.bonus=(x.bonus||0)+1;if(!targets.length)reveal(s,1);}
    if(c.id===104)s.phaseThreat+=live(s).length;
    discardCard(s,c);
    if(c.id===112)reveal(s,live(s).length);
   }
  }
  if(c.type==='Treachery')sorceryStrike(s,c);
  if(c.surge)reveal(s,1);
 }
}
function enter(s,id){s.quest=id;s.progress=0;s.spawnDefeated=false;log(s,`进入 ${quest(s).stage}B「${quest(s).name}」`);
 /* 进入新探险卡 = 新目标，本回合视为尚未达成；否则上一阶段的条件会一路沿用，自动推进到错误的关卡。 */
 s.questDoneRound=null;
 onEnterEffects(s,id);
}
/* v0.16.3：进入效果读 stage.onEnter；v0.16.10 抽出复用——首张探险卡的 onEnter 在剧本设置时也要执行
   （DD 172 每名玩家搜 164 交战、TWH 191 翻出预置卡等）。 */
function onEnterEffects(s,id){
 const oe=stageDef(s,id).onEnter;
 if(oe){
  if(oe.type==='spiderSearch'){for(const p of live(s))task(s,`${p.name}从遭遇牌库或弃牌堆选择1张蜘蛛，放入探查区（不触发翻开效果）。`,'spider',{player:p.id});}
  else if(oe.type==='revealPerPlayer'){assert(Number.isInteger(oe.count)&&oe.count>=1,'onEnter revealPerPlayer 需要正整数 count');
   if(s.questing){const ctx=P2.context(s);ctx.returnStep=ctx.step;ctx.step='staging';ctx.remaining.push(...Array.from({length:oe.count*live(s).length},()=>({})));}else reveal(s,oe.count*live(s).length);}
  /* v0.16.10：安格玛 onEnter 扩展（DD 1B/2A、TWH 2A）。 */
  else if(oe.type==='searchEngage'){assert(Number.isInteger(oe.card),'onEnter searchEngage 需要 card id');for(const p of live(s))task(s,`${p.name}从遭遇牌库搜索1张指定卡，放入场并与其交战。`,'searchEngage',{player:p.id,card:oe.card});
   /* v0.16.10 P1（DD 1B 官方全文）：搜索全部结算后洗混遭遇牌库，再每名玩家翻1张遭遇卡。 */
   s.searchEngageFollowUp={shuffle:true,revealPerPlayer:true};}
  else if(oe.type==='spawnSetAside'){assert(Number.isInteger(oe.card),'onEnter spawnSetAside 需要 card id');const i=s.setaside.findIndex(x=>x.id===oe.card);assert(i>=0,'setAside 中找不到要生成的卡：'+oe.card);const c2=s.setaside.splice(i,1)[0];s.staging.push(c2);timeEnter(s,c2);log(s,`「${c2.name}」从预置区加入探查区`);}
  else if(oe.type==='revealSetAside'){assert(Array.isArray(oe.cards)&&oe.cards.length,'onEnter revealSetAside 需要 cards 数组');for(const id2 of oe.cards){const i=s.setaside.findIndex(x=>x.id===id2);assert(i>=0,'setAside 中找不到要翻出的卡：'+id2);const c2=s.setaside.splice(i,1)[0];s.staging.push(c2);timeEnter(s,c2);log(s,`翻开「${c2.name}」，加入探查区`);}}
  else assert(false,'未知 stage.onEnter 类型：'+oe.type);
 }
}
function initializePlayer(s,p){
 const by=Object.fromEntries(p.registeredDeck.cards.map(c=>[c.code,c]));
 p.heroStates=p.heroCards.map((c,index)=>({uid:++s.serial,code:c.code,index,exhausted:false,damage:0,resources:s.difficulty==='easy'?1:0,committed:false,destroyed:false}));
 p.playerDeck=[];p.hand=[];p.playerDiscard=[];p.playerRemoved=[];p.allies=[];p.attachments=[];p.mulliganTaken=false;p.openingConfirmed=false;
 for(const [code,n] of Object.entries(p.registeredDeck.slots)){assert(by[code]&&['ally','attachment','event'].includes(by[code].type),'无效的玩家牌库卡牌。');assert(Number.isInteger(n)&&n>=0,'无效的玩家牌数量。');for(let i=0;i<n;i++)p.playerDeck.push({uid:++s.serial,code,owner:p.id});}
 shuffle(s,p.playerDeck);drawPlayer(s,p,6,true);log(s,`${p.name}抽取6张起始手牌（牌库剩${p.playerDeck.length}张）`,'P0');
}
function drawPlayer(s,p,n,setup=false){
 assert(Number.isInteger(n)&&n>=0,'抽牌数必须为非负整数。');
 if(!setup&&s.active?.id===95){log(s,`${p.name}受到魔法溪流限制，不能抽牌`);return 0;}
 if(!setup){const shackles=s.conditions.find(c=>c.id===105&&c.targetPlayer===p.id);if(shackles){s.conditions=s.conditions.filter(c=>c.uid!==shackles.uid);discardCard(s,shackles);log(s,`${p.name}本次抽牌被铁镣替代`);return 0;}}
 let count=0;while(count<n&&p.playerDeck.length){p.hand.push(p.playerDeck.shift());count++;}if(count<n&&!setup)deckOut(s,p.id);return count;
}
function openingChoice(s,pid,mulligan=false){
 assert(s.setupPending&&s.status==='playing','当前不是起始手牌选择步骤。');const p=s.players[pid];assert(p?.playerDeck,'无效玩家。');assert(!p.openingConfirmed,'该玩家已确认起始手牌。');
 if(mulligan){assert(!p.mulliganTaken,'每位玩家只能调度一次。');assert(p.hand.length===6,'调度必须将完整6张起始手牌洗回。');p.playerDeck.push(...p.hand.splice(0));shuffle(s,p.playerDeck);drawPlayer(s,p,6,true);p.mulliganTaken=true;log(s,`${p.name}整手调度一次，重抽6张并保留`,'P0');}else log(s,`${p.name}保留起始手牌`,'P0');
 p.openingConfirmed=true;
}
function startScenario(s){assert(s.setupPending,'剧本设置已经执行。');assert(s.players.every(p=>p.openingConfirmed),'所有玩家须先保留或调度起始手牌。');assert(!s.setupReveal,'起始手牌已确认，剧本设置已开始；请继续翻开开局遭遇牌。');s.setupDone=true;s.setupPending=false;applyScenarioSetup(s);log(s,'起始手牌已确认，剧本设置已执行；准备第1回合资源阶段','P0');}
function resourcePhase(s){
 ready(s);assert(s.phase===0,'仅能在资源阶段收集资源和抽牌。');assert(s.resourceRound!==s.round,'本回合资源阶段已结算。');
 const drawn=[];
 for(const p of live(s))if(p.heroStates){for(const h of p.heroStates){if(h.destroyed||(!s.rescued&&s.prisoner?.player===p.id&&s.prisoner.hero===h.index))continue;h.resources++;}const count=drawPlayer(s,p,1);log(s,`${p.name}每名可用英雄获得1资源，抽取${count}张牌`,'P0');if(count)drawn.push(...p.hand.slice(-count).map(c=>({uid:c.uid,by:p.name})));}
 s.resourceRound=s.round;s.resourceDoneRound=s.round;
 /* v0.15.68：记录资源阶段抽到的牌，界面用弹窗短暂展示（自动关闭，可手动关闭）。 */
 if(drawn.length)s.resourceDraw={id:++s.serial,round:s.round,cards:drawn};
}
/* 官方 Easy Mode（LOTR Easy Mode Rules / MEC65 规则书）：setup 时每位英雄资源池 +1，
   并从当前剧本遭遇牌库移除带「difficulty」金框标记的卡。早期剧本没有金框，按官方清单逐卡移除。
   v0.16.3：移除清单已按卡 id 迁入 data.js 各剧本的 easyRemove 字段（键=遭遇卡 id，值=移除张数）。 */
function create(scenarioId,players=1,seed=Date.now(),configs=null,options={}){
 assert(Number.isInteger(players)&&players>=1&&players<=4,'人数须为1–4。');const sc=D.scenarios.find(x=>x.id===scenarioId);assert(sc,'未知剧本。');
 assert(Array.isArray(sc.stages)&&sc.stages.length&&sc.stages[0]&&sc.stages[0].id,'剧本 stages 定义无效：'+scenarioId);
 const difficulty=options.difficulty==='easy'?'easy':'normal';
 const s={version:1,difficulty,scenario:sc.id,quest:sc.stages[0].id,round:1,phase:0,first:0,serial:0,seed:(seed>>>0)||1,status:'playing',progress:0,phaseThreat:0,revealSteps:0,stagedRound:0,spawnDefeated:false,prisoner:null,rescued:false,players:[],deck:[],discard:[],staging:[],resolving:[],conditions:[],objectives:[],setaside:[],victory:[],active:null,underQuest:[],pending:[],log:[]};
 if(configs)assert(Array.isArray(configs)&&configs.length===players,'玩家牌组配置数量不符。');
 for(let i=0;i<players;i++){const c=configs?.[i];if(c)assert(Array.isArray(c.heroes)&&c.heroes.length>=1&&c.heroes.length<=3&&Number.isInteger(c.startingThreat),'无效英雄配置。');s.players.push({id:i,name:`玩家${i+1}`,threat:c?c.startingThreat:[29,29,24,30][i],heroes:c?[...c.heroes]:[...roster[i]],...(c?{heroCodes:[...c.heroCodes],heroCards:clone(c.heroCards),registeredDeck:clone(c.registeredDeck)}:{}),engaged:[],eliminated:false});}
 for(const k of Object.keys(sc.easyRemove||{}))assert(byId[k],'剧本 easyRemove 引用未知卡 id：'+k);
 /* v0.16.4：deckQuantities 允许剧本声明某卡的组内用量覆盖卡面 quantity（缺省走卡面）；未知 id fail loud。 */
 const deckQty=sc.deckQuantities||{};
 for(const k of Object.keys(deckQty))assert(byId[k],'剧本 deckQuantities 引用未知卡 id：'+k);
 for(const d of D.cards.filter(c=>sc.sets.includes(c.set))){
  const base=deckQty[d.id]!==undefined?deckQty[d.id]:d.quantity;
  assert(Number.isInteger(base)&&base>=0,`卡 ${d.id} 的组内用量无效：${base}`);
  const qty=base-(difficulty==='easy'?((sc.easyRemove&&sc.easyRemove[d.id])||0):0);
  for(let i=0;i<qty;i++)s.deck.push({...clone(d),uid:++s.serial});
 }
 shuffle(s,s.deck);
 log(s,`开始「${sc.name}」 · ${players}人 · ${difficulty==='easy'?'简单模式（每位英雄+1资源，移除难度标记卡）':'标准模式'}`);
 if(options.openingTest)s.openingTest=true;
 if(options.first!==undefined){assert(Number.isInteger(options.first)&&options.first>=0&&options.first<players,'起始玩家必须在本局人数范围内。');s.first=options.first;}
 for(const p of s.players)if(p.registeredDeck){initializePlayer(s,p);p.openingConfirmed=!options.deferSetup;}
 if(options.deferSetup){assert(s.players.every(p=>p.playerDeck),'需要为每位玩家选择有效牌组。');s.setupPending=true;log(s,'已抽取起始手牌，等待保留或调度；尚未执行剧本设置','P0');return s;}
 applyScenarioSetup(s);return s;
}
function applyScenarioSetup(s){
 /* v0.16.4：开局设置读 scenarios[].setup。stageCards=直接把指定卡放进探查区再洗牌；
    revealFlow=逐张翻牌流程（beginSetupFlow）；无 setup 定义=标准开局（gollum 试点即此类）。 */
 const su=scenarioOf(s).setup;
 if(!su){s.revealSteps=0;onEnterEffects(s,scenarioOf(s).stages[0].id);return;}
 assert(su.type,'剧本 setup 定义缺少 type：'+s.scenario);
 if(su.type==='stageCards'){
  assert(Array.isArray(su.cards)&&su.cards.length,'stageCards setup 需要非空 cards 数组');
  for(const id of su.cards){
   /* v0.16.10：setup.cards 可包含首关探险卡 id（151/172/190 等舞台 id，不是遭遇牌库实体）——
      当前探险卡由 s.quest 表示，跳过即可；其余 id 必须 findTake 成功。 */
   if(scenarioOf(s).stages.some(x2=>x2.id===id)){log(s,`当前探险卡（id ${id}）由关卡状态表示，不从牌库取出`);continue;}
   const c=findTake(s,id);assert(c,`剧本设置：遭遇牌库中找不到卡 ${id}`);s.staging.push(c);
  }
  shuffle(s,s.deck);
  s.revealSteps=0;
 }else if(su.type==='revealFlow')beginSetupFlow(s);
 else assert(false,'未知 setup 类型：'+su.type);
 /* v0.16.10：安格玛 setup 扩展——仅 stageCards 类型（revealFlow 的 tower objectives/setAside
    语义不同，由 beginSetupFlow 专管，不许在此重复处理）。 */
 if(su.type==='stageCards'){
  if(Array.isArray(su.setAside))for(const id of su.setAside){const c2=findTake(s,id);assert(c2,'剧本 setup：遭遇牌库中找不到预置卡 '+id);s.setaside.push(c2);log(s,`${c2.name}面朝下预置`);}
  if(Array.isArray(su.objectives))for(const id of su.objectives){
   /* 目标卡可能是设置专用卡（如 161 伊亚里安不在任何 sets 里）——牌库找不到时按卡定义直接入场。 */
   let o=findTake(s,id);
   if(!o){const def=D.cards.find(x=>x.id===id);assert(def,'剧本 setup：目标卡 id 不存在：'+id);o={...clone(def),uid:++s.serial};log(s,`${o.name}为设置专用卡，按卡定义入场`);}
   o.holder={player:0,hero:null};o.guard=null;s.objectives.push(o);log(s,`${o.name}入场，由玩家1控制`);
  }
  if(Array.isArray(su.ensureInStaging))for(const id of su.ensureInStaging){
   if(inplay(s,id))continue;const c2=findTake(s,id);
   if(c2){s.staging.push(c2);timeEnter(s,c2);log(s,`${c2.name}进入探查区`);} /* 简单模式可能已按 easyRemove 移除，允许保底落空 */
  }
  if(su.perPlayerLocation)task(s,'每位玩家从遭遇牌库各放1张不同地点进探查区（各张必须互不相同，请手动放置）。','setupManual');
  if(Array.isArray(su.makeActive))for(const id of su.makeActive){const c2=findTake(s,id);assert(c2,'剧本 setup：遭遇牌库中找不到要设为当前的地点 '+id);s.active=c2;log(s,`${c2.name}设为当前地点`);}
 }
 /* 首张探险卡的 onEnter 在设置时即执行（DD 172 searchEngage 等；其余剧本首关无 onEnter，为空操作）。 */
 onEnterEffects(s,scenarioOf(s).stages[0].id);
}
/* 开局逐张翻牌：安都因「每位玩家各翻开1张遭遇卡」，多尔哥多「为每张目标各翻开1张」。
   旧实现直接调用 reveal() 立即结算，使意志考验（01050）与埃莉诺（01008）的取消窗口无从出现。
   现在逐张推进：每张先在 setupReveal.current 等待结算关键词、取消或翻下一张。 */
const SETUP_EFFECT=new Set([74,76,79,80,86,89,92,93,98,104,105,112,116,117,118,147,148,150,152,155,159,170,175,176,178,179,180,188,194,195,196,200]);
function beginSetupFlow(s){
 const setup={kind:'setup',step:'reveal',remaining:s.players.length,current:null,guard:null,reveals:[],canceled:false,replacement:false,hasEffect:false,finished:false};
 /* v0.16.3：revealPer（player=每位玩家各翻1张 / objective=tower 模式为每张目标各翻1张）与
    setAside/objectives 全部来自 scenarios[].setup；未知枚举值 fail loud。 */
 const su=scenarioOf(s).setup;
 assert(su.type==='revealFlow','beginSetupFlow 需要 revealFlow 类型的 setup');
 assert(['player','objective'].includes(su.revealPer),'未知 setup.revealPer：'+su.revealPer);
 const tower=su.revealPer==='objective';
 assert(!su.mode||su.mode==='tower','未知 setup.mode：'+su.mode);
 assert(!tower||(su.mode==='tower'&&Array.isArray(su.setAside)&&su.setAside.length===1&&Array.isArray(su.objectives)&&su.objectives.length),'tower 模式需要 setAside 与 objectives 定义');
 if(tower){
  const naz=findTake(s,su.setAside[0]);assert(naz,'tower setAside 卡在牌库中缺失：'+su.setAside[0]);s.setaside.push(naz);
  for(const id of su.objectives){let o=findTake(s,id);assert(o,'tower 目标卡在牌库中缺失：'+id);o.holder=null;o.guard=null;s.objectives.push(o);}
  setup.kind='tower';setup.remaining=s.objectives.length;
 }
 shuffle(s,s.deck);
 s.setupReveal=setup;
 s.revealSteps=0;
 log(s,su.revealPer==='player'?'剧本设置：每位玩家各翻开1张遭遇卡（逐张结算，可在翻开时使用取消响应）':'剧本设置：为每张目标各翻开1张遭遇卡（逐张结算，可在翻开时使用取消响应）');
}
function setupNextGuard(s){
 const x=s.setupReveal;
 if(x.kind!=='tower')return null;
 return s.objectives.find(o=>!o.guard)?.uid||null;
}
function setupRevealStep(s){
 const x=s.setupReveal;assert(x,'当前没有开局翻牌步骤。');assert(!s.pending.length,'请先处理待结算事项。');
 if(x.current){const c=settleSetupCard(s);if(!s.pending.length)finishSetupFlow(s);return c;}
 if(x.remaining<=0){finishSetupFlow(s);return null;}
 s.revealSteps=0;
 const guard=setupNextGuard(s);
 const card=draw(s);
 if(!card){log(s,'开局翻开时遭遇牌库为空');x.remaining--;if(x.remaining<=0&&!s.pending.length)finishSetupFlow(s);return null;}
 x.remaining--;x.current=card;x.guard=guard;x.canceled=false;x.replacement=false;
 x.hasEffect=card.type!=='Treachery'||SETUP_EFFECT.has(card.id);
 x.reveals.push(card.name);
 if(card.doomed)for(const p of live(s))adjustThreat(s,p,card.doomed);
 log(s,`翻开「${card.name}」（待结算，剩${x.remaining}张待翻）`);
 return card;
}
function settleSetupCard(s){
 const x=s.setupReveal;assert(x?.current,'没有待结算的开局遭遇牌。');assert(!s.pending.length,'请先处理待结算事项。');
 const c=x.current;
 if(x.kind==='tower'){s.staging.push(c);timeEnter(s,c);const o=s.objectives.find(o=>o.uid===x.guard);if(o){o.guard=c.uid;c.guard=o.uid;log(s,`「${c.name}」成为「${o.name}」的守卫`);}}
 else s.staging.push(c),timeEnter(s,c);
 if(x.canceled){log(s,`已取消「${c.name}」的翻开效果，关键词仍结算`);}
 else{
  const auto=applySetupEffect(s,c);
  // 敌人／地点／目标没有「翻开」效果；只有诡计与其他需要人工结算的牌才登记事项。
  if(!auto&&c.type!=='Enemy'&&c.type!=='Location'&&c.type!=='Objective')task(s,`${c.name}：${c.rule}`,'setupManual',{uid:c.uid});
 }
 if(c.type==='Treachery'&&!s.conditions.includes(c)&&!s.resolving.includes(c))discardCard(s,c);
 log(s,`开局翻牌结算完成：「${c.name}」`);
 x.current=null;
 return c;
}
/* 返回 true 表示效果已由程序结算，无需人工处理；false 则登记人工结算事项。 */
function applySetupEffect(s,c){
 if(c.id===86){s.progress=Math.max(0,s.progress-4);return true;}
 return false;
}
function finishSetupFlow(s){
 const x=s.setupReveal;if(!x||x.finished||x.remaining>0||x.current)return null;
 /* v0.16.3：翻完后的收尾读 setup.afterReveal（ensureInStaging=保底进场卡、shuffle=洗牌）；
    囚犯抽取按 flags.prisoner 开关——只有定义了该 flag 的剧本才会有囚犯，其余剧本行为不变。 */
 const su=scenarioOf(s).setup;
 if(su.type==='revealFlow'&&su.afterReveal){
  const ar=su.afterReveal;
  if(Array.isArray(ar.ensureInStaging))for(const id of ar.ensureInStaging){
   if(inplay(s,id))continue;
   const t=findTake(s,id);if(t){s.staging.push(t);log(s,`${t.name}进入探查区`);} /* 简单模式可能已按 easyRemove 移除该卡，允许保底落空 */
  }
  if(ar.shuffle)shuffle(s,s.deck);
 }
 if(scenarioFlag(s,'prisoner')){
  const heroPool=s.players.flatMap(p=>p.heroes.map((_,i)=>({player:p.id,hero:i})));
  s.prisoner=heroPool[Math.floor(rng(s)*heroPool.length)];
  const prisonPlayer=s.players[s.prisoner.player];
  task(s,`囚禁${prisonPlayer.name}的「${prisonPlayer.heroes[s.prisoner.hero]}」：翻面，不可使用、受伤或收集资源。前两阶段全队每回合最多打出1名盟友。`);
  // 回归防线：囚犯英雄必须是真实存在的英雄，不能出现越界索引。
  assert(Array.isArray(prisonPlayer.heroes)&&prisonPlayer.heroes[s.prisoner.hero],'囚犯英雄索引无效。');
 }
 x.finished=true;x.step='done';s.revealSteps=0;
 x.tasks=s.pending.length;log(s,`剧本设置结算完成${x.tasks?'（'+x.tasks+' 项待结算）':''}`);
 return x;
}
/* 开局翻开时的取消窗口：意志考验（01050）与埃莉诺（01008）。规则同第三阶段探查。 */
function setupCancelOptions(s){
 const x=s.setupReveal;
 if(!x||!x.current||x.canceled)return [];
 const card=x.current,a=[];
 if(card.type!=='Treachery'||!x.hasEffect)return a;
 for(const p of live(s)){
  for(const h of p.hand||[])if(h.code==='01050')a.push({value:'will:'+h.uid,label:`${p.name} · 意志考验（1资源）`});
  for(const c of P2.chars(s))if(c.controller===p.id&&c.meta.code==='01008'&&!c.state.exhausted)a.push({value:'eleanor:'+c.uid,label:`${p.name} · 埃莉诺（横置，弃掉并补翻）`});
 }
 return a;
}
function setupCancel(s,value,payment){
 const x=s.setupReveal;assert(x?.current&&!x.canceled,'当前没有可取消的开局翻开效果。');
 const opt=setupCancelOptions(s).find(o=>o.value===value);assert(opt,'此取消响应当前不合法。');
 const [kind,id]=value.split(':');
 if(kind==='will'){
  const p=live(s).find(p=>(p.hand||[]).some(h=>String(h.uid)===String(id)));assert(p,'找不到意志考验的持有玩家。');
  const pay=P2.payment(s,p.id,'spirit',1,payment);P2.spend(s,pay.pay);
  const at=p.hand.findIndex(h=>String(h.uid)===String(id));p.playerDiscard.push(p.hand.splice(at,1)[0]);
  log(s,`${p.name}打出意志考验，取消「${x.current.name}」的翻开效果`);
 }else{
  const c=P2.find(s,id);assert(c&&c.meta.code==='01008','找不到可横置的埃莉诺。');
  c.state.exhausted=true;x.replacement=true;
  log(s,`${s.players[c.controller].name}横置埃莉诺，取消「${x.current.name}」并弃掉该牌`);
 }
 x.canceled=true;
 return x.current;
}
function resolve(s,id,choice){const t=s.pending.find(t=>t.id===id);assert(t,'找不到待结算事项。');
 if(t.kind==='spider'){
  const pool=[...s.deck,...s.discard];const c=pool.find(c=>c.uid===Number(choice)&&c.traits.includes('Spider'));
  assert(c,'必须从牌库或弃牌堆选择蜘蛛。');const x=findTake(s,c.id);s.staging.push(x);shuffle(s,s.deck);log(s,`搜索并加入「${x.name}」`);
 }
 if(t.kind==='searchEngage'){
  const c=s.deck.find(x=>x.uid===Number(choice)&&x.id===t.args.card);assert(c,'必须从遭遇牌库选择指定的卡。');const p=s.players[t.args.player];p.engaged.push(s.deck.splice(s.deck.indexOf(c),1)[0]);log(s,`${p.name}搜索并交战「${c.name}」`);
  /* v0.16.10 P1（DD 1B）：全部搜索结算后 → 洗混遭遇牌库 → 每名玩家翻1张遭遇卡。 */
  if(s.searchEngageFollowUp&&!s.pending.some(x2=>x2.kind==='searchEngage'&&x2.id!==t.id)){const fu=s.searchEngageFollowUp;delete s.searchEngageFollowUp;
   if(fu.shuffle)shuffle(s,s.deck);
   if(fu.revealPerPlayer)reveal(s,live(s).length);
  }
 }
 if(t.kind==='treachery'){
  const c=remove(s.resolving,t.args.uid);if(c.id===105)c.targetPlayer=s.first;if([80,105].includes(c.id))s.conditions.push(c);else discardCard(s,c);
 }
 if(t.kind==='setupManual'){s.pending=s.pending.filter(x=>x.id!==id);log(s,'已确认结算：'+t.text.slice(0,35));return;}
 if(t.kind==='eliminate'){
  let p=s.players[t.args.player];p.eliminated=true;for(const c of p.engaged.splice(0))s.staging.push(c);
  for(const o of s.objectives)if(o.holder?.player===p.id)o.holder=null;
  if(s.prisoner?.player===p.id&&!s.rescued){s.status='lost';log(s,'囚犯所属玩家被淘汰，囚犯无法获救');}
  if(!live(s).length)s.status='lost';
 }
 s.pending=s.pending.filter(x=>x.id!==id);log(s,'已确认结算：'+t.text.slice(0,35));if(s.questing)P3.advanceIfReady(s);
}
function stage(s){assert(!s.questing,'请使用逐张探查流程');ready(s);assert(s.phase===2,'仅在探险阶段探查。');assert(s.stagedRound!==s.round,'本回合已经执行过探查。');s.stagedRound=s.round;s.revealSteps=0;
 /* v0.16.3：探查张数读 stage.revealPer/revealBonus（skip=河岸伏击）；此函数是无逐张流程时的手动探查入口。 */
 const st=stageDef(s,s.quest),rp=st.revealPer||'player';
 if(rp==='skip')log(s,`${quest(s).name}：跳过探查步骤`);
 else{assert(rp==='player','未知 stage.revealPer：'+rp);reveal(s,live(s).length+(st.revealBonus||0));}
 s.revealSteps=0;}
 /* 变值威胁（v0.16.4 起：133 The Old Ford 的 X=场上盟友数）在效果层实现前按 0 计，
    数据仍如实存 'X'；此处必须容错，否则探查区威胁求和会出 NaN。 */
 const threatVal=(s,c)=>{const v=s.planning?P2.stats(s,c.uid).threat:c.threat;return typeof v==='number'?v:0;};
 function threat(s){return s.phaseThreat+s.staging.filter(c=>['Enemy','Location'].includes(c.type)).reduce((n,c)=>n+threatVal(s,c)+(c.bonus||0)+(c.id===167?(c.resources||0):0),0);}
function addProgress(s,n,internal=false){ready(s);assert(internal||!s.planning||![1,2].includes(s.phase),'计划阶段进度必须由卡牌效果自动结算。');assert(Number.isInteger(n)&&n>=0,'进度须为非负整数。');let left=n;
 if(s.active){let c=s.active,k=Math.min(left,Math.max(0,c.quest-(c.progress||0)));c.progress=(c.progress||0)+k;left-=k;if(c.progress>=c.quest){s.active=null;leaveLocation(s,c);}}
 s.progress+=left;log(s,`放置${n}点进度，探险卡现有${s.progress}点`);
 if(left>0&&stageDef(s,s.quest).rescueWindow&&!s.rescued)task(s,'此探险卡已有进度。可选择救出囚犯；确认后囚犯受1点伤害，戒灵进入探查区。','rescue');
}
function leaveLocation(s,c){release(s,c.uid);if(c.id===113){s.deck.unshift(c);}else if(c.victory)s.victory.push(c);else discardCard(s,c);log(s,`探索完成「${c.name}」`);if(c.id===78)task(s,'幽暗密林山脉：每位玩家可从己方牌库顶5张选1张入手，其余洗回。');}
function rescue(s,id){const t=s.pending.find(t=>t.id===id);assert(t?.kind==='rescue','没有救援响应。');assert(scenarioFlag(s,'prisoner'),'该剧本没有囚犯机制，无法救援。');s.rescued=true;s.staging.push(...s.setaside.splice(0));s.pending=s.pending.filter(t=>t.id!==id);log(s,'囚犯获救，受到1点伤害；戒灵进入探查区');if(s.questing){const h=s.players[s.prisoner.player].heroStates[s.prisoner.hero];P2.damageCharacter(s,P2.find(s,h.uid),1);P2.pump(s);P3.advanceIfReady(s);}else task(s,'请在囚犯英雄上记录1点伤害。');}
function gate(s){if(s.setupPending)return '尚未完成开局设置';if(s.pending.length)return '仍有待结算事项';const q=quest(s);if(s.progress<q.points)return `进度不足：${s.progress}/${q.points}`;
 /* v0.16.3：探险门槛全部读 stage.gate 声明式枚举；未知字段 fail loud。 */
 const g=stageDef(s,s.quest).gate;
 if(g)for(const k of Object.keys(g))assert(['spawnDefeated','noInPlay','noEnemies','holdObjectives','rescued','controlsObjective','spawnHpZero'].includes(k),'未知 stage.gate 字段：'+k);
 if(g&&g.spawnDefeated!==undefined){assert(Number.isInteger(g.spawnDefeated),'gate.spawnDefeated 须为遭遇卡 id');if(!s.spawnDefeated)return `必须在本阶段击败${D.cards.find(c=>c.id===g.spawnDefeated).name}`;}
 if(g&&Array.isArray(g.noInPlay)){const hitId=g.noInPlay.find(id=>inplay(s,id));if(hitId!==undefined)return `${D.cards.find(c=>c.id===hitId).name}仍在场`;}
 if(g&&g.noEnemies){if([...s.staging,...s.players.flatMap(p=>p.engaged)].some(c=>c.type==='Enemy'))return '场上仍有敌人';}
 /* v0.16.10：安格玛 gate 扩展——controlsObjective（IiC 161）与 spawnHpZero（DD 2B 162，
   区别于 spawnDefeated 的离场判定：不可摧毁卡血量归零但仍在场即算达成）。 */
 /* v0.16.10：controlsObjective 口径注释——现按「被任一玩家持有」判定（o.holder 非空）。
   官方文本是「第一名玩家控制」，但 161 伊亚里安实际不可转移、控制权不随先手轮换，
   若改成 o.holder?.player===s.first 会在先手轮换后永远无法过关；待官方裁定或数据支持转移后再收紧。 */
 if(g&&Array.isArray(g.controlsObjective)){const miss=g.controlsObjective.filter(id=>!s.objectives.some(o=>o.id===id&&o.holder));if(miss.length)return `必须控制目标：${miss.map(id=>D.cards.find(c=>c.id===id)?.name||('id '+id)).join('、')}（须由玩家持有）`;}
 if(Number.isInteger(g?.spawnHpZero)){const def=D.cards.find(c=>c.id===g.spawnHpZero),c=inPlayCards(s).find(x=>x.id===g.spawnHpZero);
  if(c){if((c.damage||0)<(c.health??0))return `必须将${c.name}的血量降至0（当前${c.damage||0}/${c.health??0}）`;}
  else if(!s.discard.some(x=>x.id===g.spawnHpZero)&&!s.victory.some(x=>x.id===g.spawnHpZero))return `必须先让${def?.name||('id '+g.spawnHpZero)}入场`;}
 if(g&&(g.holdObjectives!==undefined||g.rescued)){
  const need=g.holdObjectives,held=s.objectives.filter(o=>o.holder).length;
  if(need==='all'){if((g.rescued&&!s.rescued)||held!==s.objectives.length)return `须救出囚犯并持有全部${s.objectives.length}张目标`;}
  else if(Number.isInteger(need)){if(g.rescued&&!s.rescued)return '须先救出囚犯';if(held<need)return `至少持有${need}张目标`;}
  else if(need===undefined){if(g.rescued&&!s.rescued)return '须先救出囚犯';}
  else assert(false,'未知 gate.holdObjectives：'+need);
 }
 return '';}
/* v0.16.10 P0：官方「在场时玩家不能获胜」——143 兽人战团（iic）、183 阿蒙福恩（twh）。
   机制读 stage.noWinWhileInPlay；数据侧补字段前先以 NO_WIN_CARDS 硬编码双保险。 */
const NO_WIN_CARDS=new Set([143,183]);
function noWinBlocked(s){const ids=[...(stageDef(s,s.quest).noWinWhileInPlay||[]),...NO_WIN_CARDS];return ids.filter(id=>inPlayCards(s).some(c=>c.id===id));}
function advance(s,internal=false){assert(internal||!s.questing,'探险推进由规则自动判定');ready(s);assert(!gate(s),gate(s));
 /* v0.16.3：推进读 stage.next（'random' 走 nextRandom，null/缺省=胜利）；目标必须是已定义的探险卡。 */
 const st=stageDef(s,s.quest);assert('next' in st,'stage 缺少 next 字段：'+s.quest);
 let next=st.next;
 if(next==='random'){assert(Array.isArray(st.nextRandom)&&st.nextRandom.length>=1,'random next 需要 nextRandom 数组');next=st.nextRandom[Math.floor(rng(s)*st.nextRandom.length)];}
 if(next!==null&&next!==undefined){stageDef(s,next);enter(s,next);}
 else{const blocking=noWinBlocked(s);
  if(blocking.length){log(s,`进度已满，但「${blocking.map(id=>D.cards.find(c=>c.id===id)?.name||id).join('、')}」仍在场，玩家不能获胜；待其离场后重新达成`);return;}
  s.status='won';log(s,'剧本胜利！');}}
function travel(s,uid,confirmed=false){assert(!s.traveling,'请使用旅行暂定选择与全员二次确认');ready(s);assert(s.phase===3,'仅在旅行阶段旅行。');assert(!s.active,'已有当前地点。');let c=s.staging.find(c=>c.uid===uid);assert(c?.type==='Location','请选择地点。');assert(!s.staging.some(x=>x.id===88)||c.id===88,'必须优先旅行至东湾。');
 if([77,78,94].includes(c.id))assert(confirmed,'请先确认旅行费用可支付并已处理。');
 s.active=remove(s.staging,uid);s.active.progress=0;log(s,`旅行至「${c.name}」`);
 if(c.id===78){s.revealSteps=0;reveal(s,1);s.revealSteps=0;}
 if(c.id===87){s.active=null;leaveLocation(s,c);}
 /* v0.16.10：165 破损的城墙——旅行至此，每位玩家 mill 1（Time 3 计数在入场时已放置）。 */
 if(c.id===165)for(const p of live(s))mill(s,p.id,1);
 /* v0.16.10 P2：187 旅行效果与 166/186 探索响应——本批降级为手动事项提示，避免静默丢失。 */
 if(c.id===187)task(s,'隐秘兽人营地旅行效果：第一名玩家从遭遇牌库和弃牌堆找出1个兽人敌人置入场上与其交战，然后洗混遭遇牌库。（当前按手动事项处理）','setupManual');
 if(c.id===166||c.id===186)task(s,`「${c.name}」的探索响应将在其被探索时结算，请手动处理。（当前按手动事项处理）`,'setupManual');
 if(c.id===99)task(s,'古老森林道路：起始玩家可重置1名己方角色。');
 if(c.id===100)task(s,'森林大门：起始玩家可抽2张牌（如抽牌被禁止则不抽）。');
 if(c.id===107)guards(s);
}
function guards(s){for(const p of live(s)){p.engaged.push({id:0,uid:++s.serial,name:'兽人守卫',en:'Orc Guard',type:'Enemy',attack:1,defense:1,health:1,threat:0,rule:'由该玩家牌库顶牌背面表示，离场时回到原所有者的弃牌堆。',synthetic:true});task(s,`${p.name}将自己牌库顶1张牌作为兽人守卫，已在交战区生成对应标记。`);}}
function engage(s,uid,pid){assert(!s.encountering,'请使用主动交战暂定方案与全队确认');ready(s);assert(s.phase===4,'仅在遭遇阶段交战。');const p=s.players[pid];assert(p&&!p.eliminated,'无效玩家。');const c=s.staging.find(x=>x.uid===uid);assert(c?.type==='Enemy','请选择敌人。');if(c.id===83)assert(!s.staging.some(x=>x.type==='Enemy'&&x.uid!==uid),'其他敌人仍在探查区，不能主动交战狙击手。');assert(!p.optionalRound||p.optionalRound!==s.round,'每位玩家每阶段仅可主动交战1次。');p.optionalRound=s.round;p.engaged.push(remove(s.staging,uid));log(s,`${p.name}主动交战「${c.name}」`);engageHooks(s,pid,c);if(c.id===75||c.id===96)task(s,`${c.name}交战效果：${c.rule}`);}
function encounterChecks(s){if(s.encountering){P5.beginChecks(s);return;}ready(s);assert(s.phase===4,'仅在遭遇阶段检定。');assert(!s.checkedRound||s.checkedRound!==s.round,'本回合已经完成交战检定。');s.checkedRound=s.round;
 /* v0.16.3：跳过读 stage.skipEngagementCheck（127 安都因河航道）；此函数是无遭遇框架时的手动检定入口，
    框架路径由 encounter-engine.js beginChecks 读同一字段（两处共用一份数据，语义不再分叉）。 */
 if(stageDef(s,s.quest).skipEngagementCheck){log(s,`${quest(s).name}：跳过交战检定`);return;}
 let changed=true;while(changed){changed=false;for(let offset=0;offset<s.players.length;offset++){let p=s.players[(s.first+offset)%s.players.length];if(p.eliminated)continue;let cs=s.staging.filter(c=>c.type==='Enemy'&&(c.engagement??999)<=p.threat).sort((a,b)=>b.engagement-a.engagement);if(cs.length){let c=remove(s.staging,cs[0].uid);p.engaged.push(c);log(s,`${p.name}与${c.name}交战（检定）`);if([75,96].includes(c.id))task(s,`${c.name}交战效果：${c.rule}`);changed=true;}}}
}
function defeat(s,uid,internal=false){assert(internal||!s.questing,'请用合法卡牌能力处理伤害与击败');ready(s);let zone=[s.staging,...s.players.map(p=>p.engaged),...(s.combat?[s.combat.riders]:[])].find(a=>a.some(c=>c.uid===uid));assert(zone,'敌人不在场。');const c=zone.find(c=>c.uid===uid);assert(c.type==='Enemy'||c.type==='Side Quest','只能标记敌人或支线任务被击败。');
 /* v0.16.10：Indestructible（162 索尔迪尔）——伤害累积但不摧毁，手动击败被拒绝；
   damage→destroy 路径经 defeatEnemy 也会落在这里（双保险）。
   已知缺口：planning-engine damageEnemy 在调用 defeatEnemy 前已弃掉其附属，本批不改 planning-engine。 */
 if(c.indestructible){if(!internal)throw Error('该敌人不可摧毁（Indestructible），只能通过关卡条件处理。');log(s,`「${c.name}」不可摧毁：伤害已累积（${c.damage||0}/${c.health??'?'}），仍留在场上`);return;}
 /* 150 营救伊亚里安（支线任务）被击败：第一玩家收回伊亚里安（横置入场）。 */
 if(c.id===150&&s.underQuest?.length){for(const x of s.underQuest.splice(0)){x.holder={player:s.first,hero:null};x.exhausted=true;s.objectives.push(x);}log(s,`${s.players[s.first].name}获得伊亚里安的控制权（横置）`);}
 remove(zone,uid);release(s,uid);if(c.shadows)for(const x of c.shadows)discardCard(s,x);
 delete c.shadows;delete c.shadowRevealed;delete c.timeLeft;
 if(c.combatRider){log(s,'额外攻击的座狼骑手被击败；其实体暗影牌仍按暗影规则处理');return;}
 /* v0.16.3：击败标记读当前 stage.gate.spawnDefeated（121 击败昂哥立安之子）。 */
 const gd=stageDef(s,s.quest).gate;
 if(gd&&gd.spawnDefeated===c.id)s.spawnDefeated=true;
 if(c.synthetic){if(c.playerCard)s.players[c.playerCard.owner].playerDiscard.push(c.playerCard);}else if(c.id===115){delete c.damage;delete c.bonus;s.deck.push(c);shuffle(s,s.deck);}else if(c.victory)s.victory.push(c);else discardCard(s,c);log(s,`${internal?'击败':'已手动确认击败'}「${c.name}」`);
}
function shadows(s){assert(!s.combat,'请使用战斗阶段暗影流程');ready(s);assert(s.phase===5,'仅在战斗阶段分配暗影牌。');assert(s.shadowRound!==s.round,'本回合已分配暗影牌。');s.shadowRound=s.round;for(const p of live(s))for(const c of p.engaged){c.shadows=[];let x=draw(s,false);if(x)c.shadows.push(x);}log(s,'已分配暗影牌（牌库耗尽时不在战斗阶段重洗）');}
function revealShadows(s,uid){assert(!s.combat,'请在战斗面板逐张处理暗影');ready(s);let c=s.players.flatMap(p=>p.engaged).find(c=>c.uid===uid);assert(c&&c.shadows,'请先分配暗影牌。');assert(!c.shadowRevealed,'该敌人暗影牌已翻开。');if(c.id===91&&c.beastmasterRound!==s.round){c.beastmasterRound=s.round;let x=draw(s,false);if(x)c.shadows.push(x);}c.shadowRevealed=true;for(const x of c.shadows){if(x.revealed)continue;x.revealed=true;log(s,`「${c.name}」暗影：${x.name}`);if(x.shadow)task(s,`${x.name}暗影：${x.shadow}${c.id===102?' 戒灵：此效果结算后，交战玩家还需弃掉1名角色。':''}`);}if(c.id===85&&!c.shadows.some(x=>x.shadow))task(s,'座狼：本次攻击后返回探查区。请点击“返回探查区”。');}
function extraShadow(s,uid,n){assert(!s.combat,'补发暗影由战斗效果自动处理');ready(s);assert(s.phase===5,'仅在战斗阶段补发暗影牌。');assert(Number.isInteger(n)&&n>0&&n<=20,'补发数量须为1–20。');const c=s.players.flatMap(p=>p.engaged).find(c=>c.uid===uid);assert(c?.shadows,'请先分配标准暗影牌。');for(let i=0;i<n;i++){let x=draw(s,false);if(x)c.shadows.push(x);}c.shadowRevealed=false;log(s,`${c.name}因卡牌效果补发${n}张暗影牌，请继续翻开尚未结算的牌。`);}
function returnEnemy(s,uid){assert(!s.questing,'探险阶段返回敌人须由卡牌效果执行');ready(s);let a=s.players.map(p=>p.engaged).find(a=>a.some(c=>c.uid===uid));assert(a,'敌人未交战。');const c=remove(a,uid);if(c.shadows)for(const x of c.shadows)discardCard(s,x);delete c.shadows;delete c.shadowRevealed;s.staging.push(c);log(s,`${c.name}返回探查区`);}
function claim(s,uid,pid,hero){ready(s);if(s.questing)assert(P2.window(s).kind==='action'&&!P2.context(s).actionLocked,'领取目标只能在未锁定的行动窗口执行');const o=s.objectives.find(o=>o.uid===uid);const p=s.players[pid];assert(o&&!o.guard&&!o.holder,'目标仍有守卫或已被持有。');assert(p&&!p.eliminated&&Number.isInteger(hero)&&hero>=0&&hero<p.heroes.length,'无效英雄。');assert(s.rescued||s.prisoner?.player!==pid||s.prisoner?.hero!==hero,'囚犯不能持有目标。');assert(s.objectives.filter(o=>o.holder?.player===pid&&o.holder?.hero===hero).length<2,'该英雄已持有2张受限目标（其他受限附属请自行核对）。');if(s.questing){const h=p.heroStates[hero];assert(h&&!h.destroyed,'英雄已离场');assert(P2.restrictedOn(s,h.uid).length<2,'英雄已有2张受限附属');P2.context(s).finalPasses=[];P2.context(s).actionApprovals=[];}o.holder={player:pid,hero};if(s.questing)P2.changeThreat(s,pid,2);else adjustThreat(s,p,2);log(s,`${p.name}的${p.heroes[hero]}领取${o.name}`);}
function returnObjective(s,uid){ready(s);let o=s.objectives.find(o=>o.uid===uid);assert(o?.holder,'目标尚未持有。');o.holder=null;log(s,`${o.name}返回探查区`);}
function nextPhase(s){ready(s);if(s.phase===1&&s.planning){if(s.planning.completed){s.phase=2;P3.start(s);log(s,'进入探险阶段');}else P2.finish(s);return;}if(s.phase===2&&s.questing){if(s.questing.completed){s.phase=3;P4.start(s);log(s,'进入旅行阶段');}else P3.move(s);return;}if(s.phase===3&&s.questing&&!s.traveling){P4.start(s);return;}if(s.phase===3&&s.traveling){if(s.traveling.completed){s.phase=4;P5.start(s);log(s,'进入遭遇阶段');}else P4.finish(s);return;}if(s.phase===4&&s.encountering){if(s.encountering.completed){s.phase=5;P6.start(s);log(s,'进入第六阶段战斗');}else P5.finish(s);return;}if(s.phase===5&&s.combat){if(s.combat.completed){s.phase=6;P7.start(s);}else P6.finish(s);return;}if(s.phase===6&&s.refreshing){if(s.refreshing.completed)P7.nextRound(s);else P7.finish(s);return;}if(s.phase===0&&s.players.some(p=>p.heroStates)&&s.resourceRound!==s.round)resourcePhase(s);
 if(s.phase===2){assert(s.stagedRound===s.round,'本回合须先执行探查（第三阶段也需确认跳过）。');assert(s.resolvedRound===s.round,'请先结算本回合探险结果。');s.phaseThreat=0;for(const c of s.staging)delete c.bonus;}
 if(s.phase===4)assert(s.checkedRound===s.round,'请先完成交战检定或确认跳过。');
 if(s.phase===5){for(const p of s.players)for(const c of p.engaged){for(const x of c.shadows||[])discardCard(s,x);delete c.shadows;delete c.shadowRevealed;}if(s.staging.some(c=>c.id===83))task(s,'探查区的每张哥布林狙击手：每位玩家对己方1名角色造成1点伤害。');}
 if(s.phase===6){
  /* v0.16.10：176 不安之恶的 Undead +1/+1/+1 至回合末——回合切换前按入场原值回收。 */
  for(const c of [...s.staging,...s.players.flatMap(p=>p.engaged)])if(c.undeadBoostRound===s.round){if(c.undeadBoostOrig){if(c.undeadBoostOrig.a===undefined)delete c.attack;else c.attack=c.undeadBoostOrig.a;if(c.undeadBoostOrig.d===undefined)delete c.defense;else c.defense=c.undeadBoostOrig.d;if(c.undeadBoostOrig.t===undefined)delete c.threat;else c.threat=c.undeadBoostOrig.t;delete c.undeadBoostOrig;}delete c.undeadBoostRound;}
  for(const p of live(s))adjustThreat(s,p,s.active?.id===114?2:1);
  for(const o of s.objectives.filter(o=>o.holder)){
   if(o.id===109)adjustThreat(s,s.players[o.holder.player],2);
   if(o.id===110)task(s,`暗影钥匙：${s.players[o.holder.player].name}的${s.players[o.holder.player].heroes[o.holder.hero]}受到1点伤害。`);
  }
  s.round++;s.first=(s.first+1)%s.players.length;while(s.players[s.first].eliminated&&live(s).length)s.first=(s.first+1)%s.players.length;
  s.phase=0;
 }else s.phase++;
 if(s.phase===1&&s.players.some(p=>p.heroStates))P2.start(s);
 /* 遗留路径：无 planning/questing 框架的旧存档进第三阶段时生成兽人守卫（125）；
    现行框架路径由 quest-engine.js start() 读同一 stage.orcGuards 字段（守卫带玩家牌库顶牌背面）。
    两处共用一份数据定义，语义不许分叉。 */
 if(s.phase===2&&stageDef(s,s.quest).orcGuards)guards(s);
 log(s,`进入${phases[s.phase]}阶段`,`P${s.phase}`);
}
/* ── 阶段收尾（「结束阶段」按钮的唯一入口） ──────────────────────────────
   一次点击把本阶段该结的都结掉：关闭行动窗口 → 结算阶段结束效果 →
   结算探险结果 → 进下一张探险卡 → 进入下一阶段。
   返回 {from:原阶段, to:新阶段, label:去了哪, steps:[做了哪些事]}，供界面回显。 */
function closeWindow(s){
 const pl=P2.context(s);if(!pl||pl.completed||pl.closing)return;
 const done={
  1:()=>P2.finish(s),
  2:()=>P3.move(s),                                     /* 探险阶段按 step 推进，不只是关窗口 */
  3:()=>{if(s.traveling?.step==='action')P4.finish(s);},
  4:()=>{if(s.encountering?.step==='afterChecks')P5.finish(s);},
  5:()=>{if(s.combat?.step==='endAction')P6.finish(s);}, /* 其余步骤由 endPhase 的 passAll + move 推进 */
  6:()=>{if(s.refreshing?.step==='action')P7.finish(s);}
 };
 (done[s.phase]||(()=>{}))();
}
/* 「全队让过」：语义等同界面上那颗「全队继续到下一决策点」按钮。
   原来只对「行动窗口」生效，但探险阶段 commit（按起始玩家顺序投入角色）时窗口本身是关闭的，
   那一步是纯程序结算，也要能替全队走完。所以改成按阶段白名单判断，
   并且不要求玩家先手工点过「放弃」——按钮的职责就是替他们点。 */
function passAll(s){
 const pl=P2.context(s);
 if(!pl||pl.completed||pl.closing||pl.actionLocked||pl.halted)return false;
 if(pl.plannedActions?.length)return false;                 /* 有暂定行动：必须先由玩家确认或撤销 */
 if(s.phase===2&&s.questing&&s.questing.step==='commit')pl.finalPasses=[];
 if(s.phase===2&&s.questing&&s.questing.step==='commit'){
  /* 投入步的窗口是关着的，passAction 会拒绝——这一步没有可选性，直接按空名单投入。 */
  while(s.questing.step==='commit'&&s.questing.commitIndex<s.questing.order.length&&!s.questing.tasks.length)P3.commit(s,s.questing.order[s.questing.commitIndex],[]);
  return true;
 }
 for(const p of live(s))if(!pl.finalPasses.includes(p.id))P2.passAction(s,p.id);
 return true;
}
/* 界面主推进按钮专用：把「全队已让过本窗口」直接记上，不做 passAction 的窗口校验
   （afterStaging 这类 framework 步骤窗口是关着的，passAction 会拒绝）。
   语义：玩家点「开始投入角色／继续战斗／结算刷新…」本身就代表「大家都不再行动了」，
   所以他不必先逐个点一遍「放弃本窗口行动」。返回是否全员已让过。
   有暂定行动待确认或行动已锁定时不替玩家让过（主按钮此时也应禁用）。 */
function passWindow(s){
 const c=s.phase===2?s.questing:s.phase===3?s.traveling:s.phase===4?s.encountering:s.phase===5?s.combat:s.phase===6?s.refreshing:null;
 if(!c)return false;
 if(c.plannedActions?.length||c.actionLocked)return false;
 const ids=s.players.filter(p=>!p.eliminated).map(p=>p.id);
 if(!Array.isArray(c.finalPasses))c.finalPasses=[];
 for(const id of ids)if(!c.finalPasses.includes(id))c.finalPasses.push(id);
 return ids.every(id=>c.finalPasses.includes(id));
}
/* 一次「结束阶段」能推进的最大步数：够走完结算 + 换卡 + 进阶段，又不会失控。 */
const END_STEPS=12;
/* 阶段收尾：把当前阶段该结的都结掉，然后离开本阶段。
   - 行动窗口：替全队让过（等同界面上的「全队继续」），不跳过硬性选择。
   - 探险阶段：beforeCommit→commit→staging→afterStaging→afterResult 逐步推进；
     目标已达成则直接进入下一张探险卡，否则照常进旅行阶段。
   - 任何一步需要玩家决定（待结算 / 响应队列 / 强制选择 / 未结算的遭遇牌）就停手。 */
/* 强制选择自动处理：只处理「唯一/无目标」的选择，绝不替玩家在多个合法目标里挑。
   返回 false 表示当前这项必须由玩家自己点。 */
function autoTask(s,pl){
 const t=pl.tasks[0],d=t.payload||{};
 if(t.optional)return false;                                          /* 可放弃的一律让玩家决定 */
 if(t.kind==='commitResponse'){
  const sp=P3.spec(s,t.id);
  if(!sp)return true;
  if(sp.unavailable){
   if(d.code==='01001'){try{P3.choose(s,t.id,{target:String(d.uid)});}catch(e){return false;}return true;}
   return false;
  }
  const f=sp.fields[0];
  if(f&&f.options.length===1){try{P3.choose(s,t.id,{[f.key]:f.options[0].value});}catch(e){return false;}return true;}
  return false;
 }
 return false;
}
function endPhase(s){
 ready(s);assert(s.status==='playing','对局已结束。');assert(s.phase>=0&&s.phase<=6,'未知阶段。');
 const from=s.phase,steps=[];
 const done=()=>({from,to:s.phase,steps});
 const push=()=>{if(s.phase!==from)steps.push('进入'+phases[s.phase]+'阶段');};
 const at=()=>s.questing&&s.questing.round===s.round&&s.phase===2;
 for(let i=0;i<END_STEPS;i++){
  if(s.phase!==from)break;
  const Q=s.questing;                                            /* 每圈重取：换阶段后上一阶段的对象可能已作废 */
  const pl=P2.context(s);
  if(pl?.queue?.length||pl?.actionLocked||pl?.halted)return done();
  /* 强制选择能替玩家走完就走完；剩下的必须由玩家点，立刻停手。 */
  if(pl?.tasks?.length){
   let n=0;while(pl.tasks.length&&n++<END_STEPS)if(!autoTask(s,pl))return done();
   continue;
  }

  /* ---- 第三阶段：按探险步骤逐段推进，遇到「必须玩家操作」的步骤就停 ---- */
  if(at()){
   if(Q.current)return done();                                       /* 遭遇牌未结算 */
   /* 引擎已把这一阶段判为完成（move 走到 afterResult 后 finish 又调过一次）：
      直接交给 nextPhase 换阶段，不再重复推进探险步骤。 */
   if(Q.completed){try{nextPhase(s);}catch(e){return done();}
    if(s.phase!==from){steps.push('进入'+phases[s.phase]+'阶段');}
    return done();
   }
   const submitted=Q.order.every(id=>Q.deployments?.[id]?.confirmed);
   const passed=live(s).every(p=>Q.finalPasses.includes(p.id));
   /* v0.15.46：staging（逐张探查）是玩家一张张翻的，引擎不能替他翻；
      原来这里直接 return 什么也不写，按钮看着可点、点了没动静。把张数说出来。 */
   if(Q.step==='staging'){
    const n=(Q.remaining||[]).length+(Q.current?1:0);
    steps.push('还差 '+n+' 张遭遇牌未翻开结算');
    return done();
   }
   if(Q.step==='commit'){
    if(!Q.deploymentLocked&&!submitted){
     /* v0.15.46：这里原来是静默 return，「结束阶段」按钮点了毫无反应，玩家会以为按钮坏了。
        投入名单必须由玩家自己定（engine 不替人挑角色），所以把原因写进 steps 让界面说出来。 */
     const wait=Q.order.filter(id=>!Q.deployments?.[id]?.confirmed).map(id=>(s.players[id]?.name||('玩家'+(id+1))));
     steps.push('还差 '+wait.join('、')+' 提交投入名单');
     return done();
    }
    while(Q.step==='commit'&&!Q.tasks.length&&!Q.queue.length)P3.commit(s,Q.order[Q.commitIndex],Q.deployments?.[Q.order[Q.commitIndex]]?.ids||[]);
    continue;
   }
   if(Q.step==='staging')return done();                              /* 逐张探查由玩家翻 */
   if(Q.step==='beforeCommit'||Q.step==='afterCommit'){
    /* 让过后当轮就把窗口推过去，否则一次点击只够做「让过」这一件事，玩家会觉得按钮没反应。 */
    const was=Q.step;
    if(!passed&&!passAll(s))return done();
    try{P3.move(s);}catch(e){return done();}
    if(was==='beforeCommit')steps.push('全队让过，按起始玩家顺序投入角色');
    if(Q.step==='afterResult'&&questDone(s))advance(s,true);         /* 达成：直接下一张探险卡 */
    continue;
   }
   if(Q.step==='afterStaging'||Q.step==='afterResult'){
    /* 这两步的窗口是关着的（framework），passAction 会拒绝；而且 move 自己有「全员已让过」的前置，
       所以要按 step 决定先做哪件事：
        - afterStaging：直接 move 结算意志与威胁，让过留到 afterResult 的窗口里做；
        - afterResult ：先让过（此时窗口已重新开放），再 move 走完阶段收尾。 */
    /* afterStaging 的窗口同样关着，passAction 会拒绝；而 move 要求「全员已让过」。
       这一步没有玩家可做的选择（只剩意志/威胁结算），所以直接把全员记为已让过再 move。 */
    if(Q.step==='afterStaging'){Q.finalPasses=live(s).map(p=>p.id);try{P3.move(s);}catch(e){return done();}continue;}
    if(questDone(s)){try{advance(s,true);}catch(e){return done();}continue;}
    if(!passed&&!passAll(s))return done();
    try{P3.move(s);}catch(e){return done();}                         /* 收尾：完成阶段、进下一阶段 */
    continue;
   }
   return done();
  }

  /* ---- 其它阶段：结束当前玩家出牌 → 让过 → 进入下一阶段 ---- */
  /* 资源阶段没有玩家决定：本回合没收资源就替玩家收（等同界面上的主按钮）。 */
  if(s.phase===0&&s.resourceDoneRound!==s.round)resourcePhase(s);
  /* 计划阶段还停在某位玩家的出牌步：替他把这一步结束掉（这一步本来也没有强制选择）。 */
  if(s.phase===1&&P2.active(s)!==null){P2.endTurn(s,P2.active(s));continue;}
  if(s.phase===5){try{P6.move(s);}catch(e){/* 交给下面的 passAll + nextPhase 再试 */}}
  /* 全员已让过、只差阶段收尾：让过会被拒绝（closing 已置位），直接交给 nextPhase。 */
  const already=s.phase===0||(pl&&pl.completed&&!pl.closing);   /* 资源阶段没有可让过的行动窗口 */
  if(!already&&!passAll(s))return done();
  /* 一次点击要走到「真的换阶段」。P2.finish 的行为是：第一次只做收尾（置 closing），
     收尾结束把 completed 置真，第二次才换阶段，所以这里最多连调三次：
     收尾 → 换阶段 → 新阶段里再做一次无选择的前置推进。宁可多调一次，
     也不能出现「点了按钮、界面一变、阶段没动」；真要卡住时 blocker 会说明原因。 */
  let phaseMoved=false;
  for(let k=0;k<3;k++){
   const before=s.phase;
   try{nextPhase(s);}catch(e){
    /* 收尾中途抛错是正常的（finish 还要求全员让过），把收尾落成完成后再来一次。 */
    const b=s.phase===6?s.refreshing:s.phase===5?s.combat:s.phase===4?s.encountering:s.phase===3?s.traveling:s.phase===2?s.questing:s.planning;
    if(b&&b.closing&&!b.completed){b.closing=false;b.completed=true;continue;}
    return done();
   }
   if(s.phase!==before){phaseMoved=true;break;}
  }
  if(!phaseMoved)return done();
  push();
 }
 if(s.phase===from)steps.push(s.questing&&s.questing.current?'仍有遭遇牌待结算':api.phaseRules.blocker(s));
 return done();
}
/* autoAdvance(s)：只要本阶段没有「必须由玩家决定」的事，就替玩家一路走到下一个需要他决定的地方。
   规则来源是 phaseRules.completed —— 它已经写明「哪些项算必需、哪些算可选」，
   所以这里不另立一套判断，避免界面说「已完成」而引擎不动。

   刻意不做的事：不替玩家决定放弃出牌、不替玩家放弃攻击、不替玩家收尾有可选响应的窗口。
   这些步骤的 finish/move 自带前置断言（例如「请让每位玩家确认放弃剩余行动」），
   断言一抛就当「这里需要玩家」直接停手，因此不会静默跳过玩家的选择。 */
function autoAdvance(s){
 if(!s||s.status!=='playing')return 0;
 if(s.setupPending||(s.setupReveal&&!s.setupReveal.finished))return 0;
 let moved=0;
 for(let i=0;i<END_STEPS;i++){
  if(s.status!=='playing')break;
  /* 资源阶段没有任何玩家选择：到回合就收资源、抽牌。重复调用幂等（resourcePhase 自己断言过）。 */
  if(s.phase===0&&s.resourceDoneRound!==s.round&&!s.pending?.length){try{resourcePhase(s);moved++;}catch(e){break;}}
  /* 有待结算事项、响应队列、强制选择或待翻的遭遇牌：必须玩家处理，停手。 */
  const c=api.phaseRules.ctx(s);
  if((s.pending||[]).length||(c&&((c.queue||[]).length||(c.tasks||[]).length||c.current)))break;
  if(!api.phaseRules.completed(s))break;
  const before=s.round+':'+s.phase;
  try{endPhase(s);}catch(e){break;}                     /* 前置断言不满足 = 需要玩家，停手 */
  if(before===s.round+':'+s.phase)break;                /* 没有任何推进，避免空转 */
  moved++;
 }
 return moved;
}
function questFailure(s,n){ready(s);assert(s.phase===2&&s.stagedRound===s.round,'须在探查后结算。');assert(Number.isInteger(n)&&n>0,'失败差值须为正整数。');for(const p of live(s))adjustThreat(s,p,n);for(const c of s.staging.filter(c=>c.id===101)){let o=s.objectives.find(o=>!o.holder);if(o){s.objectives=s.objectives.filter(x=>x.uid!==o.uid);if(o.guard){let g=s.staging.find(c=>c.uid===o.guard);if(g)delete g.guard;}delete o.guard;s.deck.push(o);shuffle(s,s.deck);log(s,'地牢狱卒将无人持有的目标洗回牌库');}}}
function resolveQuest(s,willpower){assert(!s.questing,'意志由投入角色自动计算');ready(s);assert(s.phase===2&&s.stagedRound===s.round,'须先执行探查。');assert(s.resolvedRound!==s.round,'本回合探险已经结算。');assert(Number.isInteger(willpower)&&willpower>=0,'总意志须为非负整数。');const delta=willpower-threat(s);s.resolvedRound=s.round;if(delta>=0)addProgress(s,delta);else questFailure(s,-delta);log(s,`探险结算：意志${willpower}，威胁${threat(s)}，差值${delta}`);}
/* 探险目标达成：进度够 + 剧本门槛（巨魔、目标持有、囚犯等）全部满足。
   达成即锁定本回合，玩家点「结束阶段」时直接进下一张探险卡，不必再点一次。 */
function questDone(s){
 if(!s||s.phase!==2||s.status!=='playing'||s.setupPending||s.pending.length)return false;
 if(s.questDoneRound===s.round)return true;
 const ok=!gate(s);
 if(ok)s.questDoneRound=s.round;
 return ok;
}
function markQuestDone(s){if(s.phase===2&&!gate(s))s.questDoneRound=s.round;}
const api={refreshing:P7,combat:P6,encountering:P5,traveling:P4,questing:P3,planning:P2,questDone,markQuestDone,endPhase,autoAdvance,closeWindow,passAll,passWindow,openingChoice,startScenario,setupRevealStep,settleSetupCard,setupCancelOptions,setupCancel,resourcePhase,drawPlayer,extraShadow,resolveQuest,D,byId,phases,create,quest,gate,threat,stage,addProgress,advance,travel,engage,encounterChecks,defeat,shadows,revealShadows,returnEnemy,claim,returnObjective,nextPhase,resolve,rescue,questFailure,adjustThreat,clone,log,mill,tickTime};
const WindowFactory=typeof WindowRulesFactory!=='undefined'?WindowRulesFactory:require('./window-engine.js');api.windows=WindowFactory(api);
/* 阶段规则：完成判定（纯函数，UI 与「结束阶段」共用）+ 结束阶段入口。 */
const PhaseFactory=typeof PhaseRulesFactory!=='undefined'?PhaseRulesFactory:require('./phase-engine.js');api.phaseRules=PhaseFactory(api);return api;
})();
if(typeof module!=='undefined')module.exports=ScenarioEngine;
