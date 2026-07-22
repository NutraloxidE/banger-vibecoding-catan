import { useState } from 'react';
import { useGame } from '../game/store';
import { RESOURCES, Resource } from '../game/types';
import { bankRate } from '../game/rules';
import { aiEvaluateTrade } from '../game/ai';
import { RES_EMOJI, RES_LABEL } from './util';
import { sfx } from '../audio/sfx';

export function TradeModal({ onClose }: { onClose: () => void }) {
  const game = useGame((s) => s.game);
  const bankTrade = useGame((s) => s.bankTrade);
  const tradeWithNpc = useGame((s) => s.tradeWithNpc);
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
    setResult(`Bank accepted: ${rate} ${RES_EMOJI[give]} → 1 ${RES_EMOJI[want]}`);
  };

  const doNpc = () => {
    if (!npcOk) { sfx.invalid(); return; }
    const ok = tradeWithNpc(npc.id, give, giveN, want, wantN);
    setResult(ok ? `${npc.name} ACCEPTED the deal 🤝` : `${npc.name} REJECTED you 🚫`);
  };

  const ResPicker = ({ value, onPick, label }: { value: Resource; onPick: (r: Resource) => void; label: string }) => (
    <div className="res-picker">
      <div className="dim tiny">{label}</div>
      <div className="res-picker-row">
        {RESOURCES.map((r) => (
          <button key={r} className={`res-pick ${value === r ? 'on' : ''}`}
            onClick={() => { sfx.click(); onPick(r); setResult(null); }}>
            {RES_EMOJI[r]}<span className="res-pick-n">{tab === 'npc' ? '' : ''}</span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal trade-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>🔁 THE MARKET</h3>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="seg">
          <button className={`seg-btn ${tab === 'bank' ? 'on' : ''}`} onClick={() => { sfx.click(); setTab('bank'); setResult(null); }}>
            🏦 World Bank
          </button>
          <button className={`seg-btn ${tab === 'npc' ? 'on' : ''}`} onClick={() => { sfx.click(); setTab('npc'); setResult(null); }}>
            🎭 Rivals
          </button>
        </div>

        {tab === 'bank' && (
          <div className="trade-body">
            <ResPicker value={give} onPick={setGive} label={`You give (${rate}:1${game.worldEvent?.kind === 'festival' ? ' — festival discount!' : ''})`} />
            <div className="trade-arrow">{rate} {RES_EMOJI[give]} → 1 {RES_EMOJI[want]}</div>
            <ResPicker value={want} onPick={setWant} label="You receive" />
            <button className={`btn btn-big ${bankOk ? 'btn-gold' : 'disabled'}`} onClick={doBank}>
              {bankOk ? '🏦 EXECUTE TRADE' : me.resources[give] < rate ? `need ${rate} ${RES_LABEL[give].toLowerCase()}` : 'pick different goods'}
            </button>
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
                <ResPicker value={give} onPick={setGive} label="You give" />
                <div className="stepper">
                  <button className="btn btn-ghost" onClick={() => setGiveN(Math.max(1, giveN - 1))}>−</button>
                  <b>{giveN}</b>
                  <button className="btn btn-ghost" onClick={() => setGiveN(Math.min(3, giveN + 1))}>+</button>
                </div>
              </div>
              <div className="trade-arrow">↔</div>
              <div>
                <ResPicker value={want} onPick={setWant} label="You receive" />
                <div className="stepper">
                  <button className="btn btn-ghost" onClick={() => setWantN(Math.max(1, wantN - 1))}>−</button>
                  <b>{wantN}</b>
                  <button className="btn btn-ghost" onClick={() => setWantN(Math.min(3, wantN + 1))}>+</button>
                </div>
              </div>
            </div>
            {npc && (
              <div className={`npc-mood-hint ${npcLikely ? 'yes' : 'no'}`}>
                {!iHaveGoods ? `You don't have ${giveN} ${RES_LABEL[give].toLowerCase()}`
                  : !npcHasGoods ? `${npc.name} doesn't have ${wantN} ${RES_LABEL[want].toLowerCase()}`
                  : npcLikely ? `${npc.emoji} ${npc.name} looks interested…`
                  : `${npc.emoji} ${npc.name} looks deeply unimpressed`}
              </div>
            )}
            <button className={`btn btn-big ${npcOk ? 'btn-gold' : 'disabled'}`} onClick={doNpc}>
              💼 MAKE THE OFFER
            </button>
          </div>
        )}

        {result && <div className="trade-result">{result}</div>}
      </div>
    </div>
  );
}
