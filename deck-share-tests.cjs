const test=require('node:test'),assert=require('node:assert/strict'),P=require('./player-cards.js'),S=require('./ringsdb-snapshot.js');
const by=P.index(S);

/* 分享链接：encodeDeck / decodeDeck 必须是无损且抗篡改的往返。
 * 这几条守的是「别人发来的链接能打开成同一副牌」，以及坏链接不会拖着启动流程一起崩。 */

test('a deck survives an encode/decode round trip unchanged',()=>{
  for(const sp of ['leadership','tactics','spirit','lore']){
    const deck=P.starter(S,sp),code=P.encodeDeck(deck),back=P.decodeDeck(code,S);
    assert.deepEqual(P.exportDeck(back.deck),P.exportDeck(deck),sp);
    assert.deepEqual(back.unknown,[],sp);
  }
});

test('shared codes only use URL and chat safe characters',()=>{
  const deck=P.starter(S,'spirit'),code=P.encodeDeck(deck);
  /* base64url 之外一个都不能有：'+' '/' '=' 在聊天软件和 URL 解析里会被吃掉或转义。 */
  assert.match(code,/^[A-Za-z0-9_-]+$/);
  assert(code.length<800,'分享码应短到能直接贴进聊天框，实际 '+code.length);
});

test('a standard built deck round trips and keeps per-card counts',()=>{
  const deck=P.starter(S,'leadership');
  deck.mode='standard';
  /* 用牌库里真实的领导力盟友，别用英雄代码：英雄走 heroes 不走 slots。 */
  deck.slots['01013']=3;
  deck.slots['01014']=2;
  const back=P.decodeDeck(P.encodeDeck(deck),S);
  assert.equal(back.deck.slots['01013'],3);
  assert.equal(back.deck.slots['01014'],2);
  assert.equal(back.deck.mode,'standard');
});

test('codes pointing at cards outside the snapshot are reported, not silently dropped',()=>{
  const deck=P.starter(S,'spirit');
  /* 手工构造带陌生代码的载荷：模拟别人用扩展包组的牌。 */
  const payload={n:'扩展牌组',m:'standard',h:['01007'],s:{'01014':2,'99999':3,'01008':1}};
  const encoded=Buffer.from(JSON.stringify(payload),'utf8').toString('base64url');
  const back=P.decodeDeck(encoded,S);
  assert.deepEqual(back.unknown.sort(),['01008','99999'],'英雄代码误写进牌表也应被识别为未知');
  assert.equal(back.deck.slots['01014'],2);
  assert.equal(back.deck.slots['99999'],undefined);
});

test('malformed payloads throw instead of returning a half-built deck',()=>{
  assert.throws(()=>P.decodeDeck('not-base64-!!!',S));
  assert.throws(()=>P.decodeDeck(Buffer.from('{"n":"空"}').toString('base64url'),S),/英雄/);
  assert.throws(()=>P.decodeDeck(Buffer.from('{"h":["01007"]}').toString('base64url'),S),/牌表/);
});

test('absurd counts are clamped to the cards deck limit',()=>{
  const payload={n:'超量',m:'standard',h:['01007'],s:{'01014':99}};
  const back=P.decodeDeck(Buffer.from(JSON.stringify(payload)).toString('base64url'),S);
  assert.equal(back.deck.slots['01014'],by['01014'].deckLimit);
});

test('deck names survive non-ASCII text without breaking the URL',()=>{
  const deck=P.starter(S,'spirit');
  deck.name='精神 · 测试牌组（中文名 + English）';
  const back=P.decodeDeck(P.encodeDeck(deck),S);
  assert.equal(back.deck.name,deck.name);
});
