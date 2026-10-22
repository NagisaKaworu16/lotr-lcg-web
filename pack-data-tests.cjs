const test=require('node:test'),assert=require('node:assert/strict'),D=require('./data.js');

/* 系列包（pack）字段：卡牌库按扩展盒筛选依赖它。
 * 历史上 D.cards / D.quests 完全没有该字段，UI 只能回退 'Core' 兜底，
 * 一旦并入非基础版的遭遇卡，筛选就会把它们全部错算进基础包。 */

test('every encounter card declares a pack code',()=>{
  assert.equal(D.cards.length,45);
  const missing=D.cards.filter(c=>!c.pack);
  assert.equal(missing.length,0,'缺 pack 的遭遇卡：'+missing.map(c=>c.id+':'+c.name).join(', '));
  for(const c of D.cards){
    assert.equal(typeof c.pack,'string',c.id);
    assert.match(c.pack,/^[A-Za-z][A-Za-z0-9'’ -]*$/,`${c.id} 的 pack 应为 RingsDB 风格的 packCode，实际 ${c.pack}`);
  }
});

test('every quest card declares a pack code',()=>{
  assert.equal(D.quests.length,10);
  const missing=D.quests.filter(q=>!q.pack);
  assert.equal(missing.length,0,'缺 pack 的探险卡：'+missing.map(q=>q.id+':'+q.name).join(', '));
  for(const q of D.quests)assert.equal(typeof q.pack,'string',q.id);
});

test('pack codes match the source sets declared in the encounter set table',()=>{
  /* 每条遭遇组都来自基础包：sources 里写的 Core Set 必须能和 pack='Core' 对上，
     否则说明数据和卡面出处不一致。 */
  for(const c of D.cards){
    const src=String(D.sets[c.set]||'');
    if(/Core/i.test(src))assert.equal(c.pack,'Core',`${c.id} 出自 ${src}，pack 应为 Core`);
  }
  for(const q of D.quests)assert.equal(q.pack,'Core',q.id);
});

test('pack codes are stable identifiers usable as catalog filter keys',()=>{
  const codes=new Set([...D.cards,...D.quests].map(c=>c.pack));
  assert.deepEqual([...codes],['Core']);
  for(const code of codes)assert(!/\s{2,}/.test(code),'pack code 不应含连续空格');
});
