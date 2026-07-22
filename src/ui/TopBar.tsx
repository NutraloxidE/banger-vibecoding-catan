import { useStore } from "../store/store";
import { PERSONALITY_INFO } from "../game/constants";
import { totalCards } from "../game/rules";

export function TopBar() {
  const game = useStore((s) => s.game);
  useStore((s) => s.tick);
  if (!game) return null;
  const target = game.settings.victoryTarget;
  const leader = Math.max(...game.players.map((p) => p.victoryPoints));

  return (
    <div className="topbar">
      {game.players.map((p) => {
        const active = p.index === game.current;
        const cards = totalCards(p.resources);
        const nearWin = p.victoryPoints >= target - 1;
        const isLeader = p.victoryPoints === leader && leader > 0;
        const pers = PERSONALITY_INFO[p.personality];
        return (
          <div
            key={p.index}
            className={`player-card${active ? " active" : ""}${nearWin ? " danger" : ""}`}
            style={{ borderColor: p.color }}
          >
            <div className="pc-top">
              <span className="pc-avatar" style={{ background: p.color }}>
                {p.isHuman ? "🙂" : pers.emoji}
              </span>
              <div className="pc-id">
                <div className="pc-name">
                  {p.name}
                  {isLeader && <span className="crown">👑</span>}
                </div>
                <div className="pc-pers">{p.isHuman ? "You" : pers.label}</div>
              </div>
              <div className="pc-vp" title="Victory points">
                {p.victoryPoints}
                <small>/{target}</small>
              </div>
            </div>
            <div className="pc-bar">
              <div
                className="pc-bar-fill"
                style={{ width: `${Math.min(100, (p.victoryPoints / target) * 100)}%`, background: p.color }}
              />
            </div>
            <div className="pc-meta">
              <span className="pc-cards" title="cards in hand">🃏 {cards}</span>
              {active && <span className="pc-turn">● thinking</span>}
              {nearWin && <span className="pc-danger">MATCH POINT</span>}
            </div>
            {p.lastLine && !p.isHuman && <div className="speech">{p.lastLine}</div>}
          </div>
        );
      })}
    </div>
  );
}
