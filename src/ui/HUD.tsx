import { useEffect, useState } from "react";
import { useStore } from "../store/store";
import { TopBar } from "./TopBar";
import { BottomHand } from "./BottomHand";
import { TradePanel } from "./TradePanel";
import { Toasts, WorldEventBanner } from "./Toasts";
import { VictoryScreen } from "./VictoryScreen";
import { audio } from "../fx/audio";

function Menu({ onClose }: { onClose: () => void }) {
  const audioSettings = useStore((s) => s.audio);
  const setAudio = useStore((s) => s.setAudio);
  const speed = useStore((s) => s.speed);
  const setSpeed = useStore((s) => s.setSpeed);
  const goTitle = useStore((s) => s.goTitle);
  const goSetup = useStore((s) => s.goSetup);

  const slider = (key: "master" | "music" | "sfx", label: string) => (
    <label className="menu-slider">
      <span>{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={audioSettings[key]}
        onChange={(e) => setAudio({ [key]: Number(e.target.value) })}
      />
    </label>
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal menu-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Menu</h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="menu-section">
          <h4>Audio</h4>
          <label className="menu-toggle">
            <input type="checkbox" checked={audioSettings.muted} onChange={(e) => setAudio({ muted: e.target.checked })} />
            Mute all
          </label>
          {slider("master", "Master")}
          {slider("music", "Music")}
          {slider("sfx", "Effects")}
        </div>
        <div className="menu-section">
          <h4>NPC Speed</h4>
          <div className="seg">
            {[1, 2, 4].map((s) => (
              <button key={s} className={speed === s ? "seg-btn active" : "seg-btn"} onClick={() => setSpeed(s)}>
                {s === 1 ? "Normal" : s === 2 ? "Fast" : "Turbo"}
              </button>
            ))}
          </div>
        </div>
        <div className="menu-section">
          <button className="btn" onClick={goSetup}>⚙ New game (setup)</button>
          <button className="btn btn-ghost" onClick={goTitle}>↩ Title screen</button>
        </div>
      </div>
    </div>
  );
}

function GameLog() {
  const log = useStore((s) => s.game?.log ?? []);
  const [open, setOpen] = useState(false);
  return (
    <div className={`log-panel${open ? " open" : ""}`}>
      <button className="log-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? "▸ Log" : "◂ Log"}
      </button>
      {open && (
        <div className="log-list">
          {log.slice(0, 30).map((e) => (
            <div key={e.id} className={`log-line log-${e.kind}`}>
              {e.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function HUD() {
  const game = useStore((s) => s.game);
  const tick = useStore((s) => s.tick);
  const audioSettings = useStore((s) => s.audio);
  const [showTrade, setShowTrade] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // sync audio engine with settings
  useEffect(() => {
    audio.setSettings(audioSettings);
  }, [audioSettings]);

  // near-win musical intensity
  useEffect(() => {
    if (!game) return;
    const lead = Math.max(...game.players.map((p) => p.victoryPoints));
    audio.setIntensity(Math.min(1, lead / game.settings.victoryTarget));
  }, [tick, game]);

  if (!game) return null;

  return (
    <div className="hud">
      <TopBar />
      <WorldEventBanner />

      <button className="menu-btn" onClick={() => setShowMenu(true)} title="Menu">
        ☰
      </button>
      <div className="seed-tag">seed {game.settings.seed}</div>

      <GameLog />
      <Toasts />

      {game.phase !== "over" && <BottomHand onOpenTrade={() => setShowTrade(true)} />}

      {showTrade && game.phase === "build" && game.current === 0 && (
        <TradePanel onClose={() => setShowTrade(false)} />
      )}
      {showMenu && <Menu onClose={() => setShowMenu(false)} />}

      {game.phase === "over" && game.winner !== null && <VictoryScreen />}
    </div>
  );
}
