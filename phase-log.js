/* 右侧「阶段竖图 + 结构化日志」——参照诡镇奇谈网页版。
   左侧一条竖排阶段色带（当前阶段高亮、已过阶段淡显），右侧按回合分组的日志流；
   每条日志按所属阶段着色，鼠标悬停时右侧浮出小撤回图标，点击回退到该条记录的状态。 */
const PhaseLog=(()=>{
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 /* 7 个阶段的配色：与阶段步骤条同一套色相，保证玩家在两处看到的颜色含义一致。
    v0.16.0 Vintage 数据色（DESIGN_SYSTEM §5.7-c）：七色等亮度（对 var(--on-dark) 恰 5.6:1，
    极差 0.04），日志流不会因为读到战斗条目整行变重；OKLab 彩度 0.082–0.100，落在
    陈年颜料带（参照：赭石 0.079 / 橄榄绿 0.054 / 纯蓝 0.313）。
    资源 #0e647a（青）与刷新 #505795（靛）**有意留在冷侧**：靛青是正当颜料，
    两两 ΔE(OKLab) 最小 0.079（计划/探险），旧值资源/旅行仅 0.025——
    改色同时修掉了三处既有对比度失败（旧计划/探险/旅行对白字 4.22/4.29/4.49 < 4.5）。 */
 const PHASE_COLOR=[
  {id:'P0',key:'resource',name:'资源',color:'#0e647a'},
  {id:'P1',key:'planning',name:'计划',color:'#81520a'},
  {id:'P2',key:'quest',name:'探险',color:'#586110'},
  {id:'P3',key:'travel',name:'旅行',color:'#08694e'},
  {id:'P4',key:'encounter',name:'遭遇',color:'#7d4a7d'},
  {id:'P5',key:'combat',name:'战斗',color:'#8f4644'},
  {id:'P6',key:'refresh',name:'刷新',color:'#505795'}
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
 /* 阶段-窗口树：照规则书把每个阶段拆成「步骤 / 窗口」，编号形如 1.1、2.2.1。
    timing 标记该窗口的性质，决定右侧竖线颜色：
     - 'trigger'（金）：规则触发的强制结算，玩家无选择权
     - 'action' （绿）：行动窗口，玩家可以在此打出事件 / 使用能力
     - 'forced' （红）：必须结算且可能造成损失的步骤（暗影、伤害、攻击）
     - 'step'   （无）：纯流程推进，不开放行动
    key 对应引擎里各阶段 context.step 的取值，用于在当前窗口上点亮。 */
 const WINDOWS=[
  {id:'1',phase:'resource',windows:[
   {no:'1.1',key:'',label:'重置英雄',timing:'step'},
   {no:'1.2',key:'',label:'获得资源',timing:'step'},
   {no:'1.3',key:'',label:'抽牌',timing:'trigger'}]},
  {id:'2',phase:'planning',windows:[
   {no:'2.1',key:'action',label:'计划行动',timing:'action'},
   {no:'2.2',key:'afterResult',label:'阶段结束',timing:'step'}]},
  {id:'3',phase:'quest',windows:[
   {no:'3.1',key:'beforeCommit',label:'投入前行动',timing:'action'},
   {no:'3.2',key:'staging',label:'探查区',timing:'forced'},
   {no:'3.3',key:'afterResult',label:'任务结算',timing:'trigger'}]},
  {id:'4',phase:'travel',windows:[
   {no:'4.1',key:'choice',label:'选择地点',timing:'step'},
   {no:'4.2',key:'action',label:'旅行行动',timing:'action'}]},
  {id:'5',phase:'encounter',windows:[
   /* 5.1 是**行动窗口**（encounter-ui 的 ['beforeChecks','afterChecks'] 分支给能力/事件按钮），
      原来标成 'step' 是笔误：它既不开放行动、也不该被当成纯流程。显示元数据，不动引擎。 */
   {no:'5.1',key:'beforeChecks',label:'交战选择',timing:'action'},
   {no:'5.2',key:'checks',label:'交战检定',timing:'forced'},
   {no:'5.3',key:'afterChecks',label:'检定后行动',timing:'action'}]},
  {id:'6',phase:'combat',windows:[
   {no:'6.1',key:'enemyAction',label:'敌人攻击',timing:'forced'},
   {no:'6.2',key:'playerAction',label:'玩家攻击',timing:'action'},
   {no:'6.3',key:'shadows',label:'暗影结算',timing:'forced'},
   {no:'6.4',key:'endAction',label:'战斗结束',timing:'step'}]},
  {id:'7',phase:'refresh',windows:[
   {no:'7.1',key:'action',label:'刷新行动',timing:'action'},
   {no:'7.2',key:'completed',label:'重置卡牌',timing:'trigger'},
   {no:'7.3',key:'roundEnd',label:'回合结束',timing:'forced'}]}
 ];
 /* 当前步骤：引擎的 step 只在部分阶段存在，这里按引擎真实的 phase 编号取子对象：
    0 资源 / 1 计划 / 2 探险 / 3 旅行 / 4 遭遇 / 5 战斗 / 6 刷新。
    计划阶段（phase 1）用的是 planning.completed 标志而非 step，单独换算；
    资源阶段（phase 0）没有子对象，交给 rail 退回第一行。
    取不到时返回空串，竖轴退回「点亮该阶段第一行」，不会整段全暗。 */
 function stepKey(s){
  if(!s)return '';
  if(s.phase===0)return '';
  if(s.phase===1)return s.planning?.completed?'afterResult':'action';
  const byPhase={2:s.questing,3:s.traveling,4:s.encountering,5:s.combat,6:s.refreshing};
  const ctx=byPhase[s.phase];
  return (ctx&&ctx.step)||'';
 }
 /* 阶段竖轴：左侧通高色块 + 竖排阶段名，右侧逐条窗口（编号右对齐 + 触发竖线）。
    这是规则书里那张「阶段与时机」图的结构，不是装饰性的标签条——
    玩家扫一眼就知道当前处在哪个阶段的第几个窗口、后面还有哪些窗口要过。 */
 function rail(s,openSet){
  const cur=s.phase,curKey=stepKey(s);
  const extra=openSet||new Set();
  return `<div class="phase-rail-v" role="list" aria-label="阶段与窗口">${WINDOWS.map((grp,i)=>{
   const p=PHASE_COLOR.find(x=>x.key===grp.phase)||PHASE_COLOR[1];
   const st=i===cur?'current':i<cur?'past':'';
   /* 精确匹配到窗口就点亮那一条；step 拿不到（资源阶段、旧存档）时点亮该阶段第一行，
      既表明「在这个阶段」，又不假装知道具体走到第几步。 */
   const exact=curKey&&grp.windows.some(w=>w.key===curKey);
   const fallback=!exact&&i===cur;
   const rows=grp.windows.map((w,wi)=>{
    const hit=i===cur&&(exact?w.key===curKey:fallback&&wi===0);
    return `<li class="rail-win${hit?' hit':''}" style="--pc:${p.color}" ${hit?'data-current="1"':''}>
     <span class="rail-win-line" data-timing="${esc(w.timing)}" aria-hidden="true"></span>
     <span class="rail-win-no">${w.no}</span>
     <span class="rail-win-label" title="${esc(w.label)}">${esc(w.label)}</span>
    </li>`;
   }).join('');
   /* 全部阶段一律展开：竖轴通高 360px，20 条窗口 × 15px = 300px 刚好排得下，
      与参考图「整条竖轴一次看全」的形态一致。早期版本对未来阶段渲染一个只写数字的
      折叠块（rail-fold），既没有信息量又挤掉一行窗口，现已去掉。 */
   const cls=['rail-grp',st].filter(Boolean).join(' ');
   void extra;
   /* v0.15.94：阶段色块头**不是按钮**。折叠功能早已退役，全仓没有任何 railPhase 分发分支
      （见 planning-dom-tests 的 data-action 派发白名单守卫），原来那个
      `<button data-action="railPhase" aria-expanded="true">` 等于向屏幕阅读器谎称
      「这里有一个可展开/收起的控件」，而 7 个阶段头点下去什么都不会发生。
      改为不可交互的 <div>：去掉 type / data-action / data-phase / aria-expanded，
      只保留 title（悬停仍能读到「阶段：N 个窗口」）。 */
   return `<div class="${cls}" role="listitem" style="--pc:${p.color}">
    <div class="rail-head" title="${esc(p.name)}阶段：${grp.windows.length} 个窗口">
     <span>${esc(p.name)}阶段</span></div>
    <ol class="rail-wins">${rows}</ol>
   </div>`;
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
 function panel(s,marks=null,scope='round',openSet=null,withRail=true){
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
  /* 右栏只保留「竖轴 + 日志」两列：范围切换与「更早 N 条」这类控件会让面板多出一行，
     且本作日志本来就是按回合分组的，多一行控件只是噪音，故不再渲染。 */
  return `<section class="phase-log" aria-label="阶段与行动日志" data-scope="${mode}">
   <div class="log-bar"><span class="log-count small">${mode==='round'?`本回合 ${total} 条`:`共 ${total} 条`}${hidden>0?` · 另 ${hidden} 条更早` :''}</span></div>
   <div class="log-body${withRail?'':' solo'}">${withRail?rail(s,openSet):''}<div class="log-stream">${body}</div></div>
  </section>`;
 }
 return {panel,parse,undoFor,PHASE_COLOR,SCOPES,normalizeScope,roundSpan,WINDOWS,stepKey,rail};
})();
