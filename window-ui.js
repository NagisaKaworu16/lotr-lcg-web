const WindowUI=(()=>{
 const E=ScenarioEngine,W=E.windows,R=E.planning,esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const b=(label,k,args='',disabled=false)=>`<button data-action="windowFlow" data-window="${k}" ${args} ${disabled?'disabled':''}>${esc(label)}</button>`;
 function panel(s){if(!s)return '';const smart=W.settings(s).mode==='smart',opts=smart?W.options(s):[],eligible=W.eligible(s);let body='';
  if(smart&&R.window(s).kind==='action'&&(s.phase!==1||R.active(s)===null)){body=`<p>当前全队可用普通行动 ${opts.length} 项。选择后仍需确认方案；继续表示全队让过当前窗口。</p>${opts.map(o=>`<div class="window-option"><span>${esc(s.players[o.player].name)} · ${esc(o.name)}${o.muted?'（本阶段不再提醒）':''}</span> ${o.kind==='objective'?`<button data-action="claim" data-uid="${o.uid}" ${eligible?'':'disabled'}>领取目标</button>`:`<button data-action="planning" data-plan="${o.kind}" data-player="${o.player}" data-uid="${o.uid}" ${eligible?'':'disabled'}>选择${o.kind==='play'?'事件':'能力'}</button>`} ${b('本阶段不再提醒','mute',`data-kind="${o.kind}" data-player="${o.player}" data-uid="${o.uid}"`,o.muted||!eligible)}</div>`).join('')}<div class="actions">${b('全队继续到下一决策点','next','',!eligible)}${b('恢复本阶段能力提醒','restore','',!(s.windowPrefs?.muted||[]).length)}</div>`;}
  return `<section class="panel window-panel"><div class="panel-title"><h2>行动窗口 · ${smart?'智能推进':'详细模式'}</h2><div class="actions">${b(smart?'切换为详细模式':'启用智能推进','mode',`data-mode="${smart?'detailed':'smart'}"`)}</div></div><p class="small muted">空行动窗口自动让过；普通行动可以暂时不再提醒。即时响应、强制选择、翻牌与攻防方案仍独立处理。可随时切换详细模式。</p>${body}</section>`;
 }
 function handle(el){const k=el.dataset.window;mutate(()=>{if(k==='mode')W.setMode(state,el.dataset.mode);if(k==='mute')W.mute(state,el.dataset.kind,+el.dataset.player,+el.dataset.uid);if(k==='restore')W.restore(state);if(k==='next')W.next(state);});}
 return {panel,handle};
})();
