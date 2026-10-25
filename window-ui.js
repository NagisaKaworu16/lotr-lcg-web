const WindowUI=(()=>{
 const E=ScenarioEngine,W=E.windows,R=E.planning,esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const b=(label,k,args='',disabled=false)=>`<button data-action="windowFlow" data-window="${k}" ${args} ${disabled?'disabled':''}>${esc(label)}</button>`;
 /* v0.15.48：这个面板不再印「标题+长说明+空列表」的空壳，只在智能模式下出现。 */
 /* v0.15.56：智能模式下没有「值得提醒」的行动时，原来整块面板都消失，
    连带把「全队继续到下一决策点」也藏了起来——玩家在第五阶段战斗里
    全队都放弃行动后就再没有可点的推进按钮，只能眼睁睁看着结束阶段报「还差 N 项」。
    现在只要窗口可推进就保留那颗按钮，无选项时只渲染按钮行。 */
 function panel(s){if(!s)return '';if(W.settings(s).mode!=='smart')return '';
  if(!(R.window(s).kind==='action'&&(s.phase!==1||R.active(s)===null)))return '';
  const opts=W.options(s),eligible=W.eligible(s);
  if(!opts.length&&!eligible)return '';
  const rows=opts.length?opts.map(o=>`<div class="window-option"><span>${esc(s.players[o.player].name)} · ${esc(o.name)}${o.muted?'（本阶段不再提醒）':''}</span> ${o.kind==='objective'?`<button data-action="claim" data-uid="${o.uid}" ${eligible?'':'disabled'}>领取目标</button>`:`<button data-action="planning" data-plan="${o.kind}" data-player="${o.player}" data-uid="${o.uid}" ${eligible?'':'disabled'}>选择${o.kind==='play'?'事件':'能力'}</button>`} ${b('本阶段不再提醒','mute',`data-kind="${o.kind}" data-player="${o.player}" data-uid="${o.uid}"`,o.muted||!eligible)}</div>`).join('')
   :'<p class="small muted">本窗口没有需要提醒的行动，可以让过继续。</p>';
  return `<section class="panel window-panel compact"><div class="panel-title"><h2>行动窗口 · 智能推进</h2>${b('切换为详细模式','mode','data-mode="detailed"')}</div>${rows}<div class="actions">${b('全队继续到下一决策点','next','',!eligible)}${b('恢复本阶段能力提醒','restore','',!(s.windowPrefs?.muted||[]).length)}</div></section>`;
 }
 function handle(el){const k=el.dataset.window;mutate(()=>{if(k==='mode')W.setMode(state,el.dataset.mode);if(k==='mute')W.mute(state,el.dataset.kind,+el.dataset.player,+el.dataset.uid);if(k==='restore')W.restore(state);if(k==='next')W.next(state);});}
 return {panel,handle};
})();
