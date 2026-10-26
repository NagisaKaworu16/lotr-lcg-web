/* Scenario engine: automated deck/stage handling; character and combat effects use explicit manual tasks. */
const ScenarioEngine = (()=>{
const D=typeof LOTR_DATA!=='undefined'?LOTR_DATA:require('./data.js');
const PlanningFactory=typeof PlanningRulesFactory!=='undefined'?PlanningRulesFactory:require('./planning-engine.js');
const P2=PlanningFactory({log,drawPlayer,shuffle,checkQuest:s=>{if(s.questing&&s.phase===2&&!s.questing.queue.length){P3.advanceIfReady(s);P3.resumeDeployment(s);P3.resumeActions(s);}if(s.traveling&&s.phase===3){P3.advanceIfReady(s);P4.resume(s);}if(s.encountering&&s.phase===4){P3.advanceIfReady(s);P5.resume(s);}if(s.combat&&s.phase===5){P3.advanceIfReady(s);P6.resume(s);}if(s.refreshing&&s.phase===6){P7.resume(s);}},defeatEnemy:(s,uid)=>defeat(s,uid,true),addProgress:(s,n)=>[2,3,4,5,6].includes(s.phase)&&P2.context(s)?P3.progress(s,n):addProgress(s,n,true)});
const QuestFactory=typeof QuestRulesFactory!=='undefined'?QuestRulesFactory:require('./quest-engine.js');
const P3=QuestFactory({log,draw,shuffle,discardCard,task,gate,advance:(s)=>advance(s,true),threat},P2);
const TravelFactory=typeof TravelRulesFactory!=='undefined'?TravelRulesFactory:require('./travel-engine.js');
const P4=TravelFactory({log,rng},P2,P3);
const EncounterFactory=typeof EncounterRulesFactory!=='undefined'?EncounterRulesFactory:require('./encounter-engine.js');
const P5=EncounterFactory({log},P2,P3);
const CombatFactory=typeof CombatRulesFactory!=='undefined'?CombatRulesFactory:require('./combat-engine.js');
const P6=CombatFactory({log,draw,discardCard,get byId(){return byId;}},P2,P3);
const RefreshFactory=typeof RefreshRulesFactory!=='undefined'?RefreshRulesFactory:require('./refresh-engine.js');
const P7=RefreshFactory({log},P2,P3);
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
function live(s){return s.players.filter(p=>!p.eliminated);}
function remove(a,uid){let i=a.findIndex(c=>c.uid===uid);assert(i>=0,'找不到该牌。');return a.splice(i,1)[0];}
function findTake(s,id){for(const a of [s.deck,s.discard]){let i=a.findIndex(c=>c.id===id);if(i>=0)return a.splice(i,1)[0];}return null;}
function inplay(s,id){return [...s.staging,...s.players.flatMap(p=>p.engaged),...(s.active?[s.active]:[])].some(c=>c.id===id);}
function adjustThreat(s,p,n){p.threat=Math.max(0,p.threat+n);if(p.threat>=50&&!p.eliminated){task(s,`${p.name}威胁达到50。按规则淘汰该玩家，并手动处理其所有角色、附属及交战敌人的离场/转移效果。`,'eliminate',{player:p.id});}}
function draw(s,refill=true){if(!s.deck.length&&refill&&s.discard.length){s.deck=shuffle(s,s.discard.splice(0));log(s,'遭遇弃牌堆洗回牌库');}return s.deck.shift()||null;}
function discardCard(s,c){delete c.damage;delete c.progress;delete c.guard;delete c.bonus;delete c.shadows;delete c.revealed;delete c.shadowRevealed;delete c.beastmasterRound;delete c.resources;delete c.forestSpiderRound;delete c.forestSpiderBonus;delete c.canceled;s.discard.push(c);}
function release(s,uid){for(const o of s.objectives){if(o.guard===uid){o.guard=null;log(s,`${o.name}的守卫已清除`);}}}
const manualReveal=new Set([74,76,79,80,89,93,98,105,116,117,118]);
function reveal(s,count=1,guardFor=null){
 for(let i=0;i<count;i++){
  assert(++s.revealSteps<400,'连续翻牌异常，请撤销并检查牌库。');
  const c=draw(s);if(!c){log(s,'没有可翻开遭遇牌');continue;}
  log(s,`翻开「${c.name}」`);
  for(const p of live(s))if(c.doomed)adjustThreat(s,p,c.doomed);
  if(c.type==='Enemy'||c.type==='Location'){
   s.staging.push(c);if(guardFor&&i===0){guardFor.guard=c.uid;c.guard=guardFor.uid;}
  }else if(c.type==='Objective'){
   c.holder=null;c.guard=null;s.objectives.push(c);reveal(s,1,c);
  }else if(c.type==='Treachery'){
   if(manualReveal.has(c.id)){
    if(c.id===118)for(const x of s.staging.filter(x=>x.type==='Location'))x.bonus=(x.bonus||0)+1;
    s.resolving.push(c);task(s,`${c.name}：${c.rule}${c.id===118?'（地点威胁已由程序增加，只需处理弃牌。）':''}`,'treachery',{uid:c.uid});
   }else{
    if(c.id===86)s.progress=Math.max(0,s.progress-4);
    if(c.id===92){let targets=s.staging.filter(x=>x.type==='Enemy'||x.type==='Location');for(const x of targets)x.bonus=(x.bonus||0)+1;if(!targets.length)reveal(s,1);}
    if(c.id===104)s.phaseThreat+=live(s).length;
    discardCard(s,c);
    if(c.id===112)reveal(s,live(s).length);
   }
  }
  if(c.surge)reveal(s,1);
 }
}
function enter(s,id){s.quest=id;s.progress=0;s.spawnDefeated=false;log(s,`进入 ${quest(s).stage}B「${quest(s).name}」`);
 /* 进入新探险卡 = 新目标，本回合视为尚未达成；否则上一阶段的条件会一路沿用，自动推进到错误的关卡。 */
 s.questDoneRound=null;
 if(id===121){for(const p of live(s))task(s,`${p.name}从遭遇牌库或弃牌堆选择1张蜘蛛，放入探查区（不触发翻开效果）。`,'spider',{player:p.id});}
 if(id===128){if(s.questing){const ctx=P2.context(s);ctx.returnStep=ctx.step;ctx.step='staging';ctx.remaining.push(...Array.from({length:2*live(s).length},()=>({})));}else reveal(s,2*live(s).length);}
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
 let count=0;while(count<n&&p.playerDeck.length){p.hand.push(p.playerDeck.shift());count++;}return count;
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
   下表是核心包三剧本涉及遭遇组的官方清单（键为英文卡名，值为移除张数）。 */
const EASY_REMOVE={
 'Chieftan Ufthak':1,'Dol Guldur Beastmaster':1,"Necromancer's Pass":1,"The Necromancer's Reach":2,
 'Eastern Crows':2,'Evil Storm':1,
 'Caught in a Web':2,'Eyes of the Forest':1,'Hummerhorns':1,
 'Hill Troll':1,'Marsh Adder':1,'Despair':2,
 'Massing at Night':1,'Gladden Fields':2,
 'Dungeon Jailor':2,
};
function create(scenarioId,players=1,seed=Date.now(),configs=null,options={}){
 assert(Number.isInteger(players)&&players>=1&&players<=4,'人数须为1–4。');const sc=D.scenarios.find(x=>x.id===scenarioId);assert(sc,'未知剧本。');
 const difficulty=options.difficulty==='easy'?'easy':'normal';
 const s={version:1,difficulty,scenario:sc.id,quest:sc.stages[0],round:1,phase:0,first:0,serial:0,seed:(seed>>>0)||1,status:'playing',progress:0,phaseThreat:0,revealSteps:0,stagedRound:0,spawnDefeated:false,prisoner:null,rescued:false,players:[],deck:[],discard:[],staging:[],resolving:[],conditions:[],objectives:[],setaside:[],victory:[],active:null,pending:[],log:[]};
 if(configs)assert(Array.isArray(configs)&&configs.length===players,'玩家牌组配置数量不符。');
 for(let i=0;i<players;i++){const c=configs?.[i];if(c)assert(Array.isArray(c.heroes)&&c.heroes.length>=1&&c.heroes.length<=3&&Number.isInteger(c.startingThreat),'无效英雄配置。');s.players.push({id:i,name:`玩家${i+1}`,threat:c?c.startingThreat:[29,29,24,30][i],heroes:c?[...c.heroes]:[...roster[i]],...(c?{heroCodes:[...c.heroCodes],heroCards:clone(c.heroCards),registeredDeck:clone(c.registeredDeck)}:{}),engaged:[],eliminated:false});}
 for(const d of D.cards.filter(c=>sc.sets.includes(c.set))){
  const qty=d.quantity-(difficulty==='easy'?(EASY_REMOVE[d.en]||0):0);
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
 if(s.scenario==='mirkwood'){s.staging.push(findTake(s,96),findTake(s,99));shuffle(s,s.deck);}
 if(s.scenario==='anduin'||s.scenario==='dolguldur')beginSetupFlow(s);
 else s.revealSteps=0;
}
/* 开局逐张翻牌：安都因「每位玩家各翻开1张遭遇卡」，多尔哥多「为每张目标各翻开1张」。
   旧实现直接调用 reveal() 立即结算，使意志考验（01050）与埃莉诺（01008）的取消窗口无从出现。
   现在逐张推进：每张先在 setupReveal.current 等待结算关键词、取消或翻下一张。 */
const SETUP_EFFECT=new Set([74,76,79,80,86,89,92,93,98,104,105,112,116,117,118]);
function beginSetupFlow(s){
 const setup={kind:'setup',step:'reveal',remaining:s.players.length,current:null,guard:null,reveals:[],canceled:false,replacement:false,hasEffect:false,finished:false};
 const tower=s.scenario==='dolguldur';
 if(tower){
  const naz=findTake(s,102);s.setaside.push(naz);
  for(const id of [108,109,110]){let o=findTake(s,id);o.holder=null;o.guard=null;s.objectives.push(o);}
  setup.kind='tower';setup.remaining=s.objectives.length;
 }
 shuffle(s,s.deck);
 s.setupReveal=setup;
 s.revealSteps=0;
 log(s,s.scenario==='anduin'?'剧本设置：每位玩家各翻开1张遭遇卡（逐张结算，可在翻开时使用取消响应）':'剧本设置：为每张目标各翻开1张遭遇卡（逐张结算，可在翻开时使用取消响应）');
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
 if(x.kind==='tower'){s.staging.push(c);const o=s.objectives.find(o=>o.uid===x.guard);if(o){o.guard=c.uid;c.guard=o.uid;log(s,`「${c.name}」成为「${o.name}」的守卫`);}}
 else s.staging.push(c);
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
 if(s.scenario==='anduin'){if(!inplay(s,82)){const t=findTake(s,82);if(t){s.staging.push(t);log(s,'山丘巨魔进入探查区');}}shuffle(s,s.deck);}
 if(s.scenario==='dolguldur'){
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
function stage(s){assert(!s.questing,'请使用逐张探查流程');ready(s);assert(s.phase===2,'仅在探险阶段探查。');assert(s.stagedRound!==s.round,'本回合已经执行过探查。');s.stagedRound=s.round;s.revealSteps=0;if(s.quest!==128)reveal(s,live(s).length+(s.quest===127?1:0));else log(s,'河岸伏击：跳过探查步骤');s.revealSteps=0;}
function threat(s){return s.phaseThreat+s.staging.filter(c=>['Enemy','Location'].includes(c.type)).reduce((n,c)=>n+(s.planning?P2.stats(s,c.uid).threat:(c.threat||0))+(c.bonus||0),0);}
function addProgress(s,n,internal=false){ready(s);assert(internal||!s.planning||![1,2].includes(s.phase),'计划阶段进度必须由卡牌效果自动结算。');assert(Number.isInteger(n)&&n>=0,'进度须为非负整数。');let left=n;
 if(s.active){let c=s.active,k=Math.min(left,Math.max(0,c.quest-(c.progress||0)));c.progress=(c.progress||0)+k;left-=k;if(c.progress>=c.quest){s.active=null;leaveLocation(s,c);}}
 s.progress+=left;log(s,`放置${n}点进度，探险卡现有${s.progress}点`);
 if(left>0&&s.quest===124&&!s.rescued)task(s,'此探险卡已有进度。可选择救出囚犯；确认后囚犯受1点伤害，戒灵进入探查区。','rescue');
}
function leaveLocation(s,c){release(s,c.uid);if(c.id===113){s.deck.unshift(c);}else if(c.victory)s.victory.push(c);else discardCard(s,c);log(s,`探索完成「${c.name}」`);if(c.id===78)task(s,'幽暗密林山脉：每位玩家可从己方牌库顶5张选1张入手，其余洗回。');}
function rescue(s,id){const t=s.pending.find(t=>t.id===id);assert(t?.kind==='rescue','没有救援响应。');s.rescued=true;s.staging.push(...s.setaside.splice(0));s.pending=s.pending.filter(t=>t.id!==id);log(s,'囚犯获救，受到1点伤害；戒灵进入探查区');if(s.questing){const h=s.players[s.prisoner.player].heroStates[s.prisoner.hero];P2.damageCharacter(s,P2.find(s,h.uid),1);P2.pump(s);P3.advanceIfReady(s);}else task(s,'请在囚犯英雄上记录1点伤害。');}
function gate(s){if(s.setupPending)return '尚未完成开局设置';if(s.pending.length)return '仍有待结算事项';const q=quest(s);if(s.progress<q.points)return `进度不足：${s.progress}/${q.points}`;
 if(s.quest===121&&!s.spawnDefeated)return '必须在本阶段击败昂哥立安之子';
 if(s.quest===122&&inplay(s,76))return '昂哥立安之子仍在场';
 if(s.quest===126&&inplay(s,82))return '山丘巨魔仍在场';
 if(s.quest===128&&[...s.staging,...s.players.flatMap(p=>p.engaged)].some(c=>c.type==='Enemy'))return '场上仍有敌人';
 if(s.quest===123&&!s.objectives.some(o=>o.holder))return '至少持有1张目标';
 if(s.quest===124&&(!s.rescued||s.objectives.filter(o=>o.holder).length!==3))return '须救出囚犯并持有全部3张目标';
 if(s.quest===125&&inplay(s,102))return '多尔哥多戒灵仍在场';return '';
}
function advance(s,internal=false){assert(internal||!s.questing,'探险推进由规则自动判定');ready(s);assert(!gate(s),gate(s));const map={119:120,120:s.quest===120?(rng(s)<0.5?121:122):121,126:127,127:128,123:124,124:125};if(map[s.quest])enter(s,map[s.quest]);else{s.status='won';log(s,'剧本胜利！');}}
function travel(s,uid,confirmed=false){assert(!s.traveling,'请使用旅行暂定选择与全员二次确认');ready(s);assert(s.phase===3,'仅在旅行阶段旅行。');assert(!s.active,'已有当前地点。');let c=s.staging.find(c=>c.uid===uid);assert(c?.type==='Location','请选择地点。');assert(!s.staging.some(x=>x.id===88)||c.id===88,'必须优先旅行至东湾。');
 if([77,78,94].includes(c.id))assert(confirmed,'请先确认旅行费用可支付并已处理。');
 s.active=remove(s.staging,uid);s.active.progress=0;log(s,`旅行至「${c.name}」`);
 if(c.id===78){s.revealSteps=0;reveal(s,1);s.revealSteps=0;}
 if(c.id===87){s.active=null;leaveLocation(s,c);}
 if(c.id===99)task(s,'古老森林道路：起始玩家可重置1名己方角色。');
 if(c.id===100)task(s,'森林大门：起始玩家可抽2张牌（如抽牌被禁止则不抽）。');
 if(c.id===107)guards(s);
}
function guards(s){for(const p of live(s)){p.engaged.push({id:0,uid:++s.serial,name:'兽人守卫',en:'Orc Guard',type:'Enemy',attack:1,defense:1,health:1,threat:0,rule:'由该玩家牌库顶牌背面表示，离场时回到原所有者的弃牌堆。',synthetic:true});task(s,`${p.name}将自己牌库顶1张牌作为兽人守卫，已在交战区生成对应标记。`);}}
function engage(s,uid,pid){assert(!s.encountering,'请使用主动交战暂定方案与全队确认');ready(s);assert(s.phase===4,'仅在遭遇阶段交战。');const p=s.players[pid];assert(p&&!p.eliminated,'无效玩家。');const c=s.staging.find(x=>x.uid===uid);assert(c?.type==='Enemy','请选择敌人。');if(c.id===83)assert(!s.staging.some(x=>x.type==='Enemy'&&x.uid!==uid),'其他敌人仍在探查区，不能主动交战狙击手。');assert(!p.optionalRound||p.optionalRound!==s.round,'每位玩家每阶段仅可主动交战1次。');p.optionalRound=s.round;p.engaged.push(remove(s.staging,uid));log(s,`${p.name}主动交战「${c.name}」`);if(c.id===75||c.id===96)task(s,`${c.name}交战效果：${c.rule}`);}
function encounterChecks(s){if(s.encountering){P5.beginChecks(s);return;}ready(s);assert(s.phase===4,'仅在遭遇阶段检定。');assert(!s.checkedRound||s.checkedRound!==s.round,'本回合已经完成交战检定。');s.checkedRound=s.round;if(s.quest===127){log(s,'安都因河航道：跳过交战检定');return;}
 let changed=true;while(changed){changed=false;for(let offset=0;offset<s.players.length;offset++){let p=s.players[(s.first+offset)%s.players.length];if(p.eliminated)continue;let cs=s.staging.filter(c=>c.type==='Enemy'&&(c.engagement??999)<=p.threat).sort((a,b)=>b.engagement-a.engagement);if(cs.length){let c=remove(s.staging,cs[0].uid);p.engaged.push(c);log(s,`${p.name}与${c.name}交战（检定）`);if([75,96].includes(c.id))task(s,`${c.name}交战效果：${c.rule}`);changed=true;}}}
}
function defeat(s,uid,internal=false){assert(internal||!s.questing,'请用合法卡牌能力处理伤害与击败');ready(s);let zone=[s.staging,...s.players.map(p=>p.engaged),...(s.combat?[s.combat.riders]:[])].find(a=>a.some(c=>c.uid===uid));assert(zone,'敌人不在场。');const c=zone.find(c=>c.uid===uid);assert(c.type==='Enemy','只能标记敌人被击败。');remove(zone,uid);release(s,uid);if(c.shadows)for(const x of c.shadows)discardCard(s,x);
 delete c.shadows;delete c.shadowRevealed;
 if(c.combatRider){log(s,'额外攻击的座狼骑手被击败；其实体暗影牌仍按暗影规则处理');return;}
 if(c.id===76&&s.quest===121)s.spawnDefeated=true;
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
  for(const p of live(s))adjustThreat(s,p,s.active?.id===114?2:1);
  for(const o of s.objectives.filter(o=>o.holder)){
   if(o.id===109)adjustThreat(s,s.players[o.holder.player],2);
   if(o.id===110)task(s,`暗影钥匙：${s.players[o.holder.player].name}的${s.players[o.holder.player].heroes[o.holder.hero]}受到1点伤害。`);
  }
  s.round++;s.first=(s.first+1)%s.players.length;while(s.players[s.first].eliminated&&live(s).length)s.first=(s.first+1)%s.players.length;
  s.phase=0;
 }else s.phase++;
 if(s.phase===1&&s.players.some(p=>p.heroStates))P2.start(s);
 if(s.phase===2&&s.quest===125)guards(s);
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
const api={refreshing:P7,combat:P6,encountering:P5,traveling:P4,questing:P3,planning:P2,questDone,markQuestDone,endPhase,autoAdvance,closeWindow,passAll,openingChoice,startScenario,setupRevealStep,settleSetupCard,setupCancelOptions,setupCancel,resourcePhase,drawPlayer,extraShadow,resolveQuest,D,byId,phases,create,quest,gate,threat,stage,addProgress,advance,travel,engage,encounterChecks,defeat,shadows,revealShadows,returnEnemy,claim,returnObjective,nextPhase,resolve,rescue,questFailure,adjustThreat,clone,log};
const WindowFactory=typeof WindowRulesFactory!=='undefined'?WindowRulesFactory:require('./window-engine.js');api.windows=WindowFactory(api);
/* 阶段规则：完成判定（纯函数，UI 与「结束阶段」共用）+ 结束阶段入口。 */
const PhaseFactory=typeof PhaseRulesFactory!=='undefined'?PhaseRulesFactory:require('./phase-engine.js');api.phaseRules=PhaseFactory(api);return api;
})();
if(typeof module!=='undefined')module.exports=ScenarioEngine;
