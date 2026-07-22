import { useMemo, useState } from 'react';
import { useGame } from '../game/store';
import { MatchState } from '../game/types';
import { sfx } from '../audio/sfx';

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
  return { sheepTotal, bestRoll, bestRollN, angriest, strongestName, banker, mostRobbed };
}

export function VictoryScreen() {
  const game = useGame((s) => s.game);
  const rematch = useGame((s) => s.rematch);
  const goSetup = useGame((s) => s.goSetup);
  const goTitle = useGame((s) => s.goTitle);
  const [showStats, setShowStats] = useState(false);
  const [skipped, setSkipped] = useState(false);

  const confetti = useMemo(() => Array.from({ length: 60 }, (_, i) => ({
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
        <h1 className="victory-name" style={{ color: winner.color }}>{winner.name}</h1>
        <div className="victory-sub">
          {winner.civTitle ? `${winner.civTitle} — ` : ''}wins with <b>{winner.vp} victory points</b> after {game.turnCount} turns
        </div>

        <div className="ranking">
          {ranked.map((p, i) => (
            <div key={p.id} className="rank-row" style={{ ['--pc' as any]: p.color }}>
              <span className="rank-pos">{['🥇', '🥈', '🥉', '🏳'][i] ?? '🏳'}</span>
              <span className="rank-name">{p.emoji} {p.name}</span>
              <span className="rank-vp">⭐ {p.vp}</span>
              <span className="dim tiny">{p.stats.produced} produced · {p.stats.roadsBuilt} roads</span>
            </div>
          ))}
        </div>

        <button className="btn btn-ghost" onClick={() => { sfx.click(); setShowStats(!showStats); }}>
          {showStats ? '▲ hide' : '▼ RIDICULOUS STATISTICS'}
        </button>

        {showStats && (
          <div className="stats-grid">
            <div className="stat"><b>Rounds survived</b><span>{game.round}</span></div>
            <div className="stat"><b>Most suspicious dice roll</b><span>{abs.bestRoll} (appeared {abs.bestRollN}×)</span></div>
            <div className="stat"><b>Sheep economically mobilized</b><span>{abs.sheepTotal}</span></div>
            <div className="stat"><b>Settlement with the strongest name</b><span>{abs.strongestName}</span></div>
            {abs.angriest && <div className="stat"><b>Highest unresolved anger</b><span>{abs.angriest.emoji} {abs.angriest.name} ({abs.angriest.stats.tradesRejected + abs.angriest.stats.timesRobbed} grievances)</span></div>}
            <div className="stat"><b>Responsible for the market situation</b><span>{abs.banker.emoji} {abs.banker.name} ({abs.banker.stats.tradesBank} bank trades)</span></div>
            <div className="stat"><b>Most robbed</b><span>{abs.mostRobbed.emoji} {abs.mostRobbed.name} ({abs.mostRobbed.stats.timesRobbed}×)</span></div>
            <div className="stat"><b>Longest road</b><span>{game.longestRoad ? `${game.players[game.longestRoad.owner].name} (${game.longestRoad.length} segments)` : 'nobody bothered (min 5)'}</span></div>
            <div className="stat"><b>Biggest single harvest</b><span>{Math.max(...game.players.map((p) => p.stats.biggestHarvest))} cards</span></div>
            <div className="stat"><b>World seed</b><span>{game.config.seed}</span></div>
          </div>
        )}

        <div className="victory-btns">
          <button className="btn btn-big btn-gold" onClick={() => { sfx.click(); rematch(false); }}>🌍 NEW WORLD</button>
          <button className="btn btn-big" onClick={() => { sfx.click(); rematch(true); }}>🔁 REMATCH (same seed)</button>
          <button className="btn btn-ghost" onClick={() => { sfx.click(); goSetup(); }}>⚙ change settings</button>
          <button className="btn btn-ghost" onClick={() => { sfx.click(); goTitle(); }}>🏠 title</button>
        </div>
      </div>
    </div>
  );
}
