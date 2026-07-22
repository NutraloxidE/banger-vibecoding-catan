import { useEffect, useState } from 'react';
import { useGame } from '../game/store';
import { RES_EMOJI } from './util';
import { sfx } from '../audio/sfx';

export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          <div className="toast-title">{t.text}</div>
          {t.sub && <div className="toast-sub">{t.sub}</div>}
        </div>
      ))}
    </div>
  );
}

export function LogFeed() {
  const log = useGame((s) => s.game?.log);
  const [open, setOpen] = useState(false);
  if (!log) return null;
  const shown = open ? log.slice(-40) : log.slice(-4);
  return (
    <div className={`log-feed ${open ? 'open' : ''}`}>
      <button className="log-toggle" onClick={() => { sfx.click(); setOpen(!open); }}>
        📜 {open ? 'collapse' : 'chronicle'}
      </button>
      <div className="log-lines">
        {shown.map((l, i) => <div key={`${log.length}-${i}`} className="log-line">{l}</div>)}
      </div>
    </div>
  );
}

export function NpcOfferPopup() {
  const offer = useGame((s) => s.game?.npcOffer);
  const players = useGame((s) => s.game?.players);
  const accept = useGame((s) => s.acceptNpcOffer);
  const decline = useGame((s) => s.declineNpcOffer);
  const [, force] = useState(0);

  useEffect(() => {
    if (!offer) return;
    const t = setInterval(() => force((n) => n + 1), 200);
    return () => clearInterval(t);
  }, [offer]);

  if (!offer || !players) return null;
  const npc = players[offer.from];
  const left = Math.max(0, offer.expiresAt - Date.now());
  const pct = Math.min(100, (left / 9000) * 100);

  return (
    <div className="npc-offer">
      <div className="npc-offer-head">{npc.emoji} <b>{npc.name}</b>: “{offer.line}”</div>
      <div className="npc-offer-deal">
        They give {offer.giveN} {RES_EMOJI[offer.give]} — they want {offer.getN} {RES_EMOJI[offer.get]}
      </div>
      <div className="npc-offer-btns">
        <button className="btn btn-gold" onClick={() => { sfx.click(); accept(); }}>🤝 DEAL</button>
        <button className="btn btn-ghost" onClick={() => { sfx.click(); decline(); }}>🚫 refuse</button>
      </div>
      <div className="offer-timer"><div className="offer-timer-fill" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export function EventBanner() {
  const ev = useGame((s) => s.game?.worldEvent);
  const round = useGame((s) => s.game?.round ?? 0);
  if (!ev) return null;
  const left = Math.max(0, ev.untilRound - round + 1);
  return (
    <div className="event-banner">
      🌍 <b>{ev.label}</b> — {ev.desc} <span className="dim">({left} round{left !== 1 ? 's' : ''} left)</span>
    </div>
  );
}

export function HudCorner() {
  const game = useGame((s) => s.game);
  const settings = useGame((s) => s.settings);
  const setSetting = useGame((s) => s.setSetting);
  const goTitle = useGame((s) => s.goTitle);
  const [open, setOpen] = useState(false);

  if (!game) return null;
  return (
    <div className="hud-corner">
      <div className="hud-meta">
        <span title="Round">🔄 R{game.round}</span>
        <span title="World seed — reuse it to replay this exact world">🌱 {game.config.seed}</span>
      </div>
      <button className="btn btn-ghost" onClick={() => { sfx.click(); setOpen(!open); }}>⚙</button>
      {open && (
        <div className="settings-pop">
          <h4>⚙ Settings</h4>
          {([['volMaster', '🔊 Master'], ['volMusic', '🎵 Music'], ['volFx', '💥 Effects'], ['volVoice', '🗣 NPC voices']] as const).map(([k, label]) => (
            <label key={k} className="vol-row">
              <span>{label}</span>
              <input type="range" min={0} max={1} step={0.05} value={settings[k] as number}
                onChange={(e) => setSetting(k, Number(e.target.value))} />
            </label>
          ))}
          <label className="chk">
            <input type="checkbox" checked={settings.fastMode}
              onChange={(e) => setSetting('fastMode', e.target.checked)} />
            ⏩ Fast NPC turns & dice
          </label>
          <button className="btn btn-ghost" onClick={() => { sfx.click(); setOpen(false); goTitle(); }}>
            🏠 quit to title (auto-saved)
          </button>
        </div>
      )}
    </div>
  );
}
