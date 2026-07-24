import { useGame } from '../game/store';
import { handSize } from '../game/rules';
import { useT } from './useT';

export function TopBar() {
  const game = useGame((s) => s.game);
  const t = useT();
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
            <div className="chip-portrait-column">
              <div className="chip-portrait">{p.emoji}</div>
              <div className="chip-mobile-stats">
                <span className="vp">⭐ {p.vp}</span>
                <span className="cards">🂠 {cards}</span>
              </div>
            </div>
            <div className="chip-info">
              <div className="chip-name">
                {p.isNpc ? p.name : t('player.you')}
                {game.longestRoad?.owner === p.id && <span title={t('top.longestRoadTip')}> 🛣️</span>}
                {game.largestArmy?.owner === p.id && <span title={t('top.largestArmyTip')}> ⚔️</span>}
              </div>
              <div className="chip-sub">
                {p.civTitle ? <span className="civ-title">{p.civTitle}</span>
                  : <span className="dim">{p.isNpc ? t(`pers.${p.personality}`) : t('player.humanSovereign')}</span>}
              </div>
              <div className="chip-stats">
                <span className="vp">⭐ {p.vp}<span className="dim">/{target}</span></span>
                <span className="cards">🂠 {cards}</span>
                {p.devCards.length > 0 && <span className="cards" title={t('top.devCardsTip')}>🎴 {p.devCards.length}</span>}
                {active && game.phase !== 'gameover' && (
                  <span className="turn-dot">
                    {p.isNpc ? t('top.thinking') : t('top.yourTurn')}
                  </span>
                )}
                {threat && <span className="threat-tag">{t('top.nearVictory')}</span>}
              </div>
            </div>
            {p.speech && <div className="speech-bubble">{p.speech}</div>}
          </div>
        );
      })}
    </div>
  );
}
