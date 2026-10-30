/* 牌组重名防呆：保存改名、同名来源徽标与稳定排序；纯 Node，无浏览器。
 * 覆盖 team-lead 指定的四个用例，另加导入路径 saveDeck 与两处渲染的顺序断言。 */
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),P=require('./player-cards.js'),S=require('./ringsdb-snapshot.js');
const clone=x=>JSON.parse(JSON.stringify(x));
function environment(savedDecks=[]){
 const toasts=[],inputs={};
 const ctx=vm.createContext({
  PlayerCards:P,RINGSDB_SNAPSHOT:S,
  ImageLibrary:{art:()=>'',safeUrl:u=>String(u||''),by:{},bindErrors(){}},
  document:{querySelector:s=>{const id=s.slice(1);return id in inputs?{value:inputs[id]}:null;},querySelectorAll:()=>[],createElement:()=>({click(){}}),body:{append(){}}},
  localStorage:{getItem:k=>k==='lotr-saved-decks-v1'?JSON.stringify(savedDecks):null,setItem(){},removeItem(){}},
  toast:m=>toasts.push(String(m)),choose:async()=>null,confirm:()=>true,render(){},
  setTimeout:()=>1,clearTimeout(){},console,
  state:{players:[]},PlanningUI:{},setupDraft:{decks:[]},
  navigator:{},Blob:function(){},URL:{createObjectURL:()=>'',revokeObjectURL(){}},
  location:{protocol:'file:',hash:'',pathname:'/',search:''},window:{history:null},
 });
 vm.runInContext(fs.readFileSync(__dirname+'/player-ui.js','utf8'),ctx,{filename:'player-ui.js'});
 return {ctx,toasts,inputs,UI:vm.runInContext('PlayerUI',ctx)};
}
/* savedDecks 的元素要能过 player-ui 的载入校验：id 字符串 + heroes 数组 + slots 对象 + name 字符串。 */
const savedEntry=(id,name)=>({id,name,mode:'starter',heroes:['01001'],slots:{'01014':2}});
const cardOrder=html=>[...html.matchAll(/<article class="deck-card[^"]*" data-deck="([^"]+)"/g)].map(m=>m[1]);

test('新增保存与现有牌组同名时自动改名「（副本）」，并在 toast 里说明',async()=>{
 const e=environment([savedEntry('custom-1','领导基础教学牌组')]);
 e.UI.startBuild('starter-leadership');            /* 草稿 = 预组副本，id 会被改写为 custom-*，即「新增」 */
 e.inputs['pc-name']='领导基础教学牌组';e.inputs['pc-mode']='starter';
 await e.UI.handle({dataset:{pc:'save'}});
 const mine=e.UI.decks().filter(d=>String(d.id).startsWith('custom-'));
 assert.equal(mine.length,2);                            /* 预置的 custom-1 + 本次新增 */
 assert.equal(mine.find(d=>d.id!=='custom-1').name,'领导基础教学牌组（副本）');
 assert.equal(e.UI.decks().find(d=>d.id==='starter-leadership').name,'领导基础教学牌组'); /* 预组原件不被波及 */
 assert(e.toasts.some(t=>t.includes('检测到同名牌组')&&t.includes('已命名为「领导基础教学牌组（副本）」')));
});

test('「（副本）」也被占用时继续递增序号到「（副本 2）」',async()=>{
 const e=environment([savedEntry('custom-1','领导基础教学牌组'),savedEntry('custom-2','领导基础教学牌组（副本）')]);
 e.UI.startBuild('starter-leadership');
 e.inputs['pc-name']='领导基础教学牌组';e.inputs['pc-mode']='starter';
 await e.UI.handle({dataset:{pc:'save'}});
 const mine=e.UI.decks().filter(d=>String(d.id).startsWith('custom-'));
 assert.equal(mine.length,3);
 /* vm 沙箱 realm 的 Array 原型与宿主不同，deepStrictEqual 会按原型判不等；先展开成宿主数组。 */
 assert.deepEqual([...mine.map(d=>d.name)],['领导基础教学牌组','领导基础教学牌组（副本）','领导基础教学牌组（副本 2）']);
 assert(e.toasts.some(t=>t.includes('（副本 2）')));
});

test('编辑既有牌组（i>=0）保存时不触发改名',async()=>{
 const e=environment([savedEntry('custom-1','领导基础教学牌组')]);
 e.UI.startBuild('custom-1');                      /* 载入自建牌组：id 保持 custom-1，走覆盖分支 */
 e.inputs['pc-name']='领导基础教学牌组';e.inputs['pc-mode']='starter';
 await e.UI.handle({dataset:{pc:'save'}});
 const mine=e.UI.decks().filter(d=>String(d.id).startsWith('custom-'));
 assert.equal(mine.length,1);
 assert.equal(mine[0].name,'领导基础教学牌组');
 assert(!e.toasts.some(t=>t.includes('检测到同名牌组')));
});

test('新增保存但名称不重复时不改名、不出提示',async()=>{
 const e=environment([savedEntry('custom-1','领导基础教学牌组')]);
 e.UI.startBuild('starter-tactics');
 e.inputs['pc-name']='孤例独名牌组';e.inputs['pc-mode']='starter';
 await e.UI.handle({dataset:{pc:'save'}});
 const mine=e.UI.decks().filter(d=>String(d.id).startsWith('custom-'));
 assert.equal(mine.length,2);
 assert.equal(mine.find(d=>d.name==='孤例独名牌组')?.name,'孤例独名牌组');
 assert(!e.toasts.some(t=>t.includes('检测到同名牌组')));
});

test('导入路径 saveDeck 同样防呆：同名改「（副本）」，再撞名递增「（副本 2）」',()=>{
 const e=environment([]);
 /* 两个不同来源（不同 id）的同名导入：各自都是新增，才会触发防呆；同 id 重复导入走覆盖分支。 */
 const first=e.UI.saveDeck({...clone(P.starter(S,'leadership')),id:'ringsdb-1'});
 assert.equal(first.name,'领导基础教学牌组（副本）');   /* 与预组同名 → 改名 */
 const again=e.UI.saveDeck({...clone(P.starter(S,'leadership')),id:'ringsdb-2'});
 assert.equal(again.name,'领导基础教学牌组（副本 2）'); /* 「（副本）」已占用 → 序号 */
 const free=e.UI.saveDeck({...clone(P.starter(S,'tactics')),id:'ringsdb-3',name:'全新独有牌组'});
 assert.equal(free.name,'全新独有牌组');              /* 不重名则原样保留 */
 /* 同 id 再导入 = 编辑覆盖：名字维持原样、条目数不变，这是既有语义。 */
 const overwrite=e.UI.saveDeck({...clone(P.starter(S,'lore')),id:'ringsdb-3',name:'全新独有牌组'});
 assert.equal(overwrite.name,'全新独有牌组');
 assert.equal(e.UI.decks().filter(d=>String(d.id).startsWith('ringsdb')).length,3);
});

test('同名不止一副时卡牌在 h2 后标注来源徽标；名字唯一时不标注',()=>{
 const dup=environment([savedEntry('custom-1','领导基础教学牌组')]);
 const html=dup.UI.decksPage();
 assert(html.includes('<h2>领导基础教学牌组 <span class="badge">预组</span></h2>'));
 assert(html.includes('<h2>领导基础教学牌组 <span class="badge">自定义</span></h2>'));
 const unique=environment([savedEntry('custom-1','与预组不同名的牌组')]);
 assert(!/<h2>[^<]*<span class="badge">/.test(unique.UI.decksPage()));
});

test('稳定排序：预组按固定球色顺序在前，自建按名称 localeCompare("zh")，两处渲染一致',()=>{
 const e=environment([savedEntry('custom-a','阿牌组'),savedEntry('custom-b','中牌组')]);
 for(const html of [e.UI.decksPage(),e.UI.deckGrid({},0)]){
  const order=cardOrder(html);
  assert.deepEqual(order.slice(0,4),['starter-leadership','starter-tactics','starter-spirit','starter-lore']);
  assert.deepEqual(order.slice(4),['custom-a','custom-b']);   /* 阿(a) < 中(zh)，且都在预组之后 */
 }
});
