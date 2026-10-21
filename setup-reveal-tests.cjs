const test=require('node:test'),assert=require('node:assert/strict'),P=require('./player-cards.js'),S=require('./ringsdb-snapshot.js'),E=require('./engine.js'),F=require('./starter-decks.js');
/* 开局取消窗口回归：安都因「每位玩家翻开1张」、多尔哥多「每张目标各翻1张」，
   都必须逐张停在可取消状态，让 #01050 意志考验与 #01008 埃莉诺获得合法响应窗口。 */
function make(sp='spirit',scenario='anduin',seed=3210,n=1){
  const spheres=n===1?[sp]:['leadership','tactics','spirit','lore'].slice(0,n);
  return E.create(scenario,n,seed,spheres.map(x=>P.config(P.starter(S,x),S)),{deferSetup:true});
}
function start(s){for(const p of s.players)E.openingChoice(s,p.id,false);E.startScenario(s);return s;}
function drain(s){while(s.pending.length)E.resolve(s,s.pending[0].id,s.pending[0].args&&s.pending[0].args.uid);}
function run(s,limit=20){let guard=0;while(s.setupReveal&&!s.setupReveal.finished&&guard++<limit){E.setupRevealStep(s);drain(s);}return s;}
function give(s,pid,code){const p=s.players[pid],c=S.cards.find(x=>x.code===code);const card={uid:++s.serial,code,name:c.name,nameZh:c.nameZh,rulesText:c.rulesText,owner:pid};p.hand.push(card);return card;}
function heroEleanor(s,pid=0){const h=s.players[pid].heroStates.find(h=>h.code==='01008');assert(h,'需要埃莉诺英雄');return h;}

test('Anduin setup pauses on every opened card instead of settling immediately',()=>{
  const s=start(make('spirit','anduin',4321,2));
  assert(s.setupReveal,'开局翻牌步骤应当存在');
  assert.equal(s.setupReveal.finished,false);
  assert.equal(s.setupReveal.remaining,2);
  const total=s.deck.length;
  assert(!s.setupReveal.current,'排队阶段尚未翻开任何遭遇牌');
  const first=E.setupRevealStep(s);
  assert.equal(s.deck.length,total-1,'翻开一张后牌库减少1张');
  assert(first&&s.setupReveal.current===first,'翻开后必须停在待结算状态');
  assert.equal(s.staging.length,0,'未结算前不进入探查区');
  E.setupRevealStep(s);drain(s);
  assert.equal(s.staging.length,1,'结算后才进入探查区');
  assert.equal(s.setupReveal.remaining,1);
});

test('A Test of Will can cancel a treachery revealed during Anduin setup and pays exactly 1 resource',()=>{
  const s=start(make('spirit','anduin',777,1));
  // 造一手确定的翻牌：先翻开一张需处理翻开效果的诡计。
  const tre=s.deck.find(c=>c.type==='Treachery'&&[74,76,79,80,89,93,98,104,105,112,116,117,118].includes(c.id));
  assert(tre,'遭遇牌库应含诡计');
  s.deck=s.deck.filter(c=>c!==tre);s.deck.unshift(tre);
  const will=give(s,0,'01050');
  const h=heroEleanor(s,0);h.resources=1;
  E.setupRevealStep(s);
  assert.equal(s.setupReveal.current.uid,tre.uid);
  const opts=E.setupCancelOptions(s);
  const willOpt=opts.find(o=>o.value==='will:'+will.uid);
  assert(willOpt,'翻开的诡计时意志考验必须可用');
  E.setupCancel(s,willOpt.value);
  assert.equal(s.setupReveal.canceled,true);
  assert.equal(h.resources,0,'意志考验支付1资源');
  assert(!s.players[0].hand.some(c=>c.uid===will.uid),'意志考验离开手牌');
  assert(s.players[0].playerDiscard.some(c=>c.uid===will.uid),'意志考验进入弃牌堆');
  E.setupRevealStep(s);
  assert.equal(s.setupReveal.current,null);
  assert(s.staging.some(c=>c.uid===tre.uid),'取消只抹掉翻开效果；诡计作为已翻开的牌仍留在探查区，随后按规则弃掉');
  assert(s.discard.some(c=>c.uid===tre.uid),'已取消的诡计进入遭遇弃牌堆');
  assert(!s.log.some(t=>t.includes('已确认结算：'+tre.name)),'取消后不再登记人工结算');
});

test('Eleanor exhausts to cancel at setup and does not block the following card',()=>{
  const s=start(make('spirit','anduin',99,1));
  const tre=s.deck.find(c=>c.type==='Treachery');
  s.deck=s.deck.filter(c=>c!==tre);s.deck.unshift(tre);
  const h=heroEleanor(s,0);
  assert.equal(h.exhausted,false);
  E.setupRevealStep(s);
  const opt=E.setupCancelOptions(s).find(o=>o.value==='eleanor:'+h.uid);
  assert(opt,'翻开的诡计时埃莉诺必须可用');
  E.setupCancel(s,opt.value);
  assert.equal(h.exhausted,true,'埃莉诺横置');
  E.setupRevealStep(s);drain(s);
  assert.empty = undefined;
  assert.equal(s.setupReveal.remaining,0);
  assert(s.setupReveal.finished,'单人安都因的开局翻牌应结束');
  assert(s.staging.some(c=>c.id===82),'山丘巨魔仍按要求进入探查区');
});

test('setup cancel window is limited to the current card and closes after cancelling',()=>{
  const s=start(make('spirit','anduin',5,1));
  const tre=s.deck.find(c=>c.type==='Treachery');
  s.deck=s.deck.filter(c=>c!==tre);s.deck.unshift(tre);
  const will=give(s,0,'01050');heroEleanor(s,0).resources=1;
  E.setupRevealStep(s);
  E.setupCancel(s,'will:'+will.uid);
  assert.deepEqual(E.setupCancelOptions(s),[],'同一张牌不能取消两次');
  assert.throws(()=>E.setupCancel(s,'will:'+will.uid),/不合法|没有可取消/);
});

test('enemies and locations revealed at setup do not offer a cancel response',()=>{
  const s=start(make('spirit','anduin',17,1));
  const loc=s.deck.find(c=>c.type==='Location');
  s.deck=s.deck.filter(c=>c!==loc);s.deck.unshift(loc);
  give(s,0,'01050');heroEleanor(s,0).resources=1;
  E.setupRevealStep(s);
  assert.equal(s.setupReveal.current.uid,loc.uid);
  assert.deepEqual(E.setupCancelOptions(s),[],'非诡计没有「翻开」效果可取消');
});

test('Dolguldur setup reveals one card per objective and assigns each as a guard',()=>{
  const s=start(make('spirit','dolguldur',4242,2));
  assert.equal(s.setupReveal.kind,'tower');
  assert.equal(s.setupReveal.remaining,3);
  assert.equal(s.objectives.length,3);
  assert(s.objectives.every(o=>!o.guard),'翻开前目标没有守卫');
  run(s);
  assert(s.setupReveal.finished);
  assert.equal(s.staging.length,3,'为每张目标各翻开1张');
  assert(s.objectives.every(o=>o.guard),'三张目标都应由翻开的卡守卫');
  const guardUids=new Set(s.staging.map(c=>c.uid));
  assert(s.objectives.every(o=>guardUids.has(o.guard)),'守卫必须指向真实翻开的卡');
  assert(s.prisoner,'囚犯在翻牌完成后才确定');
});

test('Dolguldur setup cancel skips the when-revealed effect but keeps the guard',()=>{
  const s=start(make('spirit','dolguldur',808,1));
  const tre=s.deck.find(c=>c.type==='Treachery');
  s.deck=s.deck.filter(c=>c!==tre);s.deck.unshift(tre);
  const will=give(s,0,'01050');heroEleanor(s,0).resources=1;
  E.setupRevealStep(s);
  assert.equal(s.setupReveal.current.uid,tre.uid);
  const opt=E.setupCancelOptions(s).find(o=>o.value==='will:'+will.uid);
  assert(opt);
  const guard=s.setupReveal.guard;
  E.setupCancel(s,opt.value);
  E.setupRevealStep(s);drain(s);
  const o=s.objectives.find(x=>x.uid===guard);
  assert(o.guard,'取消翻开效果不影响守卫指派');
  assert(s.staging.some(c=>c.uid===tre.uid),'诡计作为守卫仍留在场上');
});

test('setup cannot be restarted once the opening reveals have begun',()=>{
  const s=start(make('spirit','anduin',3,1));
  E.setupRevealStep(s);
  assert.throws(()=>E.startScenario(s),/剧本设置已经执行|请继续翻开/);
});

test('every seed finishes Anduin setup with a troll, a reshuffled deck and no leftover state',()=>{
  for(let seed=1;seed<=60;seed++){
    const s=run(start(make('spirit','anduin',seed,1)));
    assert(s.setupReveal.finished,'seed '+seed+' 未完成开局翻牌');
    assert(s.staging.some(c=>c.id===82),'seed '+seed+' 缺少山丘巨魔');
    assert.equal(s.setupReveal.current,null);
    assert.equal(s.pending.filter(t=>t.kind==='setupManual').length,0,'人工结算事项必须全部确认');
  }
});
