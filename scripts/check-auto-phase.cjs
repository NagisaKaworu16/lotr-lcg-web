/* 自动推进回归：从建局一路点到第 7 阶段，验证「结束阶段」不会卡死。
   引擎不替玩家做的三件事（投入名单、旅行地点、遭遇翻牌）由脚本代按，
   其余必须靠引擎自己走完；同一状态连续出现 12 次视为卡死。 */
const {chromium}=require('playwright-core'),path=require('path'),ROOT=path.join(__dirname,'..');
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const p=await (await b.newContext({viewport:{width:1440,height:960}})).newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file:///'+path.join(ROOT,'index.html'));await p.waitForTimeout(400);
 /* 页面侧点击包装：记录最后一次点到的按钮，卡死时能知道脚本到底点了什么 */
 const clk=el=>{if(el){const d=el.dataset||{};window.__lastHit=(d.combat||d.window||d.quest||d.encounter||d.refresh||d.travel||d.action||'?')+'|p='+(d.player??'')+'|u='+(d.uid??'')+'|'+(el.textContent||'').trim().slice(0,10);el.click();}return el;};
 await p.evaluate((src)=>{window.__lastHit='';window.clk=eval(src)},clk.toString());
 const P=sel=>p.evaluate(s=>{const e=document.querySelector(s);if(e)window.clk(e);return !!e},sel);
 await p.selectOption('#playerCount','2');
 await p.locator('.ng-tabs button',{hasText:'新版扩展'}).click();await p.waitForTimeout(250);
 await p.locator('.ng-card',{hasText:'基础剧本合集'}).first().click();await p.waitForTimeout(300);
 await p.locator('[data-action="ngNext"]').click();await p.waitForTimeout(300);
 await p.locator('[data-action="chooserConfirm"]').click();await p.waitForTimeout(700);
 for(let i=0;i<8;i++){const n=await p.evaluate(()=>{const b=document.querySelector('button[data-action="keepHand"]:not([disabled])');if(b){window.clk(b);return 1}return 0});if(!n)break;await p.waitForTimeout(160);}
 await p.locator('button[data-action="finishSetup"]').click();await p.waitForTimeout(700);

 await p.evaluate(()=>{const t=window.toast;window.toast=m=>{window.__lastToast=String(m);return t&&t(m)}});
 const ev=async fn=>{const r=await p.evaluate(fn);await p.waitForTimeout(260);return r};
 /* 弹窗：下拉取首项；有勾选清单时勾第一个（空清单也允许确认，表示无人防御）；
    然后点 #ok，没有就点文字为确认的按钮。 */
 const okDialog=()=>ev(()=>{
  const d=[...document.querySelectorAll('dialog')].filter(x=>x.open).pop();if(!d)return false;
  d.querySelectorAll('select').forEach(s=>{if(s.options.length)s.selectedIndex=0});
  /* 角色勾选清单按上下文处理：防御/攻击至少点 1 名角色，否则 validate 会拒绝；
     其它勾选（如同类选择）保持默认，避免误改脚本意图。 */
  const boxes=[...d.querySelectorAll('input[type="checkbox"][data-combat-select]')];
  if(boxes.length)boxes[0].checked=true;
  const c=d.querySelector('#ok')||[...d.querySelectorAll('button')].find(x=>/^(确认|确定|结算)/.test(x.textContent.trim()));
  if(!c)return false;clk(c);d.close?.();return true;});
 /* choose() 是 async：点完确认要等 Promise resolve、弹窗真正移除，
    否则紧接着的下一步会在弹窗还在时点空，堆出多个 dialog。 */
 const closeDialogs=async()=>{for(let i=0;i<4;i++){
   const open=await p.evaluate(()=>[...document.querySelectorAll('dialog')].filter(x=>x.open).length);
   if(!open)return i;
   await okDialog();await p.waitForTimeout(120);}
  return -1;};
 /* 每次只做一件「必须玩家做的事」；都做不了才按结束阶段。 */
 const act=()=>ev(()=>{
  const q=s=>document.querySelector(s);
  /* 记录最后一次点击的按钮标识，卡死时能知道脚本到底点了什么 */
  const clk=el=>{if(el){const d=el.dataset||{};window.__lastHit=(d.combat||d.window||d.quest||d.encounter||d.refresh||d.travel||d.action||'?')+'|p='+(d.player??'')+'|u='+(d.uid??'')+'|'+(el.textContent||'').trim().slice(0,10);el.click();}return el;};

  /* 敌人攻击按玩家轮转：只点当前行动玩家（activeEnemyPlayer）的按钮 */
  const enemyBtns=()=>{if(state.phase!==5||!state.combat)return null;
   const pid=ScenarioEngine.combat.activeEnemyPlayer(state);
   return [...document.querySelectorAll('button[data-combat="enemy"]')].find(x=>!x.disabled&&+x.dataset.player===pid);};
  let b=[...document.querySelectorAll('button')].find(x=>!x.disabled&&x.offsetParent&&/^(选择并结算|处理强制选择|处理卡牌响应)$/.test(x.textContent.trim()));
  if(b){clk(b);return 'spec'}
  b=q('button[data-quest="commit"]');if(b&&!b.disabled){clk(b);return 'commit'}
  b=[...document.querySelectorAll('button[data-quest="approveDeployment"]')].find(x=>!x.disabled);
  if(b){clk(b);return 'approveDeployment'}
  b=[...document.querySelectorAll('button[data-quest="approveActions"]')].find(x=>!x.disabled);
  if(b){clk(b);return 'approveActions'}
  b=q('button[data-encounter="approveAll"]');if(b&&!b.disabled){clk(b);return 'encApproveAll'}
  /* 阶段4 第一步：只要还有人没暂定方案，就替他点「暂定不主动交战」 */
  const skips=[...document.querySelectorAll('button[data-encounter="skip"]')].filter(x=>!x.disabled);
  if(skips.length){const done=new Set(Object.keys(state.encountering?.choices||{}));const hit=skips.find(x=>!done.has(String(x.dataset.player)));if(hit){clk(hit);return 'encSkip:'+hit.dataset.player}return 'encSkipNone'}
  /* 交战检定遇到同值敌人：由起始玩家挑一个，引擎才能继续 */
  b=[...document.querySelectorAll('button[data-encounter="tie"]')].find(x=>!x.disabled);
  if(b){clk(b);return 'encTie'}
  b=q('button[data-encounter="checks"]');if(b&&!b.disabled){clk(b);return 'encChecks'}
  b=q('button[data-encounter="finish"]');if(b&&!b.disabled){clk(b);return 'encFinish'}
  b=q('button[data-encounter="pass"]');if(b&&!b.disabled){clk(b);return 'encPass'}
  /* 行动窗口：先把列出的可选行动「本阶段不再提醒」让过，再点「全队继续」，
     这两颗都排在放弃行动之前——全员已让过时 pass 不可点，排前面会空转。 */
  b=[...document.querySelectorAll('button[data-window="mute"]')].find(x=>!x.disabled);
  if(b){clk(b);return 'winMute'}
  b=q('button[data-window="next"]');
  if(b&&!b.disabled){clk(b);return 'winNext'}
  /* 阶段5：敌人攻击 / 防御 / 玩家攻击都按「暂定 → 全员二次确认 → 推进」三步走。
     propose 会清空 approvals，所以已经有提案时绝不能再点暂定类按钮，
     否则脚本会自己把刚攒的确认数清零，永远推不动。 */
  {const cb=state.combat||{};
   if(cb.proposal){
    const done=new Set((cb.approvals||[]).map(String));
    const ap=[...document.querySelectorAll('button[data-combat="approve"]')].find(x=>!x.disabled&&!done.has(String(x.dataset.player)));
    if(ap){clk(ap);return 'cbApprove'}
    return 'cbAwaitApproval';}
   const e=enemyBtns();if(e){clk(e);return 'cbEnemy'}
   /* 当前行动玩家没有可选敌人（都打完了）而引擎还没换人：由脚本催一次推进 */
   if(state.phase===5&&cb.step==='enemyChoice'){
    const pid=ScenarioEngine.combat.activeEnemyPlayer(state);
    if(!ScenarioEngine.combat.pendingEnemies(state,pid).length){ScenarioEngine.combat.resume(state);return 'cbResume'}
   }}
  b=[...document.querySelectorAll('button[data-combat="defense"]')].find(x=>!x.disabled);if(b){clk(b);return 'cbDefense'}
  /* 防御响应窗口：优先直接关闭；若关闭后又被弹回同一窗口（说明还有必须处理的响应），
     改点窗口里的第一个响应，让引擎把这一轮吐完。 */
  {const rs=[...document.querySelectorAll('button[data-combat="respond"]')].filter(x=>!x.disabled);
   const skip=rs.find(x=>x.dataset.value==='skip'),other=rs.find(x=>x.dataset.value!=='skip');
   window.__respondOnce=!window.__respondOnce;
   const b=(window.__respondOnce&&other)?other:skip;
   if(b){clk(b);return 'cbRespond'}}
  /* 暗影窗口：有取消手段才取消，否则直接结算本张暗影 */
  b=q('button[data-combat="resolveShadow"]');if(b&&!b.disabled){clk(b);return 'cbShadow'}
  /* 玩家攻击声明：脚本不打人，替当前玩家「暂定结束我的攻击」，再由全员二次确认交给下一位 */
  b=[...document.querySelectorAll('button[data-combat="endAttacks"]')].find(x=>!x.disabled);
  if(b){clk(b);return 'cbEndAttacks'}
  /* 战斗阶段的行动窗口：全队放弃行动后才能推进 */
  b=[...document.querySelectorAll('button[data-combat="pass"]')].find(x=>!x.disabled);
  if(b){clk(b);return 'cbPass'}
  b=q('button[data-combat="move"]');if(b&&!b.disabled){clk(b);return 'cbMove'}
  b=q('button[data-refresh="move"]');if(b&&!b.disabled){clk(b);return 'rfMove'}
  b=q('button[data-refresh="approve"]');if(b&&!b.disabled){clk(b);return 'rfApprove'}
  b=q('button[data-travel="approve"]');if(b&&!b.disabled){clk(b);return 'travelApprove'}
  b=q('button[data-travel="skip"]')||q('button[data-travel="propose"]:not([disabled])');
  if(b&&!b.disabled){clk(b);return 'travel'}
  b=q('button[data-quest="draw"]');if(b&&!b.disabled){clk(b);return 'draw'}
  b=q('button[data-quest="reveal"]');if(b&&!b.disabled){clk(b);return 'reveal'}
  /* 智能推进：没有值得提醒的行动时，用行动窗口的「全队继续到下一决策点」让引擎自己走 */
  b=q('.phase-door .door-go');if(b&&!b.disabled){clk(b);return 'door'}
  return 'none';
 });
 /* 第五阶段的推进发生在战斗状态机内部（防御选择→响应→暗影→伤害……），
    阶段号、任务步骤、阶段门文案都不变，只看这几项会把正常推进误判成卡死。
    把战斗步骤与交战计数一起纳入签名。 */
 const snap=()=>p.evaluate(()=>({phase:state.phase,round:state.round,status:state.status,
  step:state.questing?.step||null,tstep:state.traveling?.step||null,
  cstep:state.combat?state.combat.step+':'+state.combat.enemyIndex+':'+state.combat.playerIndex+':'+(state.combat.doneEnemies||[]).length+':'+(state.combat.doneAttacks||[]).length+':'+(state.combat.proposal?state.combat.proposal.kind+state.combat.proposal.player+(state.combat.approvals||[]).length:'-'):null,
  door:document.querySelector('.phase-door .door-state')?.textContent.trim()||''}));
 const phases=new Set();let stuck=null,done=false,last='',same=0;
 for(let i=0;i<1600;i++){
  const st=await snap();
  phases.add(st.round+':'+st.phase);
  if(st.status!=='playing'||(st.round>=2&&st.phase===0)){done=true;break;}
  const key=JSON.stringify([st.round,st.phase,st.step,st.tstep,st.cstep,st.door]);
  if(key===last){
   if(++same>=12){
    stuck=await p.evaluate(()=>{const x=state.encountering;return {phase:state.phase,round:state.round,step:state.questing?.step||null,
     enc:x?{step:x.step,choices:x.choices,appr:x.approvals,passes:x.finalPasses,tasks:x.tasks.map(t=>t.kind)}:null,
     btns:[...document.querySelectorAll('.mat-phase button,.phase-door button')].map(x=>x.textContent.trim()+(x.disabled?'#':'')),
     recent:window.__acts?window.__acts.slice(-6):[],
     lastHit:window.__lastHit||null,
     dialog:(()=>{const d=[...document.querySelectorAll('dialog')].filter(x=>x.open);return d.map(x=>(x.innerText||'').replace(/\s+/g,' ').slice(0,60))})(),
     combat:(()=>{const c=state.combat;if(!c)return null;return {step:c.step,ei:c.enemyIndex,pi:c.playerIndex,
      prop:c.proposal&&{k:c.proposal.kind,p:c.proposal.player,u:c.proposal.uid,ids:c.proposal.ids},appr:c.approvals,
      doneEnemies:c.doneEnemies,doneAttacks:c.doneAttacks,
      pend:(()=>{try{return ScenarioEngine.combat.pendingEnemies(state,ScenarioEngine.combat.activeEnemyPlayer(state)).map(e=>e.name)}catch(e){return 'ERR'}})()};})(),
     reason:'状态连续 12 次无变化'};});
    break;
   }
  }else{last=key;same=0;}
  /* 点不动的按钮往往是被更高层的元素盖住了：把点击位置上的真实元素带出来。 */
  if(stuck&&stuck.combat&&process.env.HIT){
   const hit=await p.evaluate(()=>{const bs=[...document.querySelectorAll('.mat-phase button')].filter(x=>!x.disabled);
    return bs.map(x=>{const r=x.getBoundingClientRect();const top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
     return {t:x.textContent.trim().slice(0,12),cx:Math.round(r.left+r.width/2),cy:Math.round(r.top+r.height/2),
      top:top?(top.tagName+'.'+(top.className||'').toString().slice(0,30)):'null',inView:r.top>=0&&r.bottom<=innerHeight};});});
   console.log('HIT',JSON.stringify(hit));
  }
  /* 每轮先清掉残留弹窗：choose() 是异步的，上一轮点过 #ok 之后
     弹窗可能还没从 DOM 移除，挡住这一轮的点击就会空转。 */
  {const open=await p.evaluate(()=>[...document.querySelectorAll('dialog')].filter(x=>x.open).length);
   if(open)await closeDialogs();}
  let a;try{a=await act()}catch(e){console.log('act 抛错：',e.message);a='none';}
  await p.evaluate(x=>{window.__acts=[...(window.__acts||[]),x].slice(-8)},a);
  if(process.env.TRACE){const t=await p.evaluate(()=>{const c=state.combat;return {s:c?.step,p:c?.proposal&&c.proposal.kind,
    dia:[...document.querySelectorAll('dialog')].filter(x=>x.open).length,
    ap:state.combat?.approvals,pl:state.combat?.plannedActions?.length,dl:state.combat?.doneEnemies,
    da:state.combat?.doneAttacks,fp:state.combat?.finalPasses,ei:state.combat?.enemyIndex,pi:state.combat?.playerIndex};});
   console.log('['+i+']',st.phase,'|',a,'|',JSON.stringify(t));}
  if(a==='commit'){
   await ev(()=>{document.querySelector('.player-mat .own-characters .character-card.selectable .card-face')?.click()});
   await ev(()=>document.querySelector('button[data-quest="commit"]')?.click());
   await p.waitForTimeout(140);await closeDialogs();
  }
  if(a==='spec'||a==='travel'||a==='cbDefense'||a==='cbAttack')await closeDialogs();
  if(a==='none'){
   stuck=await p.evaluate(()=>({enc:(()=>{const x=state.encountering;return x?{step:x.step,choices:x.choices,appr:x.approvals,passes:x.finalPasses,tasks:x.tasks.map(t=>t.kind)}:null})(),btns:[...document.querySelectorAll('.mat-phase button,.phase-door button')].map(x=>x.textContent.trim()+(x.disabled?'#':'')),...{phase:state.phase,round:state.round,step:state.questing?.step||null,tstep:state.traveling?.step||null},
    reason:'没有任何可点的必做动作',
    door:document.querySelector('.phase-door')?.innerText,
    blocker:(()=>{try{return ScenarioEngine.phaseRules.blocker(state)}catch(e){return 'ERR '+e.message}})()}));
   break;
  }
 }
 const end=await p.evaluate(()=>({round:state.round,phase:state.phase,status:state.status}));
 console.log('reach:',[...phases].sort().join(' '));
 console.log('end:',JSON.stringify(end));
 console.log('stuck:',JSON.stringify(stuck),'done:',done);
 console.log('errors:',JSON.stringify(errs.slice(0,3)));
 const pass=!stuck&&!errs.length&&done;
 console.log(pass?'PASS':'FAIL');
 await b.close();process.exit(pass?0:1);
})().catch(e=>{console.error('FAILED',e.message);process.exit(2)});
