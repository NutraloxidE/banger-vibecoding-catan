import { useState } from 'react';
import { useGame } from '../game/store';
import { COSTS, canAfford, validSpots, MEGA_ROAD_REQ } from '../game/rules';
import { RESOURCES, BuildKind, Resource } from '../game/types';
import { DEV_ICON, DEV_CARD_COST } from '../game/dev';
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
  const buyDevCard = useGame((s) => s.buyDevCard);
  const playDevCard = useGame((s) => s.playDevCard);
  const resolveDevPrompt = useGame((s) => s.resolveDevPrompt);
  const cancelDevCard = useGame((s) => s.cancelDevCard);
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

  const deckLeft = game.devDeck.length;
  const canBuyDev = deckLeft > 0 && RESOURCES.every((r) => me.resources[r] >= (DEV_CARD_COST[r] ?? 0));
  const devPlayable = (boughtOnTurn: number) => !game.devCardPlayedThisTurn && boughtOnTurn !== game.turnCount;
  const devPrompt = game.devPrompt;
  const pending = game.pendingDevCard;
  const promptHint =
    devPrompt?.card === 'monopoly' ? t('dev.pickMonopoly') :
    devPrompt?.card === 'bounty' ? t('dev.pickBounty', { n: devPrompt.need - devPrompt.picks.length }) :
    devPrompt ? t('dev.pickYearOfPlenty', { n: devPrompt.need - devPrompt.picks.length }) : '';
  const robberFromCard = isMyTurn && game.phase === 'robber' && !!pending;

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

          {isMyTurn && game.phase === 'robber' && !robberFromCard && (
            <div className="phase-hint big-hint danger">{t('bottom.hintRobber')}</div>
          )}

          {robberFromCard && pending && (
            <div className="dev-active danger">
              <div className="dev-active-head">
                <span className="dev-active-icon">{DEV_ICON[pending.kind]}</span>
                <span className="dev-active-name">{t(`dev.${pending.kind}`)}</span>
              </div>
              <div className="dev-active-desc">{t(`dev.${pending.kind}.desc`)}</div>
              <div className="dev-active-hint">{t('dev.robberInfo')}</div>
              <button className="btn btn-ghost cancel-btn" onClick={() => cancelDevCard()}>
                {t('dev.cancel')}
              </button>
            </div>
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
              <div className="dev-row">
                <button className={`dev-buy ${canBuyDev ? 'usable' : 'locked'}`}
                  onClick={() => buyDevCard()}
                  title={`${t('dev.buy')} — ${costChips(DEV_CARD_COST)}`}>
                  <span className="dev-buy-icon">🎴</span>
                  <span className="dev-buy-label">{t('dev.buy')}</span>
                  <span className="dev-buy-cost">{costChips(DEV_CARD_COST)}</span>
                  <span className="dev-buy-deck">{deckLeft > 0 ? t('dev.deck', { n: deckLeft }) : t('dev.deckEmpty')}</span>
                </button>
                {me.devCards.length > 0 && (
                  <div className="dev-hand">
                    {me.devCards.map((c, i) => {
                      const playable = devPlayable(c.boughtOnTurn);
                      return (
                        <button key={i}
                          className={`dev-card ${playable ? 'playable' : 'held'}`}
                          disabled={!playable}
                          onClick={() => playDevCard(i)}
                          title={`${t(`dev.${c.kind}`)} — ${t(`dev.${c.kind}.desc`)}`}>
                          <span className="dev-card-icon">{DEV_ICON[c.kind]}</span>
                          <span className="dev-card-label">{t(`dev.${c.kind}`)}</span>
                          {!playable && <span className="dev-card-note">{t('dev.nextTurn')}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
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

      {game.placement && (() => {
        const freeRoad = isMyTurn && game.freeRoads > 0;
        return (
          <div className="placement-banner">
            <span>
              {freeRoad
                ? <>
                    {t('dev.freeRoads', { n: game.freeRoads })}
                    <span className="placement-desc"> · {t('dev.roadBuilding.desc')}</span>
                  </>
                : <>
                    {t(`banner.${game.placement.kind}`)}
                    {' — '}
                    {t(game.placement.spots.length > 1 ? 'banner.spots' : 'banner.spot', { n: game.placement.spots.length })}
                  </>}
            </span>
            <button className="btn btn-ghost cancel-btn"
              onClick={() => { sfx.click(); freeRoad ? cancelDevCard() : cancelPlacement(); }}>
              {t('banner.cancel')}
            </button>
          </div>
        );
      })()}

      {isMyTurn && devPrompt && (
        <div className="dev-prompt">
          <div className="dev-prompt-head">
            <span className="dev-active-icon">{DEV_ICON[devPrompt.card]}</span>
            <span className="dev-active-name">{t(`dev.${devPrompt.card}`)}</span>
          </div>
          <div className="dev-active-desc">{t(`dev.${devPrompt.card}.desc`)}</div>
          <div className="dev-prompt-hint">{promptHint}</div>
          {devPrompt.picks.length > 0 && (
            <div className="dev-prompt-chosen">
              {devPrompt.picks.map((r, i) => <span key={i}>{RES_EMOJI[r]}</span>)}
            </div>
          )}
          <div className="dev-prompt-picks">
            {RESOURCES.map((r: Resource) => (
              <button key={r} className={`dev-pick res-${r}`}
                onClick={() => { sfx.click(); resolveDevPrompt(r); }}
                title={t(`res.${r}`)}>
                <span className="dev-pick-emoji">{RES_EMOJI[r]}</span>
                <span className="dev-pick-have">{me.resources[r]}</span>
              </button>
            ))}
          </div>
          <button className="btn btn-ghost cancel-btn" onClick={() => cancelDevCard()}>
            {t('dev.cancel')}
          </button>
        </div>
      )}
    </>
  );
}
