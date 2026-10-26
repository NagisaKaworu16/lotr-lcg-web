/* 阶段智能推进：phase-engine 的完成判定 + engine.endPhase 的推进行为。
   判定的口径是「本阶段必需操作是否都做完」，与 UI 上那颗「结束阶段」按钮共用同一份 checks()。 */
const test=require('node:test'),assert=require('node:assert/strict'),E=require('./engine'),P=require('./player-cards'),S=require('./ringsdb-snapshot'),R=E.planning,Q=E.questing;
function make(n=2,spheres=null){
 const cfg=Array.from({length:n},(_,i)=>P.config(P.starter(S,spheres?.[i]||'leadership'),S));
 const s=E.create('mirkwood',n,12345,cfg,{deferSetup:true,openingTest:true});
 for(const p of s.players)E.openingChoice(s,p.id);
 E.startScenario(s);
 while(s.setupReveal&&!s.setupReveal.finished)E.setupRevealStep(s);
 return s;
}
function keys(s){return E.phaseRules.checks(s).map(x=>x.key);}
function ok(s){return E.phaseRules.checks(s).every(x=>x.check());}
function box(s){return s.phase===6?s.refreshing:s.phase===5?s.combat:s.phase===4?s.encountering:s.phase===3?s.traveling:s.phase===2?s.questing:s.planning;}
function drain(s){let g=0;while(box(s)?.tasks?.length&&g++<40){const sp=Q.spec(s,box(s).tasks[0].id);if(!sp)break;const a={};for(const f of sp.fields)a[f.key]=f.options[0].value;Q.choose(s,sp.task.id,{...a,skip:sp.unavailable||sp.task.optional});}while(s.pending.length)s.pending.shift();}
/* 资源阶段 → 计划阶段（逐位结束出牌）→ 探险阶段。计划阶段每点一次只结束一位玩家，所以要循环。 */
function toQuest(s){let g=0;while(s.phase<2&&g++<10)E.endPhase(s);return s;}

test('资源阶段：没收集资源时不算完成，收完才放行',()=>{
 const s=make();
 assert.equal(s.phase,0);
 assert.deepEqual(keys(s),['resource']);
 assert.equal(ok(s),false);
 assert.match(E.phaseRules.blocker(s),/收集资源/);
 E.resourcePhase(s);
 assert.equal(ok(s),true);
 const r=E.endPhase(s);
 assert.equal(r.from,0);assert.equal(r.to,1);
});

test('计划阶段：每位玩家都要结束出牌并确认放弃剩余行动',()=>{
 const s=make(2);while(s.phase===0)E.endPhase(s);
 assert.equal(s.phase,1);
 const k=keys(s);
 for(const id of [0,1]){assert(k.includes('plan:'+id));assert(k.includes('pass:'+id));}
 assert.equal(ok(s),false);
 while(R.active(s)!==null)R.endTurn(s,R.active(s));
 // 结束出牌后仍有「放弃剩余行动」未确认
 assert.equal(ok(s),false);
 for(const p of s.players)R.passAction(s,p.id);
 assert.equal(ok(s),true);
});

test('探险阶段：投入名单未交齐时不算完成，交齐后由程序按序投入',()=>{
 const s=make(2);toQuest(s);
 assert.equal(s.phase,2);assert.equal(s.questing.step,'beforeCommit');
 for(const p of s.players)Q.pass(s,p.id);
 Q.move(s);
 assert.equal(s.questing.step,'commit');
 assert.equal(ok(s),false);
 assert.match(E.phaseRules.blocker(s),/提交派遣名单/);
 for(const pid of s.questing.order)Q.submitDeployment(s,pid,[Q.eligible(s,pid)[0].uid]);
 /* v0.15.62 二次确认流程：全员提交后还需各自二次确认才锁定并投入 */
 for(const pid of s.questing.order)Q.approveDeployment(s,pid);
 assert.equal(s.questing.deploymentLocked,true);
 drain(s);
 const r=E.endPhase(s);
 // 名单已齐：程序投入并进入探查；逐张探查必须由玩家翻牌，所以停在 staging
 assert.equal(s.questing.step,'staging');
 assert.equal(r.to,2);
});

test('遭遇牌未结算时绝不越过探查：current 存在即判定未完成',()=>{
 const s=make(2);toQuest(s);
 for(const p of s.players)Q.pass(s,p.id);Q.move(s);
 for(const pid of s.questing.order)Q.submitDeployment(s,pid,[Q.eligible(s,pid)[0].uid]);
 for(const pid of s.questing.order)Q.approveDeployment(s,pid); /* v0.15.62 二次确认 */
 drain(s);
 E.endPhase(s);
 assert.equal(s.questing.step,'staging');
 Q.drawNext(s);
 assert(s.questing.current);
 assert.equal(ok(s),false);
 assert.equal(E.phaseRules.completed(s),false);
 const before=s.questing.step;
 E.endPhase(s);
 assert.equal(s.questing.step,before);        // 一步都不许走
});

test('探查结算完、允许让过后，探险阶段能推进到旅行阶段',()=>{
 const s=make(2);toQuest(s);
 for(const p of s.players)Q.pass(s,p.id);Q.move(s);
 for(const pid of s.questing.order)Q.submitDeployment(s,pid,[Q.eligible(s,pid)[0].uid]);
 for(const pid of s.questing.order)Q.approveDeployment(s,pid); /* v0.15.62 二次确认 */
 drain(s);
 E.endPhase(s);
 let g=0;
 while(s.phase===2&&g++<30){
  if(s.questing.step==='staging'){
   if(!s.questing.current)Q.drawNext(s);
   drain(s);
   if(s.questing.current){Q.resolveReveal(s);drain(s);}
   const more=s.questing.remaining.length||s.questing.current;
   if(!more){Q.drawNext(s);drain(s);}
   continue;
  }
  E.endPhase(s);drain(s);
 }
 assert.equal(s.phase,3,'应已进入旅行阶段');
});

test('endPhase 在有待结算事项时不代玩家结算',()=>{
 const s=make(2);E.endPhase(s);
 while(R.active(s)!==null)R.endTurn(s,R.active(s));
 for(const p of s.players)R.passAction(s,p.id);
 s.pending.push({id:++s.serial,text:'测试事项',kind:'manual',args:{}});
 assert.throws(()=>E.endPhase(s),/待结算/);
});

test('blocker 在没有待办时给出「已全部完成」，有待办时点名第一项',()=>{
 const s=make();E.resourcePhase(s);
 assert.equal(E.phaseRules.completed(s),true);
 assert.match(E.phaseRules.blocker(s),/全部完成|已全部完成/);
 const t=make();
 assert.match(E.phaseRules.blocker(t),/收集资源/);
});

test('phaseRules 是纯函数：判定不改状态',()=>{
 const s=make(2);toQuest(s);
 const before=JSON.stringify(s);
 E.phaseRules.checks(s);E.phaseRules.completed(s);E.phaseRules.blocker(s);
 assert.equal(JSON.stringify(s),before);
});
