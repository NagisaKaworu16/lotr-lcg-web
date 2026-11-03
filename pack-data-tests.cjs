const test=require('node:test'),assert=require('node:assert/strict'),D=require('./data.js');

/* 系列包（pack）字段：卡牌库按扩展盒筛选依赖它。
 * 历史上 D.cards / D.quests 完全没有该字段，UI 只能回退 'Core' 兜底，
 * 一旦并入非基础版的遭遇卡，筛选就会把它们全部错算进基础包。 */

test('every encounter card declares a pack code',()=>{
  assert.equal(D.cards.length,110);
  const missing=D.cards.filter(c=>!c.pack);
  assert.equal(missing.length,0,'缺 pack 的遭遇卡：'+missing.map(c=>c.id+':'+c.name).join(', '));
  for(const c of D.cards){
    assert.equal(typeof c.pack,'string',c.id);
    assert.match(c.pack,/^[A-Za-z][A-Za-z0-9'’ -]*$/,`${c.id} 的 pack 应为 RingsDB 风格的 packCode，实际 ${c.pack}`);
  }
});

test('every quest card declares a pack code',()=>{
  assert.equal(D.quests.length,18);
  const missing=D.quests.filter(q=>!q.pack);
  assert.equal(missing.length,0,'缺 pack 的探险卡：'+missing.map(q=>q.id+':'+q.name).join(', '));
  for(const q of D.quests)assert.equal(typeof q.pack,'string',q.id);
});

test('pack codes match the source sets declared in the encounter set table',()=>{
  /* 每条遭遇组都来自其声明的来源扩展盒：Core / THfG（寻找咕噜）/ TLR（失落的王国）。
     新并入扩展盒时在此登记 pack→遭遇组 允许表，防止数据和卡面出处错配。 */
  const PACK_SETS={
    'THfG':new Set(['The Hunt for Gollum']),
    'TLR':new Set(['Intruders in Chetwood','Angmar Orcs','Eriador Wilds','Iârion',
                   "Deadmen's Dike",'Cursed Dead','Dark Sorcery','The Weather Hills',
                   'Foul Weather','Ruins of Arnor']),
  };
  for(const c of D.cards){
    if(c.pack==='Core')continue;
    const allowed=PACK_SETS[c.pack];
    assert(allowed&&allowed.has(c.set),`${c.id} pack=${c.pack} 与 set=${c.set} 不匹配（未登记的 pack/组）`);
  }
  for(const q of D.quests)
    assert.equal(q.pack,(q.id>=129&&q.id<=131)?'THfG':(q.id>=143?'TLR':'Core'),q.id);
});

test('pack codes are stable identifiers usable as catalog filter keys',()=>{
  const codes=new Set([...D.cards,...D.quests].map(c=>c.pack));
  assert.deepEqual([...codes].sort(),['Core','THfG','TLR']);
  for(const code of codes)assert(!/\s{2,}/.test(code),'pack code 不应含连续空格');
});
