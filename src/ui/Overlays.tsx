import { useEffect, useState } from 'react';
import { useGame } from '../game/store';
import { RES_EMOJI } from './util';
import { sfx } from '../audio/sfx';
import { useT } from './useT';
import { LangToggle } from './LangToggle';

export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind} ${t.color ? 'toast-owned' : ''}`}
          style={t.color ? ({ ['--pc' as any]: t.color }) : undefined}>
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
  const t = useT();
  if (!log) return null;
  const shown = open ? log.slice(-40) : log.slice(-4);
  return (
    <div className={`log-feed ${open ? 'open' : ''}`}>
      <button className="log-toggle" onClick={() => { sfx.click(); setOpen(!open); }}>
        {open ? t('log.collapse') : t('log.chronicle')}
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
  const t = useT();
  const [, force] = useState(0);

  useEffect(() => {
    if (!offer) return;
    const timer = setInterval(() => force((n) => n + 1), 200);
    return () => clearInterval(timer);
  }, [offer]);

  if (!offer || !players) return null;
  const npc = players[offer.from];
  const left = Math.max(0, offer.expiresAt - Date.now());
  const pct = Math.min(100, (left / 9000) * 100);

  return (
    <div className="npc-offer">
      <div className="npc-offer-head">{npc.emoji} <b>{npc.name}</b>: “{offer.line}”</div>
      <div className="npc-offer-deal">
        {t('offer.deal', { giveN: offer.giveN, give: RES_EMOJI[offer.give], getN: offer.getN, get: RES_EMOJI[offer.get] })}
      </div>
      <div className="npc-offer-btns">
        <button className="btn btn-gold" onClick={() => { sfx.click(); accept(); }}>{t('offer.accept')}</button>
        <button className="btn btn-ghost" onClick={() => { sfx.click(); decline(); }}>{t('offer.refuse')}</button>
      </div>
      <div className="offer-timer"><div className="offer-timer-fill" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export function EventBanner() {
  const ev = useGame((s) => s.game?.worldEvent);
  const round = useGame((s) => s.game?.round ?? 0);
  const t = useT();
  if (!ev) return null;
  const left = Math.max(0, ev.untilRound - round + 1);
  return (
    <div className="event-banner">
      🌍 <b>{ev.label}</b> — {ev.desc} <span className="dim">{t(left !== 1 ? 'event.roundsLeft' : 'event.roundLeft', { n: left })}</span>
    </div>
  );
}

export function HudCorner() {
  const game = useGame((s) => s.game);
  const settings = useGame((s) => s.settings);
  const setSetting = useGame((s) => s.setSetting);
  const goTitle = useGame((s) => s.goTitle);
  const t = useT();
  const [open, setOpen] = useState(false);

  if (!game) return null;
  return (
    <>
      <div className="hud-meta">
        <span title="Round">{t('hud.round', { n: game.round })}</span>
        <span title={t('hud.seedTip')}>🌱 {game.config.seed}</span>
      </div>
      <div className="hud-options">
        <button className="btn btn-ghost" onClick={() => { sfx.click(); setOpen(!open); }}>⚙</button>
        {open && (
          <div className="settings-pop">
            <h4>{t('hud.settings')}</h4>
            <label className="vol-row">
              <span>{t('setup.language')}</span>
              <LangToggle compact />
            </label>
            {([['volMaster', 'hud.master'], ['volMusic', 'hud.music'], ['volFx', 'hud.effects'], ['volVoice', 'hud.voices']] as const).map(([k, label]) => (
              <label key={k} className="vol-row">
                <span>{t(label)}</span>
                <input type="range" min={0} max={1} step={0.05} value={settings[k] as number}
                  onChange={(e) => setSetting(k, Number(e.target.value))} />
              </label>
            ))}
            <label className="chk">
              <input type="checkbox" checked={settings.fastMode}
                onChange={(e) => setSetting('fastMode', e.target.checked)} />
              {t('hud.fastToggle')}
            </label>
            <button className="btn btn-ghost" onClick={() => { sfx.click(); setOpen(false); goTitle(); }}>
              {t('hud.quit')}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
