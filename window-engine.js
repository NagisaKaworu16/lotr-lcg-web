/* Timing remains in phase engines. This controller only yields ordinary action windows. */
const WindowRulesFactory=E=>{
 const R=E.planning,Q=E.questing,need=(v,m)=>{if(!v)throw Error(m);},live=s=>s.players.filter(p=>!p.eliminated);
 const settings=s=>s.windowPrefs||{mode:'detailed'},key=(s,kind,pid,uid)=>`${s.round}:${s.phase}:${kind}:${pid}:${uid}`;
 /* 一条静默记录的两种生命周期：
    once  = 「本次跳过」——只在当前窗口生效。key 里带回合/阶段/步序，
            阶段一推进 key 就不再匹配，下次再遇到同一张牌照常提示。
    phase = 「本阶段不再问」——同样带回合/阶段，跨阶段自动失效。
    forever 保留给玩家在设置里显式关掉某个能力，目前没有 UI 入口。
    早先 mute() 只会写 forever，界面又没有入口，等于整局静默且无法反悔；
    这里把默认改成 once，让「跳过这一次」成为最短的那条路。 */
 const KEEPS=['once','phase','forever'];
 function check(s){need(s&&s.status==='playing','对局已结束');need(['smart','detailed'].includes(settings(s).mode),'无效窗口模式');}
 function setMode(s,mode){need(['smart','detailed'].includes(mode),'无效窗口模式');s.windowPrefs??={};s.windowPrefs.mode=mode;}
 // Some forms depend on earlier selections (e.g. Stand and Fight's chosen ally cost).
 // Search those selections without applying effects; bounded ambiguity keeps the window open.
 // 第三个返回值是「为什么不行」的第一手理由——早先这里丢掉 reason，导致一张卡明明
 // 在场却毫无反应，玩家只能怀疑是程序出错（对照 ArkhamHorror #5821 的 AbilityPrevented）。
 function probe(get){const todo=[{}],seen=new Set;let count=0,firstReason='';
  while(todo.length&&count++<128){const params=todo.pop(),tag=JSON.stringify(params);if(seen.has(tag))continue;seen.add(tag);const sp=get(params);if(sp.legal)return true;if(!firstReason&&sp.reason)firstReason=sp.reason;for(const f of sp.fields||[])if(!(f.key in params))for(const o of f.options||[])todo.push({...params,[f.key]:o.value});}
  return todo.length?'uncertain':firstReason||false;}
 /* 返回 {list, blocked}：blocked 是「在场但此刻不能用的来源」及理由。
    probe 现在可能返回字符串（否决理由），所以判定必须严格写 ===true，
    否则一条理由会被当成合法行动塞进列表。 */
 function options(s){if(!s||R.window(s).kind!=='action')return {list:[],blocked:[]};const out=[],blocked=[];
  for(const p of live(s)){
   for(const c of [...R.chars(s),...R.attaches(s)].filter(c=>c.controller===p.id||c.meta.code==='01007')){
    const legal=probe(a=>R.abilitySpec(s,p.id,c.uid,a));
    if(legal===true)out.push({kind:'ability',player:p.id,uid:c.uid,name:c.meta.nameZh||c.meta.name,uncertain:false});
    else if(legal==='uncertain')out.push({kind:'ability',player:p.id,uid:c.uid,name:c.meta.nameZh||c.meta.name,uncertain:true});
    else if(legal)blocked.push({kind:'ability',player:p.id,uid:c.uid,name:c.meta.nameZh||c.meta.name,reason:legal});}
   for(const c of p.hand){const m=R.data(s,{...c,owner:p.id});if(m?.type!=='event'||R.eventTiming(c.code)?.kind!=='action')continue;
    const legal=probe(a=>R.playSpec(s,p.id,c.uid,a));
    if(legal===true)out.push({kind:'play',player:p.id,uid:c.uid,name:m.nameZh||m.name,uncertain:false});
    else if(legal==='uncertain')out.push({kind:'play',player:p.id,uid:c.uid,name:m.nameZh||m.name,uncertain:true});
    else if(legal)blocked.push({kind:'play',player:p.id,uid:c.uid,name:m.nameZh||m.name,reason:legal});}
  }
  for(const o of s.objectives.filter(o=>!o.holder&&!o.guard)){for(const p of live(s))if(R.chars(s).some(c=>c.kind==='hero'&&c.controller===p.id&&R.restrictedOn(s,c.uid).length<2))out.push({kind:'objective',player:p.id,uid:o.uid,name:'领取'+o.name});}
  const mutedSet=new Set(s.windowPrefs?.muted||[]);
  return {list:out.map(o=>({...o,key:key(s,o.kind,o.player,o.uid),muted:mutedSet.has(key(s,o.kind,o.player,o.uid))})),blocked};
 }
 /* 兼容旧调用：run() 与 mute() 只要列表。 */
 function list(s){return options(s).list;}
 /* 记住「这个选项这次不用问我」。
    keep='once' 是默认值：写进 muted 后当前窗口立刻让过，阶段一推进 key 变化即自动恢复。
    keep='phase' 语义相同（key 已含阶段），单独保留是为了日志文案能说清玩家选了哪种。 */
 function mute(s,kind,pid,uid,keep='once'){check(s);need(KEEPS.includes(keep),'无效的静默范围');
  const o=list(s).find(o=>o.kind===kind&&o.player===pid&&String(o.uid)===String(uid));need(o,'当前没有此合法行动');
  s.windowPrefs??={mode:'smart'};s.windowPrefs.muted??=[];
  if(!s.windowPrefs.muted.includes(o.key))s.windowPrefs.muted.push(o.key);
  s.log.unshift(`回合${s.round} · ${E.phases[s.phase]} · 本次跳过「${o.name}」（阶段推进后恢复提示）`);}
 /* 只清掉「当前窗口」的静默，不动更早阶段残留的记录。
    restore() 是全清——那是给设置面板用的，误触代价大，不要拿来做单个撤销。 */
 function unmute(s,kind,pid,uid){check(s);const k=key(s,kind,pid,uid),m=s.windowPrefs?.muted;
  if(!m)return;const i=m.indexOf(k);if(i>=0){m.splice(i,1);s.log.unshift(`回合${s.round} · 已恢复提示：该选项重新可见`);}}
 function restore(s){s.windowPrefs??={mode:'smart'};const n=(s.windowPrefs.muted||[]).length;s.windowPrefs.muted=[];
  if(n)s.log.unshift(`已恢复全部 ${n} 条窗口跳过记录`);}
 function blocked(s){const x=R.context(s);return !x||x.completed||x.closing||x.halted||s.pending.length||x.queue.length||x.tasks?.length||x.current||(s.phase===5&&x.proposal)||x.plannedActions?.length||x.actionLocked||x.actionError;}
 function eligible(s){return s&&s.status==='playing'&&[1,2,3,4,5,6].includes(s.phase)&&R.window(s).kind==='action'&&!blocked(s)&&(s.phase!==1||R.active(s)===null);}
 function step(s){const x=R.context(s);for(const p of live(s))if(!x.finalPasses.includes(p.id))R.passAction(s,p.id);
  if(s.phase===1)R.finish(s);else if(s.phase===2)Q.move(s);else if(s.phase===3)E.traveling.finish(s);else if(s.phase===4){if(x.step==='beforeChecks')E.encountering.beginChecks(s);else E.encountering.finish(s);}else if(s.phase===5)E.combat.move(s);else E.refreshing.finish(s);
 }
 function next(s){check(s);need(eligible(s),'请先处理当前选择、响应或暂定方案');step(s);}
 function run(s){if(!s||settings(s).mode!=='smart')return;let n=0;while(eligible(s)&&n++<80){if(list(s).some(o=>!o.muted))break;const before=`${s.round}:${s.phase}:${R.context(s).step}:${R.context(s).completed}`;step(s);s.log.unshift(`回合${s.round} · 快速窗口 · 已自动让过普通行动（${E.phases[s.phase]}）`);if(before===`${s.round}:${s.phase}:${R.context(s).step}:${R.context(s).completed}`)break;}
  // No phase entry, forced target choice, optional response, reveal or shadow is skipped here.
 }
 return {settings,key,probe,options,list,setMode,mute,unmute,restore,eligible,next,run};
};
if(typeof module!=='undefined')module.exports=WindowRulesFactory;
