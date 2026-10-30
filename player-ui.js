const PlayerUI=(()=>{
const P=PlayerCards;
let snapshot=P.verify(RINGSDB_SNAPSHOT),saved=[],draft=null,importReport=null,building=false,builderOrigin='',filter={text:'',type:'',sphere:''};
try{let cached=JSON.parse(localStorage.getItem('lotr-ringsdb-core-v1')||'null');if(cached&&Date.parse(cached.fetchedAt)>Date.parse(snapshot.fetchedAt))snapshot=P.verify(cached);}catch{}
try{let v=JSON.parse(localStorage.getItem('lotr-saved-decks-v1')||'[]');if(Array.isArray(v))saved=v.filter(d=>typeof d.id==='string'&&Array.isArray(d.heroes)&&d.slots&&typeof d.name==='string');}catch{}
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={hero:'英雄',ally:'盟友',attachment:'附属',event:'事件'};
function presets(){return ['leadership','tactics','spirit','lore'].map(sp=>P.starter(snapshot,sp));}
function decks(){return [...presets(),...saved];}
const PRESET_ORDER=['leadership','tactics','spirit','lore'];
/* 重名防呆：新增保存时若与现有牌组（预组+自建）同名，给出「原名（副本）」；
 * 若「（副本）」也被占用则继续递增序号（（副本 2）（副本 3）…）直到不重名。 */
function uniqueDeckName(name){const taken=new Set(decks().map(d=>d.name)),base=String(name||'未命名牌组');if(!taken.has(base))return null;let cand=base+'（副本）',n=1;while(taken.has(cand)){n++;cand=base+'（副本 '+n+'）';}return cand;}
/* 稳定排序：预组按固定球色顺序排在前，自建按名称 localeCompare('zh')。
 * 「我的卡组」页与剧本开局选牌器两处渲染共用，保证两处顺序一致。 */
function sortedDecks(list,bySize=false){
 const rank=d=>{const s=String(d.id||'');return s.startsWith('starter-')?PRESET_ORDER.indexOf(s.slice(8)):-1;};
 return [...list].sort((a,b)=>{
  const ra=rank(a),rb=rank(b);
  if((ra<0)!==(rb<0))return ra<0?1:-1;
  if(ra>=0&&ra!==rb)return ra-rb;
  return bySize?deckInfo(b).total-deckInfo(a).total:String(a.name).localeCompare(String(b.name),'zh');
 });
}
function startDraft(){if(!draft)draft=JSON.parse(JSON.stringify(presets()[0]));}
function button(t,action,attrs='',cls=''){return `<button class="${cls}" data-action="pc" data-pc="${action}" ${attrs}>${t}</button>`;}
function deckOptions(selected){return decks().map(d=>`<option value="${esc(d.id)}" ${selected===d.id?'selected':''}>${esc(d.name)}</option>`).join('');}
function configs(n,ids){const selected=[];for(let i=0;i<n;i++){const key=(ids&&ids[i])||document.querySelector('#pc-deck-'+i)?.value||presets()[i].id;const d=decks().find(d=>d.id===key);if(!d)throw Error('找不到所选玩家牌组。');selected.push(d);}const result=P.validateFellowship(selected,snapshot);if(!result.valid)throw Error(result.errors.join('\n'));return selected.map(d=>P.config(d,snapshot));}
function oneCard(c){const selected=draft.heroes.includes(c.code),count=draft.slots[c.code]||0;return `<article class="card player-card ${c.type} sphere-${c.sphere}"><div class="number"><span>${names[c.type]} · ${esc(c.sphereName)}</span><span>#${c.code}</span></div>${ImageLibrary.art(c.code)}<h3>${c.isUnique?'◆ ':''}${esc(c.nameZh)}</h3><div class="en">${esc(c.name)}</div><div class="stats">${c.type==='hero'?`初始威胁 <b>${c.startingThreat}</b>`:`费用 <b>${esc(c.cost)}</b>`}${c.health!==null?`<br>意志 ${c.willpower??'—'} · 攻 ${c.attack??'—'} · 防 ${c.defense??'—'} · 血 ${c.health}`:''}</div><div class="small muted">${esc(c.traits)}</div><div class="body rules-text">${esc(c.rulesText)}</div><div class="small">每副牌上限 ${c.deckLimit} · 原版盒内 ${c.quantity}${c.hasErrata?' · <b class="warning-text">有勘误</b>':''}</div><p class="small muted">资料已接入 · 能力待实现</p><footer>${c.type==='hero'?button(selected?'移出英雄':'选择英雄','hero',`data-code="${c.code}"`,selected?'primary':''):button('−','minus',`data-code="${c.code}"`)+`<span class="pc-count">${count}</span>`+button('+','plus',`data-code="${c.code}"`)}<a href="${c.sourceUrl}" target="_blank" rel="noreferrer" class="small">RingsDB原卡 ↗</a></footer></article>`;}
function summary(){const r=P.validateDeck(draft,snapshot),by=P.index(snapshot);return `<aside class="panel deck-editor"><div class="eyebrow">DECK BUILDER · CORE</div><h2>当前牌组</h2><p><input id="pc-name" aria-label="牌组名称" value="${esc(draft.name)}" maxlength="100"></p><label class="small">构筑模式 <select id="pc-mode"><option value="starter" ${draft.mode==='starter'?'selected':''}>原版30张教学预设</option><option value="standard" ${draft.mode==='standard'?'selected':''}>标准构筑（至少50张）</option></select></label>${importReport?`<div class="notice import-report"><b>导入报告</b>${importReport.map(x=>`<p class="small">${esc(x.line?('第'+x.line+'行 '):'')}${x.text?('「'+esc(x.text)+'」'):''}${esc(x.reason||'')}</p>`).join('')}</div>`:''}<div class="deck-counts"><div><strong>${r.heroes.length}/3</strong>英雄</div><div><strong>${r.startingThreat}</strong>初始威胁</div><div><strong>${r.total}</strong>抽牌牌库</div></div><div class="deck-heroes">${draft.heroes.map(code=>`<p>${esc(by[code]?.nameZh||code)} <span class="muted small">#${esc(code)}</span> ${button('移除','hero',`data-code="${esc(code)}"`)}</p>`).join('')||'<p class="muted small">尚未选择英雄</p>'}</div><div class="notice ${r.valid?'deck-valid':''}">${r.valid?'基本构筑校验通过':r.errors.map(esc).join('<br>')}</div><details><summary class="small">构筑提醒 / 自动化状态</summary>${r.warnings.map(w=>`<p class="small muted">${esc(w)}</p>`).join('')}</details><div class="deck-list">${Object.entries(draft.slots).filter(([,n])=>n>0).sort().map(([code,n])=>`<div><span>${esc(by[code]?.nameZh||code)}</span><span>${button('−','minus',`data-code="${esc(code)}"`)} ${n} ${button('+','plus',`data-code="${esc(code)}"`)}</span></div>`).join('')}</div><div class="actions">${button('保存牌组','save','','primary')}${button('导出牌组JSON','export')}${button('复制分享链接','share')}${button('清空重建','clear')}</div><p class="small muted">保存后，可在剧本开局处选用。复制分享链接会把这副牌的当前内容编成一条链接（需要 http/https 打开；本机双击打开时没有可分享的地址）。</p></aside>`;}
function isBuilding(){return building;}
/* 打开别人分享的链接时自动进组卡器，并清掉 hash 以免刷新后又覆盖当前编辑内容。
 * 解码失败不阻断启动：留在卡组页，把原因说清楚。 */
function openSharedDeck(){
 const code=readHashDeck();
 if(!code)return false;
 /* 先清 hash 再解码：解码失败也要清，否则刷新会一直重试同一条坏链接。 */
 clearHashDeck();
 try{
  const {deck,unknown}=P.decodeDeck(code,snapshot),r=P.validateDeck(deck,snapshot);
  draft=JSON.parse(JSON.stringify(deck));builderOrigin='';building=true;
  setTimeout(()=>toast(r.valid?'已打开分享牌组「'+deck.name+'」'+(unknown.length?'；有 '+unknown.length+' 张卡不在基础版卡池':''):'已打开分享牌组「'+deck.name+'」，但构筑未通过：'+r.errors.slice(0,2).join('；')),0);
  return true;
 }catch(e){setTimeout(()=>toast('分享链接无法解析：'+e.message),0);return false;}
}
function startBuild(id){if(id)loadDeck(id);else{draft={id:'new',name:'自定义基础版牌组',mode:'standard',heroes:[],slots:{}};importReport=null;}builderOrigin=id?String(id):'';building=true;}
function sharing(){return typeof location!=='undefined'&&/^https?:$/.test(location.protocol);}
function shareLink(deck){if(!sharing())return '';return location.origin+location.pathname+'#deck='+P.encodeDeck(deck);}
/* 分享码优先于「上次退出位置」恢复：收到别人发来的链接时，应该打开那副牌而不是自己上次的草稿。 */
function readHashDeck(){
 if(typeof location==='undefined')return null;
 const m=/[#&]deck=([A-Za-z0-9_-]+)/.exec(location.hash||'');
 return m?m[1]:null;
}
/* 用 window.history.* 调用而不是裸 history.*：顶层 `history` 变量在真实浏览器里是
 * Chrome 的全局访问计数对象（它是 window 的属性），直接 history.replaceState 会炸。 */
function clearHashDeck(){
 if(typeof window==='undefined'||!window.history)return;
 if(!/[#&]deck=/.test(window.location.hash||''))return;
 if(typeof window.history.replaceState!=='function')return;
 try{window.history.replaceState(null,'',window.location.pathname+window.location.search);}catch{}
}
/* 回填入口：正在编辑的草稿一旦偏离原牌组，就给一条一键回到原牌组的路，
 * 而不是逼玩家「返回列表 → 找到那副牌 → 再点编辑」。 */
/* 复制分享链接：优先用剪贴板 API（需要安全上下文），失败时退回「选中让你手抄」的弹窗，
 * 因为 file:// 打开时 navigator.clipboard 通常不可用，而本机调试恰恰常用双击。 */
async function copyText(text){
 try{
  if(navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(text);toast('分享链接已复制，粘贴给别人即可打开这副牌。');return;}
 }catch{}
 await choose('复制分享链接','<p class="small muted">浏览器没有允许自动复制，请手动选中下面的链接。</p><textarea id="pc-sharetext" rows="3" readonly spellcheck="false">'+esc(text)+'</textarea>',d=>{const t=d.querySelector('#pc-sharetext');t.focus();t.select();return t.value;});
}
function backLabel(){
 if(!draft||!builderOrigin)return null;
 const origin=deckById(builderOrigin);
 if(!origin)return null;
 const same=JSON.stringify(P.exportDeck(origin))===JSON.stringify(P.exportDeck(draft));
 if(same)return null;
 return {id:origin.id,name:origin.name};
}
function builder(){startDraft();const back=backLabel();return `<div class="intro"><div><div class="eyebrow">DECK BUILDER · CORE</div><h1>编辑牌组</h1><p class="muted">点卡名展开详情与加减牌；鼠标停在卡名上直接显示卡图。右侧实时校验，保存后可在剧本开局时选用。快照 ${esc(snapshot.fetchedAt.slice(0,10))} · 离线可查。</p></div><div class="actions">${back?`<button data-action="deckBackTo" data-deck="${esc(back.id)}">← 回填原牌组「${esc(back.name)}」</button>`:''}${button('← 返回卡组列表','deckBack')}${button('从RingsDB更新资料','refresh')}</div></div><div class="notice">卡牌资料来自 RingsDB 基础版快照，仅提供资料与构筑校验，不提供自动结算能力；牌组里的牌仍需在桌面上手动结算。</div><div class="toolbar"><label>载入预设／已存牌组 <select id="pc-load">${deckOptions(draft.id)}</select></label>${button('载入','load')}<label class="button" for="pc-import">导入牌组JSON文件</label><input type="file" id="pc-import" accept="application/json" hidden><input id="pc-deckurl" placeholder="RingsDB 牌组链接或编号，如 decklist/view/12345" aria-label="RingsDB 牌组链接">${button('从链接导入','importUrl')}${button('粘贴牌表导入','importText')}</div><div class="player-library-layout"><section><div class="toolbar"><input id="pc-search" placeholder="搜索中英文名称、代码、特性或能力…" value="${esc(filter.text)}" aria-label="搜索玩家卡"><select id="pc-type" aria-label="类型筛选"><option value="">全部类型</option>${Object.entries(TYPE_NAMES).map(([k,v])=>`<option value="${k}" ${filter.type===k?'selected':''}>${v}</option>`).join('')}</select><select id="pc-sphere" aria-label="球色筛选"><option value="">全部球色</option>${SPHERE_ORDER.map(k=>`<option value="${k}" ${filter.sphere===k?'selected':''}>${esc(P.SPHERES[k])}</option>`).join('')}</select></div><p class="small muted" id="pc-result-count"></p><div class="cat-index" id="pc-results"></div></section>${summary()}</div>`;}
const TYPE_NAMES={hero:'英雄',ally:'盟友',attachment:'附属',event:'事件'};
const TYPE_ORDER=['hero','ally','attachment','event'];
const SPHERE_ORDER=['leadership','tactics','spirit','lore','neutral'];
function hoverSrc(code){const rec=ImageLibrary.by[code];return rec?String(ImageLibrary.safeUrl(rec.imageUrl)||''):'';}
function buildDetail(c){const rows=[['类型',TYPE_NAMES[c.type]],['球色',c.sphereName],['费用',c.cost],['初始威胁',c.startingThreat],['意志／攻击／防御／生命',c.type==='hero'?`${c.willpower}／${c.attack}／${c.defense}／${c.health}`:null],['特性',c.traits],['卡包',c.packName],['编号',c.code],['每副上限',c.deckLimit]];const dl=`<dl class="cat-facts">${rows.filter(r=>r[1]!==null&&r[1]!==undefined&&r[1]!=='').map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;return `<div class="cat-detail">${ImageLibrary.art(c.code)}<div class="cat-text">${dl}<p class="small muted">规则文本为 RingsDB 英文原文，未作翻译。</p><p>${esc(c.rulesText||'（暂无规则文本）')}</p></div></div>`;}
function buildRow(c){const n=draft.slots[c.code]||0,heroOn=draft.heroes.includes(c.code),inDeck=heroOn||n>0,src=hoverSrc(c.code);const actions=c.type==='hero'?button(heroOn?'移出英雄':'选择英雄','hero',`data-code="${c.code}"`,heroOn?'primary':''):`${button('−','minus',`data-code="${c.code}"`)}<span class="build-count">${n}</span>${button('+','plus',`data-code="${c.code}"`)}`;return `<div class="build-row ${inDeck?'in-deck':''}"><details class="cat-item" data-code="${c.code}"><summary${src?` data-hover-src="${esc(src)}" data-hover-shape="tall"`:''}><span class="cat-name">${c.isUnique?'◆ ':''}${esc(c.nameZh)}</span><span class="cat-meta">${TYPE_NAMES[c.type]} · ${esc(c.sphereName)} · #${esc(c.code)}</span></summary><div class="cat-body" data-loaded="0"></div></details><div class="build-actions">${actions}</div></div>`;}
function buildGroups(list){const map=new Map;for(const c of list){const k=SPHERE_ORDER.includes(c.sphere)?c.sphere:'neutral';if(!map.has(k))map.set(k,[]);map.get(k).push(c);}return [...map.entries()].sort((a,b)=>SPHERE_ORDER.indexOf(a[0])-SPHERE_ORDER.indexOf(b[0])).map(([k,arr])=>{arr.sort((a,b)=>(TYPE_ORDER.indexOf(a.type)-TYPE_ORDER.indexOf(b.type))||String(a.nameZh).localeCompare(String(b.nameZh),'zh'));return `<section class="cat-group"><h2><span>${esc(P.SPHERES[k]||k)}</span><span class="cat-count">${arr.length}</span></h2><div class="build-list">${arr.map(buildRow).join('')}</div></section>`;}).join('');}
function bindBuildList(){const root=document.querySelector('#pc-results');if(!root||typeof root.addEventListener!=='function'||root.dataset.boundBuild)return;root.dataset.boundBuild='1';root.addEventListener('toggle',ev=>{const d=ev.target;if(!d.classList||typeof d.classList.contains!=='function'||!d.classList.contains('cat-item')||!d.open)return;const body=d.querySelector('.cat-body');if(!body||body.dataset.loaded==='1')return;const c=snapshot.cards.find(x=>x.code===d.dataset.code);if(c)body.innerHTML=buildDetail(c);body.dataset.loaded='1';ImageLibrary.bindErrors(body);},true);}
function filterCards(){const box=document.querySelector('#pc-search');if(!box)return;filter.text=box.value;filter.type=document.querySelector('#pc-type').value;filter.sphere=document.querySelector('#pc-sphere').value;const text=filter.text.toLocaleLowerCase();const found=snapshot.cards.filter(c=>(!filter.type||c.type===filter.type)&&(!filter.sphere||c.sphere===filter.sphere)&&`${c.code} ${c.name} ${c.nameZh} ${c.traits} ${c.rulesText}`.toLocaleLowerCase().includes(text));const count=document.querySelector('#pc-result-count');if(count)count.textContent=filter.text.trim()?`「${filter.text.trim()}」匹配 ${found.length} 种玩家卡`:`共 ${found.length} 种玩家卡`;const out=document.querySelector('#pc-results');if(!out)return;out.innerHTML=found.length?buildGroups(found):'<p class="empty">没有匹配的卡牌。</p>';ImageLibrary.bindErrors(out);bindBuildList();}
function capture(){const name=document.querySelector('#pc-name'),mode=document.querySelector('#pc-mode');if(name)draft.name=name.value||'未命名牌组';if(mode)draft.mode=mode.value;}
function persist(){localStorage.setItem('lotr-saved-decks-v1',JSON.stringify(saved));}
function download(data,name){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function bind(){filterCards();bindBuildList();for(const id of ['pc-search','pc-type','pc-sphere']){const el=document.querySelector('#'+id);if(el)el.oninput=filterCards;}const mode=document.querySelector('#pc-mode');if(mode)mode.onchange=()=>{capture();render();};const imp=document.querySelector('#pc-import');if(imp)imp.onchange=async ev=>{const f=ev.target.files[0];if(!f)return;try{if(f.size>1000000)throw Error('牌组文件过大');let d=P.importDeck(JSON.parse(await f.text()),snapshot);draft=d;importReport=null;render();toast('牌组已读入，请查看右侧构筑校验结果。');}catch(e){toast('导入失败：'+e.message);}};}
function applyImport(result,label){draft=JSON.parse(JSON.stringify(result.deck));const problems=[...(result.errors||[]),...(result.warnings||[])];importReport=problems.length?problems.slice(0,8):null;const r=P.validateDeck(draft,snapshot);if((result.errors||[]).length)toast(label+'：'+result.errors.length+' 处需要处理，详见右侧导入报告');else if(r.valid)toast(label+'：'+draft.heroes.length+' 名英雄、'+r.total+' 张玩家牌；保存后可在开局选用');else toast(label+'，但构筑校验未通过：'+r.errors.slice(0,2).join('；'));}
async function importDeckUrl(){const input=document.querySelector('#pc-deckurl'),raw=String(input&&input.value||'').trim();if(!raw){toast('请先粘贴 RingsDB 牌组链接或编号');return;}const m=raw.match(/(?:decklist|deck)\/(?:view\/)?(\d+)/i)||raw.match(/^(\d+)$/);if(!m){toast('无法识别牌组编号；示例 https://ringsdb.com/decklist/view/12345');return;}const id=m[1],cacheKey='lotr-ringsdb-decks-v1';let cache={};try{cache=JSON.parse(localStorage.getItem(cacheKey)||'{}')||{};}catch{}
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),15000);
 try{const res=await fetch('https://ringsdb.com/api/public/decklist/'+id,{signal:ctrl.signal,headers:{Accept:'application/json'}});if(!res.ok)throw Error('RingsDB 返回 HTTP '+res.status);const payload=await res.json();cache[id]={raw:payload,fetchedAt:new Date().toISOString()};try{localStorage.setItem(cacheKey,JSON.stringify(cache));}catch{}applyImport({deck:P.fromRingsdb(payload)},'已从 RingsDB 导入 #'+id);}
 catch(e){if(cache[id]&&cache[id].raw)applyImport({deck:P.fromRingsdb(cache[id].raw)},'无法联网，已用本地缓存的 #'+id);else toast(e.name==='AbortError'?'RingsDB 请求超时（15秒）；国内网络无法访问 ringsdb.com，请改用「粘贴牌表导入」':'导入失败：'+e.message+'；国内网络无法访问 ringsdb.com，可改用「粘贴牌表导入」');}
 finally{clearTimeout(timer);}}
async function handle(b){startDraft();capture();const action=b.dataset.pc,code=b.dataset.code,by=P.index(snapshot),c=by[code];
 try{
  if(action==='deckBack'){capture();building=false;render();return;}
  if(action==='hero'){if(!c||c.type!=='hero')throw Error('请选择有效英雄');if(draft.heroes.includes(code))draft.heroes=draft.heroes.filter(x=>x!==code);else{if(draft.heroes.length>=3)throw Error('最多3名英雄，请先移除1名。');draft.heroes.push(code);}draft.mode='standard';}
  if(action==='plus'){if(!c||c.type==='hero')throw Error('无效玩家牌');let n=draft.slots[code]||0;if(n>=c.deckLimit)throw Error(`该牌每副牌最多${c.deckLimit}张。`);draft.slots[code]=n+1;draft.mode='standard';}
  if(action==='minus'){if((draft.slots[code]||0)>0){draft.slots[code]--;if(!draft.slots[code])delete draft.slots[code];draft.mode='standard';}}
  if(action==='importText'){const text=await choose('粘贴牌表','<p class="small muted">每行一张牌，支持「3x 卡名」「3 卡名」或卡牌代码（如 01014）；英雄行会自动识别，中英文名称都可以，「英雄／牌组」这类分组标题会被忽略。</p><textarea id="pc-decktext" rows="12" spellcheck="false" placeholder="阿拉贡\n希优德\n贝瑞刚德\n\n3x 刚铎摄政王\n2x 突袭\n…"></textarea>',d=>d.querySelector('#pc-decktext').value);if(text===null)return;applyImport(P.parseTextDeck(text,snapshot),'已读取牌表');render();return;}
  if(action==='importUrl'){await importDeckUrl();render();return;}
  if(action==='load'){let d=decks().find(d=>d.id===document.querySelector('#pc-load').value);if(d){draft=JSON.parse(JSON.stringify(d));builderOrigin=d.id;}importReport=null;}
  if(action==='clear'){if(!confirm('清空当前未保存的牌组？'))return;draft={id:'new',name:'自定义基础版牌组',mode:'standard',heroes:[],slots:{}};importReport=null;}
  if(action==='save'){let r=P.validateDeck(draft,snapshot);if(!r.valid)throw Error(r.errors.join('\n'));if(draft.id.startsWith('starter-')||['new','custom-import'].includes(draft.id))draft.id='custom-'+Date.now();let i=saved.findIndex(x=>x.id===draft.id),renamed='';
   /* 只对「新增」防呆：编辑既有牌组（i>=0）本就是覆盖自己，不改名。 */
   if(i<0){const alt=uniqueDeckName(draft.name);if(alt){draft.name=alt;renamed='检测到同名牌组，已命名为「'+alt+'」。';}}
   let copy=JSON.parse(JSON.stringify(draft));if(i>=0)saved[i]=copy;else saved.push(copy);persist();builderOrigin=draft.id;importReport=null;toast(renamed+'牌组已保存，可在剧本开局时选用。');}
  if(action==='share'){const url=shareLink(draft);if(!url){toast('本机双击打开的页面没有可分享的地址；部署到网站后即可复制链接。');return;}await copyText(url);}
  if(action==='export'){download(P.exportDeck(draft),'lotr-core-deck.json');}
  if(action==='refresh'){
   const age=Date.now()-Date.parse(snapshot.fetchedAt);if(age>=0&&age<600000){toast('资料仍在10分钟缓存期内，已使用当前缓存。');return;}
   b.disabled=true;b.textContent='正在读取…';const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),15000);try{const next=await P.fetchCore({signal:ctrl.signal});P.verify(next);localStorage.setItem('lotr-ringsdb-core-v1',JSON.stringify(next));snapshot=next;toast('RingsDB资料已更新；正在进行的对局仍保留开局快照。');}finally{clearTimeout(timer);b.disabled=false;b.textContent='从RingsDB更新资料';}
  }
  render();
 }catch(e){toast(e.name==='AbortError'?'RingsDB请求超时，继续使用原有离线资料。':e.message);if(action==='refresh'){b.disabled=false;b.textContent='从RingsDB更新资料';}}
}
function registered(p){if(!p.heroCards)return null;return `<div class="api-heroes">${p.heroCards.map((c,i)=>`<div class="hero api-hero ${p.heroStates?.[i]?.exhausted?'is-exhausted':''} ${state.prisoner?.player===p.id&&state.prisoner?.hero===i&&!state.rescued?'prisoner':''}">${ImageLibrary.art(c.code,'hero-thumbnail')}<b>${esc(c.nameZh)}</b>${PlanningUI.heroStats(p,i)}<span class="small muted">${esc(c.sphereName)} · #${c.code}</span><span class="small muted">基础 意${c.willpower} 攻${c.attack} 防${c.defense} 血${c.health}</span><details><summary>能力资料</summary><div class="rules-text">${esc(c.rulesText)}</div></details></div>`).join('')}</div><details class="small registered-deck"><summary>${esc(p.registeredDeck?.name)} · 已登记${p.registeredDeck?.total||0}张玩家牌</summary><p>英雄、牌库与手牌按开局快照保存。当前验收到旅行阶段；第五阶段以后待实现。</p>${Object.entries(p.registeredDeck?.slots||{}).map(([code,n])=>`<span class="badge">${esc(p.registeredDeck?.cards?.find(c=>c.code===code)?.nameZh||code)} ×${n}</span>`).join('')}</details>`;}
function handPanel(p){if(!p?.hand)return `<section class="panel"><h2>玩家手牌</h2><p class="small muted">旧存档没有实际玩家牌库与手牌，请新开预组牌测试。</p></section>`;const by=Object.fromEntries(p.registeredDeck.cards.map(c=>[c.code,c]));return `<section class="panel player-hand"><div class="panel-title"><h2>玩家手牌 <span class="small muted">PLAYER HAND</span></h2><label class="small">查看 <select id="hand-player">${state.players.map(x=>`<option value="${x.id}" ${x.id===p.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label></div><div class="deck-counts"><div><strong>${p.hand.length}</strong>手牌</div><div><strong>${p.playerDeck.length}</strong>牌库</div><div><strong>${p.playerDiscard.length}</strong>弃牌</div></div><p class="small muted">同机测试，可切换查看各玩家手牌；不是联网私密手牌。卡牌图片可放大。计划阶段可正常出牌，探险阶段可在合法窗口使用事件和行动；每张牌会显示当前可用性与禁用原因。</p><div class="cards">${p.hand.map(x=>{const c=by[x.code];return `<article class="card hand-card sphere-${c.sphere}"><div class="number"><span>${names[c.type]}</span><span>#${x.code}</span></div>${ImageLibrary.art(x.code)}<h3>${esc(c.nameZh)}</h3><div class="en">${esc(c.name)}</div><div class="stats">费用 ${esc(c.cost)}${c.health!==null?`<br>意${c.willpower} 攻${c.attack} 防${c.defense} 血${c.health}`:''}</div><details><summary class="small">能力资料</summary><div class="small rules-text">${esc(c.rulesText||'无额外印刷能力')}</div></details>${PlanningUI.handButton(p,x)}</article>`;}).join('')}</div></section>`;}
/* ---------- deck library (我的卡组) and the start-of-scenario picker ---------- */
let deckView={tab:'link',text:'',sphere:'',sort:'name'};
function deckInfo(d){
 const by=P.index(snapshot),heroes=(d.heroes||[]).map(c=>by[c]).filter(Boolean),r=P.validateDeck(d,snapshot),mine=saved.some(x=>x.id===d.id);
 const source=String(d.source||'').startsWith('ringsdb:')?'RingsDB #'+String(d.source).slice(9):(String(d.id||'').startsWith('starter-')?'预组':'自定义');
 return {d,heroes,total:r.total,valid:r.valid,errors:r.errors,spheres:[...new Set(heroes.map(h=>h.sphere))],source,mine};
}
function deckCard(d,actions,extra=''){
 const i=deckInfo(d);
 /* 重名防混淆：仅当同名不止一副时，才在名字后面标注来源（预组／自定义），让玩家分得清。 */
 const dup=decks().filter(x=>x.name===d.name).length>1?` <span class="badge">${esc(i.source)}</span>`:'';
 return `<article class="deck-card ${extra}" data-deck="${esc(d.id)}"><div class="deck-card-heroes">${i.heroes.map(h=>`<span class="deck-hero-thumb">${ImageLibrary.art(h.code,'hero-thumbnail')}</span>`).join('')||'<span class="deck-hero-thumb"></span>'}</div><div class="deck-card-body"><h2>${esc(d.name)}${dup}</h2><p class="small muted">${i.heroes.map(h=>esc(h.nameZh)).join('、')||'未选英雄'}</p><p class="deck-card-tags"><span class="badge">${esc(i.source)}</span><span class="badge">${i.total} 张</span>${i.spheres.length?`<span class="badge">${i.spheres.map(x=>esc(P.SPHERES[x]||x)).join('／')}</span>`:''}${i.valid?'':'<span class="badge danger">构筑未通过</span>'}</p></div><div class="deck-card-actions">${actions}</div></article>`;
}
function deckActions(d){const i=deckInfo(d);return `<button data-action="deckUse" data-deck="${esc(d.id)}">设为玩家1</button><button data-action="deckEdit" data-deck="${esc(d.id)}">编辑</button><button data-action="deckExport" data-deck="${esc(d.id)}">导出</button>${i.mine?`<button class="danger" data-action="deckDelete" data-deck="${esc(d.id)}">删除</button>`:''}`;}
function deckById(id){return decks().find(d=>d.id===id)||null;}
function deckName(id){return deckById(id)?.name||'';}
function saveDeck(deck){const r=P.validateDeck(deck,snapshot);if(!r.valid)throw Error(r.errors.join('\n'));const copy=JSON.parse(JSON.stringify(deck));if(!copy.id||String(copy.id).startsWith('starter-')||['new','custom-import'].includes(copy.id))copy.id='custom-'+Date.now();const i=saved.findIndex(x=>x.id===copy.id);
 /* 导入路径同样是新增保存：同名防呆与手动保存一致（改名后由调用方在 toast 里说明）。 */
 if(i<0){const alt=uniqueDeckName(copy.name);if(alt)copy.name=alt;}
 if(i>=0)saved[i]=copy;else saved.push(copy);persist();return copy;}
function removeDeck(id){const i=saved.findIndex(x=>x.id===id);if(i<0)throw Error('只能删除自己保存的牌组');saved.splice(i,1);persist();}
function loadDeck(id){const d=deckById(id);if(!d)throw Error('找不到该牌组');draft=JSON.parse(JSON.stringify(d));importReport=null;}
function deckMatches(x){const i=deckInfo(x),text=String(deckView.text||'').toLowerCase();const okText=!text||`${x.name} ${i.heroes.map(h=>h.nameZh+' '+h.name).join(' ')}`.toLowerCase().includes(text);const okSphere=!deckView.sphere||i.spheres.includes(deckView.sphere);return okText&&okSphere;}
function deckList(){return sortedDecks(decks().filter(deckMatches),deckView.sort==='size');}
function decksPage(){
 const list=deckList();
 return `<div class="intro"><div><div class="eyebrow">DECK LIBRARY · ${saved.length} 副自建</div><h1>我的卡组</h1><p class="muted">四系教学预组，加上你导入或保存的牌组。点「新建牌组」进入卡牌库式列表配牌；开始剧本时会请每位玩家从这里选一副。</p></div><div class="actions"><button class="primary" data-action="deckNew">新建牌组</button><button data-action="deckGoSetup">返回剧本桌面</button></div></div>
 <section class="panel deck-import"><div class="deck-import-tabs"><button data-action="deckViewTab" data-value="link" class="${deckView.tab==='link'?'active':''}">LINK</button><button data-action="deckViewTab" data-value="file" class="${deckView.tab==='file'?'active':''}">FILE</button><button data-action="deckViewTab" data-value="share" class="${deckView.tab==='share'?'active':''}">分享链接</button></div>
 ${deckView.tab==='link'?`<div class="deck-import-row"><input id="deck-import-url" placeholder="在这里填写 RingsDB 牌组链接或编号（decklist/view/12345）" aria-label="RingsDB 牌组链接"><button class="primary" data-action="deckImportUrl">保存</button></div><p class="small muted">国内网络通常无法访问 ringsdb.com；连不上时可用「新建牌组 → 粘贴牌表导入」，或先开代理再点保存。</p>`:deckView.tab==='share'?`<div class="deck-import-row"><input id="deck-import-share" placeholder="粘贴本站的分享链接或分享码" aria-label="分享链接"><button class="primary" data-action="deckImportShare">打开</button></div><p class="small muted">本站组卡器的「复制分享链接」生成的地址，直接打开也会自动进组卡器。分享码只含牌名以外的卡牌代码与张数，不含账号信息。</p>`:`<div class="deck-import-row"><label class="button" for="deck-import-file">选择牌组 JSON 文件</label><input type="file" id="deck-import-file" accept="application/json" hidden></div><p class="small muted">支持本站「导出牌组JSON」生成的格式（name／mode／heroes／slots）。</p>`}
 </section>
 <div class="toolbar deck-filters"><input id="deck-search" placeholder="搜索牌组名或英雄…" value="${esc(deckView.text)}"><select id="deck-sort"><option value="name" ${deckView.sort==='name'?'selected':''}>排序：名称</option><option value="size" ${deckView.sort==='size'?'selected':''}>排序：张数</option></select><span class="spacer"></span>${['','leadership','tactics','spirit','lore'].map(k=>`<button data-action="deckViewSphere" data-value="${k}" class="${deckView.sphere===k?'primary':''}">${k?esc(P.SPHERES[k]):'全部'}</button>`).join('')}</div>
 <section class="deck-list">${list.map(d=>deckCard(d,deckActions(d))).join('')||'<p class="empty">没有匹配的牌组。</p>'}</section>`;
}
function bindDecks(){const s=document.querySelector('#deck-search');if(s)s.oninput=()=>{deckView.text=s.value;render();};const o=document.querySelector('#deck-sort');if(o)o.onchange=()=>{deckView.sort=o.value;render();};const f=document.querySelector('#deck-import-file');if(f)f.onchange=async ev=>{const file=ev.target.files[0];if(!file)return;try{const d=P.importDeck(JSON.parse(await file.text()),snapshot);const s=saveDeck({...d,id:'custom-'+Date.now()});render();toast((s.name!==d.name?'检测到同名牌组，已命名为「'+s.name+'」。':'')+'牌组已保存到「我的卡组」。');}catch(e){toast('导入失败：'+e.message);}finally{ev.target.value='';}};}
async function handleDecks(b){const a=b.dataset.action,id=b.dataset.deck;
 if(a==='deckViewTab'){deckView.tab=b.dataset.value;render();return true;}
 if(a==='deckViewSphere'){deckView.sphere=b.dataset.value;render();return true;}
 if(a==='deckImportUrl'){const input=document.querySelector('#deck-import-url'),raw=String(input&&input.value||'').trim(),m=raw.match(/(?:decklist|deck)\/(?:view\/)?(\d+)/i)||raw.match(/^(\d+)$/);if(!m){toast('无法识别牌组编号；示例 https://ringsdb.com/decklist/view/12345');return true;}const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),15000);try{const res=await fetch('https://ringsdb.com/api/public/decklist/'+m[1],{signal:ctrl.signal,headers:{Accept:'application/json'}});if(!res.ok)throw Error('RingsDB 返回 HTTP '+res.status);const d=P.fromRingsdb(await res.json()),r=P.validateDeck(d,snapshot),s=saveDeck(d);render();toast((s.name!==d.name?'检测到同名牌组，已命名为「'+s.name+'」。':'')+(r.valid?'已保存 RingsDB 牌组：'+s.name:'已保存 '+s.name+'，但构筑未通过：'+r.errors.slice(0,2).join('；')));}catch(e){toast(e.name==='AbortError'?'RingsDB 请求超时（15秒）；国内网络通常无法访问':'导入失败：'+e.message);}finally{clearTimeout(timer);}return true;}
 if(a==='deckNew'){startBuild();tab='decks';render();return true;}
 if(a==='deckBack'){building=false;render();return true;}
 if(a==='deckBackTo'){const d=deckById(id);if(!d){toast('原牌组已不存在。');return true;}if(!confirm('放弃当前未保存的改动，回到「'+d.name+'」？'))return true;startBuild(id);tab='decks';render();toast('已回填原牌组「'+d.name+'」。');return true;}
 if(a==='deckImportShare'){const raw=String(document.querySelector('#deck-import-share')?.value||'').trim(),m=raw.match(/[#&]deck=([A-Za-z0-9_-]+)/),code=m?m[1]:raw;if(!code){toast('请粘贴完整的分享链接或分享码。');return true;}try{const {deck,unknown}=P.decodeDeck(code,snapshot),r=P.validateDeck(deck,snapshot),tail=unknown.length?'；有 '+unknown.length+' 张卡不在基础版卡池':'';draft=JSON.parse(JSON.stringify(deck));builderOrigin='';building=true;tab='decks';render();toast(r.valid?'已读取分享牌组「'+deck.name+'」'+tail:'已读取分享牌组「'+deck.name+'」，但构筑未通过：'+r.errors.slice(0,2).join('；')+tail);}catch(e){toast('分享链接无效：'+e.message);}return true;}
 if(a==='deckEdit'){startBuild(id);tab='decks';render();return true;}
 if(a==='deckExport'){const d=deckById(id);if(d)download(P.exportDeck(d),(d.name||'deck')+'.json');return true;}
 if(a==='deckDelete'){const d=deckById(id);if(!d)return true;if(!confirm('删除牌组「'+d.name+'」？此操作不可撤销。'))return true;removeDeck(id);render();toast('已删除。');return true;}
 if(a==='deckUse'){const d=deckById(id);if(!d)return true;setupDraft.decks[0]=id;tab='table';render();toast('已把「'+d.name+'」设为玩家1牌组；点开始远征时确认。');return true;}
 return false;
}
function deckGrid(picks,player){return `<div class="deck-grid">${sortedDecks(decks()).map(d=>deckCard(d,`<button class="${picks[player]===d.id?'primary':''}" data-action="chooserPick" data-deck="${esc(d.id)}" data-player="${player}">${picks[player]===d.id?'已选':'选用'}</button>`,picks[player]===d.id?'is-selected':'')).join('')}</div>`;}
return {builder,isBuilding,startBuild,openSharedDeck,shareLink,bind,handle,configs,registered,handPanel,getSnapshot:()=>snapshot,decks,decksPage,bindDecks,handleDecks,deckGrid,deckById,deckName,saveDeck,loadDeck,removeDeck,deckInfo};
})();
