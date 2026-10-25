/* v0.15.60 行动窗口「跳过语义」回归。

   三件事必须同时成立，少一件就说明静默机制退回到「要么全问、要么全不问」：
   1. options() 返回 {list, blocked}，blocked 带引擎给出的中文理由。
      以前这类来源被直接丢弃：卡在场却不响应，玩家无从判断是规则还是 bug。
   2. 「本次跳过」只让过当前窗口。key 含回合+阶段，阶段推进后同一张卡应重新出现。
      以前 mute() 只写永久记录，一次跳过等于整局消失。
   3. restore() 清空全部记录、unmute() 只清指定记录，两者都留日志。 */
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const Factory = require(path.join(ROOT, 'window-engine.js'));

/* 最小假 E：只实现 WindowRulesFactory 真正用到的接口。
   legal 决定这个来源此刻能不能用；reason 是引擎给出的中文否决理由。 */
function makeEngine({ legal = false, reason = '', chars } = {}) {
  const state = {
    status: 'playing', round: 1, phase: 4, log: [], pending: [], objectives: [],
    windowPrefs: { mode: 'smart', muted: [] },
    players: [{ id: 0, eliminated: false, hand: [] }, { id: 1, eliminated: false, hand: [] }],
  };
  const src = chars || [{ uid: 8, kind: 'hero', controller: 0, meta: { code: 'K2', nameZh: '测试英雄' } }];
  const planning = {
    window: () => ({ kind: 'action' }),
    context: () => ({ step: 'action', completed: false, closing: false, halted: false,
      queue: [], tasks: [], current: null, finalPasses: [] }),
    chars: () => src, attaches: () => [], active: () => 0, restrictedOn: () => [],
    data: () => ({}), eventTiming: () => null, passAction: () => {}, finish: () => {},
    abilitySpec: () => ({ legal, reason, fields: [] }),
    playSpec: () => ({ legal: false, reason: '', fields: [] }),
  };
  const E = {
    planning, questing: { move: () => {} }, traveling: { finish: () => {} },
    encountering: { beginChecks: () => {}, finish: () => {} },
    combat: { move: () => {} }, refreshing: { finish: () => {} },
    phases: ['资源', '计划', '探险', '旅行', '遭遇', '战斗', '刷新'],
  };
  return { W: Factory(E), state };
}

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); fail++; }
};

console.log('引擎层：');

t('options() 返回 {list, blocked} 而不是裸数组', () => {
  const o = makeEngine().W.options(makeEngine().state);
  assert.ok(o && !Array.isArray(o), 'options() 仍返回数组');
  assert.ok(Array.isArray(o.list) && Array.isArray(o.blocked), 'list/blocked 不是数组');
});

t('在场但不可用的来源进 blocked，并带出引擎理由', () => {
  const { W, state } = makeEngine({ legal: false, reason: '来源已经横置，不能再次支付横置费用' });
  const { blocked, list } = W.options(state);
  assert.strictEqual(list.length, 0, '否决的来源不应进 list');
  assert.strictEqual(blocked.length, 1, 'blocked 数量不对：' + JSON.stringify(blocked));
  assert.strictEqual(blocked[0].name, '测试英雄');
  assert.ok(/横置/.test(blocked[0].reason), '理由丢失：' + blocked[0].reason);
});

t('否决理由不会被误判成合法行动', () => {
  // probe 现在可能返回字符串；若用 if(legal) 判断，理由会被当成真值塞进 list
  const { W, state } = makeEngine({ legal: false, reason: '没有合法目标' });
  assert.strictEqual(W.options(state).list.length, 0, '理由字符串泄漏进了 list');
  assert.strictEqual(W.list(state).length, 0, 'list() 也泄漏了');
});

t('mute 默认只写当前回合+阶段的 key，并留日志', () => {
  const { W, state } = makeEngine({ legal: true });
  const before = state.log.length;
  W.mute(state, 'ability', 0, 8);
  assert.ok(state.log.length > before, 'mute 没有写日志');
  assert.ok(/跳过/.test(state.log[0]), '日志没说明是跳过：' + state.log[0]);
  assert.strictEqual(state.windowPrefs.muted.length, 1);
  assert.ok(state.windowPrefs.muted[0].startsWith('1:4:'), 'key 缺少回合+阶段：' + state.windowPrefs.muted[0]);
  assert.strictEqual(W.list(state)[0].muted, true, 'mute 后选项未被标记静默');
});

t('阶段推进后同一张卡重新可见（once 语义）', () => {
  const { W, state } = makeEngine({ legal: true });
  W.mute(state, 'ability', 0, 8);
  assert.strictEqual(W.list(state)[0].muted, true, '第 4 阶段跳过失败');
  state.phase = 5;                       // 模拟阶段推进
  assert.strictEqual(W.list(state)[0].muted, false, '进入下一阶段后仍被静默：once 语义失效');
});

t('restore() 清空全部并留日志', () => {
  const { W, state } = makeEngine({ legal: true });
  state.windowPrefs.muted = ['1:4:ability:0:8', '1:5:ability:1:9'];
  W.restore(state);
  assert.deepStrictEqual(state.windowPrefs.muted, [], 'restore 没有清空');
  assert.ok(/恢复全部 2 条/.test(state.log[0]), 'restore 日志不对：' + state.log[0]);
});

t('unmute() 只清指定 key', () => {
  const { W, state } = makeEngine({ legal: true });
  state.windowPrefs.muted = ['1:4:ability:0:8', '1:5:ability:1:9'];
  W.unmute(state, 'ability', 0, 8);
  assert.deepStrictEqual(state.windowPrefs.muted, ['1:5:ability:1:9'], 'unmute 误删其它记录');
});

t('mute 的 keep 参数非法时报错', () => {
  const { W, state } = makeEngine({ legal: true });
  assert.throws(() => W.mute(state, 'ability', 0, 8, 'bogus'), /无效的静默范围/);
});

console.log(`\n结果：pass ${pass} / fail ${fail}`);
process.exit(fail ? 1 : 0);
