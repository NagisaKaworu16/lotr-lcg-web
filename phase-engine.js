/* 阶段完成判定：只读、不写状态、不抛异常，供 UI 与「结束阶段」共用同一套口径。
   7 个阶段各有一个必需操作清单；全部打勾 = 本阶段无剩余必需操作，
   玩家点「结束阶段」后由引擎结清阶段收尾（关闭行动窗口 → 结算结束效果 → 进入下一阶段）。

   刻意不做的事：
   - 不代替玩家决定「要不要继续打牌」。行动窗口是开放的、可选的，所以它标记的
     optional，不参与完成判定（否则玩家永远打不完一张牌）。
   - 不在有强制选择（queue/tasks/pending）或待结算遭遇牌时判定完成：
     这些必须逐项处理，属于「未完成」而不是「已完成」。 */
const PhaseRulesFactory=(E)=>{
 const R=E.planning;
 const live=s=>s.players.filter(p=>!p.eliminated);
 const ctx=s=>{switch(s.phase){
  case 0:return s.resource;
  case 1:return s.planning;
  case 2:return s.questing;
  case 3:return s.traveling;
  case 4:return s.encountering;
  case 5:return s.combat;
  case 6:return s.refreshing;
  default:return null;
 }};
 /* 每个阶段「必需操作」模板：done/wait 是给玩家看的两种措辞，
    check 是判定函数（返回 true 表示该项已完成）。 */
 function checks(s){
  const c=ctx(s);
  if(!s||s.status!=='playing')return [];
  const ch=[];
  const add=(key,label,done,ok,check)=>ch.push({key,label,done,ok,check});
  if(s.setupPending){add('setup','确认起始手牌',false,'未确认',()=>false);return ch;}
  if(s.setupReveal&&!s.setupReveal.finished){add('setupReveal','完成开局翻牌',false,'剩余 '+s.setupReveal.remaining+' 张',()=>false);return ch;}
  if(s.phase===0){
   add('resource','收集资源并抽牌',!!s.resourceDoneRound&&s.resourceDoneRound===s.round,'待收集',()=>s.resourceDoneRound===s.round);
  }
  if(s.phase===1&&c){
   for(const p of live(s)){
    const played=c.order.indexOf(p.id)<c.index;
    add('plan:'+p.id,p.name+' 结束出牌',played,'待结束',()=>c.order.indexOf(p.id)<c.index);
   }
   for(const p of live(s))add('pass:'+p.id,p.name+' 放弃剩余行动',(c.finalPasses||[]).includes(p.id),'待确认',()=>(c.finalPasses||[]).includes(p.id));
  }
  if(s.phase===2&&c){
   const order=c.order||[];
   if(c.step==='commit'&&!c.deploymentLocked){
    for(const id of order)add('deploy:'+id,(s.players[id]?.name||('玩家'+(id+1)))+' 提交派遣名单',!!c.deployments?.[id]?.confirmed,'待提交',()=>!!c.deployments?.[id]?.confirmed);
    for(const id of order)add('dconfirm:'+id,(s.players[id]?.name||('玩家'+(id+1)))+' 二次确认派遣',(c.deploymentApprovals||[]).includes(id),'待确认',()=>(c.deploymentApprovals||[]).includes(id));
   }
   if(c.step==='commit')add('commit','按起始玩家顺序投入角色',c.commitIndex>=order.length,'待投入',()=>c.commitIndex>=order.length);
   add('reveal','完成逐张探查',!c.current&&!(c.remaining||[]).length,'剩余 '+((c.remaining||[]).length+(c.current?1:0))+' 张',()=>!c.current&&!(c.remaining||[]).length);
   add('result','结算探险结果',c.step==='afterResult',c.step==='afterStaging'?'待结算':'未开始',()=>c.step==='afterResult');
   add('pass','全队放弃本窗口行动',live(s).every(p=>(c.finalPasses||[]).includes(p.id)),'待确认',()=>live(s).every(p=>(c.finalPasses||[]).includes(p.id)));
  }
  if(s.phase===3&&c){
   add('choice','完成旅行选择',c.step!=='choice','待选择',()=>c.step!=='choice');
   add('travel','支付费用并抵达地点',!!c.traveled||(c.step==='action'),'未抵达',()=>!!c.traveled||c.step==='action');
   add('pass','全队放弃旅行后行动',(c.step==='action')&&live(s).every(p=>(c.finalPasses||[]).includes(p.id)),'待确认',()=>(c.step==='action')&&live(s).every(p=>(c.finalPasses||[]).includes(p.id)));
  }
  if(s.phase===4&&c){
   add('optional','提交主动交战方案',(c.approvals||[]).length>=live(s).length||c.step!=='optional','待提交',()=>(c.approvals||[]).length>=live(s).length||c.step!=='optional');
   add('checks','完成交战检定',!!s.checkedRound&&s.checkedRound===s.round||!['beforeChecks','checks'].includes(c.step),'待检定',()=>s.checkedRound===s.round||!['beforeChecks','checks'].includes(c.step));
   add('pass','全队放弃检定后行动',c.step!=='afterChecks'||live(s).every(p=>(c.finalPasses||[]).includes(p.id)),'待确认',()=>c.step!=='afterChecks'||live(s).every(p=>(c.finalPasses||[]).includes(p.id)));
  }
  if(s.phase===5&&c){
   add('enemies','结算所有敌人攻击',(c.enemyIndex||0)>=live(s).length&&c.step!=='enemyChoice','待结算',()=>(c.enemyIndex||0)>=live(s).length&&c.step!=='enemyChoice');
   add('attacks','完成玩家攻击步骤',['endAction','ending'].includes(c.step),'待攻击',()=>['endAction','ending'].includes(c.step));
   add('pass','全队放弃攻击后行动',!['playerAction','afterPlayer'].includes(c.step)||live(s).every(p=>(c.finalPasses||[]).includes(p.id)),'待确认',()=>!['playerAction','afterPlayer'].includes(c.step)||live(s).every(p=>(c.finalPasses||[]).includes(p.id)));
  }
  if(s.phase===6&&c){
   add('ready','提交蛛网支付方案',(c.approvals||[]).length>=live(s).length||c.step!=='ready','待确认',()=>(c.approvals||[]).length>=live(s).length||c.step!=='ready');
   add('effects','结算回合结束效果',c.step==='roundEnd'||c.step==='completed','待结算',()=>c.step==='roundEnd'||c.step==='completed');
   add('pass','全队放弃刷新后行动',c.step!=='action'||live(s).every(p=>(c.finalPasses||[]).includes(p.id)),'待确认',()=>c.step!=='action'||live(s).every(p=>(c.finalPasses||[]).includes(p.id)));
  }
  return ch;
 }
 /* completed(s)：无剩余必需操作。
    额外护栏：有待结算事项 / 响应队列 / 旅行与探险的当前翻牌时一律不算完成，
    即使某项 check 因数据缺失而误判 true 也不会跳过一个需要玩家决定的效果。 */
 function completed(s){
  if(!s||s.status!=='playing'||s.setupPending)return false;
  if(s.setupReveal&&!s.setupReveal.finished)return false;
  if((s.pending||[]).length)return false;
  const c=ctx(s);
  if(c&&((c.queue||[]).length||(c.tasks||[]).length||c.current))return false;
  if(s.phase===2&&s.questing&&!s.questing.deploymentLocked&&s.questing.step==='commit')return false;
  return checks(s).every(x=>x.check());
 }
 /* 下一步要做什么：给「结束阶段」按钮的状态行与提示条共用同一句人话。 */
 function blocker(s){
  if(!s||s.status!=='playing')return '对局已结束';
  if((s.pending||[]).length)return '先处理剧本待结算 '+s.pending.length+' 项';
  if(s.setupPending)return '先确认起始手牌';
  if(s.setupReveal&&!s.setupReveal.finished)return '先完成开局翻牌';
  const c=ctx(s),q=c&&(c.queue||[]).length,t=c&&(c.tasks||[]).length;
  if(q)return '先处理卡牌响应（'+q+' 项）';
  if(t)return '先完成强制选择（'+t+' 项）';
  if(s.phase===2&&s.questing){
   const x=s.questing;
   if(x.current)return '逐张探查未完成：还有牌未结算';
   if(x.step==='afterStaging')return '点「结束阶段」结算意志与威胁';
  }
  const rest=checks(s).filter(x=>!x.check());
  return rest.length?rest[0].label+'（'+rest.length+' 项待办）':'本阶段必需操作已全部完成';
 }
 return {checks,completed,blocker,ctx};
};
if(typeof module!=='undefined')module.exports=PhaseRulesFactory;
