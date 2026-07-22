import { useState } from 'react';
import { useGame } from '../game/store';
import { RESOURCES, Resource } from '../game/types';
import { bankRate, ownedPorts } from '../game/rules';
import { aiEvaluateTrade } from '../game/ai';
import { RES_EMOJI } from './util';
import { sfx } from '../audio/sfx';
import { useT } from './useT';

export function TradeModal({ onClose }: { onClose: () => void }) {
  const game = useGame((s) => s.game);
  const bankTrade = useGame((s) => s.bankTrade);
  const tradeWithNpc = useGame((s) => s.tradeWithNpc);
  const t = useT();
  const [tab, setTab] = useState<'bank' | 'npc'>('bank');
  const [give, setGive] = useState<Resource>('wood');
  const [want, setWant] = useState<Resource>('wheat');
  const [giveN, setGiveN] = useState(1);
  const [wantN, setWantN] = useState(1);
  const [npcId, setNpcId] = useState<number>(1);
  const [result, setResult] = useState<string | null>(null);

  if (!game) return null;
  const me = game.players[0];
  const npcs = game.players.filter((p) => p.isNpc);
  const npc = game.players[npcId] ?? npcs[0];
  const rate = bankRate(game, give);

  const bankOk = give !== want && me.resources[give] >= rate;
  const npcHasGoods = npc && npc.resources[want] >= wantN;
  const iHaveGoods = me.resources[give] >= giveN;
  const npcOk = give !== want && npcHasGoods && iHaveGoods;
  const npcLikely = npcOk && aiEvaluateTrade(game, npc.id, give, giveN, want, wantN);

  const doBank = () => {
    if (!bankOk) { sfx.invalid(); return; }
    bankTrade(give, want);
    setResult(t('trade.bankAccepted', { rate, give: RES_EMOJI[give], get: RES_EMOJI[want] }));
  };

  const doNpc = () => {
    if (!npcOk) { sfx.invalid(); return; }
    const ok = tradeWithNpc(npc.id, give, giveN, want, wantN);
    setResult(ok ? t('trade.npcAccepted', { name: npc.name }) : t('trade.npcRejected', { name: npc.name }));
  };

  const ResPicker = ({ value, onPick, label }: { value: Resource; onPick: (r: Resource) => void; label: string }) => (
    <div className="res-picker">
      <div className="dim tiny">{label}</div>
      <div className="res-picker-row">
        {RESOURCES.map((r) => (
          <button key={r} className={`res-pick ${value === r ? 'on' : ''} ${me.resources[r] === 0 ? 'empty' : ''}`}
            title={t(`res.${r}`)}
            onClick={() => { sfx.click(); onPick(r); setResult(null); }}>
            <span className="res-pick-emoji">{RES_EMOJI[r]}</span>
            <span className="res-pick-have">{me.resources[r]}</span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal trade-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t('trade.market')}</h3>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="trade-inventory">
          <div className="dim tiny">{t('trade.yourResources')}</div>
          <div className="trade-inv-row">
            {RESOURCES.map((r) => (
              <div key={r} className={`trade-inv-chip ${me.resources[r] === 0 ? 'empty' : ''}`} title={t(`res.${r}`)}>
                <span className="trade-inv-emoji">{RES_EMOJI[r]}</span>
                <span className="trade-inv-count">{me.resources[r]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="seg">
          <button className={`seg-btn ${tab === 'bank' ? 'on' : ''}`} onClick={() => { sfx.click(); setTab('bank'); setResult(null); }}>
            {t('trade.bank')}
          </button>
          <button className={`seg-btn ${tab === 'npc' ? 'on' : ''}`} onClick={() => { sfx.click(); setTab('npc'); setResult(null); }}>
            {t('trade.rivals')}
          </button>
        </div>

        {tab === 'bank' && (
          <div className="trade-body">
            <ResPicker value={give} onPick={setGive}
              label={t('trade.youGiveRate', { rate, festival: game.worldEvent?.kind === 'festival' ? t('trade.festival') : '' })} />
            <div className="trade-arrow">{rate} {RES_EMOJI[give]} → 1 {RES_EMOJI[want]}</div>
            <ResPicker value={want} onPick={setWant} label={t('trade.youReceive')} />
            <button className={`btn btn-big ${bankOk ? 'btn-gold' : 'disabled'}`} onClick={doBank}>
              {bankOk ? t('trade.execute') : me.resources[give] < rate ? t('trade.needN', { n: rate, res: t(`res.${give}`) }) : t('trade.pickDiff')}
            </button>
            <div className="ports-box">
              <div className="dim tiny">{t('trade.ports')}</div>
              {ownedPorts(game, 0).length === 0 ? (
                <div className="ports-none">{t('trade.portsNone')}</div>
              ) : (
                <div className="ports-list">
                  {ownedPorts(game, 0).map((p) => (
                    <span key={p.id} className="port-chip" title={p.name}>
                      {p.kind === 'generic' ? '⚓' : RES_EMOJI[p.kind]} {p.rate}:1
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'npc' && (
          <div className="trade-body">
            <div className="npc-target-row">
              {npcs.map((p) => (
                <button key={p.id} className={`npc-target ${npc?.id === p.id ? 'on' : ''}`}
                  style={{ ['--pc' as any]: p.color }}
                  onClick={() => { sfx.click(); setNpcId(p.id); setResult(null); }}>
                  {p.emoji} {p.name}
                </button>
              ))}
            </div>
            <div className="trade-cols">
              <div>
                <ResPicker value={give} onPick={setGive} label={t('trade.youGive')} />
                <div className="stepper">
                  <button className="btn btn-ghost" onClick={() => setGiveN(Math.max(1, giveN - 1))}>−</button>
                  <b>{giveN}</b>
                  <button className="btn btn-ghost" onClick={() => setGiveN(Math.min(3, giveN + 1))}>+</button>
                </div>
              </div>
              <div className="trade-arrow">↔</div>
              <div>
                <ResPicker value={want} onPick={setWant} label={t('trade.youReceive')} />
                <div className="stepper">
                  <button className="btn btn-ghost" onClick={() => setWantN(Math.max(1, wantN - 1))}>−</button>
                  <b>{wantN}</b>
                  <button className="btn btn-ghost" onClick={() => setWantN(Math.min(3, wantN + 1))}>+</button>
                </div>
              </div>
            </div>
            {npc && (
              <div className={`npc-mood-hint ${npcLikely ? 'yes' : 'no'}`}>
                {!iHaveGoods ? t('trade.noHaveGive', { n: giveN, res: t(`res.${give}`) })
                  : !npcHasGoods ? t('trade.npcNoHave', { name: npc.name, n: wantN, res: t(`res.${want}`) })
                  : npcLikely ? t('trade.interested', { emoji: npc.emoji, name: npc.name })
                  : t('trade.unimpressed', { emoji: npc.emoji, name: npc.name })}
              </div>
            )}
            <button className={`btn btn-big ${npcOk ? 'btn-gold' : 'disabled'}`} onClick={doNpc}>
              {t('trade.makeOffer')}
            </button>
          </div>
        )}

        {result && <div className="trade-result">{result}</div>}
      </div>
    </div>
  );
}
