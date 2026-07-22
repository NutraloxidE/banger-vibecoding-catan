import { useState } from "react";
import { useStore } from "../store/store";
import { RESOURCE_INFO } from "../game/constants";
import { bankRate } from "../game/gameReducer";
import { npcAcceptsTrade } from "../game/ai";
import type { ResourceType } from "../game/types";
import { audio } from "../fx/audio";

const RES: ResourceType[] = ["wood", "brick", "sheep", "wheat", "ore"];
const zero = (): Record<ResourceType, number> => ({ wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 });

export function TradePanel({ onClose }: { onClose: () => void }) {
  const game = useStore((s) => s.game)!;
  const bankTradeAction = useStore((s) => s.bankTradeAction);
  const proposeTrade = useStore((s) => s.proposeTrade);
  const [mode, setMode] = useState<"bank" | "npc">("bank");

  const [give, setGive] = useState<ResourceType>("wood");
  const [want, setWant] = useState<ResourceType>("ore");

  const npcs = game.players.filter((p) => p.index !== 0);
  const [npc, setNpc] = useState(npcs[0]?.index ?? 1);
  const [offerGive, setOfferGive] = useState(zero());
  const [offerWant, setOfferWant] = useState(zero());

  const me = game.players[0];
  const rate = bankRate(game, 0, give);
  const canBank = me.resources[give] >= rate && give !== want;

  const likely = npcAcceptsTrade(game, npc, offerGive, offerWant);
  const bump = (
    setter: typeof setOfferGive,
    obj: Record<ResourceType, number>,
    r: ResourceType,
    d: number,
    max: number,
  ) => {
    const v = Math.max(0, Math.min(max, (obj[r] ?? 0) + d));
    setter({ ...obj, [r]: v });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal trade-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Trade</h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>✕</button>
        </div>

        <div className="seg">
          <button className={mode === "bank" ? "seg-btn active" : "seg-btn"} onClick={() => setMode("bank")}>
            🏦 Bank / Port
          </button>
          <button className={mode === "npc" ? "seg-btn active" : "seg-btn"} onClick={() => setMode("npc")}>
            🤝 Opponent
          </button>
        </div>

        {mode === "bank" && (
          <div className="bank-trade">
            <p className="hint">Your best rate for {RESOURCE_INFO[give].label} is {rate}:1.</p>
            <div className="trade-cols">
              <div>
                <div className="trade-label">Give ({rate})</div>
                <div className="res-picker">
                  {RES.map((r) => (
                    <button key={r} className={give === r ? "rp active" : "rp"} onClick={() => setGive(r)} style={{ borderColor: RESOURCE_INFO[r].color }}>
                      {RESOURCE_INFO[r].icon}
                      <small>{me.resources[r]}</small>
                    </button>
                  ))}
                </div>
              </div>
              <div className="trade-arrow">→</div>
              <div>
                <div className="trade-label">Receive (1)</div>
                <div className="res-picker">
                  {RES.map((r) => (
                    <button key={r} className={want === r ? "rp active" : "rp"} onClick={() => setWant(r)} style={{ borderColor: RESOURCE_INFO[r].color }}>
                      {RESOURCE_INFO[r].icon}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button
              className="btn btn-huge"
              disabled={!canBank}
              onClick={() => { audio.resource(want); bankTradeAction(give, want); }}
            >
              {canBank ? `Trade ${rate} ${give} → 1 ${want}` : "Not enough to trade"}
            </button>
          </div>
        )}

        {mode === "npc" && (
          <div className="npc-trade">
            <div className="npc-picker">
              {npcs.map((p) => (
                <button key={p.index} className={npc === p.index ? "np active" : "np"} onClick={() => setNpc(p.index)} style={{ borderColor: p.color }}>
                  <span className="np-dot" style={{ background: p.color }} />
                  {p.name}
                </button>
              ))}
            </div>
            <div className="trade-cols">
              <div>
                <div className="trade-label">You give</div>
                {RES.map((r) => (
                  <div key={r} className="stepper">
                    <span>{RESOURCE_INFO[r].icon}</span>
                    <button onClick={() => bump(setOfferGive, offerGive, r, -1, me.resources[r])}>−</button>
                    <b>{offerGive[r]}</b>
                    <button onClick={() => bump(setOfferGive, offerGive, r, +1, me.resources[r])}>+</button>
                  </div>
                ))}
              </div>
              <div>
                <div className="trade-label">You want</div>
                {RES.map((r) => (
                  <div key={r} className="stepper">
                    <span>{RESOURCE_INFO[r].icon}</span>
                    <button onClick={() => bump(setOfferWant, offerWant, r, -1, 20)}>−</button>
                    <b>{offerWant[r]}</b>
                    <button onClick={() => bump(setOfferWant, offerWant, r, +1, 20)}>+</button>
                  </div>
                ))}
              </div>
            </div>
            <div className={`likely ${likely ? "yes" : "no"}`}>
              {likely ? "😊 Likely to accept" : "😠 Likely to refuse"}
            </div>
            <button
              className="btn btn-huge"
              onClick={() => {
                const ok = proposeTrade(npc, offerGive, offerWant);
                if (ok) {
                  setOfferGive(zero());
                  setOfferWant(zero());
                }
              }}
            >
              MAKE THE OFFER
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
