import { useGame } from '../game/store';
import { handSize } from '../game/rules';
import { PERSONALITY_LABEL } from '../game/names';

export function TopBar() {
  const game = useGame((s) => s.game);
  if (!game) return null;
  const target = game.config.targetVp;

  return (
    <div className="top-bar">
      {game.players.map((p) => {
        const active = game.current === p.id && game.winner === null;
        const threat = p.vp >= target - 2 && game.winner === null;
        const cards = handSize(p);
        return (
          <div key={p.id}
            className={`player-chip ${active ? 'active' : ''} ${threat ? 'threat' : ''}`}
            style={{ ['--pc' as any]: p.color }}
          >
            <div className="chip-portrait">{p.emoji}</div>
            <div className="chip-info">
              <div className="chip-name">
                {p.name}
                {game.longestRoad?.owner === p.id && <span title="Longest road (+2 VP)"> 🛣️</span>}
              </div>
              <div className="chip-sub">
                {p.civTitle ? <span className="civ-title">{p.civTitle}</span>
                  : <span className="dim">{p.isNpc ? PERSONALITY_LABEL[p.personality] : 'Human Sovereign'}</span>}
              </div>
              <div className="chip-stats">
                <span className="vp">⭐ {p.vp}<span className="dim">/{target}</span></span>
                <span className="cards">🂠 {cards}</span>
                {active && game.phase !== 'gameover' && (
                  <span className="turn-dot">
                    {p.isNpc ? 'thinking…' : 'your turn'}
                  </span>
                )}
                {threat && <span className="threat-tag">⚠ near victory</span>}
              </div>
            </div>
            {p.speech && <div className="speech-bubble">{p.speech}</div>}
          </div>
        );
      })}
    </div>
  );
}
