/* 右侧「阶段竖图 + 结构化日志」——参照诡镇奇谈网页版。
   左侧一条竖排阶段色带（当前阶段高亮、已过阶段淡显），右侧按回合分组的日志流；
   每条日志按所属阶段着色，鼠标悬停时右侧浮出小撤回图标，点击回退到该条记录的状态。 */
const PhaseLog=(()=>{
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 /* 7 个阶段的配色：与阶段步骤条同一套色相，保证玩家在两处看到的颜色含义一致。 */
 const PHASE_COLOR=[
  {id:'P0',key:'resource',name:'资源',color:'#3f6b80'},
  {id:'P1',key:'planning',name:'计划',color:'#8a6a22'},
  {id:'P2',key:'quest',name:'探险',color:'#3f7a4a'},
  {id:'P3',key:'travel',name:'旅行',color:'#2f7385'},
  {id:'P4',key:'encounter',name:'遭遇',color:'#7d3f72'},
  {id:'P5',key:'combat',name:'战斗',color:'#9a3a31'},
  {id:'P6',key:'refresh',name:'刷新',color:'#3a5a78'}
 ];
 const PHASE_BY_KEY=Object.fromEntries(PHASE_COLOR.map(p=>[p.key,p]));
 /* 日志里出现这些词时，即使没有阶段标记也能判断归属（兼容旧存档与子系统日志）。 */
 const GUESS=[
  [/探险|意志|威胁增加|进度|阶段推进/, 'quest'],
  [/旅行|地点/, 'travel'],
  [/交战|遭遇|暗影|翻牌|敌人/, 'encounter'],
  [/攻击|防御|伤害|击杀|击败/, 'combat'],
  [/刷新|重置|回合结束/, 'refresh'],
  [/打出|支付|盟友|附属|事件|资源/, 'planning']
 ];
 /* 解析日志行：「回合3 · §P5§某事件」→ {round,phase,text} */
 function parse(line,fallbackKey){
  const m=/^回合(\d+) · (?:§(P\d+(?:\.\d+)?)§)?([\s\S]*)$/.exec(String(line||''));
  if(!m)return {round:0,phase:fallbackKey,text:String(line||'')};
  const raw=m[2]||'',base=raw.split('.')[0];
  let key=PHASE_COLOR.find(p=>p.id===base)?.key;
  if(!key)key=GUESS.find(([re])=>re.test(m[3]))?.[1]||fallbackKey||'planning';
  return {round:Number(m[1])||0,phase:key,text:m[3]};
 }
 /* 撤回定位：日志是 newest-first，下标 i 对应「第 logLength-1-i 条旧日志之后」的时刻。
   app.js 为每次操作记录 {seq, before, after}（该操作前后的日志条数），
   取满足 before <= 目标条数 < after 的那次操作即为产生该条日志的操作，
   回退到它的 before（即 history[seq]）就停在这条日志出现之前。
   marks 缺失（旧存档、纯 DOM 测试）时返回 null，界面不显示回退按钮。 */
 function undoFor(index,logLength,marks){
  if(!marks||!marks.length)return null;
  const target=logLength-1-index;           /* 该条日志出现之前的日志条数 */
  for(let j=marks.length-1;j>=0;j--)if(marks[j].before<=target&&target<marks[j].after)return marks[j].seq;
  return null;
 }
 /* 按回合分组：只做「相邻同回合合并」，再按回合号从新到旧排序。
    日志是 newest-first，但同回合内可能夹着跨回合的杂项（阶段切换、补写记录），
    单纯扫描会把同一回合拆成多段并排到后面，出现「回合2 / 回合3 / 回合1」的乱序。 */
 function group(entries){
  const out=[],byRound=new Map();
  for(const e of entries){
   let g=byRound.get(e.round);
   if(!g){g={round:e.round,items:[]};byRound.set(e.round,g);out.push(g);}
   g.items.push(e);
  }
  /* 回合号大的是更新的回合，排在上面；回合号 0（无法解析）沉底。 */
  return out.sort((a,b)=>(b.round||0)-(a.round||0));
 }
 /* 仅当前阶段的记录高亮，其余淡化——和截图里「MYTHOS 段整块亮、其余灰」一致。 */
 function rail(s){
  const cur=s.phase;
  return `<div class="phase-rail-v" role="list" aria-label="回合阶段">${PHASE_COLOR.map((p,i)=>{
   const state=i===cur?'current':i<cur?'past':'';
   return `<div class="rail-v-step ${state}" role="listitem" style="--pc:${p.color}" ${i===cur?'aria-current="step"':''}>
    <span class="rail-v-no">${i+1}</span><b>${esc(p.name)}</b></div>`;
  }).join('')}</div>`;
 }
 function entry(e,i,total,marks){
  const p=PHASE_BY_KEY[e.phase]||PHASE_COLOR[1];
  const seq=undoFor(i,total,marks);
  const undoable=seq!==null;
  return `<li class="log-entry tone-${esc(p.key)}" style="--pc:${p.color}" ${undoable?`data-undo-seq="${seq}"`:''}>
   <span class="log-dot" aria-hidden="true"></span>
   <span class="log-text">${esc(e.text)}</span>
   ${undoable?`<button class="log-undo" data-action="undoLog" data-seq="${seq}" title="回退到这一步之前" aria-label="回退到：${esc(e.text.slice(0,30))}">
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M6 3 2 6.5 6 10V7.5h3.2a3.3 3.3 0 0 1 0 6.6H5v1.6h4.2a4.9 4.9 0 0 0 0-9.8H6z" fill="currentColor"/></svg>
   </button>`:''}
  </li>`;
 }
 /* 显示范围：默认只显示本回合。round=0 表示「全部回合」。
   范围只影响渲染，不改写 state.log，也不进撤销历史——切换范围属于纯视图操作。 */
 const SCOPES=[{key:'round',label:'本回合'},{key:'all',label:'全部'}];
 const SCOPE_KEYS=SCOPES.map(x=>x.key);
 function normalizeScope(scope){return SCOPE_KEYS.includes(scope)?scope:'round';}
 /* 本回合能显示多少条：日志 newest-first，扫到第一条第 round 小于当前回合的记录为止。
    用长度而不是筛掉旧记录，保证「本回合」模式下 index 与原日志下标一致，回退映射不需要换算。 */
 function roundSpan(lines,round){
  let n=0;
  for(const line of lines){if(parse(line).round!==round)break;n++;}
  return n;
 }
 /* log: 原始日志（newest-first）；marks: app.js 的操作日志标记；scope: 'round'|'all' */
 function panel(s,marks=null,scope='round'){
  if(!s)return '';
  const mode=normalizeScope(scope),all=s.log||[],room=120;
  const span=mode==='round'?roundSpan(all,s.round):all.length;
  /* 总数取渲染窗口内的条数：回退映射只在这个窗口里有意义 */
  const raw=all.slice(0,Math.min(room,span));
  /* 下标必须随解析一起落库（日志是 newest-first，index 越小越新）。
     早先版本用 entries.indexOf(e) 反查，同文本条目会全部命中第一条，导致只有一条能撤回。 */
  const entries=raw.map((line,i)=>({...parse(line,PHASE_COLOR[s.phase]?.key),index:i}));
  const groups=group(entries);
  const total=entries.length;
  const hidden=all.length-span;
  const body=groups.length?groups.map(g=>`
   <div class="log-round">
    <div class="log-round-head"><span>回合 ${g.round||'—'}</span></div>
    <ol class="log-list">${g.items.map(e=>entry(e,e.index,total,marks)).join('')}</ol>
   </div>`).join(''):`<p class="log-empty">${mode==='round'?'本回合还没有记录；推进阶段或执行操作后会出现在这里。':'尚无可显示的记录。'}</p>`;
  /* 本回合模式下明确告知还有多少旧记录，并给一键切换（不写游戏状态） */
  const more=mode==='round'&&hidden>0?`<button type="button" class="log-more small" data-action="logScope" data-scope="all">更早 ${hidden} 条 · 查看全部回合</button>`:'';
  return `<section class="phase-log" aria-label="阶段与行动日志" data-scope="${mode}">
   ${rail(s)}
   <div class="log-bar">
    <div class="log-scope" role="group" aria-label="日志范围">${SCOPES.map(o=>`<button type="button" class="log-scope-btn${o.key===mode?' active':''}" data-action="logScope" data-scope="${o.key}" aria-pressed="${o.key===mode}">${o.label}</button>`).join('')}</div>
    <span class="log-count small">${mode==='round'?`本回合 ${total} 条`:`共 ${total} 条`}</span>
   </div>
   <div class="log-stream">${body}</div>
   ${more}
  </section>`;
 }
 return {panel,parse,undoFor,PHASE_COLOR,SCOPES,normalizeScope,roundSpan};
})();
