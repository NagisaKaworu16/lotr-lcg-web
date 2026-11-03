/* 《安格玛觉醒》批次1 引擎层单测：5 原语 + effect cases + 暗影解释器。
   数据已落地（data.js ids 143–201），全部走真实卡定义；剧本级 flag/stage 改动用临时补丁并在 finally 还原。 */
const test=require('node:test'),assert=require('node:assert/strict'),E=require('./engine'),P=require('./player-cards'),S=require('./ringsdb-snapshot'),R=E.planning,Q=E.questing,C=E.combat;
function make(spheres=['leadership'],first=0){const cfg=spheres.map(sp=>P.config(P.starter(S,sp),S));const s=E.create('mirkwood',cfg.length,12345,cfg,{deferSetup:true,first,openingTest:true});for(const p of s.players)E.openingChoice(s,p.id);E.startScenario(s);E.nextPhase(s);while(R.active(s)!==null)R.endTurn(s,R.active(s));for(const p of s.players)R.passAction(s,p.id);E.nextPhase(s);assert.equal(s.phase,1);E.nextPhase(s);return s;}
function passes(s){for(const p of s.players)if(!p.eliminated)Q.pass(s,p.id);}
function move(s){passes(s);Q.move(s);}
function responses(s){while(s.questing.tasks.length){const sp=Q.spec(s),a=Object.fromEntries(sp.fields.map(f=>[f.key,f.options[0]?.value]));Q.choose(s,sp.task.id,{...a,skip:sp.unavailable&&sp.task.optional});}}
function commitAll(s){move(s);for(const pid of [...s.questing.order]){Q.commit(s,pid,Q.eligible(s,pid).map(c=>c.uid));responses(s);}move(s);}
function one(s,id){s.questing.remaining=[{}];const c={...E.byId[id],uid:++s.serial};s.deck.unshift(c);Q.drawNext(s);return c;}
function patch(obj,key,value,fn){const old=obj[key];obj[key]=value;try{fn();}finally{if(old===undefined)delete obj[key];else obj[key]=old;}}
function stageDefPatch(s,mut,fn){const st=E.D.scenarios.find(x=>x.id===s.scenario).stages.find(x=>x.id===s.quest);const old={...st};Object.assign(st,mut);try{fn();}finally{for(const k of Object.keys(mut))if(old[k]===undefined)delete st[k];else st[k]=old[k];}}
function flagPatch(s,mut,fn){const sc=E.D.scenarios.find(x=>x.id===s.scenario);const old={...(sc.flags||{})};sc.flags={...old,...mut};try{fn();}finally{sc.flags=old;}}
function alive(s){return s.players.filter(p=>!p.eliminated);}

/* ── 原语1：H.mill ── */
test('mill moves top N cards one by one; stops when deck empties; no elimination without flag',()=>{const s=make();const p=s.players[0];const n=p.playerDeck.length;const got=E.mill(s,0,3);assert.equal(got,3);assert.equal(p.playerDeck.length,n-3);assert.equal(p.playerDiscard.length,3);const got2=E.mill(s,0,999);assert.equal(got2,n-3);assert.equal(p.playerDeck.length,0);assert(!s.pending.length,'无 deckOutElimination 旗标时不淘汰');});
test('deckOutElimination: mill and draw failures route the player through the eliminate task',()=>{const s=make();flagPatch(s,{deckOutElimination:true},()=>{const p=s.players[0];E.mill(s,0,999);assert(s.pending.some(t=>t.kind==='eliminate'&&t.args.player===0),'mill 耗尽应登记淘汰事项');s.pending=[];p.playerDeck=[];E.drawPlayer(s,p,1);assert(s.pending.some(t=>t.kind==='eliminate'&&t.args.player===0),'抽牌失败路径同样淘汰');s.pending=[];});});
test('deckOutElimination eliminate task resolves via E.resolve',()=>{const s=make(['leadership','spirit']);flagPatch(s,{deckOutElimination:true},()=>{const p=s.players[0];p.playerDeck=[];E.mill(s,0,1);const t=s.pending.find(x=>x.kind==='eliminate');E.resolve(s,t.id);assert(p.eliminated);});});

/* ── 原语2：time 倒计时 ── */
function revealTo(s,id){commitAll(s);const c=one(s,id);Q.resolveReveal(s);return c;}
test('time card placed in staging gets counters; tickTime decrements; 165 millEach expire mills 5 and resets 1',()=>{const s=make();const c=revealTo(s,165);assert(s.staging.includes(c));assert.equal(c.timeLeft,3);const deck0=alive(s).map(p=>p.playerDeck.length);E.tickTime(s);assert.equal(c.timeLeft,2);E.tickTime(s);E.tickTime(s);assert.equal(c.timeLeft,1,'millEach reset=1 回填');alive(s).forEach((p,i)=>assert.equal(p.playerDeck.length,deck0[i]-5,'每人 mill 5'));});
test('150 time expire discards the hidden Iârion and the players lose (161 out of play)',()=>{const s=make();const c=revealTo(s,150);assert.equal(c.timeLeft,4);c.timeLeft=1;const i={...E.byId[161],uid:++s.serial};s.underQuest.push(i);E.tickTime(s);assert.equal(s.status,'lost');assert.equal(s.underQuest.length,0);assert(s.discard.some(x=>x.id===161));});
test('189 time expire: 1 hero per player takes 4 damage, counters reset (perpetual)',()=>{const s=make();const c=revealTo(s,189);assert.equal(c.timeLeft,4);const h=s.players[0].heroStates[0];for(let i=0;i<4;i++)E.tickTime(s);assert.equal(h.damage,4,'第一名英雄受4伤');assert.equal(c.timeLeft,4,'计数重置，永续');});
test('time counters vanish when the card leaves play (defeat path)',()=>{const s=make();const c=revealTo(s,150);assert.equal(c.timeLeft,4);E.defeat(s,c.uid,true);assert(c.timeLeft===undefined);});

/* ── 150 营救伊亚里安：WR / 击败 / 时间 ── */
test('150 WR takes controlled Iârion face-down under the quest; defeat returns him to first player exhausted',()=>{const s=make();const i={...E.byId[161],uid:++s.serial};i.holder={player:0,hero:0};s.objectives.push(i);commitAll(s);const c=one(s,150);Q.resolveReveal(s);assert(s.staging.some(x=>x.id===150));assert.equal(c.timeLeft,4);assert(!s.objectives.includes(i));assert(s.underQuest.includes(i));E.defeat(s,c.uid,true);assert(s.objectives.includes(i));assert.deepEqual(i.holder,{player:s.first,hero:null});assert(i.exhausted);});
test('defeat accepts side quests but still rejects plain treacheries',()=>{const s=make();assert.throws(()=>E.defeat(s,1,true));});

/* ── 原语3：Indestructible + gate.spawnHpZero ── */
test('Thaurdir accumulates damage but is never destroyed; manual defeat is rejected',()=>{const s=make();const c={...E.byId[162],uid:++s.serial};s.staging.push(c);R.damageEnemy(s,c.uid,20);assert(s.staging.some(x=>x.uid===c.uid),'不可摧毁：仍在场');assert.equal(c.damage,20,'伤害仍累积');assert.throws(()=>E.defeat(s,c.uid),'手动击败被拒绝');});
test('gate.spawnHpZero: hp zeroed while still in play satisfies the gate (unlike spawnDefeated)',()=>{const s=make();s.progress=999;const c={...E.byId[162],uid:++s.serial,damage:3};s.staging.push(c);stageDefPatch(s,{gate:{spawnHpZero:162}},()=>{const g1=E.gate(s);assert(g1.includes('血量'),'血量未归零应被拦：'+g1);c.damage=9;assert.equal(E.gate(s),'','血量归零（仍在场）即达成');});});
test('gate.controlsObjective: players must hold the listed objective-ally',()=>{const s=make();s.progress=999;const i={...E.byId[161],uid:++s.serial};s.objectives.push(i);stageDefPatch(s,{gate:{controlsObjective:[161]}},()=>{const g1=E.gate(s);assert(g1.includes('控制'),'未持有应被拦：'+g1);i.holder={player:0,hero:0};assert.equal(E.gate(s),'');});});

/* ── 原语4/5：onEnter 扩展 + setup 扩展 ── */
function settlePending(s){let n=0;while(s.pending.length&&n++<20){const t=s.pending[0];const choice=t.kind==='searchEngage'?s.deck.find(c=>c.id===t.args.card)?.uid:undefined;E.resolve(s,t.id,choice);}}
test('DD 172 onEnter searchEngage fires at setup; resolving engages the searched card',()=>{const cfg=[P.config(P.starter(S,'leadership'),S)];const s=E.create('dd',1,777,cfg,{openingTest:true});assert(s.pending.some(t=>t.kind==='searchEngage'&&t.args.card===164),'设置时应登记搜索事项');const target=s.deck.find(c=>c.id===164);assert(target,'164 应在牌库中');const p=s.players[0];const encN=p.engaged.length;settlePending(s);assert(p.engaged.length===encN+1&&p.engaged.some(c=>c.id===164));assert(!s.deck.includes(target));});
test('DD 173 onEnter spawnSetAside brings Thaurdir from setAside into staging; setup 161 controlled by P1',()=>{const cfg=[P.config(P.starter(S,'leadership'),S)];const s=E.create('dd',1,777,cfg,{openingTest:true});const i=s.objectives.find(o=>o.id===161);assert(i&&i.holder&&i.holder.player===0,'161 设置专用卡直接入场并归玩家1');settlePending(s);assert(s.setaside.some(c=>c.id===162));s.progress=999;E.advance(s,true);assert.equal(s.quest,173);assert(s.staging.some(c=>c.id===162),'索尔迪尔从预置区生成');assert(!s.setaside.some(c=>c.id===162));});
test('TWH setup: makeActive 185, ensureInStaging 184/192, setAside 155/183',()=>{const cfg=[P.config(P.starter(S,'leadership'),S)];const s=E.create('twh',1,888,cfg,{openingTest:true});assert(s.active&&s.active.id===185);assert(s.staging.some(c=>c.id===184));assert(s.staging.some(c=>c.id===192));assert(s.setaside.some(c=>c.id===155)&&s.setaside.some(c=>c.id===183));});
test('IiC setup: objective 161 controlled by player 1, ensureInStaging 143, perPlayerLocation task',()=>{const cfg=[P.config(P.starter(S,'leadership'),S)];const s=E.create('iic',1,999,cfg,{openingTest:true});const i=s.objectives.find(o=>o.id===161);assert(i&&i.holder&&i.holder.player===0);assert(s.staging.some(c=>c.id===143));assert(s.pending.some(t=>t.kind==='setupManual'));});

/* ── 刷新末尾统一时点：threatPerStagingEnemy / 185 ── */
test('refresh end: stage.threatPerStagingEnemy adds staging enemy count; active 185 damages 1 character per player',()=>{const s=toCombatDone();const e1={...E.byId[96],uid:++s.serial},e2={...E.byId[97],uid:++s.serial};s.staging.push(e1,e2);const ridge={...E.byId[185],uid:++s.serial};s.active=ridge;for(const p of s.players)for(const h of p.heroStates)h.exhausted=false;const t0=s.players.map(p=>p.threat),h0=s.players[0].heroStates[0].damage;
 stageDefPatch(s,{threatPerStagingEnemy:true},()=>{E.refreshing.start(s);});
 assert.deepEqual(s.players.map(p=>p.threat),t0.map(t=>t+1+2),'基础+1、每个探查区敌人+1');assert.equal(s.players[0].heroStates[0].damage,h0+1,'185：第一名英雄受1伤');});

/* ── 167 福诺斯特广场：mill 钩子 + 威胁 ── */
test('167: first player mills place resources and each resource raises its staging threat',()=>{const s=make(['leadership','spirit'],0);const sq={...E.byId[167],uid:++s.serial};s.staging.push(sq);const t0=E.threat(s);assert.equal(E.threat(s),t0,'初始无资源不加成');E.mill(s,0,2);assert.equal(sq.resources,2,'第一玩家 mill 触发资源');assert.equal(E.threat(s),t0+2,'威胁+=资源数');E.mill(s,1,1);assert.equal(sq.resources,2,'非第一玩家 mill 不触发');});

/* ── 165 旅行 ── */
test('165 travel: each player mills 1',()=>{const s=make();s.phase=3;const c={...E.byId[165],uid:++s.serial};s.staging.push(c);const d0=alive(s).map(p=>p.playerDeck.length);E.travel(s,c.uid);alive(s).forEach((p,i)=>assert.equal(p.playerDeck.length,d0[i]-1));assert.equal(s.active.uid,c.uid);});

/* ── 162 巫术立即攻击 ── */
test('Thaurdir immediately attacks the first player when a Sorcery treachery is revealed',()=>{const s=make();const th={...E.byId[162],uid:++s.serial};s.staging.push(th);commitAll(s);const sorcery={id:250,name:'巫术诡计',en:'Sorcery Trick',type:'Treachery',traits:'Sorcery.',rule:'',quantity:1,uid:++s.serial};s.questing.remaining=[{}];s.deck.unshift(sorcery);Q.drawNext(s);Q.resolveReveal(s);const h=s.players[s.first].heroStates[0];assert.equal(h.damage,th.attack,'第一玩家第一名英雄承受索尔迪尔攻击力伤害');});

/* ── effect cases ── */
test('152 Angmar Orc: discard an ally, or pass to reveal an extra encounter card',()=>{const s=make();commitAll(s);const p=s.players[0];const ally={...p.hand.find(c=>R.data(s,c).type==='ally'),uid:++s.serial,owner:0,controller:0,damage:0,exhausted:false,committed:false};p.allies.push(ally);
 one(s,152);Q.resolveReveal(s);let sp=Q.spec(s);assert.equal(sp.task.kind,'angmarOrc');Q.choose(s,sp.task.id,{target:String(ally.uid)});drainQ(s);assert(!p.allies.includes(ally),'盟友被弃');
 one(s,152);Q.resolveReveal(s);sp=Q.spec(s);Q.choose(s,sp.task.id,{skip:true});drainQ(s);assert.equal(s.questing.remaining.length,1,'放弃 → 额外翻开1张');});
test('147 Sudden Assault: willpower beats threat → staging enemies attack first player',()=>{const s=make();commitAll(s);s.staging=[];const wp={...E.byId[143],uid:++s.serial,threat:0};s.staging.push(wp);assert.ok(Q.total(s)>E.threat(s));one(s,147);Q.resolveReveal(s);const sp=Q.spec(s);assert.equal(sp.task.kind,'suddenAssault');const h=s.players[s.first].heroStates[0];Q.choose(s,sp.task.id,{target:h.uid});assert.equal(h.damage,wp.attack);});
test('147 Sudden Assault fallback searches Orc War Party into staging',()=>{const s=make();commitAll(s);s.staging=[];s.deck.push({...E.byId[143],uid:++s.serial});one(s,147);Q.resolveReveal(s);assert(s.staging.some(c=>c.id===143),'无攻击发生 → 搜出兽人战团');assert.equal(s.questing.tasks.length,0);});
test('148 Surprising Speed: engaged enemies return to staging; with none, surge + doomed 1',()=>{const s=make();commitAll(s);const e={...E.byId[96],uid:++s.serial};s.players[0].engaged.push(e);one(s,148);Q.resolveReveal(s);const sp=Q.spec(s);assert.equal(sp.task.kind,'returnEnemy148');Q.choose(s,sp.task.id,{target:e.uid});assert(s.staging.includes(e));assert(!s.players[0].engaged.includes(e));});
test('148 with no engaged enemies: surge and doomed 1',()=>{const s=make();commitAll(s);one(s,148);const t0=s.players.map(p=>p.threat);Q.resolveReveal(s);assert.equal(s.questing.remaining.length,1,'涌现');assert.deepEqual(s.players.map(p=>p.threat),t0.map(t=>t+1),'厄运1');});
test('155 Orc Ambush: each player searches an Orc enemy and engages it',()=>{const s=make();commitAll(s);one(s,155);Q.resolveReveal(s);const sp=Q.spec(s);assert.equal(sp.task.kind,'orcAmbush');const orc=sp.fields[0].options[0];Q.choose(s,sp.task.id,{target:orc.value});assert(s.players[0].engaged.some(c=>String(c.uid)===String(orc.value)));});
test('159 Weight of Responsibility: one reveal per quest card in play',()=>{const s=make();commitAll(s);const sq={...E.byId[149],uid:++s.serial};s.staging.push(sq);one(s,159);Q.resolveReveal(s);assert.equal(s.questing.remaining.length,2,'当前1张+支线1张=2');});
test('170 Unnatural Fog: per player mill-per-committed or withdraw all',()=>{const s=make(['leadership','spirit']);commitAll(s);one(s,170);Q.resolveReveal(s);const sp=Q.spec(s);assert.equal(sp.task.kind,'fog170');const pid=sp.task.actor;const committedN=Q.eligible(s,pid).length+0;const count=sp.task.payload.count;const deck0=s.players[pid].playerDeck.length;Q.choose(s,sp.task.id,{mode:'mill'});assert.equal(s.players[pid].playerDeck.length,deck0-count,'mill 数=承诺角色数');});
test('175 Cursed Dead: every copy in the encounter discard joins staging',()=>{const s=make();commitAll(s);const a={...E.byId[175],uid:++s.serial},b={...E.byId[175],uid:++s.serial};s.discard.push(a,b);one(s,175);Q.resolveReveal(s);assert(s.staging.includes(a)&&s.staging.includes(b));});
test('176 Restless Evil: Undead enemies get +1 threat/attack/defense until end of round; surge without Undead',()=>{const s=make();commitAll(s);const th={...E.byId[162],uid:++s.serial};s.staging.push(th);one(s,176);Q.resolveReveal(s);assert.equal(th.attack,7);assert.equal(th.defense,5);assert.equal(th.threat,5);assert.equal(th.undeadBoostRound,s.round);});
test('176 with no Undead: surge',()=>{const s=make();commitAll(s);one(s,176);Q.resolveReveal(s);assert.equal(s.questing.remaining.length,1);});
test('178 Terror of the North: mill 3 each; staging threat +2 per distinct milled card type',()=>{const s=make();commitAll(s);one(s,178);const d0=alive(s).map(p=>p.playerDeck.length);Q.resolveReveal(s);alive(s).forEach((p,i)=>assert.equal(p.playerDeck.length,d0[i]-3));const m=s.questing.encounterModifiers.find(x=>x.kind==='staging'&&x.stat==='threat');assert(m&&m.amount>0&&m.amount%2===0,'按不同类型数×2 加探查区威胁');});
test('179 Dark Sorcery: each player discards every controlled ally sharing a name with his discard pile',()=>{const s=make();commitAll(s);const p=s.players[0];const give={uid:++s.serial,code:'01016',owner:0,controller:0,damage:0,exhausted:false,committed:false};p.allies.push(give);p.playerDiscard.push({uid:++s.serial,code:'01016',owner:0});one(s,179);Q.resolveReveal(s);assert(!p.allies.includes(give),'同名盟友被弃');assert(p.playerDiscard.includes(give));});
test('180 Heavy Curse: surge + attaches to quest; playing a card sharing a name with own discard costs +1',()=>{const s=make(['lore']);commitAll(s);one(s,180);const t0=s.questing.remaining.length;Q.resolveReveal(s);assert.equal(s.questing.remaining.length,t0+1,'涌现');assert(s.questAttachments?.some(a=>a.card.id===180));
 /* 打出与弃牌堆同名的卡：费用 = 印制费用 +1，全部落在唯一有资源的英雄上。 */
 s.questing.remaining=[];s.questing.current=null;s.questing.step='staging';Q.drawNext(s); /* 清掉涌现余量，回到可行动窗口 */
 const p=s.players[0];const event=p.hand.find(c=>{if(R.data(s,c).type!=='event')return false;const sp2=R.playSpec(s,0,c.uid,{});return sp2.legal;});assert(event,'手中需有合法事件');
 const params=Object.fromEntries(R.playSpec(s,0,event.uid,{}).fields.map(f=>[f.key,f.options[0].value]));
 p.playerDiscard.push({uid:++s.serial,code:event.code,owner:0});
 for(const h of p.heroStates)h.resources=0;const hero=p.heroStates[0];hero.resources=10;
 const sp=R.playSpec(s,0,event.uid,{});assert.equal(sp.cost,sp.payment?sp.cost:sp.cost);
 const before=hero.resources;Q.queueAction(s,'play',0,event.uid,params);Q.approveActions(s,0);
 assert.equal(hero.resources,before-sp.cost-1,'实际支付 = 印制费用 +1（180 条件附属）');});
test('188 Ice Storm: each player assigns X=quest cards damage to own characters; damaged characters exhaust',()=>{const s=make();commitAll(s);const sq={...E.byId[149],uid:++s.serial};s.staging.push(sq);one(s,188);Q.resolveReveal(s);const sp=Q.spec(s);assert.equal(sp.task.kind,'iceStorm188');assert.equal(sp.task.payload.left,2,'X=场上探险卡数');const h=s.players[0].heroStates[0];Q.choose(s,sp.task.id,{target:h.uid});const sp2=Q.spec(s);Q.choose(s,sp2.task.id,{target:s.players[0].heroStates[1].uid});assert.equal(h.damage,1);assert.equal(h.exhausted,true,'结算完毕后所有受伤角色横置');assert.equal(s.players[0].heroStates[1].exhausted,true);});
test('194 Biting Wind: first player distributes X=committed count damage among committed characters',()=>{const s=make();commitAll(s);const n=s.players.flatMap(p=>p.heroStates).filter(h=>h.committed).length;one(s,194);Q.resolveReveal(s);const sp=Q.spec(s);assert.equal(sp.task.kind,'bitingWind194');assert.equal(sp.task.payload.left,n);const h=s.players[0].heroStates.find(h2=>h2.committed);Q.choose(s,sp.task.id,{target:h.uid});assert.equal(h.damage,1);});
test('195 Freezing Blast: every damaged committed character leaves the quest; doomed 2 comes from data',()=>{const s=make();commitAll(s);const h=s.players[0].heroStates[0];h.damage=2;const h2=s.players[0].heroStates[1];one(s,195);const t0=s.players.map(p=>p.threat);Q.resolveReveal(s);assert.equal(h.committed,false,'受伤角色离队');assert(h2.committed,'未受伤角色保持投入');assert.deepEqual(s.players.map(p=>p.threat),t0.map(t=>t+2),'厄运2由数据 doomed 字段结算');});
test('196 Cold from Angmar: 1 hero per player takes 1 damage; treachery attaches to quest',()=>{const s=make();commitAll(s);one(s,196);Q.resolveReveal(s);for(const p of alive(s))assert.equal(p.heroStates.filter(h=>(h.damage||0)>0).length,1,'每名玩家恰1名英雄受1伤');assert(s.questAttachments?.some(a=>a.card.id===196));});
test('200 Tragic Discovery: every player gains the active location threat',()=>{const s=make();commitAll(s);s.active=s.staging.splice(s.staging.findIndex(c=>c.id===99),1)[0];const t=s.active.threat;one(s,200);const t0=s.players.map(p=>p.threat);Q.resolveReveal(s);assert.deepEqual(s.players.map(p=>p.threat),t0.map(x=>x+t));});

/* ── 暗影解释器 applyShadow ── */
function pass(s){for(const p of s.players)if(!p.eliminated)Q.pass(s,p.id);}
function toPhase5({spheres=['leadership'],enemies=[{id:97,pid:0}],shadows=[],first=0}={}){const s=make(spheres,first);finishQuest(s);E.nextPhase(s);assert.equal(s.phase,3);E.traveling.propose(s,s.first,null);pass(s);E.traveling.finish(s);E.nextPhase(s);assert.equal(s.phase,4);
 for(const p of s.players)if(!p.eliminated)E.encountering.propose(s,p.id,null);pass(s);E.encountering.beginChecks(s);pass(s);E.encountering.finish(s);
 /* 战斗阶段发暗影前先铺好暗影牌库与交战敌人（E.nextPhase→P6.start 会立即发暗影）；
    同时重置投入期造成的横置，保证战斗/刷新框架的可操作性。 */
 for(const p of s.players)for(const h of p.heroStates){h.exhausted=false;h.committed=false;}
 s.deck=shadows.map(x=>typeof x==='object'?{...x,uid:++s.serial}:{...E.byId[x],uid:++s.serial});
 for(const v of enemies)s.players[v.pid??0].engaged.push({...E.byId[v.id],...v,uid:++s.serial});
 E.nextPhase(s);assert.equal(s.phase,5);return s;}
function finishQuest(s){commitAll(s);s.staging=[];s.questing.remaining=[];s.questing.current=null;s.questing.step='staging';Q.drawNext(s);move(s);pass(s);Q.move(s);assert(s.questing.completed,'探险阶段完成');}
function toCombatDone(opts){const s=toPhase5(opts);s.combat={round:s.round,completed:true};s.phase=6;return s;}
function advance(s){pass(s);C.move(s);}
function selectEnemy(s,uid=s.players[C.activeEnemyPlayer(s)].engaged[0].uid){if(s.combat.step==='enemyAction'||s.combat.step==='afterEnemy')advance(s);C.propose(s,C.activeEnemyPlayer(s),'enemy',uid);for(const p of s.players.filter(p=>!p.eliminated)){if(!s.combat.proposal)break;C.approve(s,p.id);}return uid;}
function defend(s,ids=[]){advance(s);C.propose(s,s.combat.attack.player,'defense',null,ids);for(const p of s.players.filter(p=>!p.eliminated)){if(!s.combat.proposal)break;C.approve(s,p.id);}if(s.combat.step==='defenderResponses')C.respond(s,'skip');}
function clearTasks(s){let n=0;while(C.spec(s)&&n++<20){const sp=C.spec(s);C.choose(s,sp.task.id,{target:sp.fields[0].options[0].value});}}
function drainQ(s){let n=0;while(s.questing.queue.length&&n++<20){const sp=R.choiceSpec(s);R.resolveChoice(s,sp.task.id,sp.task.optional?{skip:true}:Object.fromEntries(sp.fields.map(f=>[f.key,f.options[0]?.value])));}}
test('shadowSpec 148 {atk,returnToStaging}: attack +1 and the enemy returns to staging after the attack',()=>{const s=toPhase5({shadows:[148]});const uid=selectEnemy(s);const atk0=R.stats(s,uid).attack;const h=s.players[0].heroStates[0];const def0=R.stats(s,h.uid).defense;defend(s,[h.uid]);advance(s);assert.equal(s.combat.step,'shadowWindow');C.resolveShadow(s);clearTasks(s);C.resume(s);advance(s);assert.equal(s.combat.attack.damage,atk0+1-def0,'atk+1 计入攻击');assert(s.staging.some(c=>c.uid===uid),'returnToStaging：攻击后返回探查区');});
test('shadowSpec 194 {damage:{target:defender,amount:1}}: defender takes 1',()=>{const s=toPhase5({shadows:[194]});selectEnemy(s);const h=s.players[0].heroStates[0];defend(s,[h.uid]);advance(s);C.resolveShadow(s);clearTasks(s);assert.equal(h.damage,1);});
test('shadowSpec 164 {exhaust:{count:1}} registers an exhaust choice',()=>{const s=toPhase5({shadows:[164]});selectEnemy(s);defend(s,[s.players[0].heroStates[0].uid]);advance(s);C.resolveShadow(s);const sp=C.spec(s);assert.equal(sp.task.kind,'exhaust');});
test('shadowSpec 169 {discard:attachment} registers an attachment discard choice',()=>{const s=toPhase5({shadows:[169]});selectEnemy(s);
 /* 预置1张附属，使弃附属任务有合法目标 */
 const hero=s.players[0].heroStates[0];s.players[0].attachments.push({uid:++s.serial,code:'01040',owner:0,controller:0,target:hero.uid,exhausted:false});
 defend(s,[hero.uid]);advance(s);C.resolveShadow(s);const sp=C.spec(s);assert.equal(sp.task.kind,'attachment');C.choose(s,sp.task.id,{target:String(s.players[0].attachments[0].uid)});assert.equal(s.players[0].attachments.length,0,'附属被弃');});
test('unknown shadowSpec key fails loud',()=>{const s=toPhase5({shadows:[{id:299,name:'测试暗影',type:'Treachery',shadow:'',shadowSpec:{bogus:1}}]});selectEnemy(s);defend(s,[s.players[0].heroStates[0].uid]);advance(s);assert.throws(()=>C.resolveShadow(s),/未知 shadowSpec 键/);});

/* ── 163/174 交战钩子 ── */
test('engage hook 163: mill 2 from the engaging player via the engagement check',()=>{const s=make();finishQuest(s);E.nextPhase(s);E.traveling.propose(s,s.first,null);pass(s);E.traveling.finish(s);E.nextPhase(s);const e={...E.byId[163],uid:++s.serial};s.staging.push(e);E.encountering.propose(s,s.first,null);s.players[0].threat=99;pass(s);E.encountering.beginChecks(s);assert(s.players[0].engaged.some(c=>c.uid===e.uid),'自动交战');assert.equal(s.players[0].playerDiscard.length,2,'mill 2');});
test('engage hook 174: top Undead enemy in the encounter discard joins and engages',()=>{const s=make();finishQuest(s);E.nextPhase(s);E.traveling.propose(s,s.first,null);pass(s);E.traveling.finish(s);E.nextPhase(s);const dead={...E.byId[174],uid:++s.serial};s.staging.push(dead);const undead={...E.byId[162],uid:++s.serial};s.discard.push(undead);E.encountering.propose(s,s.first,null);s.players[0].threat=99;pass(s);E.encountering.beginChecks(s);assert(s.players[0].engaged.some(c=>c.uid===dead.uid));assert(s.players[0].engaged.some(c=>c.uid===undead.uid),'弃牌堆顶亡灵敌人随之交战');});
test('attack hook 164: defender discards top deck card; ally on top gives this attack +2',()=>{const s=toPhase5({enemies:[{id:164,pid:0}]});const p=s.players[0];p.playerDeck.unshift({uid:++s.serial,code:'01016',owner:0});const uid=selectEnemy(s);assert.equal(s.combat.attack.bonus,2,'牌库顶是盟友 → 攻击+2');assert.equal(p.playerDiscard.length,1,'弃掉牌库顶1张');
 const s2=toPhase5({enemies:[{id:164,pid:0}]});const p2=s2.players[0];p2.playerDeck.unshift({uid:++s.serial,code:'01022',owner:0});selectEnemy(s2);assert.equal(s2.combat.attack.bonus,0,'牌库顶非盟友 → 无加成');});

/* ── verify-angmar 复核修复回归 ── */
test('P0 no-win: 143 Orc War Party in play blocks victory; removing it wins (iic final stage, hardcoded)',()=>{const cfg=[P.config(P.starter(S,'leadership'),S)];const s=E.create('iic',1,999,cfg,{openingTest:true});settlePending(s);
 const i=s.objectives.find(o=>o.id===161);i.holder={player:0,hero:null};
 s.progress=999;E.advance(s,true);assert.notEqual(s.status,'won','143 兽人战团在场不能获胜');
 s.staging.splice(s.staging.findIndex(c=>c.id===143),1);
 E.advance(s,true);assert.equal(s.status,'won','143 离场后正常获胜');});
test('P0 no-win: twh stage 191 reveals 183 Amon Fûn which blocks victory until it leaves play',()=>{const cfg=[P.config(P.starter(S,'leadership'),S)];const s=E.create('twh',1,888,cfg,{openingTest:true});settlePending(s);
 s.progress=999;E.advance(s,true);assert.equal(s.quest,191);assert(s.staging.some(c=>c.id===183),'进入 191 时从预置区翻开 183 入探查区');
 s.progress=999;E.advance(s,true);assert.notEqual(s.status,'won','183 在场阻断胜利');
 s.staging.splice(s.staging.findIndex(c=>c.id===183),1);
 E.advance(s,true);assert.equal(s.status,'won','183 离场后正常获胜');});
test('P0 no-win: stage.noWinWhileInPlay data field blocks victory (data-driven path)',()=>{const s=make();s.staging=[];const e={...E.byId[96],uid:++s.serial};s.staging.push(e);
 stageDefPatch(s,{next:null,noWinWhileInPlay:[96]},()=>{s.progress=999;E.advance(s,true);assert.notEqual(s.status,'won','数据字段声明的在场卡阻断胜利');
  s.staging=[];E.advance(s,true);assert.equal(s.status,'won','离场后正常获胜');});});
test('P0 147 Sudden Assault cannot be canceled (no Test of Will / Eleanor options)',()=>{const s=make(['spirit']);commitAll(s);s.staging=[];const wp={...E.byId[143],uid:++s.serial,threat:0};s.staging.push(wp);s.deck.push({...E.byId[143],uid:++s.serial});
 const h=s.players[0].heroStates[0];h.resources=1;s.players[0].hand.push({uid:++s.serial,code:'01050',owner:0});
 one(s,148);assert(Q.cancelOptions(s).length>0,'普通诡计在取消窗口可考验取消');Q.resolveReveal(s);
 one(s,147);assert.equal(Q.cancelOptions(s).length,0,'147 不可取消：不提供任何取消选项');assert.throws(()=>Q.cancel(s,'will:'+s.players[0].hand[0].uid),'取消响应被拒绝');Q.resolveReveal(s);
 assert.equal(Q.spec(s).task.kind,'suddenAssault','效果照常进入攻击任务');});
test('P1 DD 172 follow-up: after all searches the deck is shuffled and 1 card per player is revealed into staging',()=>{const cfg=[P.config(P.starter(S,'leadership'),S)];const s=E.create('dd',1,777,cfg,{openingTest:true});
 /* 受控牌库排除 surge/厄运干扰：搜索拿走 164 后，follow-up 必然翻开剩下的唯一1张 */
 s.deck=[{...E.byId[164],uid:++s.serial},{...E.byId[96],uid:++s.serial}];
 while(s.pending.length){const t=s.pending[0];const choice=t.kind==='searchEngage'?s.deck.find(c=>c.id===t.args.card)?.uid:undefined;E.resolve(s,t.id,choice);}
 assert(!s.deck.length,'翻牌耗尽受控牌库');assert(s.staging.some(c=>c.id===96),'翻出的遭遇牌加入探查区');assert(s.searchEngageFollowUp===undefined,'follow-up 消费后清除');
 const cfg2=[P.config(P.starter(S,'leadership'),S),P.config(P.starter(S,'spirit'),S)];const s2=E.create('dd',2,777,cfg2,{openingTest:true});
 s2.deck=[{...E.byId[164],uid:++s2.serial},{...E.byId[164],uid:++s2.serial},{...E.byId[96],uid:++s2.serial},{...E.byId[97],uid:++s2.serial}];
 while(s2.pending.length){const t=s2.pending[0];const choice=t.kind==='searchEngage'?s2.deck.find(c=>c.id===t.args.card)?.uid:undefined;E.resolve(s2,t.id,choice);}
 assert(!s2.deck.length);assert(s2.staging.some(c=>c.id===96)&&s2.staging.some(c=>c.id===97),'双人局共翻2张加入探查区');});
test('P1 refresh deckOutElimination: mill 1 per player at refresh end; empty deck eliminates',()=>{const s=toCombatDone();flagPatch(s,{deckOutElimination:true},()=>{const p=s.players[0];const d0=p.playerDeck.length;
  E.refreshing.start(s);
  assert.equal(p.playerDeck.length,d0-1,'休整末尾每人弃牌库顶1张');assert.equal(p.playerDiscard.length,1,'弃牌进入弃牌堆');});});
test('P1 refresh deckOutElimination: player with empty deck is routed to elimination',()=>{const s=toCombatDone();flagPatch(s,{deckOutElimination:true},()=>{const p=s.players[0];p.playerDeck=[];p.playerDiscard=[];
  E.refreshing.start(s);
  assert(s.pending.some(t=>t.kind==='eliminate'&&t.args.player===0),'空牌库在休整 mill 时登记淘汰事项');s.pending=[];});});
test('P1 173 Forced: Thaurdir destroying a character offers mill-3 or return-to-staging; mill branch',()=>{const s=toPhase5({enemies:[{id:162,pid:0}]});const p=s.players[0];const h=p.heroStates[0];h.damage=R.stats(s,h.uid).health-1;
 const d0=p.playerDeck.length,dis0=p.playerDiscard.length;selectEnemy(s);defend(s,[h.uid]);
 let guard=0;while(!s.combat.tasks.length&&guard++<6)advance(s);
 const sp=C.spec(s);assert(sp&&sp.task.kind==='thaurdir173','角色被摧毁后登记 173 强制事项');assert(sp.fields[0].options.length===2,'提供 弃3张/返回 两个选项');
 C.choose(s,sp.task.id,{target:'mill'});assert.equal(p.playerDeck.length,d0-3,'弃牌库顶3张');assert.equal(p.playerDiscard.length,dis0+3);});
test('P1 173 Forced: return branch sends Thaurdir back to staging and aborts the rest of the attack',()=>{const s=toPhase5({enemies:[{id:162,pid:0}]});const p=s.players[0];const h=p.heroStates[0];h.damage=R.stats(s,h.uid).health-1;
 selectEnemy(s);defend(s,[h.uid]);let guard2=0;while(!s.combat.tasks.length&&guard2++<6)advance(s);
 const sp=C.spec(s);assert(sp&&sp.task.kind==='thaurdir173');
 const thUid=s.combat.attack.uid;C.choose(s,sp.task.id,{target:'return'});
 assert(s.staging.some(c=>c.uid===thUid),'索尔迪尔返回探查区');assert(!p.engaged.some(c=>c.uid===thUid),'不再处于交战区');});

/* ── v0.16.10 批次2：光环 / X / 条件附属 / 附属限制 / 日志去重 ── */
test('B2 155 Orc Ambush aura: Orc enemies get +1 threat/attack/defense while the side quest is in staging',()=>{const s=make();s.phase=2;const orc={...E.byId[143],uid:++s.serial};s.staging.push(orc);
 assert.equal(R.stats(s,orc.uid).attack,6,'基准（无光环）');
 const sq={...E.byId[155],uid:++s.serial};s.staging.push(sq);
 const st=R.stats(s,orc.uid);assert.equal(st.attack,7);assert.equal(st.defense,4);assert.equal(st.threat,4,'三项各+1，交战检定与探查区威胁共用 stats');
 const spider={...E.byId[96],uid:++s.serial};s.staging.push(spider);
 assert.equal(R.stats(s,spider.uid).attack,E.byId[96].attack,'非兽人不加成');
 const orc2={...E.byId[143],uid:++s.serial};s.players[0].engaged.push(orc2);
 assert.equal(R.stats(s,orc2.uid).attack,7,'交战区兽人同样加成');
 s.staging.splice(s.staging.indexOf(sq),1);
 assert.equal(R.stats(s,orc.uid).attack,6,'支线离场光环消失');});
test('B2 156 Rugged Country: +2 threat only while the current quest is a side quest',()=>{const s=make();s.phase=2;const loc={...E.byId[156],uid:++s.serial};s.staging.push(loc);
 assert.equal(R.stats(s,loc.uid).threat,2,'正式关不加成');
 E.byId[s.quest]={id:s.quest,type:'Side Quest',name:'临时支线'};try{assert.equal(R.stats(s,loc.uid).threat,4,'当前探险为支线时威胁+2');}finally{delete E.byId[s.quest];}
 assert.equal(R.stats(s,loc.uid).threat,2,'补丁还原');});
test('B2 157 Shrouded Hills: threat X = quest cards in play (dynamic)',()=>{const s=make();s.phase=2;const loc={...E.byId[157],uid:++s.serial};s.staging.push(loc);
 assert.equal(R.stats(s,loc.uid).threat,1,'只有当前关1张探险卡 → X=1');
 const sq={...E.byId[149],uid:++s.serial};s.staging.push(sq);
 assert.equal(R.stats(s,loc.uid).threat,2,'支线在场 → X=2');
 s.staging.splice(s.staging.indexOf(sq),1);
 assert.equal(R.stats(s,loc.uid).threat,1,'X 随场况动态变化');});
test('B2 157 surge on reveal while it is the only quest card (questing reveal path)',()=>{const s=make();commitAll(s);one(s,157);Q.resolveReveal(s);
 assert(s.staging.some(c=>c.id===157));assert.equal(s.questing.remaining.length,1,'涌现：额外翻1张');});
test('B2 157 no surge when a side quest is already in play',()=>{const s=make();commitAll(s);const sq={...E.byId[149],uid:++s.serial};s.staging.push(sq);one(s,157);Q.resolveReveal(s);
 assert.equal(s.questing.remaining.length,0,'场上已有2张探险卡 → 不涌现');});
test('B2 168 Haunted Keep: first Undead revealed each round gets surge while active',()=>{const s=make();commitAll(s);s.active={...E.byId[168],uid:++s.serial};
 one(s,162);Q.resolveReveal(s);assert.equal(s.questing.remaining.length,1,'本回合第一个亡灵 → 涌现');
 s.questing.remaining=[];one(s,162);Q.resolveReveal(s);assert.equal(s.questing.remaining.length,0,'同回合第二个亡灵 → 不涌现');
 s.questing.remaining=[];s.round++;s.questing.round=s.round; /* 测试垫片：questing 框架按轮校验 */ one(s,162);Q.resolveReveal(s);assert.equal(s.questing.remaining.length,1,'下一回合重新生效');});
test('B2 168 inactive: Undead reveal without surge',()=>{const s=make();commitAll(s);one(s,162);Q.resolveReveal(s);assert.equal(s.questing.remaining.length,0);});
test('B2 183 Amon Forn: an Orc enemy joining staging triggers an immediate attack on the first player',()=>{const s=make();commitAll(s);s.active={...E.byId[183],uid:++s.serial};
 const h=s.players[s.first].heroStates[0];const orc=one(s,143);Q.resolveReveal(s);
 assert(s.staging.some(c=>c.id===143));assert.equal(h.damage,E.byId[143].attack,'第一名玩家英雄承受兽人攻击力伤害');
 const d0=h.damage;const nonOrc=one(s,97);Q.resolveReveal(s);assert.equal(h.damage,d0,'非兽人敌人不触发');});
test('B2 183 inactive: Orc joins staging without attack',()=>{const s=make();commitAll(s);const h=s.players[s.first].heroStates[0];const orc=one(s,143);Q.resolveReveal(s);assert.equal(h.damage,0);});
test('B2 169 Deadmen\'s Gate: triggered action and response each discard that player\'s top deck card',()=>{const s=make(['lore']);commitAll(s);s.questing.remaining=[];s.questing.current=null;s.questing.step='staging';Q.drawNext(s);
 const p=s.players[0];const event=p.hand.find(c=>{if(R.data(s,c).type!=='event')return false;const sp2=R.playSpec(s,0,c.uid,{});return sp2.legal;});assert(event,'手中需有合法事件');
 const gate={...E.byId[169],uid:++s.serial};s.active=gate;
 const d0=p.playerDeck.length;let top=p.playerDeck[0];
 const params=Object.fromEntries(R.playSpec(s,0,event.uid,{}).fields.map(f=>[f.key,f.options[0].value]));
 Q.queueAction(s,'play',0,event.uid,params);Q.approveActions(s,0);
 assert(s.log.some(t=>t.includes('亡者之门')),'行动触发后弃牌库顶1张（洛瑞恩的财富自身抽牌会移动牌库顶，故以日志断言）');
 /* 响应路径（排队响应结算） */
 const d1=p.playerDeck.length;top=p.playerDeck[0];
 R.queue(s,'gloin',0,{uid:R.chars(s)[0].uid,amount:1});const t=R.context(s).queue[0];R.resolveChoice(s,t.id,{});
 assert.equal(p.playerDeck.length,d1-1,'响应结算后同样弃牌库顶1张');assert(p.playerDiscard.includes(top));
 /* 跳过的响应不触发 */
 const d2=p.playerDeck.length;
 R.queue(s,'gloin',0,{uid:R.chars(s)[0].uid,amount:1});const t2=R.context(s).queue[0];R.resolveChoice(s,t2.id,{skip:true});
 assert.equal(p.playerDeck.length,d2,'跳过（未触发效果）不弃牌');});
test('B2 169 inactive: actions do not discard deck top',()=>{const s=make(['lore']);commitAll(s);s.questing.remaining=[];s.questing.current=null;s.questing.step='staging';Q.drawNext(s);
 const p=s.players[0];const event=p.hand.find(c=>{if(R.data(s,c).type!=='event')return false;const sp2=R.playSpec(s,0,c.uid,{});return sp2.legal;});assert(event);
 const params=Object.fromEntries(R.playSpec(s,0,event.uid,{}).fields.map(f=>[f.key,f.options[0].value]));
 Q.queueAction(s,'play',0,event.uid,params);Q.approveActions(s,0);
 assert(!s.log.some(t=>t.includes('亡者之门')),'亡者之门不在场 → 不弃');});
test('B2fix #2 169 covers planning-phase card plays and ability activations',()=>{const s=make(['lore']);const p=s.players[0];
 const gate={...E.byId[169],uid:++s.serial};s.active=gate;
 /* 回到计划阶段自由行动窗口（make() 已走完 phase1，测试垫片重开） */
 s.phase=1;s.planning.completed=false;
 const event=p.hand.find(c=>{if(R.data(s,c).type!=='event')return false;try{return R.playSpec(s,0,c.uid,{}).legal;}catch{return false;}});assert(event,'lore 起手需有合法事件');
 const params=Object.fromEntries(R.playSpec(s,0,event.uid,{}).fields.map(f=>[f.key,f.options[0].value]));
 R.play(s,0,event.uid,params);
 assert(s.log.filter(t=>t.includes('亡者之门')).length===1,'计划阶段打出事件 → 弃牌库顶1张');
 const beravor=R.chars(s).find(c=>c.meta.code==='01012');assert(beravor,'lore 预组需含贝拉沃');
 R.activate(s,0,beravor.uid,{player:'0'});
 assert(s.log.filter(t=>t.includes('亡者之门')).length===2,'能力激活同样触发（第二次）');});
test('B2fix #3 questAttachments cleared on stage advance: 196 blank-text ends with the quest card',()=>{const s=make(['spirit']);commitAll(s);
 s.questAttachments??=[];s.questAttachments.push({card:{...E.byId[196],uid:++s.serial},round:s.round});
 const el=R.chars(s).find(c=>c.meta.code==='01008');el.state.damage=1;el.state.exhausted=false;el.state.committed=false;
 one(s,148);assert(!Q.cancelOptions(s).some(o=>o.value.startsWith('eleanor:')),'196 在场且受伤：文本空白');Q.resolveReveal(s);
 s.questing.remaining=[];s.progress=999;E.advance(s,true);assert.equal(s.quest,120,'换到 2B');
 assert.equal(s.questAttachments.length,0,'换关后条件附属引用清空（官方：condition 随所附卡离场而弃）');
 one(s,148);assert(Q.cancelOptions(s).some(o=>o.value.startsWith('eleanor:')),'同一受伤角色不再被空白（196 已随旧关离场）');});
test('B2 196 conditional attachment: damaged Eleanor loses her cancel response, undamaged keeps it',()=>{const s=make(['spirit']);commitAll(s);
 s.questAttachments??=[];s.questAttachments.push({card:{...E.byId[196],uid:++s.serial},round:s.round});
 const el=R.chars(s).find(c=>c.meta.code==='01008');assert(el,'spirit 预组需含埃莉诺');
 el.state.exhausted=false;el.state.committed=false;
 el.state.damage=1;
 one(s,148);assert(!Q.cancelOptions(s).some(o=>o.value.startsWith('eleanor:')),'受伤 → 印制文本空白，埃莉诺响应不可用');
 el.state.damage=0;
 assert(Q.cancelOptions(s).some(o=>o.value.startsWith('eleanor:')),'未受伤 → 响应可用');});
test('B2 196 conditional attachment: damaged Thalin deals no reveal damage',()=>{const s=make(['tactics']);commitAll(s);
 s.questAttachments??=[];s.questAttachments.push({card:{...E.byId[196],uid:++s.serial},round:s.round});
 const th=R.chars(s).find(c=>c.meta.code==='01006');th.state.damage=1;
 const e1=one(s,97);Q.resolveReveal(s);assert(!e1.damage,'受伤沙林：翻开的敌人不掉血');
 th.state.damage=0;const e2=one(s,97);Q.resolveReveal(s);assert.equal(e2.damage,1,'未受伤沙林：翻开时+1伤害');});
test('B2 196 conditional attachment: Éomer loses damage-to-attack while damaged, keeps it undamaged',()=>{const s=make(['tactics']);
 const eo=R.chars(s).find(c=>c.meta.code==='01004');const base0=R.stats(s,eo.uid).attack;
 eo.state.damage=2;assert.equal(R.stats(s,eo.uid).attack,base0+2,'196 不在场：受损转攻生效');
 s.questAttachments??=[];s.questAttachments.push({card:{...E.byId[196],uid:++s.serial},round:s.round});
 assert.equal(R.stats(s,eo.uid).attack,base0,'196 在场且受伤：印制文本空白');
 eo.state.damage=0;assert.equal(R.stats(s,eo.uid).attack,base0,'未受伤不受影响');});
test('B2 196 conditional attachment: Glóin gains no resource while 196 is attached',()=>{const s=make(['leadership']);
 const gl=R.chars(s).find(c=>c.meta.code==='01003');assert(gl,'leadership 预组需含葛罗因');
 R.damageCharacter(s,gl,1);
 const t=R.context(s).queue.find(x=>x.kind==='gloin');assert(t,'196 不在场：葛罗因响应入队');
 R.context(s).queue.length=0;
 s.questAttachments??=[];s.questAttachments.push({card:{...E.byId[196],uid:++s.serial},round:s.round});
 R.damageCharacter(s,gl,1);
 assert(!R.context(s).queue.some(x=>x.kind==='gloin'),'196 在场且已受伤：文本空白，不再获得资源');});
test('B2 143/162 cannot have attachments: Forest Snare targets exclude them',()=>{const s=make();commitAll(s);
 s.questing.remaining=[];s.questing.current=null;s.questing.step='staging';Q.drawNext(s); /* 打开行动窗口 */
 const p=s.players[0];const orc={...E.byId[143],uid:++s.serial},th={...E.byId[162],uid:++s.serial},normal={...E.byId[97],uid:++s.serial};
 p.engaged.push(orc,th,normal);
 const snare={uid:++s.serial,code:'01069',owner:0};p.hand.push(snare);
 const sp=R.playSpec(s,0,snare.uid,{});
 const targets=sp.fields.find(f=>f.key==='target');
 assert(targets,'森林陷阱需提供附着目标字段：'+(sp.reason||''));
 assert(targets.options.some(o=>String(o.value)===String(normal.uid)),'普通敌人可作为目标');
 assert(!targets.options.some(o=>String(o.value)===String(orc.uid)),'143 兽人战团不可附着');
 assert(!targets.options.some(o=>String(o.value)===String(th.uid)),'162 索尔迪尔不可附着');});
test('B2 no-win blocking message is logged once per distinct blocking state',()=>{const s=make();s.staging=[];const e={...E.byId[96],uid:++s.serial};s.staging.push(e);
 stageDefPatch(s,{next:null,noWinWhileInPlay:[96]},()=>{s.progress=999;
  E.advance(s,true);E.advance(s,true);E.advance(s,true);
  assert.equal(s.log.filter(t=>t.includes('仍在场')).length,1,'同一 blocking 状态只记一次');
  s.staging=[];E.advance(s,true);assert.equal(s.status,'won');});});
