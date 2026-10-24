const WindowUI=(()=>{
 const E=ScenarioEngine,W=E.windows,R=E.planning,esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const b=(label,k,args='',disabled=false)=>`<button data-action="windowFlow" data-window="${k}" ${args} ${disabled?'disabled':''}>${esc(label)}</button>`;
 /* v0.15.48：原来这个面板无论有没有可做的行动都印一整块（标题+长说明+空列表），
    和右侧阶段竖轴表达同一件事，玩家问「这个窗口为什么还在」。
    现在只在智能模式且 action 窗口真的有可选项时才渲染紧凑面板；
    空壳删除，模式切换缩成操作条标题行的一枚小按钮（desktop-ui.js 的 modeChip）。 */
 function panel(s){if(!s)return '';if(W.settings(s).mode!=='smart')return '';
  if(!(R.window(s).kind==='action'&&(s.phase!==1||R.active(s)===null)))return '';
  const opts=W.options(s);if(!opts.length)return '';
  const eligible=W.eligible(s);
  return `<section class="panel window-panel compact"><div class="panel-title"><h2>行动窗口 · 智能推进</h2>${b('切换为详细模式','mode','data-mode="detailed"')}</div>${opts.map(o=>`<div class="window-option"><span>${esc(s.players[o.player].name)} · ${esc(o.name)}${o.muted?'（本阶段不再提醒）':''}</span> ${o.kind==='objective'?`<button data-action="claim" data-uid="${o.uid}" ${eligible?'':'disabled'}>领取目标</button>`:`<button data-action="planning" data-plan="${o.kind}" data-player="${o.player}" data-uid="${o.uid}" ${eligible?'':'disabled'}>选择${o.kind==='play'?'事件':'能力'}</button>`} ${b('本阶段不再提醒','mute',`data-kind="${o.kind}" data-player="${o.player}" data-uid="${o.uid}"`,o.muted||!eligible)}</div>`).join('')}<div class="actions">${b('全队继续到下一决策点','next','',!eligible)}${b('恢复本阶段能力提醒','restore','',!(s.windowPrefs?.muted||[]).length)}</div></section>`;
 }
 /* v0.15.51：modeChip 删除——玩家不需要在标题行看到「行动窗口 · 智能推进」，
    模式切换仅在面板真实出现时提供。 */
 function handle(el){const k=el.dataset.window;mutate(()=>{if(k==='mode')W.setMode(state,el.dataset.mode);if(k==='mute')W.mute(state,el.dataset.kind,+el.dataset.player,+el.dataset.uid);if(k==='restore')W.restore(state);if(k==='next')W.next(state);});}
 return {panel,handle};
})();
