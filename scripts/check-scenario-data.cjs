/* 剧本定义数据化改造（v0.16.3）的专项回归：
   1) 三剧本 setup/flags/easyRemove/stages 数据驱动行为与改造前逐条等价；
   2) 每个 gate 条件的触发/不触发两路；
   3) advance 推进链与 120 的随机分叉；
   4) prisoner 只按 flags.prisoner 开关，对其余剧本零影响；
   5) 未知剧本字段/枚举值一律 fail loud（不许静默跳过）；
   6) 数据 schema 自检（stage 覆盖全部探险卡、next 目标存在、枚举值合法）。 */
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('path');
const ROOT=path.join(__dirname,'..');
const E=require(path.join(ROOT,'engine.js'));
const D=require(path.join(ROOT,'data.js'));

function drain(s){while(s.pending.length){let t=s.pending[0];if(t.kind==='spider'){let c=[...s.deck,...s.discard].find(c=>c.traits?.includes('Spider'));assert(c);E.resolve(s,t.id,c.uid);}else if(t.kind==='rescue')E.rescue(s,t.id);else E.resolve(s,t.id);}}
function auto(s){for(let i=0;i<20&&s.setupReveal&&!s.setupReveal.finished;i++){E.setupRevealStep(s);drain(s);}return s;}
function put(s,id,zone){const c={...E.byId[id],uid:++s.serial};(zone||s.staging).push(c);return c;}
function deckCount(s,id){return s.deck.filter(c=>c.id===id).length;}
/* 深拷贝 scenarios 用于 fail-loud 用例的污染-恢复 */
const SCENARIOS_BACKUP=JSON.parse(JSON.stringify(D.scenarios));
function withScenario(id,mutate,fn){const sc=D.scenarios.find(x=>x.id===id);const backup=JSON.parse(JSON.stringify(sc));try{mutate(sc);fn();}finally{D.scenarios.splice(D.scenarios.findIndex(x=>x.id===id),1,JSON.parse(JSON.stringify(backup)));}}

/* ── 1. 数据 schema 自检 ─────────────────────────────────────────────── */
test('scenario schema: stages cover every quest, next targets exist, enums valid',()=>{
 const allQuests=new Set(D.quests.map(q=>q.id)),covered=new Set;
 assert.deepEqual(D.scenarios.map(s=>s.id),['mirkwood','anduin','dolguldur','gollum','iic','dd','twh'],'剧本声明顺序即 UI 顺序，不许变');
 for(const sc of D.scenarios){
  assert(sc.coverCard===sc.stages[0].id,'coverCard 必须是首张探险卡（PODS 派生的封面依据）');
  const ids=new Set(sc.stages.map(st=>st.id));
  assert.equal(ids.size,sc.stages.length,'stage id 不许重复');
  for(const st of sc.stages){
   covered.add(st.id);
   assert('next' in st,`stage ${st.id} 缺 next 字段`);
   if(st.next==='random'){assert(Array.isArray(st.nextRandom)&&st.nextRandom.length>=1);for(const n of st.nextRandom)assert(ids.has(n),`随机分叉目标 ${n} 未定义`);}
   else if(st.next!==null)assert(ids.has(st.next),`stage ${st.id} 的 next ${st.next} 未定义`);
   if(st.gate)for(const k of Object.keys(st.gate))assert(['spawnDefeated','noInPlay','noEnemies','holdObjectives','rescued','controlsObjective','spawnHpZero'].includes(k),`未知 gate 字段 ${k}`);
   if(st.onEnter)assert(['spiderSearch','revealPerPlayer','searchEngage','spawnSetAside','revealSetAside'].includes(st.onEnter.type),`未知 onEnter 类型`);
   if(st.revealPer!==undefined)assert(['player','skip'].includes(st.revealPer),`未知 revealPer`);
  }
 }
 assert.deepEqual([...covered].sort((a,b)=>a-b),[...allQuests].sort((a,b)=>a-b),'全部探险卡（含 HfG 三张）必须都有 stage 定义');
});

/* ── 1.5 HfG（寻找咕噜）试点：数据构成与推进 ─────────────────────────── */
test('gollum normal deck: exactly 48 cards matching official scenario usage',()=>{
 const s=E.create('gollum',1,42);
 assert.equal(s.deck.length,48,'normal 档牌库总数必须等于 encounter-carddata scenarios 摘要（官方构成）');
 const bySet={};s.deck.forEach(c=>bySet[c.set]=(bySet[c.set]||0)+1);
 assert.deepEqual(bySet,{'The Hunt for Gollum':29,"Sauron's Reach":10,'Journey Along the Anduin':9});
 assert.deepEqual([...new Set(s.deck.map(c=>c.pack))].sort(),['Core','THfG']);
});
test('gollum easy deck: 34 cards via easyRemove (official per-card counts)',()=>{
 const s=E.create('gollum',1,42,null,{difficulty:'easy'});
 assert.equal(s.deck.length,34);
});
test('gollum standard setup: no reveal flow, no prisoner, stage chain 129→130→131→won',()=>{
 const s=E.create('gollum',1,42);
 assert.equal(s.setupReveal,undefined,'标准开局不进翻牌流程');
 assert.equal(s.quest,129);
 assert.equal(s.prisoner,null);
 s.progress=8;E.advance(s,true);assert.equal(s.quest,130);
 s.progress=10;E.advance(s,true);assert.equal(s.quest,131);
 s.progress=8;E.advance(s,true);assert.equal(s.status,'won','stage3 next:null 即胜利');
});
test('deckQuantities override: honored by deck build, unknown id fails loud',()=>{
 withScenario('gollum',sc=>{sc.deckQuantities={'111':1,'999':1};},()=>{
  assert.throws(()=>E.create('gollum',1,7),/未知卡 id/,'未知 id 必须显式报错');
 });
 withScenario('gollum',sc=>{sc.deckQuantities={'111':1};},()=>{
  const s=E.create('gollum',1,7);
  assert.equal(s.deck.filter(c=>c.id===111).length,1,'override 生效');
  assert.equal(s.deck.length,48-3+1,'总量随 override 变化');
 });
});
test('variable threat X (Old Ford) does not poison staging threat sum',()=>{
 const s=E.create('gollum',1,7);
 s.staging.push({...E.byId[133],uid:++s.serial});
 s.staging.push({...E.byId[134],uid:++s.serial});
 const t=E.threat(s);
 assert.equal(typeof t,'number');
 assert.equal(t,2,'X 按 0 计（效果层后续实现），数值卡正常求和');
});

/* ── 2. setup 等价 ───────────────────────────────────────────────────── */
test('mirkwood setup stages 96+99 into staging then shuffles',()=>{
 const s=E.create('mirkwood',1,42);
 assert.deepEqual(s.staging.map(c=>c.id).sort(),[96,99]);
 assert.equal(s.setupReveal,undefined);
});
test('anduin setup: per-player reveal flow, troll ensured in staging afterwards',()=>{
 const s=auto(E.create('anduin',1,7));
 assert(s.setupReveal.finished);
 assert(s.staging.some(c=>c.id===82),'afterReveal.ensureInStaging 应保底山丘巨魔进场');
 assert(s.setupReveal.reveals.length===1,'每位玩家翻1张');
});
test('dolguldur setup: tower mode sets aside Nazgul, seats 3 objectives, assigns prisoner',()=>{
 const s=E.create('dolguldur',1,7);
 assert.equal(s.setupReveal.kind,'tower');
 assert.equal(s.setupReveal.remaining,3,'为每张目标各翻1张');
 assert.deepEqual(s.setaside.map(c=>c.id),[102]);
 assert.deepEqual(s.objectives.map(c=>c.id),[108,109,110]);
 assert.equal(s.prisoner,null,'囚犯在设置流程完成后才抽取');
 auto(s);
 assert(s.prisoner&&Number.isInteger(s.prisoner.player)&&Number.isInteger(s.prisoner.hero));
 const p=s.players[s.prisoner.player];
 assert(Array.isArray(p.heroes)&&p.heroes[s.prisoner.hero],'囚犯英雄索引必须有效');
});

/* ── 3. gate 两路验证 ────────────────────────────────────────────────── */
test('gate 121: spawnDefeated blocks until Ungoliant Spawn defeated',()=>{
 const s=E.create('mirkwood',1,9);s.quest=121;s.progress=99;
 assert.match(E.gate(s),/昂哥立安之子/);
 const c=put(s,76);E.defeat(s,c.uid);
 assert.equal(E.gate(s),'');
 E.advance(s,true);assert.equal(s.status,'won','121 无后继，击败后胜利（与改造前一致）');
});
test('gate 122: blocks while Spawn in play, passes once gone',()=>{
 const s=E.create('mirkwood',1,9);s.quest=122;s.progress=99;
 const c=put(s,76);
 assert.match(E.gate(s),/仍在场/);
 E.defeat(s,c.uid);
 assert.equal(E.gate(s),'');
 E.advance(s,true);assert.equal(s.status,'won');
});
test('gate 126: blocks while Hill Troll in staging, passes once removed',()=>{
 const s=auto(E.create('anduin',1,7));s.progress=8;
 assert.match(E.gate(s),/山丘巨魔仍在场/);
 s.staging.splice(s.staging.findIndex(c=>c.id===82),1);
 assert.equal(E.gate(s),'');
 E.advance(s,true);assert.equal(s.quest,127,'126 的 next 是 127');
});
test('gate 128: blocks while any enemy in play',()=>{
 const s=auto(E.create('anduin',1,7));s.quest=128;s.progress=99;
 put(s,82);
 assert.match(E.gate(s),/场上仍有敌人/);
 for(const a of [s.staging,...s.players.map(p=>p.engaged)])for(let i=a.length-1;i>=0;i--)if(a[i].type==='Enemy')a.splice(i,1);
 assert.equal(E.gate(s),'');
 E.advance(s,true);assert.equal(s.status,'won');
});
test('gate 123: requires at least one held objective',()=>{
 const s=auto(E.create('dolguldur',1,7));s.quest=123;s.progress=99;
 assert.match(E.gate(s),/至少持有1张目标/);
 s.objectives[0].holder={player:0,hero:0};
 assert.equal(E.gate(s),'');
 E.advance(s,true);assert.equal(s.quest,124);
});
test('gate 124: requires rescue AND all three objectives held',()=>{
 const s=auto(E.create('dolguldur',1,7));s.quest=124;s.progress=99;
 for(const o of s.objectives)o.holder={player:0,hero:0};
 assert.match(E.gate(s),/须救出囚犯并持有全部3张目标/,'未救出囚犯时被挡');
 s.rescued=true;
 assert.equal(E.gate(s),'');
 E.advance(s,true);assert.equal(s.quest,125);
});
test('gate 125: blocks while Nazgul in play',()=>{
 const s=auto(E.create('dolguldur',1,7));s.quest=125;s.progress=99;
 const n=put(s,102);
 assert.match(E.gate(s),/多尔哥多戒灵仍在场/);
 s.staging.splice(s.staging.findIndex(c=>c.uid===n.uid),1);
 assert.equal(E.gate(s),'');
 E.advance(s,true);assert.equal(s.status,'won');
});

/* ── 4. advance 推进链与随机分叉 ─────────────────────────────────────── */
test('advance chain: 119→120, 126→127, 127→128, 123→124, 124→125 all data-driven',()=>{
 const s=E.create('mirkwood',1,3);s.progress=99;E.advance(s,true);assert.equal(s.quest,120);
 const a=auto(E.create('anduin',1,3));a.progress=99;a.staging.splice(a.staging.findIndex(c=>c.id===82),1);E.advance(a,true);assert.equal(a.quest,127);
 a.quest=127;a.progress=99;E.advance(a,true);assert.equal(a.quest,128);
 const d=auto(E.create('dolguldur',1,3));d.progress=99;d.objectives[0].holder={player:0,hero:0};E.advance(d,true);assert.equal(d.quest,124);
 d.quest=124;d.rescued=true;d.progress=99;for(const o of d.objectives)o.holder={player:0,hero:0};E.advance(d,true);assert.equal(d.quest,125);
});
test('advance random branch at 120 yields both 121 and 122 across seeds',()=>{
 const outcomes=new Set;
 for(let seed=1;seed<100;seed++){
  const s=E.create('mirkwood',1,seed);s.progress=8;E.advance(s,true);
  assert.equal(s.quest,120);s.progress=100;E.advance(s,true);outcomes.add(s.quest);
 }
 assert.deepEqual([...outcomes].sort(),[121,122]);
});

/* ── 5. 探查张数与交战检定跳过 ───────────────────────────────────────── */
test('staging counts: 127 = players+1, 128 = skip (data-driven revealPer/revealBonus)',()=>{
 const s=auto(E.create('anduin',1,7));s.quest=127;s.progress=99;s.staging.splice(s.staging.findIndex(c=>c.id===82),1);E.advance(s,true);
 assert.equal(s.quest,128);
 /* 直接检查 stage 定义被引擎按数据解读：127 的手动探查入口翻 players+1 张 */
 const s2=auto(E.create('anduin',1,7));s2.quest=127;s2.phase=2;
 const before=s2.deck.length;E.stage(s2);
 assert.equal(before-s2.deck.length,2,'单人 127：1（每玩家）+1（revealBonus）');
});
test('encounter checks: 127 skips via stage.skipEngagementCheck, optional engagement still works',()=>{
 const s=auto(E.create('anduin',1,7));s.quest=127;s.phase=4;
 put(s,96);const b=put(s,76);
 E.encounterChecks(s);
 assert.equal(s.checkedRound,s.round,'手动入口按数据跳过');
 assert(s.staging.includes(b),'检定跳过但敌人不被强制交战');
});

/* ── 6. prisoner 按 flags 开关 ───────────────────────────────────────── */
test('prisoner flag: dolguldur on, mirkwood/anduin never assign prisoner',()=>{
 for(let seed=1;seed<=30;seed++){
  const m=E.create('mirkwood',1,seed);assert.equal(m.prisoner,null,'mirkwood 无囚犯');
  const a=E.create('anduin',1,seed);assert.equal(a.prisoner,null,'anduin 无囚犯');
 }
 const d=auto(E.create('dolguldur',1,11));assert(d.prisoner,'flags.prisoner=true 的剧本必须抽囚犯');
});
test('rescue is fail-loud on scenarios without the prisoner flag',()=>{
 const m=E.create('mirkwood',1,5);
 m.pending.push({id:1,kind:'rescue',text:'伪造的救援事项'});
 assert.throws(()=>E.rescue(m,1),/没有囚犯机制/,'非囚犯剧本的救援事项必须显式报错');
});

/* ── 7. easyRemove 数据迁移等价 ──────────────────────────────────────── */
test('easyRemove per scenario: exact quantities removed, normal mode untouched',()=>{
 const cases=[['mirkwood',{90:1,91:1,94:1,93:2,80:2,79:1,75:1}],['anduin',{90:1,91:1,94:1,93:2,115:2,116:1,82:1,84:1,86:2,112:1,114:2}],['dolguldur',{90:1,91:1,94:1,93:2,80:2,79:1,75:1,101:2}]];
 for(const [id,table] of cases){
  const normal=E.create(id,1,7),easy=E.create(id,1,7,null,{difficulty:'easy'});
  const all=new Set([...Object.keys(table),...normal.deck.map(c=>String(c.id))]);
  for(const key of all){
   const cid=Number(key),want=(table[key]||0);
   assert.equal(deckCount(normal,cid)-deckCount(easy,cid),want,`剧本 ${id} 卡 ${cid} 的 easy 移除数应为 ${want}`);
  }
 }
});

/* ── 8. fail loud：未知字段/枚举/缺失定义不许静默跳过 ────────────────── */
test('fail loud: unknown gate field throws',()=>{
 withScenario('mirkwood',sc=>{sc.stages[0].gate={bogusField:1};},()=>{
  const s=E.create('mirkwood',1,7);s.progress=99;
  assert.throws(()=>E.gate(s),/未知 stage\.gate 字段/);
 });
});
test('fail loud: unknown onEnter type throws',()=>{
 withScenario('mirkwood',sc=>{sc.stages[1].onEnter={type:'bogus'};},()=>{
  const s=E.create('mirkwood',1,7);s.progress=99;
  assert.throws(()=>E.advance(s,true),/未知 stage\.onEnter 类型/);
 });
});
test('fail loud: unknown revealPer in setup throws at create',()=>{
 withScenario('anduin',sc=>{sc.setup.revealPer='bogus';},()=>{
  assert.throws(()=>E.create('anduin',1,7),/未知 setup\.revealPer/);
 });
});
test('fail loud: unknown stage.revealPer throws in questing staging',()=>{
 withScenario('anduin',sc=>{const st=sc.stages.find(x=>x.id===127);st.revealPer='bogus';},()=>{
  const s=auto(E.create('anduin',1,7));s.quest=127;s.phase=2;
  assert.throws(()=>E.stage(s),/未知 stage\.revealPer/);
 });
});
test('fail loud: missing stage definition throws',()=>{
 withScenario('anduin',sc=>{sc.stages.splice(sc.stages.findIndex(x=>x.id===127),1);},()=>{
  const s=auto(E.create('anduin',1,7));s.progress=8;s.staging.splice(s.staging.findIndex(c=>c.id===82),1);
  assert.throws(()=>E.advance(s,true),/缺少探险卡 127 的 stage 定义/);
 });
});
test('fail loud: easyRemove with unknown card id throws at create',()=>{
 withScenario('mirkwood',sc=>{sc.easyRemove={'99999':1};},()=>{
  assert.throws(()=>E.create('mirkwood',1,7),/未知卡 id/);
 });
});

/* ── 9. 安格玛批次1（TLR，id 143-201 + 剧本 iic/dd/twh）数据层断言 ─────────
   引擎端（setup.type=stageCards、searchEngage/spawnSetAside/revealSetAside、
   controlsObjective/spawnHpZero、sideQuest、time/timeExpire 等）由 fe 并行接线；
   在接线完成前，effect 覆盖检查走下方 PENDING_ENGINE_WIRING 豁免清单——
   这是显式的「待引擎接线」登记，fe 完成对应 id 后应从清单除名。 */
const TLR_SRC=JSON.parse(require('fs').readFileSync(path.join(ROOT,'docs/data/cache/angmar-batch1-source.json'),'utf8'));

test('TLR uid: every new card/quest materializes uid matching the HoB export, globally unique',()=>{
 const seen=new Set;
 for(const c of [...D.cards,...D.quests]){
  if(c.pack!=='TLR')continue;
  assert(c.uid&&typeof c.uid==='string',`TLR 条目 ${c.id} 缺 uid`);
  assert(!seen.has(c.uid),'uid 全局唯一');
  seen.add(c.uid);
 }
 const hobCodes=new Set(Object.values(TLR_SRC).map(c=>c.uid));
 for(const c of [...D.cards,...D.quests].filter(x=>x.pack==='TLR'))
  assert(hobCodes.has(c.uid),`uid ${c.uid} 不在 HoB 导出中（必须与 encounter-carddata 一致）`);
});

test('TLR effect coverage: every id referenced by iic/dd/twh is known to the engine or explicitly waived',()=>{
 /* 从引擎源码文本读取三个清单（归 fe 维护，这里只读不写） */
 const qeSrc=require('fs').readFileSync(path.join(ROOT,'quest-engine.js'),'utf8');
 const eSrc=require('fs').readFileSync(path.join(ROOT,'engine.js'),'utf8');
 const known=new Set;
 for(const m of qeSrc.matchAll(/hasEffect=\[([^\]]*)\]/g))for(const x of m[1].split(','))if(x.trim())known.add(Number(x));
 for(const m of eSrc.matchAll(/(?:manualReveal|SETUP_EFFECT)=new Set\(\[([^\]]*)\]\)/g))for(const x of m[1].split(','))if(x.trim())known.add(Number(x));
 /* 待引擎接线豁免清单（fail-loud 精神：显式登记，不静默跳过）：
    143 兽人战团确保进场 / 151,172,190 stageCards 关卡 / 155,183 setAside 伏笔 /
    161 伊亚里安目标 / 162 索尔迪尔 spawnHpZero / 164 searchEngage /
    167 确保进场 / 172? 关卡 / 183 setAside / 184 确保进场 / 185 makeActive /
    190,191 关卡链 / 192 确保进场目标。fe 接线后逐一除名。 */
 const PENDING_ENGINE_WIRING=new Set([143,151,155,161,162,164,167,172,173,183,184,185,190,191,192]);
 const refs=new Set;
 for(const sc of D.scenarios.filter(s=>['iic','dd','twh'].includes(s.id))){
  const su=sc.setup||{};
  for(const k of ['cards','objectives','ensureInStaging','setAside','makeActive'])for(const v of su[k]||[])refs.add(v);
  for(const st of sc.stages){
   refs.add(st.id);
   if(st.next!=null)refs.add(st.next);
   const oe=st.onEnter||{};
   if(oe.card!=null)refs.add(oe.card);
   for(const v of oe.cards||[])refs.add(v);
   const g=st.gate||{};
   for(const v of Object.values(g))for(const x of (Array.isArray(v)?v:[v]))if(typeof x==='number')refs.add(x);
  }
 }
 const missing=[...refs].filter(id=>!known.has(id)&&!PENDING_ENGINE_WIRING.has(id));
 assert.deepEqual(missing,[],`剧本引用的 id 未被引擎三清单覆盖且未登记豁免: ${missing}`);
 /* 豁免清单保持诚实：不允许登记剧本未引用的 id */
 const unref=PENDING_ENGINE_WIRING&&[...PENDING_ENGINE_WIRING].filter(id=>!refs.has(id));
 assert.deepEqual(unref,[],`豁免清单存在剧本未引用的 id（fe 接线后请除名）: ${unref}`);
});

test('TLR shadow audit: shadow text must have shadowSpec or be on the manual list',()=>{
 /* 人工暗影清单：阴影文本无法用 shadowSpec 契约键完整表达，需引擎人工结算 */
 const MANUAL_SHADOWS=new Set([144,145,152,153,159,168,174,175,176,178,182,185,188,195,198,200]);
 for(const c of D.cards.filter(c=>c.pack==='TLR')){
  if(c.shadow&&!c.shadowSpec)assert(MANUAL_SHADOWS.has(c.id),`卡 ${c.id}「${c.en}」有阴影文本但无 shadowSpec 且不在人工清单`);
  if(c.shadowSpec){assert(c.shadow,`卡 ${c.id} 有 shadowSpec 却无阴影文本`);assert(!MANUAL_SHADOWS.has(c.id),`卡 ${c.id} 已可结构化表达，不应留在人工清单`);}
 }
 for(const id of MANUAL_SHADOWS){
  const c=D.cards.find(x=>x.id===id);
  assert(c&&c.shadow&&!c.shadowSpec,`人工暗影清单条目 ${id} 必须真实有阴影文本且无 shadowSpec（清单保持诚实）`);
 }
});

test('TLR time fields: rule text 时间N 与 time 字段一致，timeExpire 仅 165',()=>{
 for(const c of D.cards.filter(c=>c.pack==='TLR')){
  const m=(c.rule||'').match(/时间(\d+)/);
  if(m)assert.equal(c.time,Number(m[1]),`卡 ${c.id} 文本时间 ${m[1]} 与 time 字段不一致`);
  else assert.equal(c.time,undefined,`卡 ${c.id} 无时间文本却带 time 字段`);
 }
 const te=D.cards.filter(c=>c.timeExpire).map(c=>c.id);
 assert.deepEqual(te,[165],'timeExpire 本批仅崩毁的壁垒（millEach n=5 reset=1）');
 const b=D.cards.find(c=>c.id===165);
 assert.deepEqual(b.timeExpire,{type:'millEach',n:5,reset:1});
});

test('TLR sets: per-set normal totals match the official group table; scenario decks match HoB',()=>{
 const SET_NORMAL={'Intruders in Chetwood':18,'Angmar Orcs':9,'Eriador Wilds':10,'Iârion':1,
                   "Deadmen's Dike":24,'Cursed Dead':10,'Dark Sorcery':9,'The Weather Hills':22,
                   'Foul Weather':9,'Ruins of Arnor':8};
 for(const [name,n] of Object.entries(SET_NORMAL)){
  const s=D.cards.filter(c=>c.set===name).reduce((a,c)=>a+c.quantity,0);
  assert.equal(s,n,`遭遇组 ${name} normal 合计应 ${n}，实测 ${s}`);
  assert(D.sets[name]&&D.sets[name].length,'每个新组都要有中文名');
 }
 const HOB={iic:{total:37,easyDelta:12,sets:['Intruders in Chetwood','Angmar Orcs','Eriador Wilds']},
            dd:{total:43,easyDelta:13,sets:["Deadmen's Dike",'Cursed Dead','Dark Sorcery']},
            twh:{total:48,easyDelta:9,sets:['The Weather Hills','Foul Weather','Ruins of Arnor','Angmar Orcs']}};
 for(const [id,exp] of Object.entries(HOB)){
  const sc=D.scenarios.find(s=>s.id===id);
  const qsum=Object.values(sc.deckQuantities).reduce((a,b)=>a+b,0);
  assert.equal(qsum,exp.total,`剧本 ${id} normal 牌库应 ${exp.total} 张`);
  const esum=Object.values(sc.easyRemove).reduce((a,b)=>a+b,0);
  assert.equal(esum,exp.easyDelta,`剧本 ${id} easy 移除合计应 ${exp.easyDelta}`);
  const inDeck=new Set(D.cards.filter(c=>exp.sets.includes(c.set)).map(c=>String(c.id)));
  for(const k of Object.keys(sc.deckQuantities))assert(inDeck.has(k),`剧本 ${id} deckQuantities 含组外卡 ${k}`);
  assert.deepEqual(new Set([...Object.keys(sc.deckQuantities),...Object.keys(sc.easyRemove)].filter(k=>!inDeck.has(k))),new Set);
  for(const [k,v] of Object.entries(sc.easyRemove)){
   assert(sc.deckQuantities[k]>=v,`剧本 ${id} 卡 ${k} 的 easyRemove ${v} 超过 normal 数量`);
  }
 }
 const POINTS={151:30,172:11,173:13,190:null,191:20};
 for(const [id,pts] of Object.entries(POINTS)){
  const q=D.quests.find(x=>x.id===Number(id));
  assert(q,'TLR 关卡卡缺失 '+id);
  assert.equal(q.points,pts,`关卡 ${id} 进度阈值不符`);
 }
 assert.deepEqual(D.quests.filter(q=>q.pack==='TLR').map(q=>q.stage).sort((a,b)=>a-b),[1,1,1,2,2]);
});
