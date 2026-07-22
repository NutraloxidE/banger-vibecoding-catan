import { useEffect, useMemo } from "react";
import { useStore } from "../store/store";
import { audio } from "../fx/audio";
import type { GameState } from "../game/types";

function computeStats(game: GameState) {
  const useful: [string, string][] = [];
  const absurd: [string, string][] = [];

  const totalProduced = Object.values(game.stats.produced).reduce((a, b) => a + b, 0);
  useful.push(["Total resources produced", String(totalProduced)]);
  useful.push(["Trades completed", String(game.stats.trades)]);
  useful.push(["Turns played", String(game.turnNumber)]);
  useful.push(["Longest road", `${game.longestRoadLen} segments`]);
  useful.push(["Sevens rolled", String(game.stats.sevensRolled)]);

  // highest civ tier
  const tiers = Object.values(game.buildings).map((b) => b.kind);
  const tier = tiers.includes("megacity") ? "Mega City" : tiers.includes("city") ? "City" : "Settlement";
  useful.push(["Highest civilization tier", tier]);

  // most suspicious dice roll
  const rollEntries = Object.entries(game.stats.rollCounts).sort((a, b) => b[1] - a[1]);
  if (rollEntries.length) absurd.push(["Most suspicious dice roll", `${rollEntries[0][0]} (×${rollEntries[0][1]})`]);

  absurd.push(["Sheep economically mobilized", String(game.stats.sheepMobilized)]);
  absurd.push(["Robber deployments", String(game.stats.robberMoves)]);

  // strongest settlement name (longest)
  const names = Object.values(game.buildings).map((b) => b.name);
  const strongest = names.sort((a, b) => b.length - a.length)[0];
  if (strongest) absurd.push(["Settlement with the strongest name", strongest]);

  // NPC with highest unresolved anger
  let angriest = "Nobody, for once";
  let maxAnger = 0;
  for (const p of game.players) {
    const anger = Object.values(p.grudges).reduce((a, b) => a + b, 0);
    if (anger > maxAnger) {
      maxAnger = anger;
      angriest = p.name;
    }
  }
  absurd.push(["Highest unresolved anger", angriest]);
  absurd.push(["Avoidable economic decisions", String(game.stats.trades + game.stats.robberMoves)]);

  return { useful, absurd };
}

export function VictoryScreen() {
  const game = useStore((s) => s.game)!;
  const startGame = useStore((s) => s.startGame);
  const goSetup = useStore((s) => s.goSetup);
  const setDraft = useStore((s) => s.setDraft);
  const randomizeSeed = useStore((s) => s.randomizeSeed);

  const winner = game.players[game.winner!];
  const ranking = [...game.players].sort((a, b) => b.victoryPoints - a.victoryPoints);
  const stats = useMemo(() => computeStats(game), [game]);

  useEffect(() => {
    audio.victory();
    audio.setIntensity(1);
  }, []);

  const rematchSameSeed = () => {
    setDraft({ ...game.settings });
    startGame();
  };
  const restartSame = () => {
    setDraft({ ...game.settings });
    randomizeSeed();
    startGame();
  };
  const newWorld = () => {
    randomizeSeed();
    startGame();
  };

  return (
    <div className="victory-root" style={{ ["--win" as any]: winner.color }}>
      <div className="confetti">
        {Array.from({ length: 40 }, (_, i) => (
          <span key={i} className="confetti-bit" style={{ left: `${(i * 2.5) % 100}%`, animationDelay: `${(i % 10) * 0.15}s`, background: game.players[i % game.players.length].color }} />
        ))}
      </div>
      <div className="victory-card">
        <div className="victory-crown">👑</div>
        <h1 className="victory-name" style={{ color: winner.color }}>
          {winner.name} WINS
        </h1>
        <p className="victory-sub">
          {winner.victoryPoints} victory points · seed {game.settings.seed}
        </p>

        <div className="ranking">
          {ranking.map((p, i) => (
            <div key={p.index} className="rank-row" style={{ borderColor: p.color }}>
              <span className="rank-pos">#{i + 1}</span>
              <span className="rank-dot" style={{ background: p.color }} />
              <span className="rank-name">{p.name}</span>
              <span className="rank-vp">{p.victoryPoints} VP</span>
            </div>
          ))}
        </div>

        <div className="stats-cols">
          <div className="stats-col">
            <h4>Match Report</h4>
            {stats.useful.map(([k, v]) => (
              <div key={k} className="stat-line">
                <span>{k}</span>
                <b>{v}</b>
              </div>
            ))}
          </div>
          <div className="stats-col absurd">
            <h4>Ridiculous Statistics</h4>
            {stats.absurd.map(([k, v]) => (
              <div key={k} className="stat-line">
                <span>{k}</span>
                <b>{v}</b>
              </div>
            ))}
          </div>
        </div>

        <div className="victory-actions">
          <button className="btn" onClick={rematchSameSeed}>♻ Rematch (same seed)</button>
          <button className="btn" onClick={restartSame}>🔁 Same settings, new map</button>
          <button className="btn" onClick={newWorld}>🌍 New world</button>
          <button className="btn btn-ghost" onClick={goSetup}>⚙ Return to setup</button>
        </div>
      </div>
    </div>
  );
}
