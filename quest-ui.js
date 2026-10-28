const QuestUI=(()=>{
 const R=ScenarioEngine.questing,P=ScenarioEngine.planning,esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const button=(text,kind,args='',disabled=false)=>`<button data-action="quest" data-quest="${kind}" ${args} ${disabled?'disabled':''}>${esc(text)}</button>`;
 /* v0.15.80（R4）：草稿改按 pid 分槽（Map），见下方 draftFor 注释。 */
 /* v0.15.80（R4）：草稿改按 pid 分槽（Map）。旧的单槽 {context,player,ids} 会在
    「玩家0 勾到一半 → 切去看玩家1 → 切回来」时把玩家0 的草稿当场重置成提交名单，
    同机多人协作时反复丢勾选。分槽后每个 pid 各自记住自己的草稿，切人不丢。 */
 let drafts=new Map();
 /* draftFor 有副作用（会把该 pid 的草稿重置成「这个 pid 的初始名单」），只给交互路径用。
    「只是看看」的地方（R0 合计、名单明细、勾选态、浮层徽标）一律走纯函数 draftPeek——
    拿别人的 pid 调 draftFor 会让当前操作者勾好的名单当场消失，且不进 history、撤不回来。 */
 function draftFor(s,pid){let d=drafts.get(pid);if(!d||d.context!==s.questing){d={context:s.questing,ids:[...(s.questing.deployments?.[pid]?.ids||[])]};drafts.set(pid,d);}const allowed=R.eligible(s,pid).map(c=>c.uid);d.ids=d.ids.filter(id=>allowed.includes(id));return [...d.ids];}
 function draftPeek(s,pid){const allowed=R.eligible(s,pid).map(c=>c.uid);const d=drafts.get(pid);const ids=d&&d.context===s.questing?d.ids:[...(s.questing.deployments?.[pid]?.ids||[])];return ids.filter(id=>allowed.includes(id));}
 function setDraft(s,pid,ids){const allowed=R.eligible(s,pid).map(c=>c.uid);drafts.set(pid,{context:s.questing,ids:[...new Set(ids)].filter(id=>allowed.includes(id))});}
 const steps={beforeCommit:'投入前行动窗口',commit:'派遣名单',afterCommit:'投入后行动窗口',staging:'逐张探查',afterStaging:'探险结算前行动窗口',afterResult:'结算后行动窗口',completed:'阶段3验收完成'};

 /* ── 派遣名单（v0.15.71）──────────────────────────────────────────────
    一屏只留一个主操作，纵向四段（编号与验收口径一致）：
      R0 头部（状态·合计 + 玩家分段）· R1 名单区 · R2 主操作行 · R3 规则与名单
    状态枚举（唯一一支，不再用「两条并列 if 各追加一段」）：
      A  本人未提交                        1 绿【提交名单】（0 名时【提交空名单】）
      B  本人已提交、他人未提交            0 绿，ghost【修改名单】+ 行尾「还差 玩家2 提交」
      C1 全员已交、本人未确认              1 绿【确认派遣】+ ghost【修改名单】+「尚未横置角色」
      C2 本人已确认、他人未确认            0 绿，ghost【取消确认】+ 行尾「还差 玩家2 确认」
      D  deploymentLocked                  无按钮，只读
    单人局永远到不了 C：引擎在 submitDeployment 里提交即自动 approveDeployment。
    所有「全员」判据都走 liveOrder（排除已淘汰玩家），否则中途有人被淘汰会把全队永远卡在 B。 */
 const RULES='名单全部提交后才能二次确认；确认后仍可取消。任何修改会清除所有人的确认。全员确认后按起始玩家顺序横置，并结算投入响应。';
 const nameOf=(s,id)=>s.players[id]?.name||('玩家'+(id+1));
 const liveOrder=s=>(s.questing?.order||[]).filter(id=>!s.players[id]?.eliminated);
 /* R4 的展开态是纯视图偏好：render() 全量重建会把 <details open> 抹掉，所以要自己记住。 */
 let rulesOpen=false;
 function stateOf(s,pid){
  const q=s.questing,live=liveOrder(s),apr=q.deploymentApprovals||[];
  if(q.deploymentLocked)return 'D';
  if(!live.length)return 'D';
  if(!q.deployments?.[pid]?.confirmed)return 'A';
  if(!live.every(id=>q.deployments?.[id]?.confirmed))return 'B';
  if((q.order||[]).length>1&&q.discussion){
   if(!apr.includes(pid))return 'C1';
   if(!live.every(id=>apr.includes(id)))return 'C2';
  }
  return 'D';
 }
 /* R0 的数字 = Σ 已提交名单 + 本机草稿（未提交者按 0 计），所以草稿态也能看到「我勾了会怎样」。*/
 function tally(s,pid,ph){
  let n=0,will=0;
  for(const id of liveOrder(s)){const d=s.questing.deployments?.[id];if(!d?.confirmed)continue;n+=d.ids.length;will+=d.ids.reduce((a,uid)=>a+P.stats(s,uid).willpower,0);}
  if(ph==='A'){const ids=draftPeek(s,pid);n+=ids.length;will+=ids.reduce((a,uid)=>a+P.stats(s,uid).willpower,0);}
  return {n,will};
 }
/* 「已投入」只属于锁定态，所以 D 态的前缀是「实际」，未锁一律「暂定」——
   两个都是两个汉字，五态前缀实宽严格相等，数字文本的起点才不会跟着状态跳。
   （v0.15.72 更正：早前 D 态用空前缀 + .r0-label:empty{display:none}，会让整行左移 20px。） */
function statusParts(s,pid,ph){
 const {n,will}=tally(s,pid,ph);
 return {label:ph==='D'?'实际':'暂定',num:`${n} 名 · 意志 ${will}`};
}
const pillOf=(s,ph)=>{if(ph==='A')return '草稿';if(ph==='B')return '已提交';if(ph==='C1')return '待确认';if(ph==='C2'){const q=s.questing;return '已确认 '+((q.deploymentApprovals||[]).length)+'/'+liveOrder(s).length;}return '执行中';};
/* R0 头部：一行装「谁 · 交了多少」（pill + 前缀 + 数字）和「切换看谁的名单」（分段按钮组），
   行尾小字说「还差谁」。宽屏一行、窄屏自动落两行，但只算一段，不再多一层纵向分隔。
   这一行是**内容宽、左锚**的：跨状态稳定的是数字文本的起点（pill 等宽 + 前缀等宽），
   不是右缘——要右缘恒定就得让 .r0 撑满整行，那会把数字甩到面板远端、和状态词之间空出几百像素。
   .r0 带 tabindex=-1：单人局没有 R1 胶囊，焦点恢复时落在这里（见 focusActor）。 */
function headRow(s,pid,ph){
 const {label,num}=statusParts(s,pid,ph),q=s.questing,live=liveOrder(s),apr=q.deploymentApprovals||[];
 let note='';
 if(ph==='B')note='还差 '+live.filter(id=>!q.deployments?.[id]?.confirmed).map(id=>nameOf(s,id)).join('、')+' 提交';
 if(ph==='C1')note='尚未横置角色';
 if(ph==='C2')note='还差 '+live.filter(id=>!apr.includes(id)).map(id=>nameOf(s,id)).join('、')+' 确认';
 /* D 态不渲染玩家切换：tally() 是全员累加，pid 只在 A 态影响草稿，D 态切人时 R0 数字
   一个字符都不会变——那是一个点了没有任何反馈的死控件。 */
 const group=(live.length<2||ph==='D')?'':`<fieldset class="quest-actors" role="radiogroup" aria-label="当前操作玩家">${live.map(id=>{const sub=!!q.deployments?.[id]?.confirmed,ok=apr.includes(id),tone=ok?'ok':sub?'sub':'idle',label2=ok?'已确认':sub?'已提交':'未提交';
  return `<label class="actor-chip" data-state="${tone}"><input type="radio" name="quest-actor" value="${id}" data-quest-actor="${id}" data-focus-key="quest-actor-${id}" ${id===pid?'checked':''} aria-label="${esc(nameOf(s,id))}，${label2}"><span class="dot" aria-hidden="true"></span>${esc(nameOf(s,id))}</label>`;}).join('')}</fieldset>`;
 return `<div class="r-head"><div class="r0" tabindex="-1"><span class="state-pill" data-state="${ph}">${esc(pillOf(s,ph))}</span><span class="r0-label">${esc(label)}</span><span class="r0-num">${esc(num)}</span></div>${group}${note?`<span class="action-note">${esc(note)}</span>`:''}</div>`;
}
 /* R1 名单区（三条互斥分支，同一位置演化）：
   A 可勾选网格；B/C1/C2 一行只读「已提交：本人名单」；D「已投入：全队名单」。
   「已提交」与「已投入」在同一个位置演化，正好承载「提交 ≠ 投入」这个模型。 */
 function committedLine(s){
  const list=P.chars(s).filter(c=>c.state.committed).map(c=>esc(c.meta.nameZh)+'（意'+P.stats(s,c.uid).willpower+'）');
  if(!list.length)return '';
  return `<div class="quest-committed" title="已投入：${list.join('、')}">已投入：${list.join('、')}</div>`;
 }
 function listRow(s,pid,ph){
  if(ph==='D')return committedLine(s);
  if(ph!=='A'){
   const ids=s.questing.deployments?.[pid]?.ids||[],names=ids.map(uid=>P.find(s,uid)?.meta.nameZh).filter(Boolean);
   return `<div class="quest-submitted" title="已提交：${esc(names.join('、'))}">已提交：${esc(names.join('、')||'未派遣角色')}</div>`;
  }
  const mine=P.chars(s).filter(c=>c.controller===pid),selected=draftPeek(s,pid);
  if(!mine.length)return '<div class="quest-commit-list empty">本回合无可用角色</div>';
  return `<div class="quest-commit-list">${mine.map(c=>`<label data-state="${selected.includes(c.uid)?'on':''}"><input type="checkbox" data-commit="${c.uid}" data-focus-key="quest-commit-${c.uid}" ${c.state.exhausted?'disabled':''} ${selected.includes(c.uid)?'checked':''}><span>${esc(c.meta.nameZh)}</span><small>意${P.stats(s,c.uid).willpower}</small></label>`).join('')}</div>`;
 }
 /* R2 主操作：一屏唯一主操作。A/C1 一颗绿；B/C2 只有 ghost（撤销不是推进，给绿会让按钮同位置绿↔ghost 翻转）。*/
 function mainAction(s,pid,ph){
  if(ph==='D')return '';
  const green=(label,kind,key)=>`<button class="primary" data-action="quest" data-quest="${kind}" data-player="${pid}" data-focus-key="${key}">${esc(label)}</button>`;
  const ghost=(label,kind,key)=>`<button class="quest-ghost" data-action="quest" data-quest="${kind}" data-player="${pid}" data-focus-key="${key}">${esc(label)}</button>`;
  let main='',sub='';
  if(ph==='A')main=green(draftPeek(s,pid).length?'提交名单':'提交空名单','commit','quest-submit');
  else if(ph==='B')sub=ghost('修改名单','withdraw','quest-withdraw');
  else if(ph==='C1'){main=green('确认派遣','approveDeployment','quest-approve');sub=ghost('修改名单','withdraw','quest-withdraw');}
  else if(ph==='C2')sub=ghost('取消确认','unapproveDeployment','quest-unapprove');
  return `<div class="quest-main-action">${main}${sub}</div>`;
 }
 /* R3 规则与名单：规则正文 + 名单明细。明细用来说明 R0 的差额（未提交者按 0 计）。
   规则在任何状态都可查（只读态更需要）；明细在 D 态不渲染——上方已有全队「已投入：…」。
   summary 文案恒定，避免这一行横向抖。 */
 function roster(s){
  const live=liveOrder(s),viewer=typeof handView==='number'?handView:null,dep=s.questing.deployments||{};
  const rows=live.map(id=>{const name=esc(nameOf(s,id));
   if(dep[id]?.confirmed){const ids=dep[id].ids||[],will=ids.reduce((a,uid)=>a+P.stats(s,uid).willpower,0);
    return `<li data-roster-player="${id}"><span class="name">${name}</span><span class="num">${ids.length} 名 · 意志 ${will}</span><span class="st st-submitted">已提交</span></li>`;}
   if(id===viewer){const ids=draftPeek(s,id);if(ids.length){const will=ids.reduce((a,uid)=>a+P.stats(s,uid).willpower,0);
    return `<li data-roster-player="${id}"><span class="name">${name}</span><span class="num">${ids.length} 名 · 意志 ${will}</span><span class="st st-draft">草稿</span></li>`;}}
   return `<li data-roster-player="${id}"><span class="name">${name}</span><span class="num"></span><span class="st st-none">未提交</span></li>`;}).join('');
  return `<ul class="commit-roster quest-roster">${rows}</ul>`;
 }
function rulesRow(s,ph){
 return `<details class="commit-hint quest-rules" id="quest-rules"${rulesOpen?' open':''}><summary>规则与名单</summary><p>${esc(RULES)}</p>${ph==='D'?'':roster(s)}</details>`;
}
function deploySection(s,pid){
 const ph=stateOf(s,pid);
 return `<div class="quest-deploy" data-state="${ph}">${headRow(s,pid,ph)}${listRow(s,pid,ph)}${mainAction(s,pid,ph)}${rulesRow(s,ph)}</div>`;
}
 /* 勾选复选框只改本地草稿与摘要文字，绝不 render()——整页重绘会把焦点丢掉。 */
 function syncDraftBits(s,pid){
  if(typeof document==='undefined'||typeof document.querySelector!=='function')return;
  const ids=draftPeek(s,pid);
  const num=document.querySelector('.r0-num');
  if(num)num.textContent=statusParts(s,pid,'A').num;
  const commit=document.querySelector('[data-quest="commit"]');
  if(commit)commit.textContent=ids.length?'提交名单':'提交空名单';
  document.querySelectorAll('[data-commit]').forEach(el=>{const l=el.closest&&el.closest('label');if(l&&l.dataset)l.dataset.state=el.checked?'on':'';});
  /* 明细若正展开着，勾选也要跟着变，否则读屏与视觉都会停在旧数。 */
  const cell=document.querySelector('[data-roster-player="'+pid+'"]');
  if(cell){
   const will=ids.reduce((a,uid)=>a+P.stats(s,uid).willpower,0),numCell=cell.querySelector('.num'),st=cell.querySelector('.st');
   if(numCell)numCell.textContent=ids.length?`${ids.length} 名 · 意志 ${will}`:'';
   if(st){st.textContent=ids.length?'草稿':'未提交';st.className='st '+(ids.length?'st-draft':'st-none');}
  }
  /* v0.15.81：勾选只做局部同步（不整页重绘），触发条徽标与缩略图已选态也要跟着刷新。 */
  syncPickBits(s,pid);
 }
 /* 牌桌角色卡与勾选双向同步：反向点卡本来就能同步，正向勾选以前只改摘要。 */
 function syncTableMarks(s,pid){
  if(typeof document==='undefined'||typeof document.querySelectorAll!=='function')return;
  const ids=draftPeek(s,pid);
  document.querySelectorAll('.character-card').forEach(card=>{
   const on=ids.includes(Number(card.dataset&&card.dataset.cardUid));
   if(card.classList){if(on)card.classList.add('selected');else card.classList.remove('selected');}
   const face=card.querySelector&&card.querySelector('.card-face');
   if(face&&face.setAttribute)face.setAttribute('aria-pressed',on?'true':'false');
   const mark=card.querySelector&&card.querySelector('.selection-mark');
   if(on&&!mark&&typeof document.createElement==='function'){
    const span=document.createElement('span');span.className='selection-mark';span.textContent='已选';if(face&&face.append)face.append(span);
   }else if(!on&&mark&&mark.remove)mark.remove();
  });
 }
 function bind(){
  if(typeof document==='undefined'||typeof document.querySelectorAll!=='function')return;
  const rules=document.querySelector('#quest-rules');
  if(rules&&rules.addEventListener)rules.addEventListener('toggle',()=>{rulesOpen=!!rules.open;});
  if(!state?.questing||state.questing.step!=='commit')return;
  const live=liveOrder(state),pid=live.includes(handView)?handView:live[0];
  if(pid===undefined)return;
  document.querySelectorAll('[data-commit]').forEach(el=>el.onchange=()=>{
   setDraft(state,pid,[...document.querySelectorAll('[data-commit]:checked')].map(x=>+x.dataset.commit));
   syncDraftBits(state,pid);syncTableMarks(state,pid);
  });
  document.querySelectorAll('[data-quest-actor]').forEach(el=>el.onchange=()=>{
   const next=Number(el.dataset.questActor);
   if(Number.isInteger(next)&&next!==handView){handView=next;render();}
  });
 }
 /* 提交／确认之后的焦点落点：多人局落新操作者的 R1 胶囊，单人局落 .r0。
   为什么不落「下一位的确认派遣」：#1 它会被 render 的按 key 恢复顺手选中，按住回车
   就连续替两个人确认；#2 胶囊是非推进性动作（只切视图），回车最坏也只是再看一遍。
   为什么必须显式 focus：render 只在 innerHTML 替换前记住 activeElement 的 key，替身
   状态一变（quest-approve → quest-unapprove / 切到别人）就匹配不上，焦点会掉回 body。 */
function focusActor(pid){
 if(typeof document==='undefined'||typeof document.querySelector!=='function')return;
 const chip=Number.isInteger(pid)?document.querySelector('[data-quest-actor="'+pid+'"]'):null;
 const el=chip||document.querySelector('.r0');
 if(el&&typeof el.focus==='function')el.focus({preventScroll:true});
}
/* 播报：先清空再异步写入，#live 是 shell.html 里的 role=status 空节点（在 #app 之外，
    否则每次 render 都会把它连内容一起销毁）。同一句连播两次时浏览器只在内容变化时才读。 */
 function say(text){
  if(typeof document==='undefined'||typeof document.querySelector!=='function'||!text)return;
  const box=document.querySelector('#live');if(!box)return;
  box.textContent='';
  setTimeout(()=>{box.textContent=text;},30);
 }
 function deployedCount(s){return Object.values(s.questing.deployments||{}).reduce((n,d)=>n+((d.ids||[]).length),0);}
 /* 面板底部只留一个出口：本阶段还有必需操作时点它=列出还差什么；
    全部完成时点它=引擎自检并推进。撤销走顶栏「撤销一步」，这里不再重复。 */
 function panel(s,pid){if(s.phase!==2||!s.questing)return '';const q=s.questing,ch=P.choiceSpec(s),sp=R.spec(s),live=liveOrder(s),actor=live.includes(pid)?pid:(live[0]??null);const w=P.window(s);let body='';
  if(q.completed)return '<section class="panel deck-valid"><h2>阶段3 · 探险阶段验收完成</h2><p>探险结果与阶段结束效果已结算。点「结束阶段」进入第四阶段 · 旅行。</p></section>';
  if(ch)body+=`<div class="notice">${esc(ch.message)} <button data-action="planning" data-plan="choice" data-id="${ch.task.id}">处理卡牌响应</button></div>`;
  if(sp)body+=`<div class="notice">${esc(sp.message)} ${button('选择并结算','choice',`data-id="${sp.task.id}"`,!!ch)}</div>${q.tasks.filter(t=>t!==sp.task&&t.kind==='commitResponse').map(t=>button('先结算：'+(P.find(s,t.payload.uid)?.meta.nameZh||'投入响应'),'choice',`data-id="${t.id}"`,!!ch)).join('')}`;
  /* 派遣这一段整块交给 deploySection：状态枚举只有一份实现，详细模式与智能模式共用。
     有卡牌响应要处理时不出控件（避免在别人决定时提交名单），只留只读摘要。 */
  if(q.step==='commit'){
   if(sp||ch||actor===null){
    const lockedPh=q.deploymentLocked?'D':'A';
    body+=`<div class="quest-deploy" data-state="${lockedPh}">${headRow(s,actor,lockedPh)}${q.deploymentLocked?committedLine(s):''}${q.deploymentLocked?rulesRow(s,'D'):''}</div>`;
   }else body+=deploySection(s,actor);
  }else body+=committedLine(s);
  if(q.discussion&&(q.plannedActions?.length||q.actionLocked||q.actionError)){body+=`<section class="notice"><h3>暂定行动 · 交流缓冲区</h3><p>按下列顺序执行；全员二次确认前不支付、不弃牌、不抽牌。修改或撤销会清除全体二次确认。</p>${q.actionError?`<p>${esc(q.actionError)}</p>`:''}${(q.plannedActions||[]).map(a=>{const source=a.kind==='play'?s.players[a.player].hand.find(c=>c.uid===a.uid):P.find(s,a.uid)?.state;const m=source?P.data(s,{...source,owner:a.player}):null;return `<p>${esc(s.players[a.player].name)} · ${a.kind==='play'?'事件':'能力'}：${esc(m?.nameZh||'#'+a.uid)} ${button('撤销此暂定行动','cancelAction',`data-player="${a.player}" data-id="${a.id}"`,q.actionLocked)}</p>`;}).join('')}<div class="actions">${q.order.filter(id=>!s.players[id].eliminated).map(id=>button(s.players[id].name+(q.actionApprovals?.includes(id)?'：取消二次确认':'：二次确认行动'),q.actionApprovals?.includes(id)?'unapproveActions':'approveActions',`data-player="${id}"`,!q.plannedActions?.length||q.actionLocked||!!ch||!!sp)).join('')}</div>${q.actionLocked?'<p>全员已确认，正在执行；请先处理效果与响应。</p>':''}</section>`;}
  if(q.step==='staging'&&!sp&&!ch){if(q.current){const c=q.current.card;body+=`<div class="quest-reveal">${ImageLibrary.encounterArt(c.id)}<h3>${esc(c.name)}</h3><p>${esc(c.rule)}</p><p>厄运 ${c.doomed||0} · ${c.surge?'涌现':'无涌现'} · ${q.current.canceled?'翻开效果已取消':'等待结算'}</p><div class="actions">${R.cancelOptions(s).map(o=>button(o.label,'cancel',`data-value="${o.value}"`)).join('')}${button('结算此牌的关键词与效果','reveal')}</div></div>`;}else body+=button(q.remaining.length?'翻开下一张遭遇牌（待翻 '+q.remaining.length+'）':'结束探查，开放行动窗口','draw');}
  if(w.kind==='action'&&!q.actionLocked&&ScenarioEngine.windows.settings(s).mode==='detailed'&&actor!==null){body+=`<p class="small">事件与主动能力先进入暂定清单，全员二次确认后执行。${q.plannedActions?.length?'暂定行动尚未执行，请先二次确认或撤销。':'等待结束行动：'+(s.players.filter(p=>!p.eliminated&&!q.finalPasses.includes(p.id)).map(p=>esc(p.name)).join('、')||'全员已放弃，可以推进')}。放弃后仍可取消放弃。</p><div class="actions">${s.players.filter(p=>!p.eliminated).map(p=>button(p.name+(q.finalPasses.includes(p.id)?'：取消放弃行动':'：放弃本窗口行动'),q.finalPasses.includes(p.id)?'unpass':'pass',`data-player="${p.id}"`,false)).join('')}${button(q.step==='beforeCommit'?'开始投入角色':q.step==='afterCommit'?'开始探查':q.step==='afterStaging'?'自动结算探险':'结束探险阶段','move','',!!q.plannedActions?.length||!s.players.filter(p=>!p.eliminated).every(p=>q.finalPasses.includes(p.id)))}</div><label>使用行动的玩家 <select id="planning-actor">${s.players.filter(p=>!p.eliminated).map(p=>`<option value="${p.id}" ${p.id===actor?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><div class="actions">${P.abilities(s,actor).map(a=>`<button data-action="planning" data-plan="ability" data-player="${actor}" data-uid="${a.uid}" title="${esc(a.reason)}" ${a.legal?'':'disabled'}>${esc(a.name)}</button>`).join('')}</div><p class="small muted">事件在下方手牌区操作；任一行动会清除全体玩家的放弃标记。</p>`;}
  /* commit 这一段的数字在 R0 里，标题行不再重复「投入意志」；但威胁必须在这里补上——
     v0.15.72 把「／ 威胁 N」从 R0 数字串里移出（它在界面上已是第四处重复，且全局值
     不属于「我的派遣」这一行），玩家在 commit 时仍需要看到意志要对抗多少威胁。其他
     步骤（探查、结果）没有 R0，威胁照旧随标题走。 */
  const head=q.step==='commit'?`<div class="panel-title"><h2>阶段3 · ${steps[q.step]}</h2><strong>探查区威胁 ${ScenarioEngine.threat(s)}</strong></div>`:`<div class="panel-title"><h2>阶段3 · ${steps[q.step]}</h2><strong>投入意志 ${R.total(s)} ／ 探查区威胁 ${ScenarioEngine.threat(s)}</strong></div>`;
  return `<section class="panel questing-panel">${head}${q.result?`<p class="notice">本次结果：意志 ${q.result.willpower} − 威胁 ${q.result.threat} = ${q.result.delta}。${q.result.delta>0?'进度已自动分配':q.result.delta<0?'每位玩家威胁已增加'+(-q.result.delta):'平局，不放进度、不增加威胁'}。</p>`:''}${body}</section>`;
 }
 async function handle(b){let k=b.dataset.quest;const pid=+b.dataset.player,id=+b.dataset.id;
  if(k==='back'){if(history.length){state=history.pop();save();render();}return;}
  /* v0.15.81：浮层开合（toggle/close）改由 DecisionUI 统一处理（data-action="decide"），
     这里不再有自己的 .pick-trigger / pickState。 */
  if(k==='withdraw'){
   const q=state?.questing,was=(q?.deploymentApprovals||[]).length;
   /* 改名单会 invalidateAgreement 清空全队确认——这是本面板唯一需要二次确认的次操作。 */
   if(was>0){const ok=await choose('修改名单 · '+(state.players[pid]?.name||''),`<p>修改名单会清除全队已完成的 <b>${was}</b> 次确认，所有人需要重新确认。继续？</p>`,()=>true);if(!ok)return;}
   mutate(()=>{R.withdrawDeployment(state,pid);});
   if(was&&state?.questing&&!state.questing.deploymentLocked)say(`${nameOf(state,pid)} 改了名单，确认已重置，请重新确认`);
   return;
  }
  if(k==='clear'){setDraft(state,pid,[]);render();return;}
  if(k==='commit'){
   const ids=draftFor(state,pid),before=JSON.stringify(state);const selected=ids.map(id=>P.find(state,id));
   const solo=(state.questing.order||[]).length<2;
   const ok=await choose('提交名单 · '+state.players[pid].name,`<p>${selected.length?'将派遣以下角色：':'本次不派遣角色（0名）。'}</p><ul>${selected.map(c=>`<li>${esc(c.meta.nameZh)} · 意志 ${P.stats(state,c.uid).willpower}</li>`).join('')}</ul><p>当前意志合计 <b>${selected.reduce((n,c)=>n+P.stats(state,c.uid).willpower,0)}</b>。遭遇与后续行动可能改变此数值。</p><p>${solo?'单人局：提交即投入。':'只提交名单。全员确认后才横置。返回修改时勾选会保留。'}</p>`,()=>true);
   /* 提交 + 交接操作权必须进同一次 mutate（同一次 render）：提交后如果先渲染再单独
     渲染一次切人，第二次 innerHTML 替换会把第一次恢复的焦点连节点一起丢掉（U18-a）。 */
   let handedTo=null;
   if(ok)mutate(()=>{
    if(JSON.stringify(state)!==before)throw Error('桌面已变化，请重新核对派遣名单。');
    R.submitDeployment(state,pid,ids);drafts.delete(pid);
    const q=state.questing;
    if(q.step==='commit'&&!q.deploymentLocked&&typeof handView!=='undefined'){
     const next=liveOrder(state).find(x=>!q.deployments?.[x]?.confirmed);
     if(next!==undefined&&next!==handView){handView=next;handedTo=next;}
    }
    /* v0.15.81：浮层是开是关不再由这里标记——DecisionUI 用 (round,phase,kind,body 哈希)
       这一把唯一钥匙决定自动开合，提交后交接/全员交齐都会改变它的 key，浮层自然自动弹出。 */
   });
   if(ok&&state?.questing){
    const q=state.questing,live=liveOrder(state);
    if(q.deploymentLocked)say(`已锁定，正在按顺序投入 ${deployedCount(state)} 名角色`);
    else if(q.step==='commit'){
     const wait=live.filter(x=>!q.deployments?.[x]?.confirmed);
     if(wait.length)say(`${nameOf(state,pid)} 已提交名单，还差 ${wait.map(x=>nameOf(state,x)).join('、')}`);
     else say(`名单已齐，等待 ${live.filter(x=>!(q.deploymentApprovals||[]).includes(x)).length} 人确认，尚未横置`);
    }
    /* 操作权已经交出去了，焦点跟着交出去，别留在刚被替换掉的按钮上。 */
    if(handedTo!==null)focusActor(handedTo);
   }
   return;
  }
  if(k==='choice'){const sp=R.spec(state,id);if(!sp)return;let values=await choose(sp.message,sp.fields.map(f=>`<label>${esc(f.label)}<select id="quest-${f.key}">${f.options.map(o=>`<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}</select></label>`).join('')+(sp.task.optional?'<p><label><input id="quest-skip" type="checkbox">放弃此响应</label></p>':''),d=>({...Object.fromEntries(sp.fields.map(f=>[f.key,d.querySelector('#quest-'+f.key).value])),skip:!!d.querySelector('#quest-skip')?.checked}));if(values)mutate(()=>R.choose(state,id,values));return;}
  /* v0.15.81：`pickApprove` 退成**兼容别名**——v0.15.80 的两步内联确认（先翻确认条、
     再点「就是现在」）已退役：它必然与 R2 的「确认派遣」形成两颗同义绿按钮，而硬约束要求
     `.decide-box` 内 `[data-quest="approveDeployment"]` 恰好一颗、`.quest-deploy` 内
     primary ≤1。防误触的说明改由 pickBar 的静态文案承担（「确认后尚未横置…可随时取消确认」）。
     别名保留：老存档/外部脚本若还带着 data-quest="pickApprove"，行为与直接确认一致。 */
  if(k==='pickApprove'){k='approveDeployment';}
  if(k==='approveDeployment'||k==='unapproveDeployment'){
   const name=state?.players[pid]?.name||('玩家'+(pid+1));
   const before=(state.questing?.deploymentApprovals||[]).length;
   /* 二次确认也是「接力」：确认完把操作权交给下一位未确认者，并且必须和这次变更进同一次
      mutate —— 分开渲染两次会让第二次替换把第一次恢复的焦点连节点一起丢掉（U18-a）。 */
   let switched=null;
   mutate(()=>{
    if(k==='approveDeployment')R.approveDeployment(state,pid);else R.withdrawDeploymentApproval(state,pid);
    const q=state.questing,live=liveOrder(state);
    if(k==='approveDeployment'&&!q.deploymentLocked&&typeof handView!=='undefined'){
     const next=live.find(x=>!(q.deploymentApprovals||[]).includes(x));
     if(next!==undefined&&next!==handView){handView=next;switched=next;}
    }
   });
   const q=state?.questing;
   if(q&&(q.deploymentApprovals||[]).length!==before){
    if(q.deploymentLocked)say(`已锁定，正在按顺序投入 ${deployedCount(state)} 名角色`);
    else if(k==='unapproveDeployment')say(`${name} 取消确认，尚未横置`);
    else say(`已确认 ${(q.deploymentApprovals||[]).length}／${liveOrder(state).length}，尚未横置`);
   }
   /* 落点：交出去了就落新操作者；没交出去（已锁定 / 取消确认）就落回自己。
      绝不按原 key 恢复成「下一位的确认派遣」——按住回车会连续替两个人确认。 */
   focusActor(switched!==null?switched:handView);
   return;
  }
  mutate(()=>{if(k==='unpass')R.unpass(state,pid);if(k==='approveActions')R.approveActions(state,pid);if(k==='unapproveActions')R.withdrawActionApproval(state,pid);if(k==='cancelAction')R.cancelAction(state,pid,id);if(k==='pass')R.pass(state,pid);if(k==='move')R.move(state);if(k==='draw')R.drawNext(state);if(k==='reveal')R.resolveReveal(state);if(k==='cancel')R.cancel(state,b.dataset.value);});
 }
 /* 操作条只放这一步必须的输入：选角色投入 / 结算正在翻开的遭遇牌。
    其余说明、状态与「结束阶段」都在角色卡下方的完整面板里。 */
 function picker(s,pid){const q=s.questing;
  /* 投入前行动窗口也要给出「开始投入」入口：此前 picker 只在 step==='commit' 渲染，
     玩家在投入前窗口打完事件、全员确认后只能靠详细模式找到那个按钮——智能模式下就此永久卡住。 */
  if(!q||q.completed)return '';
  if(q.step==='beforeCommit'&&!q.deploymentLocked&&!R.spec(s)&&!P.choiceSpec(s)&&!q.actionLocked){
   const left=q.order.filter(id=>!q.finalPasses.includes(id));
   /* 全员放弃后才能投入：pass 只在 left 里，unpass 要覆盖已放弃的人 */
   const passed=q.order.filter(id=>q.finalPasses.includes(id));
   return `<section class="panel questing-panel compact"><div class="panel-title"><h2>投入前行动窗口</h2><strong class="small">意志 0 ／ 威胁 ${ScenarioEngine.threat(s)}</strong></div><p class="small muted">${q.plannedActions?.length?'暂定行动尚未执行，请先在上方二次确认或撤销。':left.length?'全队放弃本窗口行动后即可投入角色（可随时取消放弃）。':'全员已放弃，可以投入角色。'}</p><div class="actions">${left.map(id=>`<button data-action="quest" data-quest="pass" data-player="${id}">${esc(s.players[id].name)}：放弃本窗口行动</button>`).join('')}${passed.map(id=>`<button data-action="quest" data-quest="unpass" data-player="${id}">${esc(s.players[id].name)}：取消放弃</button>`).join('')}</div><div class="actions"><button class="primary" data-action="quest" data-quest="move" ${(!q.plannedActions?.length&&!left.length)?'':'disabled'}>开始投入角色 →</button></div></section>`;
  }
  if(q.step!=='commit'||q.deploymentLocked||R.spec(s)||P.choiceSpec(s))return '';
  const live=liveOrder(s),actor=live.includes(pid)?pid:(live[0]??null);
  if(actor===null)return '';
  /* 智能模式与详细模式共用同一份五态面板：以前这里是一份精简的重复实现，
     两处各改一半就成了「同一件事两个入口、两颗绿按钮」。 */
  return `<section class="panel questing-panel compact">${deploySection(s,actor)}</section>`;
 }
 function revealCard(s){const c=s.questing&&s.questing.current&&s.questing.current.card;if(!c)return '';
  return `<section class="panel questing-panel compact"><div class="panel-title"><h2>翻开的遭遇</h2><strong>${c.surge?'涌现':'无涌现'}</strong></div><p><b>${esc(c.name)}</b></p><p class="small muted">${esc(c.rule)}</p><div class="actions">${R.cancelOptions(s).map(o=>button(o.label,'cancel',`data-value="${o.value}"`)).join('')}${button('结算此牌的关键词与效果','reveal')}</div></section>`;
 }
 /* 决策弹窗的标题直接用这里的中文步骤名，免得两处各写一份文案、改一处漏一处。 */
 function stepName(step){return steps[step]||'';}
/* ── 探险 commit 的「选人」区（v0.15.81）──────────────────────────────
   v0.15.80 的独立浮层（.quest-pick + 独立触发按钮 + 自成一套的开合状态机）已退役：
   用户要求「全部阶段的决策面板统一为一行触发条 + 非模态浮层」，于是选人网格并入
   DecisionUI 的统一浮层 `.decide-pop`（作为浮层体的一段，排在 deploySection 之前），
   开合／自动弹出／Esc／点外部全部由 DecisionUI 统一管理（.decide-trigger + .decide-pop），
   这里只负责**渲染**与**草稿**：
     · drafts 按 pid 分槽（R4）——切人丢草稿的老账已还，保留；
     · 缩略图与桌面角色卡、内联勾选共用同一份草稿（R3 双向同步），点击走 DesktopUI 的 pick 路径；
     · 触发条上的「已选 N 名（意志 X）」徽标由 pickHint 提供（不再有第二条触发条）。
   为什么不保留 pickState：状态一旦分散在两处，就会出现「同一时刻两个浮层」「Esc 关哪一个」
   这种二义性——决策面板只能有一个开合真相。 */
function pickBadge(s,pid){const ids=draftPeek(s,pid),will=ids.reduce((a,uid)=>a+P.stats(s,uid).willpower,0);return `已选 ${ids.length} 名（意志 ${will}）`;}
const qtk=(type,n)=>`<span class="tk tk-${type}"><img src="assets/tokens/${type}.png" alt=""><b>${n}</b></span>`;
 /* 选人网格：一卡 = 卡图（424/600 cover）+ 卡名（单行省略）+ 属性代币行 + 费用徽标 + 查看角标。
    状态四态沿用 v0.15.80：is-selected 金边已选 / is-pending 绿态待确认 / is-exhausted 已横置 /
    is-gone 已离场。后三类 + 非 A 态一律 aria-disabled（点击由 DesktopUI.pick 兜底给 toast）。 */
 function pickGrid(s,pid,ph){
  const mine=P.chars(s).filter(c=>c.controller===pid),ids=draftPeek(s,pid);
  const sub=ph!=='A'?(s.questing.deployments?.[pid]?.ids||[]):[];
  const card=c=>{
   const v=P.stats(s,c.uid),st=c.state||{};
   const selected=ids.includes(c.uid),pending=sub.includes(c.uid),gone=!!st.destroyed,ex=!!st.exhausted;
   const cls=['qp-card',selected?'is-selected':'',pending?'is-pending':'',ex?'is-exhausted':'',gone?'is-gone':''].filter(Boolean).join(' ');
   const rec=ImageLibrary.by[c.meta.code],url=rec?ImageLibrary.safeUrl(rec.faces?.B||rec.imageUrl):null;
   const img=url?`<img src="${esc(url)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:'<span class="qp-noart">卡图暂缺</span>';
   const flag=pending?'<span class="qp-flag ok-flag">待确认</span>':selected?'<span class="selection-mark">已选</span>':ex?'<span class="qp-flag ex-flag">已横置</span>':gone?'<span class="qp-flag gone-flag">已离场</span>':'';
   const blocked=gone||ex||pending||ph!=='A';
   const label=`${esc(c.meta.nameZh)}：意志 ${v.willpower||0} 攻击 ${v.attack||0} 防御 ${v.defense||0} 生命 ${v.health||0}，${blocked?'当前不能加入名单':selected?'点击移出名单':'点击加入名单'}`;
   return `<div class="${cls}" data-card-uid="${c.uid}"><button class="card-face" data-action="desktop" data-desktop="pick" data-uid="${c.uid}" data-player="${pid}" data-focus-key="quest-pick-${c.uid}" aria-pressed="${selected}"${blocked?' aria-disabled="true"':''} aria-label="${label}">${img}${flag}</button><span class="qp-cost" title="费用 ${c.meta.cost??'—'}">${c.meta.cost??'—'}</span><button class="qp-view" data-action="images" data-image-action="open" data-code="${esc(c.meta.code)}" aria-label="查看${esc(c.meta.nameZh)}详情">查看</button><span class="qp-name" title="${esc(c.meta.nameZh)}">${esc(c.meta.nameZh)}</span><div class="card-tokens attr-tokens">${qtk('willpower',v.willpower||0)+qtk('attack',v.attack||0)+qtk('defense',v.defense||0)+qtk('hitPoints',v.health||0)}</div></div>`;
  };
  const group=(label,list)=>list.length?`<div class="pick-group"><div class="ng-chapter-head pick-group-head"><span>${label}</span><span class="pick-count">${list.length} 名</span></div><div class="pick-grid">${list.map(card).join('')}</div></div>`:'';
  const heroes=mine.filter(c=>c.kind==='hero'),allies=mine.filter(c=>c.kind!=='hero');
  return mine.length?group('英雄',heroes)+group('盟友',allies):'<p class="pick-empty">本回合无可用角色</p>';
 }
 /* 选人区的小标题行：谁在选 + （A 态）重置选择 + （C1 态）确认语义说明。
    「重置选择」只清草稿：主操作（提交／确认／修改）一律留在 .quest-deploy 的 R2，
    避免同一件事出现两颗同名按钮——v0.15.80 的浮层脚部曾与 R2 各有一颗「提交名单」。*/
 function pickBar(s,pid,ph){
  const ids=draftPeek(s,pid);
  const clear=ph==='A'?`<button class="quest-ghost pick-clear" data-action="quest" data-quest="clear" data-player="${pid}" aria-label="清空选择（重置当前名单草稿）"${ids.length?'':' disabled'}>重置选择</button>`:'';
  const note=ph==='C1'?'<span class="pick-note">确认后尚未横置，全员确认后才执行；可随时取消确认。</span>':ph==='B'?'<span class="pick-note">已提交名单，等待其他玩家</span>':ph==='C2'?'<span class="pick-note">已确认，等待其他玩家确认</span>':'';
  return `<div class="pick-bar"><span class="pick-bar-title">投入角色 · ${esc(nameOf(s,pid))}</span>${note}${clear}</div>`;
 }
 /* 浮层体里的选人段（DecisionUI 在 commit 步骤把它拼到 .decide-body 的最前面）。
    只有探险 commit 需要；有卡牌响应待结算（R.spec / P.choiceSpec）时不渲染——那时提交会被
    引擎拒绝，先让人处理响应（与 QuestUI.panel 的判据一致）。D 态（名单已锁定）不再渲染网格：
    角色正在被引擎横置，选人已无意义。 */
 function popExtra(s,pid){
  if(!s||s.phase!==2)return '';
  const q=s.questing;
  if(!q||q.completed||q.step!=='commit'||q.deploymentLocked)return '';
  if(R.spec(s)||P.choiceSpec(s))return '';
  const live=liveOrder(s),actor=live.includes(pid)?pid:live[0];
  if(actor===undefined||actor===null)return '';
  const ph=stateOf(s,actor);
  return `<div class="pick-panel" role="group" aria-label="投入角色选择">${pickBar(s,actor,ph)}${pickGrid(s,actor,ph)}</div>`;
 }
 /* 触发条右侧的提示区：原 .pick-badge 的「已选 N 名（意志 X）」搬到这里（不再有第二条触发条）。
     只在 A 态（草稿）给——B 之后名单已交给引擎，再写「已选」会与 R0 的「已提交」打架。 */
 function pickHint(s,pid){
  if(!s||s.phase!==2)return '';
  const q=s.questing;
  if(!q||q.completed||q.step!=='commit'||q.deploymentLocked)return '';
  if(R.spec(s)||P.choiceSpec(s))return '';
  const live=liveOrder(s),actor=live.includes(pid)?pid:live[0];
  if(actor===undefined||actor===null||stateOf(s,actor)!=='A')return '';
  return pickBadge(s,actor);
 }
 /* 勾选等局部同步路径（不整页重绘）刷新触发条徽标与缩略图已选态；整页 render() 会全量重建。 */
 function syncPickBits(s,pid){
  if(typeof document==='undefined'||typeof document.querySelector!=='function')return;
  const ids=draftPeek(s,pid);
  const hint=document.querySelector('.decide-trigger .decide-hint');
  if(hint)hint.textContent=pickHint(s,pid);
  const clear=document.querySelector('.pick-panel [data-quest="clear"]');
  if(clear)clear.disabled=!ids.length;
  document.querySelectorAll('.pick-grid .qp-card').forEach(card=>{
   const uid=Number(card.dataset&&card.dataset.cardUid),on=ids.includes(uid);
   if(card.classList){if(on)card.classList.add('is-selected');else card.classList.remove('is-selected');}
   const face=card.querySelector&&card.querySelector('.card-face');
   if(face&&face.setAttribute)face.setAttribute('aria-pressed',on?'true':'false');
   const mark=card.querySelector&&card.querySelector('.selection-mark');
   if(on&&!mark&&typeof document.createElement==='function'&&face&&face.append){const sp=document.createElement('span');sp.className='selection-mark';sp.textContent='已选';face.append(sp);}
   else if(!on&&mark&&mark.remove)mark.remove();
  });
 }
return {panel,handle,bind,setDraft,draftFor,draftPeek,picker,revealCard,stepName,stateOf,liveOrder,popExtra,pickHint,pickBadge};
})();
