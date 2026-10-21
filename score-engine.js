/* 剧本结算计分（官方标准模式 Scoring，原版规则书「Campaign / Scoring」章节）。
   魔力戒 LCG 官方计分公式：
     分数 = 全队最终威胁之和
          + 回合数 × 10
          + 每名被淘汰玩家 × 100
          + 每位英雄受到的伤害点数之和
          - 胜利区卡牌的胜利点数之和
   分数越低越好；结算只在剧本胜利（status === 'won'）时提供，失败局只记录过程不做计分。
   设计说明：本模块纯函数、无副作用、不修改 state，便于单测与 UI 复用。 */

/* 官方难度区间不按分数分档，社区常用「每名玩家」归一化后比较不同人数局。
   这里给出参考评级只作趣味展示，不写入规则判定。 */
const RATINGS = [
  { max: 40, label: '史诗级胜利', note: '威胁控制与资源调度都近乎完美' },
  { max: 70, label: '优秀', note: '全程稳定压制，少数回合被迫应对' },
  { max: 100, label: '良好', note: '按部就班通过，途中吃过不小压力' },
  { max: 140, label: '勉强通过', note: '险象环生，靠意志与运气撑到最后' },
  { max: Infinity, label: '惨胜', note: '几乎被拖垮，但任务仍然完成了' }
];

/* 汇总每位玩家的可计分角色：英雄（含囚犯翻面英雄）。被淘汰玩家的英雄不计伤害（已含 100 分惩罚）。 */
function heroDamage(s) {
  const rows = [];
  for (const p of s.players || []) {
    if (p.eliminated) continue;
    for (const h of p.heroStates || []) {
      const name = (p.heroes && p.heroes[h.index]) || ('英雄' + (h.index + 1));
      rows.push({ player: p.id, playerName: p.name, hero: name, damage: Math.max(0, h.damage || 0), destroyed: !!h.destroyed });
    }
  }
  return rows;
}

/* 胜利区明细：按卡牌聚合，重复卡合并张数，便于面板显示与人工核对。 */
function victoryRows(s) {
  const map = new Map();
  for (const c of s.victory || []) {
    const key = c.id ?? c.name;
    const row = map.get(key) || { name: c.name || '未知卡牌', points: Math.max(0, c.victory || 0), count: 0 };
    row.count += 1;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}

/* 主计分。返回分项明细，UI 直接渲染即可；不读写 state 之外的东西。 */
function score(s) {
  if (!s) return null;
  const players = (s.players || []).filter(p => !p.eliminated);
  const threat = (s.players || []).reduce((n, p) => n + Math.max(0, p.threat || 0), 0);
  const rounds = Math.max(0, s.round || 0);
  const eliminated = (s.players || []).filter(p => p.eliminated).length;
  const damageRows = heroDamage(s);
  const damage = damageRows.reduce((n, r) => n + r.damage, 0);
  const victoryCardRows = victoryRows(s);
  const victoryPoints = (s.victory || []).reduce((n, c) => n + Math.max(0, c.victory || 0), 0);
  const roundPoints = rounds * 10;
  const eliminatedPoints = eliminated * 100;
  const total = threat + roundPoints + eliminatedPoints + damage - victoryPoints;
  const rating = RATINGS.find(r => total <= r.max);
  return {
    done: s.status === 'won',
    status: s.status,
    scenario: s.scenario,
    players: (s.players || []).length,
    difficulty: s.difficulty || 'normal',
    threat,
    threatRows: (s.players || []).map(p => ({ name: p.name, threat: Math.max(0, p.threat || 0), eliminated: !!p.eliminated })),
    rounds,
    roundPoints,
    eliminated,
    eliminatedPoints,
    damage,
    damageRows,
    victoryPoints,
    victoryRows: victoryCardRows,
    total,
    rating: rating.label,
    ratingNote: rating.note,
    /* 每名玩家归一化：人数越多威胁基数越大，横比不同局时用这个。 */
    perPlayer: s.players && s.players.length ? Math.round(total / s.players.length * 10) / 10 : total
  };
}

/* 面板需要的行项目（文案 + 数值 + 说明），集中在这里方便测试与本地化。 */
function lines(s) {
  const r = score(s);
  if (!r) return [];
  return [
    { key: 'threat', label: '最终威胁（全队合计）', value: r.threat, sign: '+', note: r.threatRows.map(t => `${t.name} ${t.threat}`).join(' · ') },
    { key: 'rounds', label: `回合数（${r.rounds} 回合 × 10）`, value: r.roundPoints, sign: '+', note: r.rounds ? `${r.rounds} 个完整回合` : '尚无完整回合' },
    { key: 'eliminated', label: `被淘汰玩家（${r.eliminated} 人 × 100）`, value: r.eliminatedPoints, sign: '+', note: r.eliminated ? '每名淘汰玩家 +100' : '无人淘汰' },
    { key: 'damage', label: '英雄伤害合计', value: r.damage, sign: '+', note: r.damageRows.filter(d => d.damage).map(d => `${d.hero} ${d.damage}`).join(' · ') || '英雄均无伤' },
    { key: 'victory', label: `胜利区点数（${(s.victory || []).length} 张）`, value: r.victoryPoints, sign: '-', note: r.victoryRows.map(v => `${v.name}${v.count > 1 ? ' ×' + v.count : ''} ${v.points}`).join(' · ') || '胜利区为空' }
  ];
}

const ScoreEngine = { score, lines, heroDamage, victoryRows, RATINGS };
if (typeof module !== 'undefined') module.exports = ScoreEngine;
