import { useStore } from "../store/store";

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}${t.big ? " toast-big" : ""}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function WorldEventBanner() {
  const events = useStore((s) => s.game?.worldEvents ?? []);
  const rivalries = useStore((s) => s.game?.rivalries ?? []);
  useStore((s) => s.tick);
  if (events.length === 0 && rivalries.length === 0) return null;
  return (
    <div className="event-banner">
      {events.map((e) => (
        <div key={e.id} className="event-chip">
          <b>{e.title}</b> · {e.description} <span className="event-timer">{e.turnsLeft}⏳</span>
        </div>
      ))}
      {rivalries.map((r, i) => (
        <div key={i} className="rivalry-chip">
          ⚔ {r.label}
        </div>
      ))}
    </div>
  );
}
