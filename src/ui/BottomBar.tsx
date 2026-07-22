import { useState } from 'react';
import { useGame } from '../game/store';
import { COSTS, canAfford, validSpots, MEGA_ROAD_REQ } from '../game/rules';
import { RESOURCES, BuildKind } from '../game/types';
import { RES_EMOJI, costChips } from './util';
import { sfx } from '../audio/sfx';
import { TradeModal } from './TradeModal';
import { useT } from './useT';

const BUILD_DEFS: { kind: BuildKind; icon: string }[] = [
  { kind: 'road', icon: '🛤' },
  { kind: 'settlement', icon: '🏠' },
  { kind: 'city', icon: '🏙' },
  { kind: 'megacity', icon: '🌆' },
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
  const t = useT();

  if (!game || game.winner !== null) return null;
  const me = game.players[0];
  const isMyTurn = game.current === 0;
  const cur = game.players[game.current];

  const buildDesc = (kind: BuildKind) =>
    kind === 'megacity' ? t('build.megacity.desc', { roads: MEGA_ROAD_REQ }) : t(`build.${kind}.desc`);

  return (
    <>
      {tradeOpen && isMyTurn && game.phase === 'main' && <TradeModal onClose={() => setTradeOpen(false)} />}
      <div className="bottom-bar">
        <div className="hand">
          {RESOURCES.map((r) => (
            <div key={r} className={`res-card res-${r} ${me.resources[r] === 0 ? 'empty' : ''}`}
              title={t(`res.${r}`)}>
              <div className="res-emoji">{RES_EMOJI[r]}</div>
              <div className="res-count" key={`${r}-${me.resources[r]}`}>{me.resources[r]}</div>
            </div>
          ))}
        </div>

        <div className="action-zone">
          {!isMyTurn && (
            <div className="npc-turn-note">
              <span className="pulse-dot" style={{ background: cur.color }} />
              <span dangerouslySetInnerHTML={{ __html: t('bottom.plotting', { emoji: cur.emoji, name: `<b>${cur.name}</b>` }) }} />
              <button className={`btn btn-ghost ${settings.fastMode ? 'on' : ''}`}
                onClick={() => { sfx.click(); setSetting('fastMode', !settings.fastMode); }}
                title={t('bottom.fastTip')}>
                {settings.fastMode ? t('bottom.fast') : t('bottom.normal')}
              </button>
            </div>
          )}

          {isMyTurn && game.phase === 'setup' && (
            <div className="phase-hint big-hint">
              {game.setupStage === 'settlement' ? t('bottom.hintSettlement') : t('bottom.hintRoad')}
            </div>
          )}

          {isMyTurn && game.phase === 'roll' && (
            <button className="btn btn-huge btn-gold roll-btn" onClick={() => { sfx.click(); rollDice(); }}>
              {t('bottom.roll')}
            </button>
          )}

          {isMyTurn && game.phase === 'robber' && (
            <div className="phase-hint big-hint danger">{t('bottom.hintRobber')}</div>
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
                      title={`${buildDesc(b.kind)}\n${costChips(COSTS[b.kind])}${spots === 0 ? '' : ''}`}
                    >
                      <span className="build-icon">{b.icon}</span>
                      <span className="build-label">{t(`build.${b.kind}`)}</span>
                      <span className="build-cost">{costChips(COSTS[b.kind])}</span>
                      {!afford && <span className="build-note">{t('build.needMore')}</span>}
                      {afford && spots === 0 && <span className="build-note">{t('build.noSpot')}</span>}
                    </button>
                  );
                })}
              </div>
              <div className="turn-row">
                <button className="btn btn-big" onClick={() => { sfx.click(); setTradeOpen(true); }}>
                  {t('bottom.trade')}
                </button>
                <button className="btn btn-big btn-end" onClick={() => { sfx.click(); endTurn(); }}>
                  {t('bottom.endTurn')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {game.placement && (
        <div className="placement-banner">
          <span>
            {t(`banner.${game.placement.kind}`)}
            {' — '}
            {t(game.placement.spots.length > 1 ? 'banner.spots' : 'banner.spot', { n: game.placement.spots.length })}
          </span>
          <button className="btn btn-ghost cancel-btn" onClick={() => { sfx.click(); cancelPlacement(); }}>
            {t('banner.cancel')}
          </button>
        </div>
      )}
    </>
  );
}
