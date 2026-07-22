import { useState } from 'react';
import { useGame } from '../game/store';
import { COSTS, canAfford, validSpots, MEGA_ROAD_REQ, roadCount, buildingCount } from '../game/rules';
import { RESOURCES, BuildKind, Resource } from '../game/types';
import { RES_EMOJI, RES_LABEL, costChips } from './util';
import { sfx } from '../audio/sfx';
import { TradeModal } from './TradeModal';

const BUILD_DEFS: { kind: BuildKind; label: string; icon: string; desc: string }[] = [
  { kind: 'road', label: 'Road', icon: '🛤', desc: 'Extends your network. 5+ in a row = Longest Road (+2 VP)' },
  { kind: 'settlement', label: 'Settlement', icon: '🏠', desc: '+1 VP · produces 1 per adjacent tile hit' },
  { kind: 'city', label: 'City', icon: '🏙', desc: '+1 VP more · produces 2 · upgrade a settlement' },
  { kind: 'megacity', label: 'MEGA CITY', icon: '🌆', desc: `+1 VP more · produces 3 · needs a city + ${MEGA_ROAD_REQ} roads · one per player` },
];

export function BottomBar() {
  const game = useGame((s) => s.game);
  const startPlacement = useGame((s) => s.startPlacement);
  const cancelPlacement = useGame((s) => s.cancelPlacement);
  const rollDice = useGame((s) => s.rollDice);
  const endTurn = useGame((s) => s.endTurn);
  const settings = useGame((s) => s.settings);
  const setSetting = useGame((s) => s.setSetting);
  const [tradeOpen, setTradeOpen] = useState(false);

  if (!game || game.winner !== null) return null;
  const me = game.players[0];
  const isMyTurn = game.current === 0;
  const cur = game.players[game.current];

  return (
    <>
      {tradeOpen && isMyTurn && game.phase === 'main' && <TradeModal onClose={() => setTradeOpen(false)} />}
      <div className="bottom-bar">
        <div className="hand">
          {RESOURCES.map((r) => (
            <div key={r} className={`res-card res-${r} ${me.resources[r] === 0 ? 'empty' : ''}`}
              title={RES_LABEL[r]}>
              <div className="res-emoji">{RES_EMOJI[r]}</div>
              <div className="res-count" key={`${r}-${me.resources[r]}`}>{me.resources[r]}</div>
            </div>
          ))}
        </div>

        <div className="action-zone">
          {!isMyTurn && (
            <div className="npc-turn-note">
              <span className="pulse-dot" style={{ background: cur.color }} />
              {cur.emoji} <b>{cur.name}</b> is plotting…
              <button className={`btn btn-ghost ${settings.fastMode ? 'on' : ''}`}
                onClick={() => { sfx.click(); setSetting('fastMode', !settings.fastMode); }}
                title="Speed up NPC turns and dice">
                {settings.fastMode ? '⏩ fast' : '▶ normal'}
              </button>
            </div>
          )}

          {isMyTurn && game.phase === 'setup' && (
            <div className="phase-hint big-hint">
              {game.setupStage === 'settlement'
                ? '🏠 FOUND A SETTLEMENT — tap a glowing corner'
                : '🛤 PAVE A ROAD — tap a glowing edge next to it'}
            </div>
          )}

          {isMyTurn && game.phase === 'roll' && (
            <button className="btn btn-huge btn-gold roll-btn" onClick={() => { sfx.click(); rollDice(); }}>
              🎲 ROLL THE ECONOMY
            </button>
          )}

          {isMyTurn && game.phase === 'robber' && (
            <div className="phase-hint big-hint danger">🦹 PLACE THE ROBBER — tap any red-ringed tile</div>
          )}

          {isMyTurn && game.phase === 'main' && (
            <div className="main-actions">
              <div className="build-row">
                {BUILD_DEFS.map((b) => {
                  const afford = canAfford(me, b.kind);
                  const spots = validSpots(game, 0, b.kind).length;
                  const usable = afford && spots > 0;
                  const selected = game.placement?.kind === b.kind;
                  return (
                    <button key={b.kind}
                      className={`build-card ${usable ? 'usable' : 'locked'} ${selected ? 'selected' : ''} ${b.kind === 'megacity' ? 'mega' : ''}`}
                      onClick={() => startPlacement(b.kind)}
                      title={`${b.desc}\nCost: ${costChips(COSTS[b.kind])}${spots === 0 ? '\n(no valid location right now)' : ''}`}
                    >
                      <span className="build-icon">{b.icon}</span>
                      <span className="build-label">{b.label}</span>
                      <span className="build-cost">{costChips(COSTS[b.kind])}</span>
                      {!afford && <span className="build-note">need more</span>}
                      {afford && spots === 0 && <span className="build-note">no spot</span>}
                    </button>
                  );
                })}
              </div>
              <div className="turn-row">
                <button className="btn btn-big" onClick={() => { sfx.click(); setTradeOpen(true); }}>
                  🔁 TRADE
                </button>
                <button className="btn btn-big btn-end" onClick={() => { sfx.click(); endTurn(); }}>
                  🏁 END MY GLORIOUS TURN
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {game.placement && (
        <div className="placement-banner">
          <span>
            {game.placement.kind === 'road' ? '🛤 Choose an edge' : game.placement.kind === 'settlement' ? '🏠 Choose a corner' : game.placement.kind === 'city' ? '🏙 Choose a settlement to upgrade' : '🌆 Choose a city to ASCEND'}
            {' '}— {game.placement.spots.length} valid spot{game.placement.spots.length > 1 ? 's' : ''} glowing
          </span>
          <button className="btn btn-ghost cancel-btn" onClick={() => { sfx.click(); cancelPlacement(); }}>
            ✕ CANCEL (Esc)
          </button>
        </div>
      )}
    </>
  );
}
