/* Timing remains in phase engines. This controller only yields ordinary action windows. */
const WindowRulesFactory=E=>{
 const R=E.planning,Q=E.questing,need=(v,m)=>{if(!v)throw Error(m);},live=s=>s.players.filter(p=>!p.eliminated);
 const settings=s=>s.windowPrefs||{mode:'detailed'},key=(s,kind,pid,uid)=>`${s.round}:${s.phase}:${kind}:${pid}:${uid}`;
 function check(s){need(s&&s.status==='playing','对局已结束');need(['smart','detailed'].includes(settings(s).mode),'无效窗口模式');}
 function setMode(s,mode){need(['smart','detailed'].includes(mode),'无效窗口模式');s.windowPrefs??={};s.windowPrefs.mode=mode;}
 // Some forms depend on earlier selections (e.g. Stand and Fight's chosen ally cost).
 // Search those selections without applying effects; bounded ambiguity keeps the window open.
 function probe(get){const todo=[{}],seen=new Set;let count=0;while(todo.length&&count++<128){const params=todo.pop(),tag=JSON.stringify(params);if(seen.has(tag))continue;seen.add(tag);const sp=get(params);if(sp.legal)return true;for(const f of sp.fields||[])if(!(f.key in params))for(const o of f.options||[])todo.push({...params,[f.key]:o.value});}return todo.length?'uncertain':false;}
 function options(s){if(!s||R.window(s).kind!=='action')return [];const out=[];
  for(const p of live(s)){
   for(const c of [...R.chars(s),...R.attaches(s)].filter(c=>c.controller===p.id||c.meta.code==='01007')){const legal=probe(a=>R.abilitySpec(s,p.id,c.uid,a));if(legal)out.push({kind:'ability',player:p.id,uid:c.uid,name:c.meta.nameZh||c.meta.name,uncertain:legal==='uncertain'});}
   for(const c of p.hand){const m=R.data(s,{...c,owner:p.id});if(m?.type!=='event'||R.eventTiming(c.code)?.kind!=='action')continue;const legal=probe(a=>R.playSpec(s,p.id,c.uid,a));if(legal)out.push({kind:'play',player:p.id,uid:c.uid,name:m.nameZh||m.name,uncertain:legal==='uncertain'});}
  }
  for(const o of s.objectives.filter(o=>!o.holder&&!o.guard)){for(const p of live(s))if(R.chars(s).some(c=>c.kind==='hero'&&c.controller===p.id&&R.restrictedOn(s,c.uid).length<2))out.push({kind:'objective',player:p.id,uid:o.uid,name:'领取'+o.name});}
  return out.map(o=>({...o,key:key(s,o.kind,o.player,o.uid),muted:(s.windowPrefs?.muted||[]).includes(key(s,o.kind,o.player,o.uid))}));
 }
 function mute(s,kind,pid,uid){check(s);const o=options(s).find(o=>o.kind===kind&&o.player===pid&&String(o.uid)===String(uid));need(o,'当前没有此合法行动');s.windowPrefs??={mode:'smart'};s.windowPrefs.muted??=[];if(!s.windowPrefs.muted.includes(o.key))s.windowPrefs.muted.push(o.key);}
 function restore(s){s.windowPrefs??={mode:'smart'};s.windowPrefs.muted=[];}
 function blocked(s){const x=R.context(s);return !x||x.completed||x.closing||x.halted||s.pending.length||x.queue.length||x.tasks?.length||x.current||(s.phase===5&&x.proposal)||x.plannedActions?.length||x.actionLocked||x.actionError;}
 function eligible(s){return s&&s.status==='playing'&&[1,2,3,4,5,6].includes(s.phase)&&R.window(s).kind==='action'&&!blocked(s)&&(s.phase!==1||R.active(s)===null);}
 function step(s){const x=R.context(s);for(const p of live(s))if(!x.finalPasses.includes(p.id))R.passAction(s,p.id);
  if(s.phase===1)R.finish(s);else if(s.phase===2)Q.move(s);else if(s.phase===3)E.traveling.finish(s);else if(s.phase===4){if(x.step==='beforeChecks')E.encountering.beginChecks(s);else E.encountering.finish(s);}else if(s.phase===5)E.combat.move(s);else E.refreshing.finish(s);
 }
 function next(s){check(s);need(eligible(s),'请先处理当前选择、响应或暂定方案');step(s);}
 function run(s){if(!s||settings(s).mode!=='smart')return;let n=0;while(eligible(s)&&n++<80){if(options(s).some(o=>!o.muted))break;const before=`${s.round}:${s.phase}:${R.context(s).step}:${R.context(s).completed}`;step(s);s.log.unshift(`回合${s.round} · 快速窗口 · 已自动让过普通行动（${E.phases[s.phase]}）`);if(before===`${s.round}:${s.phase}:${R.context(s).step}:${R.context(s).completed}`)break;}
  // No phase entry, forced target choice, optional response, reveal or shadow is skipped here.
 }
 return {settings,key,probe,options,setMode,mute,restore,eligible,next,run};
};
if(typeof module!=='undefined')module.exports=WindowRulesFactory;
