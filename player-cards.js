/* RingsDB adapter and deck rules. Card text is data, never executable game logic. */
const PlayerCards=(()=>{
const STARTERS=typeof STARTER_DECKS!=='undefined'?STARTER_DECKS:require('./starter-decks.js');
const TYPES=new Set(['hero','ally','attachment','event']);
const SPHERES={leadership:'领导',tactics:'战术',spirit:'精神',lore:'知识',neutral:'中立',baggins:'巴金斯',fellowship:'护戒同盟'};
const NAMES={
'01001':'阿拉贡','01002':'希奥德雷德','01003':'葛罗因','01004':'金雳','01005':'莱戈拉斯','01006':'沙林','01007':'伊欧玟','01008':'埃莉诺','01009':'杜内希尔','01010':'丹内梭尔','01011':'葛罗芬戴尔','01012':'贝拉沃',
'01013':'城堡卫兵','01014':'法拉米尔','01015':'阿尔诺之子','01016':'雪鬃河侦察兵','01017':'银脉河弓手','01018':'长须兽人杀手','01019':'布洛克铁拳','01020':'时刻警惕','01021':'共同事业','01022':'为了刚铎','01023':'偷袭','01024':'英勇牺牲','01025':'坚定决心','01026':'刚铎宰相','01027':'凯勒布莉安之石','01028':'老练斧手','01029':'刚铎长矛兵','01030':'骑马弓手','01031':'比翁','01032':'剑术精通','01033':'箭雨','01034':'佯攻','01035':'迅捷打击','01036':'长矛之林','01037':'快速反击','01038':'并肩作战','01039':'刚多林之刃','01040':'城堡板甲','01041':'矮人战斧','01042':'刚铎号角','01043':'流浪的图克','01044':'洛瑞恩向导','01045':'北方追踪者','01046':'加拉兹民的问候','01047':'意志之力','01048':'仓促一击','01049':'西方意志','01050':'意志考验','01051':'挺身战斗','01052':'黑暗中的光','01053':'矮人墓穴','01054':'命运与机遇','01055':'夫人的恩惠','01056':'大地之力','01057':'意外的勇气','01058':'宁洛德尔之女','01059':'埃瑞博铁匠','01060':'汉纳玛斯河歌','01061':'铁丘陵矿工','01062':'格雷温','01063':'伊姆拉缀斯的医术','01064':'洛瑞恩的财富','01065':'瑞达加斯特的计谋','01066':'秘密小径','01067':'甘道夫的搜寻','01068':'比翁的款待','01069':'森林陷阱','01070':'洛瑞恩守护者','01071':'黑暗知识','01072':'自我保全','01073':'甘道夫'};
function need(v,m){if(!v)throw Error(m);}
function plain(text){return String(text??'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/?(?:b|i|em|strong|cite|p)>/gi,'').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').trim();}
function number(v,field,required=false){if(v==null||v===''){need(!required,`${field}缺失`);return null;}if(typeof v==='string'&&/^\d+$/.test(v))v=Number(v);need(typeof v==='number'&&Number.isFinite(v)&&Number.isInteger(v)&&v>=0,`${field}不是有效非负数值`);return v;}
function normalizeCard(raw,pack='Core'){
 need(raw&&typeof raw==='object','卡牌不是有效对象');need(typeof raw.code==='string'&&/^[A-Za-z0-9_-]{3,30}$/.test(raw.code),'卡牌code必须保留字符串格式');need(TYPES.has(raw.type_code),'不支持的玩家牌类型');need(typeof raw.is_unique==='boolean','is_unique必须为布尔值');need(raw.has_errata===undefined||typeof raw.has_errata==='boolean','has_errata必须为布尔值');need(['leadership','tactics','spirit','lore','neutral'].includes(raw.sphere_code),'不支持的基础版领域');need(typeof raw.name==='string'&&raw.name.trim(),'缺少卡名');
 const prints=Array.isArray(raw.packs)?raw.packs:[];const print=prints.find(p=>p.pack_code===pack)||(raw.pack_code===pack?raw:null);need(print,`卡牌${raw.code}不属于${pack}`);
 let cost=null;if(raw.type_code!=='hero'){if(raw.cost==='X'||raw.cost==='-')cost=raw.cost;else cost=number(raw.cost,'cost',true);}
 const c={code:raw.code,name:raw.name,nameZh:NAMES[raw.code]||raw.name,type:raw.type_code,sphere:raw.sphere_code||'neutral',sphereName:SPHERES[raw.sphere_code]||raw.sphere_name||raw.sphere_code,cost,startingThreat:raw.type_code==='hero'?number(raw.threat,'threat',true):null,willpower:number(raw.willpower,'willpower'),attack:number(raw.attack,'attack'),defense:number(raw.defense,'defense'),health:number(raw.health,'health'),isUnique:raw.is_unique===true,deckLimit:number(raw.deck_limit,'deck_limit',true),quantity:number(print.quantity,'quantity',true),traits:plain(raw.traits),rulesText:plain(raw.text),hasErrata:raw.has_errata===true,packCode:pack,packName:print.pack_name||raw.pack_name,position:print.position??raw.position,printings:prints.map(p=>({packCode:p.pack_code,name:p.pack_name,quantity:p.quantity,position:p.position})),sourceUrl:`https://ringsdb.com/card/${encodeURIComponent(raw.code)}`,abilityStatus:'data-only',abilityVersion:null};
 if(c.type==='hero'){for(const f of ['willpower','attack','defense','health'])need(c[f]!==null,`英雄${raw.code}缺少${f}`);}return c;
}
function normalizePack(raw,meta={}){
 need(Array.isArray(raw),'API必须返回卡牌数组');const pack=meta.packCode||'Core';const candidates=raw.filter(c=>TYPES.has(c?.type_code));const cards=candidates.map(c=>normalizeCard(c,pack));need(cards.length>0,'API未返回任何可用玩家牌');need(new Set(cards.map(c=>c.code)).size===cards.length,'API含重复卡牌code');
 if(pack==='Core'){need(cards.length===73&&cards.filter(c=>c.type==='hero').length===12,'基础版API资料不完整，应为73种玩家牌和12名英雄；保留旧资料。');}
 return {schemaVersion:1,source:'RingsDB',endpoint:meta.endpoint||`https://ringsdb.com/api/public/cards/${pack}.json`,packCode:pack,fetchedAt:meta.fetchedAt||new Date().toISOString(),lastModified:meta.lastModified||null,cacheControl:meta.cacheControl||'max-age=600, public',cards};
}
function verify(snapshot){need(snapshot?.schemaVersion===1&&snapshot.source==='RingsDB'&&snapshot.packCode==='Core'&&Array.isArray(snapshot.cards),'不是支持的RingsDB基础版快照');need(snapshot.cards.length===73&&new Set(snapshot.cards.map(c=>c.code)).size===73,'快照牌张不完整');for(const c of snapshot.cards){need(typeof c.code==='string'&&/^01\d{3}$/.test(c.code)&&TYPES.has(c.type)&&c.packCode==='Core','快照卡牌格式无效');need(typeof c.name==='string'&&typeof c.nameZh==='string'&&typeof c.rulesText==='string'&&typeof c.traits==='string','快照文本字段无效');need(Number.isInteger(c.deckLimit)&&c.deckLimit>=1&&Number.isInteger(c.quantity)&&c.quantity>=1,'快照限制无效');if(c.type==='hero')for(const f of ['startingThreat','willpower','attack','defense','health'])number(c[f],f,true);else need(typeof c.cost==='number'&&c.cost>=0||c.cost==='X'||c.cost==='-','快照费用无效');}need(snapshot.cards.filter(c=>c.type==='hero').length===12,'英雄数量不完整');return snapshot;}
function index(snapshot){return Object.fromEntries(snapshot.cards.map(c=>[c.code,c]));}
function starter(snapshot,sphere){const d=STARTERS.decks.find(d=>d.sphere===sphere);need(d,'未知预组牌领域');const copy=JSON.parse(JSON.stringify(d)),by=index(snapshot);for(const code of [...copy.heroes,...Object.keys(copy.slots)])need(by[code],`预组牌缺少卡牌${code}`);return copy;}
function canonicalName(c){return c.name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();}
function validateDeck(deck,snapshot){
 const by=index(snapshot),errors=[],warnings=[];if(!deck||typeof deck!=='object')return {valid:false,errors:['不是有效牌组'],warnings,startingThreat:0,total:0,heroes:[]};
 let hs=Array.isArray(deck.heroes)?deck.heroes:[],slots=deck.slots;const heroes=[];
 if(hs.length<1||hs.length>3)errors.push('须选择1–3名英雄。');
 for(const code of hs){const c=by[code];if(!c||c.type!=='hero')errors.push(`无效英雄：${code}`);else heroes.push(c);}
 if(new Set(heroes.map(c=>canonicalName(c))).size!==heroes.length)errors.push('英雄不能重复。');
 let total=0,counts={};
 if(!slots||typeof slots!=='object'||Array.isArray(slots))errors.push('缺少有效的slots牌张清单。');else for(const [code,count] of Object.entries(slots)){
  const c=by[code];if(!Number.isInteger(count)||count<0||count>999){errors.push(`${code}的数量必须是非负整数。`);continue;}if(count===0)continue;if(!c){errors.push(`未接入卡牌：${code}`);continue;}if(c.type==='hero'){errors.push('英雄不能放入玩家抽牌牌库。');continue;}
  total+=count;counts[canonicalName(c)]=(counts[canonicalName(c)]||0)+count;if(counts[canonicalName(c)]>c.deckLimit)errors.push(`${c.nameZh}超过每副牌${c.deckLimit}张的限制。`);
  if(c.isUnique&&heroes.some(h=>h.isUnique&&canonicalName(h)===canonicalName(c)))warnings.push(`${c.nameZh}与所选独特英雄同名，不能同时在场。`);
 }
 const mode=deck.mode||'standard';if(mode==='standard'){if(total<50)errors.push(`标准牌组至少50张，目前${total}张（不含英雄）。`);}else if(mode==='starter'){
  const presets=['leadership','tactics','spirit','lore'].map(sp=>starter(snapshot,sp));
  const same=(a,b)=>JSON.stringify(Object.entries(a).filter(([,n])=>n).sort())===JSON.stringify(Object.entries(b).filter(([,n])=>n).sort());
  if(!presets.some(p=>JSON.stringify([...p.heroes].sort())===JSON.stringify([...hs].sort())&&same(p.slots,slots||{})))errors.push('教学模式仅允许原版四系30张预设；修改后请使用标准模式。');
 }else errors.push('未知牌组模式。');
 if(mode==='starter')warnings.push('原版30张教学预设，不满足标准50张构筑下限。');
 const available=new Set(heroes.map(c=>c.sphere));const missing=new Set;for(const [code,n] of Object.entries(slots||{})){const c=by[code];if(n>0&&c&&c.sphere!=='neutral'&&!available.has(c.sphere))missing.add(c.sphereName);}
 if(missing.size)warnings.push(`缺少${[...missing].join('、')}英雄的基础资源匹配；是否能通过卡牌能力支付尚未校验。`);
 if(heroes.some(h=>h.startingThreat===null))errors.push('英雄缺少初始威胁。');
 warnings.push('能力文本已导入，尚未成为自动执行的规则；本牌组不能标记为全自动可用。');
 return {valid:!errors.length,errors,warnings,startingThreat:heroes.reduce((n,c)=>n+(c.startingThreat||0),0),total,heroes,automated:false};
}
function validateFellowship(decks,snapshot){const results=decks.map(d=>validateDeck(d,snapshot));const errors=results.flatMap((r,i)=>r.errors.map(e=>`玩家${i+1}：${e}`)),seen=new Set;for(const [i,r] of results.entries())for(const h of r.heroes){const key=canonicalName(h);if(seen.has(key))errors.push(`玩家${i+1}：英雄${h.nameZh}已被其他玩家选择。`);seen.add(key);}return {valid:!errors.length,errors,results};}
function config(deck,snapshot){let r=validateDeck(deck,snapshot);need(r.valid,r.errors.join('\n'));return {heroes:r.heroes.map(c=>c.nameZh),heroCodes:r.heroes.map(c=>c.code),heroCards:r.heroes.map(c=>JSON.parse(JSON.stringify(c))),startingThreat:r.startingThreat,registeredDeck:{name:deck.name||'未命名牌组',mode:deck.mode||'standard',slots:{...deck.slots},cards:Object.entries(deck.slots).filter(([,n])=>n>0).map(([code])=>JSON.parse(JSON.stringify(index(snapshot)[code]))),total:r.total,source:snapshot.source,sourceFetchedAt:snapshot.fetchedAt,automated:false}};}
function importDeck(raw,snapshot){need(raw&&typeof raw==='object','无效牌组JSON');let slots=raw.slots;need(slots&&typeof slots==='object'&&!Array.isArray(slots),'找不到RingsDB slots字段');const by=index(snapshot),heroes=[],draw={};for(const [code,n] of Object.entries(slots)){need(typeof n==='number'&&Number.isInteger(n)&&n>=0,`${code}数量无效`);if(!n)continue;need(by[code],`本版本仅接入基础版，无法导入${code}`);if(by[code].type==='hero'){need(n===1,'每名英雄只能1张');heroes.push(code);}else draw[code]=n;}
 const h=raw.heroes===undefined?heroes:raw.heroes;need(Array.isArray(h)&&h.every(c=>typeof c==='string'),'heroes须为卡牌代码数组');return {id:'custom-import',name:String(raw.name||'导入牌组').slice(0,100),mode:raw.mode||'standard',heroes:h,slots:draw};}
function exportDeck(deck){return {name:deck.name,mode:deck.mode,slots:{...deck.slots,...Object.fromEntries(deck.heroes.map(code=>[code,1]))}};}
/* 分享链接：把牌组压成可贴进聊天框的一串编码，放在 URL hash 里。
 * 只用 base64url 字符集，避免 '+' '/' '=' 被聊天软件或 URL 解析截断。 */
function toB64Url(text){
 const bytes=new TextEncoder().encode(String(text));let bin='';
 for(const b of bytes)bin+=String.fromCharCode(b);
 return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function fromB64Url(code){
 const padded=String(code).replace(/-/g,'+').replace(/_/g,'/');
 const bin=atob(padded+'='.repeat((4-padded.length%4)%4));
 const bytes=new Uint8Array(bin.length);
 for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
 return new TextDecoder().decode(bytes);
}
/* 紧凑载荷：{n:名称,m:模式,h:[英雄代码],s:{代码:张数}}。
 * 字段名压到 1 字符是因为链接会被贴进聊天软件，长度直接影响可用性。 */
function encodeDeck(deck){
 const slots={};for(const [code,n] of Object.entries(deck.slots||{}))if(n>0)slots[code]=n;
 return toB64Url(JSON.stringify({n:String(deck.name||'未命名牌组').slice(0,60),m:deck.mode||'standard',h:(deck.heroes||[]).slice(0,3),s:slots}));
}
function decodeDeck(code,snapshot){
 const raw=JSON.parse(fromB64Url(code));
 need(raw&&typeof raw==='object'&&!Array.isArray(raw),'分享码内容不是牌组');
 need(Array.isArray(raw.h)&&raw.h.every(c=>typeof c==='string'),'分享码缺少英雄列表');
 need(raw.s&&typeof raw.s==='object'&&!Array.isArray(raw.s),'分享码缺少牌表');
 const by=index(snapshot),known=[],unknown=[],heroes=[];
 for(const c of raw.h){if(by[c]&&by[c].type==='hero')heroes.push(c);else unknown.push(c);}
 const slots={};
 for(const [c,n] of Object.entries(raw.s)){
  if(!Number.isInteger(n)||n<1||n>99)continue;
  if(!by[c]||by[c].type==='hero'){unknown.push(c);continue;}
  slots[c]=Math.min(n,by[c].deckLimit||3);
 }
 return {deck:{id:'custom-import',name:String(raw.n||'分享牌组').slice(0,100),mode:raw.m||'standard',heroes,slots},unknown};
}
// ---- deck import: pasted decklist text, or a RingsDB decklist JSON payload ----
// Names are matched loosely (case, punctuation and apostrophes ignored) so pasted
// lists from RingsDB, arkham.build-style exports or plain notes all resolve.
function nameKey(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[\u2018\u2019\u02bc]/g,"'").replace(/[^0-9a-z\u4e00-\u9fff']/g,'');}
function nameIndex(snapshot){const map=new Map;for(const c of snapshot.cards)for(const n of [c.name,c.nameZh,c.nameZhCard]){const k=nameKey(n);if(k&&!map.has(k))map.set(k,c.code);}return map;}
const deckHeaders=/^(?:英雄|英雄区|英雄名单|heroes?|deck|decklist|牌组|牌库|玩家牌|玩家牌组|cards?|slots?|盟友|盟友区|附属|附属区|事件|attachments?|allies|events?)\s*[:：]?\s*[（(]?\s*\d*\s*[)）]?$/i;
function parseTextDeck(text,snapshot){
 const by=index(snapshot),names=nameIndex(snapshot),heroes=[],slots={},errors=[],warnings=[];let cards=0;
 String(text||'').split(/\r?\n/).forEach((rawLine,i)=>{
  const original=rawLine;let line=rawLine.trim();
  if(!line)return;
  if(/^(?:\/\/|;|—|##?\s*$)/.test(line))return;
  if(deckHeaders.test(line.replace(/[*#]/g,'')))return;
  line=line.replace(/^[-*•·]\s*/,'').trim();
  const m=line.match(/^(?:(\d+)\s*[x×*]\s*|(\d+)\s+)?(.+?)(?:\s*[x×*]\s*(\d+))?$/i);
  if(!m){errors.push({line:i+1,text:original.trim(),reason:'无法解析这一行'});return;}
  const rawCount=m[1]||m[2]||m[4],count=rawCount?Number(rawCount):1;
  if(!Number.isInteger(count)||count<1||count>99){errors.push({line:i+1,text:original.trim(),reason:'张数无效'});return;}
  let name=String(m[3]||'').trim().replace(/[，,;；]$/,'');
  let code=null;
  const bare=name.match(/^#?(\d{3,6})$/);
  const paren=name.match(/^(.*?)\s*[（(]\s*#?(\d{3,6})\s*[)）]$/);
  if(bare&&by[bare[1]])code=bare[1];
  else if(paren&&by[paren[2]]){name=paren[1].trim();code=paren[2];}
  if(!code)code=names.get(nameKey(name))||null;
  if(!code){errors.push({line:i+1,text:original.trim(),reason:'卡池中没有「'+name+'」'});return;}
  const card=by[code];
  if(card.type==='hero'){
   if(count>1)warnings.push({line:i+1,text:original.trim(),reason:'英雄只取1张'});
   if(!heroes.includes(code))heroes.push(code);
   if(heroes.length>3){errors.push({line:i+1,text:original.trim(),reason:'英雄超过3名'});}
   return;
  }
  slots[code]=(slots[code]||0)+count;cards+=count;
 });
 if(!heroes.length)errors.push({line:0,text:'',reason:'没有识别到英雄（需要1–3名）'});
 return {deck:{id:'custom-import',name:'导入牌组',mode:'standard',heroes,slots},errors,warnings,cards,heroes:heroes.length};
}
function fromRingsdb(raw){
 need(raw&&typeof raw==='object'&&!Array.isArray(raw),'RingsDB 返回的不是牌组对象');
 const sourceHeroes=raw.heroes||{},heroes=[];
 if(Array.isArray(sourceHeroes)){for(const c of sourceHeroes)if(c)heroes.push(String(c));}
 else{for(const [code,n] of Object.entries(sourceHeroes))if(Number(n)>0)heroes.push(String(code));}
 const slots={};for(const [code,n] of Object.entries(raw.slots||{})){const v=Number(n);if(Number.isInteger(v)&&v>0)slots[String(code)]=v;}
 need(heroes.length,'RingsDB 牌组里没有英雄');
 return {id:'ringsdb-'+raw.id,name:String(raw.name||('RingsDB 牌组 '+raw.id)).slice(0,100),mode:'standard',heroes,slots,source:'ringsdb:'+raw.id};
}
async function fetchCore({fetchImpl=globalThis.fetch,signal}={}){need(typeof fetchImpl==='function','当前浏览器不支持联网读取');const endpoint='https://ringsdb.com/api/public/cards/Core.json';const r=await fetchImpl(endpoint,{method:'GET',cache:'default',signal});need(r.ok,`RingsDB请求失败：HTTP ${r.status}`);return normalizePack(await r.json(),{endpoint,packCode:'Core',fetchedAt:new Date().toISOString(),lastModified:r.headers.get('Last-Modified'),cacheControl:r.headers.get('Cache-Control')});}
return {SPHERES,NAMES,normalizeCard,normalizePack,verify,index,starter,validateDeck,validateFellowship,config,importDeck,exportDeck,encodeDeck,decodeDeck,fetchCore,parseTextDeck,fromRingsdb,nameIndex};
})();
if(typeof module!=='undefined')module.exports=PlayerCards;
