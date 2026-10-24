/* Tabletop view: UI drafts never pay, exhaust, reveal, or bypass phase validation. */
/* 界面版本徽标唯一来源：须与 CHANGELOG.md 最新条目标题一致（planning-dom-tests 有校验）。 */
const APP_VERSION='v0.15.45';
const DesktopUI=(()=>{
 const E=ScenarioEngine,R=E.planning,Q=E.questing,C=E.combat,esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let combatDraft={key:'',target:null,ids:[]},draftState=null;
 const live=s=>s.players.filter(p=>!p.eliminated);
 const who=(s,id)=>esc(s.players[id]?.name||('玩家'+(id+1)));
 /* 日志回退标记由 app.js 提供（哪次操作产生了哪几条日志）；测试环境无此钩子时返回 null，只渲染不可回退的日志。 */
 const logMarks=()=>{try{return typeof APP_LOG_MARKS==='function'?APP_LOG_MARKS().logMarks:null;}catch(e){return null;}};
 /* 日志显示范围由 app.js 的视图偏好决定；模块单独加载（测试环境）时退回「本回合」。 */
 const logScope=()=>{try{return typeof APP_LOG_SCOPE==='function'?APP_LOG_SCOPE():'round';}catch(e){return 'round';}};
 /* 竖轴手动展开的阶段；模块单独加载（测试环境）时给空集合，走「未来阶段默认折叠」。 */
 const railOpen=()=>{try{return typeof APP_RAIL_OPEN==='function'?APP_RAIL_OPEN():null;}catch(e){return null;}};
 const chip=(text,tone='wait')=>`<span class="op-chip ${tone}">${esc(text)}</span>`;
 /* 诡镇网页版式代币：圆形徽章、数字居中，同型多枚层叠。数量由规则引擎结算，拖放仅作视觉表现。
    属性代币（意志/攻击/防御）是静态数值快照，不参与拖放。 */
 const tk=(type,n,drag=true)=>`<span class="tk tk-${type}${n>1?' stack':''}" data-n="${n}"><img src="assets/tokens/${type}.png" alt="" ${drag?`draggable="true" data-token="${type}"`:''}><b>${n}</b></span>`;
 const tokenRow=(cls,inner)=>inner?`<div class="card-tokens ${cls}" aria-hidden="true">${inner}</div>`:'';
 const chipRow=(s,order,done,ok,wait)=>(order||[]).map(id=>`<span class="op-chip ${(done||[]).includes(id)?'done':'wait'}">${who(s,id)} · ${(done||[]).includes(id)?ok:wait}</span>`).join('');
 const b=(label,kind,args='',disabled=false)=>`<button data-action="desktop" data-desktop="${kind}" ${args} ${disabled?'disabled':''}>${esc(label)}</button>`;
 function mode(s,pid){if(s.status!=='playing'||s.pending.length||R.context(s)?.queue?.length||R.context(s)?.tasks?.length)return null;
  if(s.phase===2&&s.questing?.step==='commit'&&!s.questing.deploymentLocked&&!s.questing.deployments?.[pid]?.confirmed)return {kind:'quest',player:pid,eligible:Q.eligible(s,pid).map(c=>c.uid)};
  if(s.phase===5&&s.combat&&!s.combat.proposal){if(s.combat.step==='defenseChoice')return {kind:'defense',player:s.combat.attack.player,eligible:C.defenders(s).map(c=>c.uid)};if(s.combat.step==='attackChoice')return {kind:'attack',player:C.activePlayer(s),eligible:[]};}return null;
 }
 function draft(s,m){const k=`${s.round}:${s.phase}:${s.combat?.step}:${m?.player}:${s.combat?.attack?.uid}`;if(draftState!==s||combatDraft.key!==k){draftState=s;combatDraft={key:k,target:null,ids:[]};}return combatDraft;}
 function ids(s,m){return m?.kind==='quest'?QuestUI.draftFor(s,m.player):draft(s,m).ids;}
 function eligible(s,m,uid){if(!m)return false;if(m.kind==='attack'){const d=draft(s,m);return d.target!==null&&C.attackers(s,m.player,d.target).some(c=>c.uid===uid);}return m.eligible.includes(uid);}
 function art(code){const rec=ImageLibrary.by[code],url=ImageLibrary.safeUrl(rec?.faces?.B||rec?.imageUrl);return url?`<img src="${esc(url)}" alt="${esc(rec.nameZhCard||rec.name||code)}" loading="lazy" referrerpolicy="no-referrer">`:'<span class="table-card-fallback">卡图暂缺<br>请查看牌名与数值</span>';}
 function inspect(code){return `<button class="inspect-card" data-action="images" data-image-action="open" data-code="${esc(code)}" aria-label="查看卡牌详情">查看</button>`;}
 function character(s,c,m){const h=c.state,v=R.find(s,c.uid)?R.stats(s,c.uid):c.meta,selectable=eligible(s,m,c.uid),selected=!!m&&ids(s,m).includes(c.uid),ability=R.abilitySpec(s,c.controller,c.uid),a=selectable?'data-action="desktop" data-desktop="pick"':!m&&ability.legal?'data-action="planning" data-plan="ability"':'',captured=c.kind==='hero'&&!s.rescued&&s.prisoner?.player===c.controller&&s.prisoner?.hero===h.index;
  return `<article class="table-card character-card ${h.exhausted?'exhausted':''} ${selectable?'selectable':''} ${selected?'selected':''} ${h.destroyed||captured?'unavailable':''}" data-card-uid="${c.uid}" aria-label="${esc(c.meta.nameZh)}：意志 ${v.willpower||0} 攻击 ${v.attack||0} 防御 ${v.defense||0} 生命 ${v.health||0}${c.kind==='hero'?' 资源 '+(h.resources||0):''} 伤害 ${h.damage||0}${selectable?'，点击选择':''}">${tokenRow('attr-tokens',tk('willpower',v.willpower||0,false)+tk('attack',v.attack||0,false)+tk('defense',v.defense||0,false)+tk('hitPoints',v.health||0,false))}<button class="card-face" ${a} data-player="${c.controller}" data-uid="${c.uid}" ${a?'':'disabled'} aria-label="${esc(c.meta.nameZh)}${selectable?'，点击选择':''}" aria-pressed="${selected}">${art(c.meta.code)}${selected?'<span class="selection-mark">已选</span>':''}</button><div class="table-card-caption"><b>${esc(c.meta.nameZh)}</b>${c.kind!=='hero'&&h.resources?`<span>资源 ${h.resources}</span>`:''}${h.destroyed||captured||h.committed?`<span>${[h.destroyed?'已离场':captured?'囚禁':'',h.committed?'已投入':''].filter(Boolean).join(' · ')}</span>`:''}</div>${tokenRow('state-tokens',c.kind==='hero'?tk('resource',h.resources||0)+tk('damage',h.damage||0):tk('damage',h.damage||0))}${inspect(c.meta.code)}</article>`;
 }
 function playerChars(s,p){return [...p.heroStates.map(h=>({kind:'hero',uid:h.uid,controller:p.id,owner:p.id,state:h,meta:R.data(s,{...h,owner:p.id})})),...p.allies.map(c=>({kind:'ally',uid:c.uid,controller:p.id,owner:c.owner,state:c,meta:R.data(s,c)}))];}
 function encounter(s,c,zone,m){const found=R.find(s,c.uid),v=found?R.stats(s,c.uid):c;let attrs='',legal=false,selected=false;
  if(s.status==='playing'&&!s.pending.length&&!R.context(s)?.queue?.length&&!R.context(s)?.tasks?.length){
   if(s.phase===3&&zone==='staging'&&c.type==='Location'&&E.traveling.spec(s,c.uid).legal){attrs='data-action="travelFlow" data-travel="propose"';legal=true;}
   else if(s.phase===4&&s.encountering?.step==='optional'&&zone==='staging'&&c.type==='Enemy'){try{E.encountering.propose(JSON.parse(JSON.stringify(s)),handView,c.uid);attrs=`data-action="desktop" data-desktop="engage" data-player="${handView}"`;legal=true;}catch{}}
   else if(s.phase===5&&s.combat?.step==='enemyChoice'&&C.pendingEnemies(s,C.activeEnemyPlayer(s)).some(e=>e.uid===c.uid)){attrs=`data-action="combatFlow" data-combat="enemy" data-player="${C.activeEnemyPlayer(s)}"`;legal=true;}
   else if(m?.kind==='attack'&&C.attackTargets(s,m.player).some(e=>e.uid===c.uid)){attrs='data-action="desktop" data-desktop="target"';legal=true;selected=draft(s,m).target===c.uid;}
  }
  const stats=c.type==='Enemy'?`威胁 ${v.threat||0} · 攻击 ${v.attack||0} · 防御 ${v.defense||0}<br>伤害 ${c.damage||0}/${v.health||0} · 交战 ${c.engagement??'—'}`:c.type==='Location'?`威胁 ${v.threat||0} · 进度 ${c.progress||0}/${c.quest}`:c.holder?`持有：${esc(s.players[c.holder.player].name)}`:c.guard?'守卫尚未清除':'可领取';
  return `<article class="table-card encounter-card ${legal?'selectable':''} ${selected?'selected':''}" data-card-uid="${c.uid}"><button class="card-face" ${attrs} data-uid="${c.uid}" ${legal?'':'disabled'} aria-label="${esc(c.name)}" aria-pressed="${selected}">${art('enc-'+c.id)}${selected?'<span class="selection-mark">目标</span>':''}</button><div class="table-card-caption"><b>${esc(c.name)}</b><span>${stats}</span>${c.shadows?`<span>暗影 ${c.shadows.length} · 已翻开 ${c.shadows.filter(x=>x.revealed||c.shadowRevealed).length}</span>`:''}</div>${tokenRow('state-tokens',c.type==='Enemy'?tk('damage',c.damage||0):c.type==='Location'?tk('progress',c.progress||0):'')}${inspect('enc-'+c.id)}${zone==='objective'&&!c.holder&&!c.guard?`<button data-action="claim" data-uid="${c.uid}" ${R.window(s).kind==='action'?'':'disabled'}>领取目标</button>`:''}<details><summary>牌文</summary><p>${esc(c.rule)}</p></details></article>`;
 }
 const row=(label,body,extra='')=>`<section class="table-zone ${extra}"><div class="zone-heading"><h2>${label}</h2></div><div class="table-card-row">${body||'<span class="zone-empty">暂无卡牌</span>'}</div></section>`;
 function selection(s,m){if(!m)return '';const selected=ids(s,m).map(uid=>R.find(s,uid)).filter(Boolean),d=draft(s,m);let preview='';
  if(m.kind==='quest')preview='暂定意志 '+selected.reduce((n,c)=>n+R.stats(s,c.uid).willpower,0);
  if(m.kind==='defense'){const defense=selected.reduce((n,c)=>n+R.stats(s,c.uid).defense,0),atk=R.find(s,s.combat.attack.uid);preview=`暂定防御 ${defense} · 敌人当前攻击 ${(atk?R.stats(s,atk.uid).attack:0)+(s.combat.attack.bonus||0)}（暗影与后续效果仍可能改变）`;}
  if(m.kind==='attack'){const attack=selected.reduce((n,c)=>n+R.stats(s,c.uid).attack,0),target=d.target?R.find(s,d.target):null;preview=`暂定基础攻击 ${attack}${target?' · 目标防御 '+R.stats(s,target.uid).defense+' · 基础伤害预估 '+Math.max(0,attack-R.stats(s,target.uid).defense):' · 请先点选目标敌人'}（特殊能力以正式结算为准）`;}
  return `<div class="table-selection"><b>${esc(s.players[m.player].name)} · ${m.kind==='quest'?'点击角色暂定投入':m.kind==='defense'?'点击角色暂定防御；不选表示无人防御':'先点敌人，再点参与攻击的角色'}</b><p aria-live="polite">${esc(preview)} · 已选 ${selected.length} 名</p><div class="actions">${b(m.kind==='quest'?'提交暂定派遣名单':m.kind==='defense'?'提交暂定防御名单':'提交暂定攻击名单','submit','',m.kind==='attack'&&(!d.target||!selected.length))}${b('清空选择','clear')}${m.kind==='attack'?`<button data-action="combatFlow" data-combat="endAttacks" data-player="${m.player}">暂定结束我的攻击</button>`:''}</div><p class="small muted">这里只暂定名单。全员二次确认后才横置、支付并执行。</p></div>`;
 }
 function next(s){const x=R.context(s),done=x?.completed;let label='',disabled=false;
 if(s.status==='won'||s.status==='lost')return `<span class="badge">${s.status==='won'?'剧本已结束 · 见上方结算':'远征已结束 · 见上方结算'}</span>`;
 if(s.setupPending||setupPendingReveal(s))return '';if(s.phase===0)label='收集资源、抽1张牌 → 计划阶段';else if(done)label=s.phase===6?'进入下一回合 · 资源阶段':'进入第'+['一','二','三','四','五','六','七'][s.phase+1]+'阶段 · '+E.phases[s.phase+1];else if(s.phase===1){label='结算计划阶段结束';disabled=!PlanningUI.canFinish(s);}else return '';
  return `<button class="primary" data-action="next" ${disabled||s.pending.length||s.status!=='playing'?'disabled':''}>${label}</button>`;
 }
 /* 待结算事项面板。历史上 tableHTML 直接调用 pending() 但从未定义，
    导致任何存在 s.pending 的时刻整个渲染抛 ReferenceError（mutate 回滚，玩家看不到结算按钮）。 */
 function pending(){
  const s=stateRef();if(!s||!s.pending.length)return '';
  const spiders=s.pending.filter(t=>t.kind==='spider');
  const spiderPool=spiders.length?[...new Set([...s.deck,...s.discard].filter(c=>(c.traits||'').includes('Spider')).map(c=>c.id))].map(id=>{const c=[...s.deck,...s.discard].find(x=>x.id===id);return `<option value="${c.uid}">${esc(c.name)}</option>`;}).join(''):'';
  const items=s.pending.map(t=>{
   const note=t.kind==='spider'?`<select id="choice-${t.id}" aria-label="选择蜘蛛">${spiderPool||'<option value="">牌库与弃牌堆中没有蜘蛛</option>'}</select>`
    :t.kind==='treachery'?`<span class="small muted">按牌面文字手动结算后确认</span>`
    :t.kind==='eliminate'?`<span class="small muted">该玩家将被淘汰，交战的敌人回到探查区</span>`
    :`<span class="small muted">按牌面文字手动结算后确认</span>`;
   return `<div class="pending-item"><p><b>${esc(String(t.text||t.kind).slice(0,120))}</b></p>${note}<div class="actions"><button class="primary" data-action="resolve" data-id="${t.id}" ${t.kind==='spider'&&!spiderPool?'disabled':''}>确认结算</button></div></div>`;
  }).join('');
  return `<section class="panel pending-panel"><div class="panel-title"><h2>待结算事项</h2><span class="badge">${s.pending.length} 项</span></div><p class="small">这些效果需要人工按牌面文字处理：处理后点「确认结算」才会继续推进。</p>${items}</section>`;
 }
 let currentState=null;
 function stateRef(){return currentState;}
 function setupPendingReveal(s){return !!(s&&s.setupReveal&&!s.setupReveal.finished);}
 function setupPanel(s){if(!setupPendingReveal(s))return '';const x=s.setupReveal,cur=x.current,opts=cur?E.setupCancelOptions(s):[];
  const card=cur?`<div class="setup-reveal">${ImageLibrary.encounterArt(cur.id)}<div><h3>${esc(cur.name)}</h3><p>${esc(cur.rule||'')}</p><p class="small">${esc({Enemy:'敌人',Location:'地点',Treachery:'诡计',Objective:'目标'}[cur.type]||cur.type)} · 厄运 ${cur.doomed||0} · ${cur.surge?'涌现':'无涌现'} · ${x.canceled?'翻开效果已取消（关键词仍结算）':'等待结算'}${x.kind==='tower'&&x.guard?' · 本张守卫目标':''}</p></div></div>`:'';
  return `<section class="panel setup-flow"><div class="panel-title"><h2>剧本设置 · 开局翻牌（${x.kind==='tower'?'每张目标各1张':'每位玩家各1张'}）</h2><span class="badge">剩 ${x.remaining} 张</span></div><p class="small">开局翻牌逐张结算：每张都可以在翻开时使用<b>意志考验</b>或<b>埃莉诺</b>取消其翻开效果。取消后关键词仍结算，然后翻下一张。</p>${card}<div class="actions">${cur?opts.map(o=>`<button data-action="setupCancel" data-value="${esc(o.value)}">${esc(o.label)}</button>`).join(''):''}${cur?`<button class="primary" data-action="setupResolve">结算此牌并继续</button>`:`<button class="primary" data-action="setupDraw">翻开下一张遭遇牌</button>`}</div></section>`;
 }
 /* 剧本结算计分面板：胜利后显示官方公式的完整分项明细。 */
 function scorePanel(s){
  if(!s||(s.status!=='won'&&s.status!=='lost'))return '';
  const r=(typeof ScoreEngine!=='undefined'?ScoreEngine:null)?.score(s);
  if(!r)return '';
  const rows=(typeof ScoreEngine!=='undefined'?ScoreEngine:null).lines(s).map(x=>`<tr class="score-row score-${x.key}"><th>${esc(x.label)}</th><td class="score-value">${x.sign}${x.value}</td><td class="small muted">${esc(x.note||'')}</td></tr>`).join('');
  const title=s.status==='won'?'剧本胜利 · 结算计分':'远征失败 · 过程计分';
  const verdict=s.status==='won'?`<div class="score-total"><span>总分</span><strong>${r.total}</strong><small>${esc(r.rating)} · ${esc(r.ratingNote)}</small></div>`
   :`<div class="score-total lost"><span>参考分</span><strong>${r.total}</strong><small>失败局不计入战绩，仅作过程参考</small></div>`;
  return `<section class="panel score-panel"><div class="panel-title"><h2>${title}</h2><span class="badge">${esc((E.quest(s)||{}).name||'')}</span></div><p class="small">按原版计分公式：威胁合计 + 回合数×10 + 淘汰人数×100 + 英雄伤害 − 胜利区点数。分数越低越好。</p><table class="score-table"><tbody>${rows}</tbody></table>${verdict}<p class="small muted">每名玩家归一化 ${r.perPlayer}（跨人数比较时参考）。${r.players} 人 · ${r.rounds} 回合 · ${({easy:'简单',normal:'标准',nightmare:'噩梦'}[r.difficulty]||'标准')}模式</p><div class="actions"><button class="primary" data-action="export">导出本局存档</button><button data-action="reset">开始新剧本</button></div></section>`;
 }
 function status(s){if(!s||s.status!=='playing')return null;
  if(s.setupPending)return {label:'确认起始手牌',chips:chipRow(s,s.players.map(p=>p.id),s.players.filter(p=>p.openingConfirmed).map(p=>p.id),'已确认','待确认')};
  if(setupPendingReveal(s)){const x=s.setupReveal;return {label:x.current?'开局翻开：'+x.current.name+'（可取消或结算）':'开局翻牌 · 还剩 '+x.remaining+' 张',chips:chip('剧本设置')};}
  if(s.pending.length)return {label:'先处理剧本待结算事项',chips:chip('待结算 '+s.pending.length+' 项')};
  const q=s.questing,c=s.combat,t=s.traveling,e=s.encountering,r=s.refreshing,ids=live(s).map(p=>p.id);
  if(q&&q.round===s.round&&!q.completed){
   if(q.step==='commit'&&!q.deploymentLocked){const order=q.order||[],done=order.filter(id=>q.deployments?.[id]?.confirmed),pend=order.filter(id=>!q.deployments?.[id]?.confirmed);
    if(pend.length)return {label:'等待 '+pend.map(id=>s.players[id]?.name||('玩家'+(id+1))).join('、')+' 提交派遣名单（'+done.length+'/'+order.length+'）',chips:chipRow(s,order,done,'已提交','待提交')};
    const app=q.deploymentApprovals||[];return {label:'名单已就绪 · 等待二次确认（'+app.length+'/'+order.length+'）',chips:chipRow(s,order,app,'已确认','待确认')};}
   if(q.actionLocked)return {label:'正在执行暂定行动',chips:chip('全员已确认','done')};
   if(q.plannedActions?.length){const app=q.actionApprovals||[];return {label:'暂定行动待确认（'+app.length+'/'+ids.length+'）',chips:chipRow(s,ids,app,'已确认','待确认')};}
  }
  if(s.phase===5&&c){const app=c.approvals||[];
   if(c.proposal)return {label:'战斗方案待确认（'+app.length+'/'+ids.length+'）',chips:chipRow(s,ids,app,'已确认','待确认')};
   if(c.step==='enemyChoice'){const pid=C.activeEnemyPlayer(s);return {label:esc(s.players[pid].name)+' 选择攻击敌人',chips:chip('剩余 '+C.pendingEnemies(s,pid).length+' 名')};}
   if(c.step==='attackChoice'){const pid=C.activePlayer(s);return {label:esc(s.players[pid].name)+' 声明玩家攻击',chips:chip('先点敌人再点角色')};}
  }
  if(s.phase===3&&t&&t.step==='choice'){const app=t.approvals||[];
   if(t.proposal)return {label:'旅行选择待确认（'+app.length+'/'+ids.length+'）',chips:chipRow(s,ids,app,'已确认','待确认')};
   return {label:esc(s.players[s.first].name)+' 选择旅行地点',chips:chip('暂定后再全员确认')};}
  if(s.phase===4&&e&&e.step==='optional'){const app=e.approvals||[],picked=Object.keys(e.choices||{}).length;
   return {label:picked?'主动交战方案待确认（'+app.length+'/'+ids.length+'）':'选择主动交战或不交战',chips:chipRow(s,ids,app,'已确认','待确认')};}
  if(s.phase===6&&r&&r.step==='ready'&&r.approvals){const app=r.approvals;
   return {label:'刷新方案待确认（'+app.length+'/'+ids.length+'）',chips:chipRow(s,ids,app,'已确认','待确认')};}
  return null;
 }
 function prompt(s,m){if(s.status!=='playing')return s.status==='won'?'剧本胜利':'远征失败';if(s.setupPending)return '每位玩家确认起始手牌';if(setupPendingReveal(s))return s.setupReveal.current?'开局翻开「'+s.setupReveal.current.name+'」：先取消或结算，再翻下一张':'剧本设置：翻开下一张遭遇牌';if(s.pending.length)return '先处理剧本待结算事项';if(m)return m.kind==='quest'?'选择投入角色':m.kind==='defense'?'选择防御者':'选择攻击目标与角色';const st=status(s);if(st)return st.label;if(s.phase===2&&s.questing?.step==='commit'&&!s.questing.deploymentLocked){const pend=(s.questing.order||[]).filter(id=>!s.questing.deployments?.[id]?.confirmed).map(id=>s.players[id]?.name).filter(Boolean);if(pend.length)return '等待 '+pend.join('、')+' 提交派遣名单（顶部按钮切换）';}const x=R.context(s);if(x?.completed)return '本阶段已完成';if(x?.queue?.length)return '处理卡牌效果或即时响应';if(x?.tasks?.length)return '选择强制效果目标';return ['收集资源与抽牌','打出卡牌或使用行动','探险与遭遇结算','选择旅行地点','主动交战与交战检定','敌人攻击与玩家攻击','刷新与回合结束'][s.phase];}
 function phasePanel(s,pid,m){if(m?.kind==='quest'){const q=s.questing;return `<section class="panel"><h2>阶段3 · 角色投入</h2><p>从桌面点选重置角色；全员确认前可更改。</p>${selection(s,m)}<div class="actions">${s.players.filter(p=>!p.eliminated).map(p=>q.deployments?.[p.id]?.confirmed?`<span class="badge">${esc(p.name)}：已提交（可更改）</span>${b('取消'+p.name+'的提交','withdraw',`data-player="${p.id}"`)}`:`<span class="badge">${esc(p.name)}：未提交</span>`).join('')}</div></section>`;}
  return (m&&m.kind!=='quest'?selection(s,m):'')+(s.phase===1?PlanningUI.panel(s,pid):s.phase===2?QuestUI.panel(s,pid):s.phase===3?TravelUI.panel(s,pid):s.phase===4?EncounterUI.panel(s,pid):s.phase===5?CombatUI.panel(s,pid):s.phase===6?RefreshUI.panel(s,pid):'');
 }
 function tableHTML(s,pid){
  currentState=s;if(!s.players.every(p=>p.heroStates))return legacyTable();const p=s.players[pid]||s.players[0],m=mode(s,p.id),q=E.quest(s),sc=LOTR_DATA.scenarios.find(c=>c.id===s.scenario);
  if(!m)draft(s,null);
  const others=s.players.filter(x=>x.id!==p.id).map(o=>`<section class="other-player"><div class="zone-heading"><h3>${esc(o.name)}${s.first===o.id?' · 起始玩家':''}</h3><span>威胁 ${o.threat}${o.eliminated?' · 已淘汰':''}</span>${b('查看手牌与完整区域','view',`data-player="${o.id}"`)}</div><div class="table-card-row peer-cards">${playerChars(s,o).map(c=>character(s,c,m)).join('')}${o.engaged.map(c=>encounter(s,c,'engaged',m)).join('')}</div></section>`).join('');
  const hand=p.hand.map(c=>{const meta=R.data(s,{...c,owner:p.id}),sp=R.playSpec(s,p.id,c.uid);
   /* 费用检测：时机/目标合法但匹配领域的资源不足 → 灰化禁用，仍保留悬停放大与查看（探针挂在 article 上，绕过 disabled button 不派发 hover 的限制）。 */
   const unaff=!sp.legal&&/资源不足/.test(sp.reason||'');
   const probe=unaff?(()=>{const rec=ImageLibrary.by[c.code],url=rec?ImageLibrary.safeUrl(rec.faces?.B||rec.imageUrl):null;return url?` data-hover-src="${esc(url)}" data-hover-shape="tall"`:'';})():'';
   return `<article class="table-card hand-card ${sp.legal?'selectable':''}${unaff?' unaffordable':''}"${probe}><button class="card-face" data-action="planning" data-plan="play" data-player="${p.id}" data-uid="${c.uid}" ${sp.legal?'':'disabled'} aria-label="使用${esc(meta.nameZh)}">${art(c.code)}</button><div class="table-card-caption"><b>${esc(meta.nameZh)}</b><span>费用 ${meta.cost??'—'} · ${esc(meta.sphereName||meta.sphere)}</span></div>${inspect(c.code)}<span class="card-legality">${esc(sp.legal?'点击选择目标与费用':sp.reason)}</span></article>`;}).join('');
  /* 玩家状态条：BGA 式汇总每位玩家的威胁／资源／伤害，点按即切换查看（复用 view 动作）。 */
 const tabStats=o=>{const res=o.heroStates?o.heroStates.reduce((n,h)=>n+h.resources,0):0,dmg=o.heroStates?o.heroStates.reduce((n,h)=>n+(h.damage||0),0):0;
  return `<span class="tab-stats">威胁 <b>${o.threat}</b> · 资源 <b>${res}</b> · 伤害 <b>${dmg}</b></span>${s.first===o.id?'<span class="first-mark">起始</span>':''}${o.eliminated?'<span class="elim-mark">淘汰</span>':''}`;};
 return `<div class="desktop-table"><div class="expedition-title"><div><span class="eyebrow">MIDDLE-EARTH EXPEDITION · ${APP_VERSION}</span><h1>${esc(s.session&&s.session.name||sc.name)}</h1></div><span>${s.session&&s.session.name?esc(sc.name)+' · ':''}第 ${s.round} 回合 · ${s.players.length} 人同机${s.session&&s.session.difficulty?' · '+({easy:'简单',normal:'标准',nightmare:'噩梦'}[s.session.difficulty]||''):''}</span><div class="player-tabs" role="group" aria-label="查看玩家">${s.players.map(o=>`<button data-action="desktop" data-desktop="view" data-player="${o.id}" class="${o.id===p.id?'active':''}" aria-pressed="${o.id===p.id}"><b class="tab-name">${esc(o.name)}</b>${tabStats(o)}</button>`).join('')}</div>${b('重新选择剧本','reset')}</div><div class="tabletop-layout"><div class="tabletop-main"><div class="operation-dock" role="region" aria-label="当前操作"><div class="operation-title"><span class="operation-indicator"></span><strong>${esc(prompt(s,m))}</strong><div class="operation-chips">${status(s)?.chips||''}</div><span class="small">第 ${s.phase+1}/7 阶段 · ${E.phases[s.phase]}</span>${next(s)}</div><p class="small phase-hint">${esc(phaseHint())}</p><div class="operation-content">${scorePanel(s)}${PlayerUI.openingPanel(s)}${setupPanel(s)}${s.pending.length?pending():''}${phasePanel(s,p.id,m)}${WindowUI.panel(s)}</div></div><div class="public-table"><div class="quest-location-row"><section class="table-zone quest-zone"><div class="zone-heading"><h2>当前探险 · ${esc(q.stage)}</h2><strong>${q.points?s.progress+' / '+q.points+' 进度':'特殊胜利条件'}</strong></div><div class="quest-display"><div class="quest-art-wrap">${ImageLibrary.art('enc-'+q.id,'',s.setupPending?'A':'B')}${q.points?`<div class="card-tokens quest-tokens" aria-hidden="true">${tk('progress',s.progress)}</div>`:''}</div><div><h3>${esc(q.name)}</h3><p>${esc(s.setupPending?q.front:q.back)}</p><span class="small muted">${esc(E.gate(s)||'满足条件后由规则自动推进')}</span></div></div>${q.points?`<div class="quest-progress" role="progressbar" aria-label="探险进度" aria-valuemin="0" aria-valuemax="${q.points}" aria-valuenow="${s.progress}"><div class="quest-progress-fill" style="width:${Math.min(100,Math.round(s.progress/q.points*100))}%"></div><span class="quest-progress-label">${s.progress} / ${q.points}</span></div>`:''}</section>${row('当前地点',s.active?encounter(s,s.active,'active',m):'','active-zone')}</div>${row('探查区 <span class="threat-total">总威胁 '+E.threat(s)+'</span>',s.staging.map(c=>encounter(s,c,'staging',m)).join(''))}${s.objectives.length?row('剧本目标',s.objectives.map(c=>encounter(s,c,'objective',m)).join('')):''}${others}</div><section class="player-mat"><div class="zone-heading"><h2>${esc(p.name)} · ${esc(p.registeredDeck?.name||'玩家区域')}</h2><span class="own-piles">威胁 ${p.threat}${s.first===p.id?' · 起始玩家':''} · <span class="pile-chip">牌库 <b>${p.playerDeck.length}</b></span> · <span class="pile-chip">弃牌 <b>${p.playerDiscard.length}</b></span></span></div>${row('英雄与盟友 <span class="small muted">盟友区 · '+p.allies.length+'</span>',playerChars(s,p).map(c=>character(s,c,m)).join(''),'own-characters')}${p.attachments.length?row('附属',p.attachments.map(c=>{const meta=R.data(s,c),host=R.find(s,c.target),legal=R.abilitySpec(s,p.id,c.uid).legal;return `<article class="table-card"><button class="card-face" data-action="planning" data-plan="ability" data-player="${p.id}" data-uid="${c.uid}" ${legal?'':'disabled'}>${art(c.code)}</button><div class="table-card-caption"><b>${esc(meta.nameZh)}</b><span>附于 ${esc(host?.meta.nameZh||host?.meta.name||'目标已离场')}</span></div>${inspect(c.code)}</article>`;}).join('')):''}${p.engaged.length?row('交战区',p.engaged.map(c=>encounter(s,c,'engaged',m)).join('')):''}${row('手牌 · '+p.hand.length+' <span class="small muted">点击可用卡牌；查看按钮放大牌文</span>',hand,'hand-zone')}<p class="small muted">同机模式可切换查看每位玩家手牌；不提供联网私密手牌。</p></section></div><aside class="tabletop-rail">${PhaseLog.rail(s,railOpen())}<section class="table-log" aria-label="远征日志">${PhaseLog.panel(s,logMarks(),logScope(),railOpen(),false)}</section></aside></div></div>`;
 }
 function handle(el){const k=el.dataset.desktop,uid=+el.dataset.uid,pid=+el.dataset.player,m=mode(state,handView),d=draft(state,m);
  if(k==='view'){handView=pid;render();return;}if(k==='reset'){if(confirm('结束当前桌面并重新选择剧本？建议先导出存档。'))mutate(()=>state=null);return;}
  if(k==='pick'){if(!eligible(state,m,uid)){toast('此角色当前不能加入名单');return;}if(m.kind==='quest'){const a=QuestUI.draftFor(state,m.player);QuestUI.setDraft(state,m.player,a.includes(uid)?a.filter(x=>x!==uid):[...a,uid]);}else d.ids=d.ids.includes(uid)?d.ids.filter(x=>x!==uid):[...d.ids,uid];render();return;}
  if(k==='target'){if(m?.kind!=='attack'||!C.attackTargets(state,m.player).some(e=>e.uid===uid)){toast('该敌人不是合法攻击目标');return;}d.target=uid;d.ids=[];render();return;}
  if(k==='clear'){if(m?.kind==='quest')QuestUI.setDraft(state,m.player,[]);else d.ids=[];render();return;}
  if(k==='submit'&&m){const kind=m.kind,chosen=[...ids(state,m)];mutate(()=>{if(kind==='quest')Q.submitDeployment(state,m.player,chosen);else C.propose(state,m.player,kind,d.target,chosen);});if(kind==='quest'&&state?.questing?.step==='commit'&&!state.questing.deploymentLocked){const pid=(state.questing.order||[]).find(id=>!state.questing.deployments?.[id]?.confirmed);if(pid!==undefined&&pid!==handView){handView=pid;render();}}return;}
  if(k==='withdraw'){mutate(()=>Q.withdrawDeployment(state,pid));return;}
  if(k==='engage')mutate(()=>E.encountering.propose(state,pid,uid));
 }
 /* 拖放表现：代币可拖起、可放到卡面上（与诡镇网页版一致的手感），但本作代币数量
    一律由规则引擎结算——放置只给提示，不改动任何状态（交互红线）。 */
 document.addEventListener?.('dragstart',e=>{const t=e.target.closest?.('.tk');if(t&&e.dataTransfer){e.dataTransfer.setData('text/plain','lotr-token');e.dataTransfer.effectAllowed='copy';}});
 document.addEventListener?.('dragover',e=>{if(e.dataTransfer&&[...e.dataTransfer.types].includes('text/plain')&&e.target.closest?.('.table-card,.quest-art-wrap')){e.preventDefault();e.dataTransfer.dropEffect='copy';}});
 document.addEventListener?.('drop',e=>{if(e.dataTransfer?.getData('text/plain')==='lotr-token'&&e.target.closest?.('.table-card,.quest-art-wrap')){e.preventDefault();toast('代币数量由规则引擎自动结算，暂不支持手动拖放。');}});
 return {render:tableHTML,handle,mode,draft,eligible,selection,status,setupPanel,setupPendingReveal,scorePanel};
})();
