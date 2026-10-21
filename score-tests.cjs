/* 结算计分（score-engine.js）的纯函数回归。
   公式依据原版规则书 Scoring：威胁合计 + 回合数×10 + 淘汰人数×100 + 英雄伤害 − 胜利区点数。 */
const test = require('node:test'), assert = require('node:assert/strict');
const Score = require('./score-engine.js');

function make(over = {}) {
  const s = {
    status: 'won', scenario: 'anduin', difficulty: 'normal', round: 5,
    players: [
      { id: 0, name: '玩家1', threat: 30, eliminated: false, heroes: ['阿拉贡', '希奥德雷德', '葛罗因'], heroStates: [{ index: 0, damage: 0 }, { index: 1, damage: 2 }, { index: 2, damage: 1 }], engaged: [] },
      { id: 1, name: '玩家2', threat: 25, eliminated: false, heroes: ['金雳', '莱戈拉斯', '沙林'], heroStates: [{ index: 0, damage: 0 }, { index: 1, damage: 0 }, { index: 2, damage: 3 }], engaged: [] }
    ],
    victory: [{ id: 82, name: '山丘巨魔', victory: 5 }, { id: 96, name: '幽暗密林蜘蛛', victory: 1 }, { id: 96, name: '幽暗密林蜘蛛', victory: 1 }],
    ...over
  };
  return s;
}

test('总分严格按官方公式相加', () => {
  const r = Score.score(make());
  assert.equal(r.threat, 55, '威胁 30+25');
  assert.equal(r.rounds, 5);
  assert.equal(r.roundPoints, 50, '5 回合 × 10');
  assert.equal(r.eliminated, 0);
  assert.equal(r.eliminatedPoints, 0);
  assert.equal(r.damage, 6, '2+1+3');
  assert.equal(r.victoryPoints, 7, '5+1+1');
  assert.equal(r.total, 55 + 50 + 0 + 6 - 7);
  assert.equal(r.done, true);
});

test('胜利区同名牌合并张数并降序排列', () => {
  const rows = Score.victoryRows(make());
  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, '山丘巨魔');
  assert.equal(rows[0].points, 5);
  const spider = rows.find(r => r.name === '幽暗密林蜘蛛');
  assert.equal(spider.count, 2, '两只蜘蛛合并');
  assert.equal(spider.points, 1, '单张点数，不是合并后累加');
});

test('每名被淘汰玩家计 100 分且其英雄伤害不再重复计入', () => {
  const s = make();
  s.players[1].eliminated = true;
  const r = Score.score(s);
  assert.equal(r.eliminated, 1);
  assert.equal(r.eliminatedPoints, 100);
  assert.equal(r.damage, 3, '只统计未淘汰玩家的英雄伤害 2+1');
  assert.equal(r.total, 55 + 50 + 100 + 3 - 7);
});

test('英雄伤害为负或缺失时按 0 计，威胁同理', () => {
  const s = make();
  s.players[0].heroStates[1].damage = -4;
  s.players[1].threat = undefined;
  const r = Score.score(s);
  assert.equal(r.damage, 4, '负伤害不计，实际 1（葛罗因）+3（沙林）');
  assert.equal(r.threat, 30, '缺失威胁按 0');
  assert(Number.isFinite(r.total));
});

test('已完成与未完成局区分：未胜利时 done 为 false 但仍可计分', () => {
  const r = Score.score(make({ status: 'playing' }));
  assert.equal(r.done, false);
  assert.equal(r.status, 'playing');
  assert(Number.isFinite(r.total));
});

test('perPlayer 归一化保留 1 位小数，便于跨人数比较', () => {
  const r = Score.score(make());
  assert.equal(r.perPlayer, Math.round(r.total / 2 * 10) / 10);
});

test('lines 输出五项分项，胜利项为负号', () => {
  const rows = Score.lines(make());
  assert.deepEqual(rows.map(r => r.key), ['threat', 'rounds', 'eliminated', 'damage', 'victory']);
  assert.equal(rows.find(r => r.key === 'victory').sign, '-');
  assert(rows.filter(r => r.key !== 'victory').every(r => r.sign === '+'));
  for (const r of rows) assert.equal(typeof r.label, 'string');
});

test('空胜利区与零回合不报错', () => {
  const s = make({ victory: [], round: 0 });
  const r = Score.score(s);
  assert.equal(r.victoryPoints, 0);
  assert.equal(r.roundPoints, 0);
  assert.equal(r.total, 55 + 6);
  assert.equal(Score.lines(s).find(x => x.key === 'victory').note, '胜利区为空');
});

test('null 输入返回 null 而不是抛错', () => {
  assert.equal(Score.score(null), null);
  assert.deepEqual(Score.lines(null), []);
});

test('评级随总分升高而降档', () => {
  const low = Score.score(make({ round: 1, victory: [{ id: 82, name: '山丘巨魔', victory: 5 }] }));
  const high = Score.score(make({ round: 30, victory: [] }));
  assert.notEqual(low.rating, high.rating);
  assert(Score.RATINGS.every(r => typeof r.label === 'string'));
});
