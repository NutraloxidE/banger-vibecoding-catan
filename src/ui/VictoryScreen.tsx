import { useMemo, useState } from 'react';
import { useGame } from '../game/store';
import { MatchState } from '../game/types';
import { sfx } from '../audio/sfx';
import { useT } from './useT';

function computeAbsurdStats(g: MatchState) {
  const sheepTotal = g.players.reduce((n, p) => n + p.stats.producedBy.sheep, 0);
  let bestRoll = 0, bestRollN = -1;
  g.rollCounts.forEach((n, total) => { if (total >= 2 && n > bestRollN) { bestRollN = n; bestRoll = total; } });
  const angriest = [...g.players].filter((p) => p.isNpc)
    .sort((a, b) => (b.stats.tradesRejected + b.stats.timesRobbed) - (a.stats.tradesRejected + a.stats.timesRobbed))[0];
  const buildings = Object.values(g.buildings);
  const strongestName = buildings.length > 0
    ? buildings.reduce((a, b) => (b.name.length > a.name.length ? b : a)).name
    : '—';
  const banker = [...g.players].sort((a, b) => b.stats.tradesBank - a.stats.tradesBank)[0];
  const mostRobbed = [...g.players].sort((a, b) => b.stats.timesRobbed - a.stats.timesRobbed)[0];
  const devBuyer = [...g.players].sort((a, b) => b.stats.devCardsBought - a.stats.devCardsBought)[0];
  return { sheepTotal, bestRoll, bestRollN, angriest, strongestName, banker, mostRobbed, devBuyer };
}

export function VictoryScreen() {
  const game = useGame((s) => s.game);
  const rematch = useGame((s) => s.rematch);
  const goSetup = useGame((s) => s.goSetup);
  const goTitle = useGame((s) => s.goTitle);
  const t = useT();
  const [showStats, setShowStats] = useState(false);
  const [skipped, setSkipped] = useState(false);

  const confetti = useMemo(() => Array.from({ length: 60 }, () => ({
    left: Math.random() * 100,
    delay: Math.random() * 2.5,
    dur: 2.5 + Math.random() * 3,
    hue: Math.floor(Math.random() * 360),
    size: 6 + Math.random() * 8,
  })), []);

  if (!game || game.winner === null) return null;
  const winner = game.players[game.winner];
  const ranked = [...game.players].sort((a, b) => b.vp - a.vp);
  const abs = computeAbsurdStats(game);
  const dName = (p: MatchState['players'][number]) => (p.isNpc ? p.name : t('player.you'));

  const civ = winner.civTitle ? t('victory.civWith', { civ: winner.civTitle }) : '';
  const subtitle = t('victory.subtitle', { civ, vp: winner.vp, turns: game.turnCount });

  return (
    <div className="victory-overlay" onClick={() => setSkipped(true)}>
      {!skipped && confetti.map((c, i) => (
        <span key={i} className="confetti" style={{
          left: `${c.left}%`, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s`,
          background: `hsl(${c.hue} 90% 60%)`, width: c.size, height: c.size * 0.6,
        }} />
      ))}
      <div className="victory-panel" onClick={(e) => e.stopPropagation()}>
        <div className="victory-crown">👑</div>
        <h1 className="victory-name" style={{ color: winner.color }}>{dName(winner)}</h1>
        <div className="victory-sub" dangerouslySetInnerHTML={{ __html: subtitle }} />

        <div className="ranking">
          {ranked.map((p, i) => (
            <div key={p.id} className="rank-row" style={{ ['--pc' as any]: p.color }}>
              <span className="rank-pos">{['🥇', '🥈', '🥉', '🏳'][i] ?? '🏳'}</span>
              <span className="rank-name">{p.emoji} {dName(p)}</span>
              <span className="rank-vp">⭐ {p.vp}</span>
              <span className="dim tiny">{t('victory.rankSub', { produced: p.stats.produced, roads: p.stats.roadsBuilt })}</span>
            </div>
          ))}
        </div>

        <button className="btn btn-ghost" onClick={() => { sfx.click(); setShowStats(!showStats); }}>
          {showStats ? t('victory.hide') : t('victory.stats')}
        </button>

        {showStats && (
          <div className="stats-grid">
            <div className="stat"><b>{t('stat.rounds')}</b><span>{game.round}</span></div>
            <div className="stat"><b>{t('stat.suspiciousRoll')}</b><span>{t('stat.rollAppeared', { roll: abs.bestRoll, n: abs.bestRollN })}</span></div>
            <div className="stat"><b>{t('stat.sheepMobilized')}</b><span>{abs.sheepTotal}</span></div>
            <div className="stat"><b>{t('stat.strongestName')}</b><span>{abs.strongestName}</span></div>
            {abs.angriest && <div className="stat"><b>{t('stat.anger')}</b><span>{t('stat.angerVal', { emoji: abs.angriest.emoji, name: abs.angriest.name, n: abs.angriest.stats.tradesRejected + abs.angriest.stats.timesRobbed })}</span></div>}
            <div className="stat"><b>{t('stat.market')}</b><span>{t('stat.marketVal', { emoji: abs.banker.emoji, name: abs.banker.name, n: abs.banker.stats.tradesBank })}</span></div>
            <div className="stat"><b>{t('stat.mostRobbed')}</b><span>{t('stat.mostRobbedVal', { emoji: abs.mostRobbed.emoji, name: abs.mostRobbed.name, n: abs.mostRobbed.stats.timesRobbed })}</span></div>
            <div className="stat"><b>{t('stat.longestRoad')}</b><span>{game.longestRoad ? t('stat.longestRoadVal', { name: game.players[game.longestRoad.owner].name, n: game.longestRoad.length }) : t('stat.longestRoadNone')}</span></div>
            <div className="stat"><b>{t('stat.largestArmy')}</b><span>{game.largestArmy ? t('stat.largestArmyVal', { name: game.players[game.largestArmy.owner].name, n: game.largestArmy.count }) : t('stat.largestArmyNone')}</span></div>
            {abs.devBuyer.stats.devCardsBought > 0 && <div className="stat"><b>{t('stat.devCards')}</b><span>{t('stat.devCardsVal', { emoji: abs.devBuyer.emoji, name: abs.devBuyer.name, n: abs.devBuyer.stats.devCardsBought })}</span></div>}
            <div className="stat"><b>{t('stat.biggestHarvest')}</b><span>{t('stat.cards', { n: Math.max(...game.players.map((p) => p.stats.biggestHarvest)) })}</span></div>
            <div className="stat"><b>{t('stat.seed')}</b><span>{game.config.seed}</span></div>
          </div>
        )}

        <div className="victory-btns">
          <button className="btn btn-big btn-gold" onClick={() => { sfx.click(); rematch(false); }}>{t('victory.newWorld')}</button>
          <button className="btn btn-big" onClick={() => { sfx.click(); rematch(true); }}>{t('victory.rematch')}</button>
          <button className="btn btn-ghost" onClick={() => { sfx.click(); goSetup(); }}>{t('victory.changeSettings')}</button>
          <button className="btn btn-ghost" onClick={() => { sfx.click(); goTitle(); }}>{t('victory.title')}</button>
        </div>
      </div>
    </div>
  );
}
