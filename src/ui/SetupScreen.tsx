import { useMemo } from "react";
import { useStore } from "../store/store";
import { generateBoard } from "../game/mapGen";
import { makeRng } from "../game/rng";
import { BIOME_INFO, MAP_RADII, PERSONALITY_INFO, PLAYER_COLORS } from "../game/constants";
import { axialToWorld } from "../game/hexGrid";
import { audio } from "../fx/audio";
import type { ChaosModifiers } from "../game/types";

const CHAOS_LABELS: Record<keyof ChaosModifiers, { name: string; blurb: string; emoji: string }> = {
  turbo: { name: "Turbo Economy", blurb: "More resources, shorter game.", emoji: "⚡" },
  worldEvents: { name: "World Events", blurb: "Storms, booms, suspicious sheep.", emoji: "🌪️" },
  goldenHex: { name: "Golden Hex", blurb: "One tile makes wildcard loot.", emoji: "✨" },
  friendlyRobber: { name: "Friendly Robber", blurb: "Robber leaves a consolation sheep.", emoji: "🥺" },
  npcDrama: { name: "NPC Drama", blurb: "Grudges & rivalries amplified.", emoji: "🎭" },
  maxSheep: { name: "Maximum Sheep", blurb: "Sheep matter. Do not ask.", emoji: "🐑" },
};

function BoardPreview() {
  const draft = useStore((s) => s.draft);
  const svg = useMemo(() => {
    const rng = makeRng(draft.seed + draft.mapSize + (draft.chaos.goldenHex ? "g" : ""));
    const { board } = generateBoard(draft, rng);
    const tiles = board.tileOrder.map((id) => board.tiles[id]);
    const pts = tiles.map((t) => {
      const w = axialToWorld(t.q, t.r);
      return { ...t, ...w };
    });
    const scale = 34 - board.radius * 3;
    const cx = 160;
    const cy = 140;
    return { pts, scale, cx, cy };
  }, [draft]);

  const hexPath = (x: number, y: number, s: number) => {
    let d = "";
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i - 30);
      const px = x + s * Math.cos(a);
      const py = y + s * Math.sin(a);
      d += (i === 0 ? "M" : "L") + px.toFixed(1) + "," + py.toFixed(1);
    }
    return d + "Z";
  };

  return (
    <svg viewBox="0 0 320 280" className="board-preview" aria-label="map preview">
      {svg.pts.map((t) => {
        const x = svg.cx + t.x * svg.scale;
        const y = svg.cy + t.z * svg.scale;
        return (
          <g key={t.id}>
            <path d={hexPath(x, y, svg.scale * 0.92)} fill={BIOME_INFO[t.biome].top} stroke="#0b0e14" strokeWidth={1.5} />
            {t.number && (
              <text x={x} y={y + 3} textAnchor="middle" fontSize={svg.scale * 0.42} fontWeight="700" fill={t.number === 6 || t.number === 8 ? "#b0201a" : "#222"}>
                {t.number}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function SetupScreen() {
  const draft = useStore((s) => s.draft);
  const setDraft = useStore((s) => s.setDraft);
  const toggleChaos = useStore((s) => s.toggleChaos);
  const randomizeSeed = useStore((s) => s.randomizeSeed);
  const startGame = useStore((s) => s.startGame);
  const goTitle = useStore((s) => s.goTitle);

  const chaosCount = Object.values(draft.chaos).filter(Boolean).length;

  return (
    <div className="setup-root">
      <div className="setup-panel">
        <div className="setup-head">
          <button className="btn btn-ghost btn-sm" onClick={goTitle}>
            ← Back
          </button>
          <h2>Configure Your World</h2>
          <div className="spacer" />
        </div>

        <div className="setup-grid">
          <div className="setup-controls">
            <label className="field">
              <span>Map Size</span>
              <div className="seg">
                {(["small", "medium", "large"] as const).map((m) => (
                  <button
                    key={m}
                    className={draft.mapSize === m ? "seg-btn active" : "seg-btn"}
                    onClick={() => {
                      audio.click();
                      setDraft({ mapSize: m });
                    }}
                  >
                    {m}
                    <small>{tileCount(m)} tiles</small>
                  </button>
                ))}
              </div>
            </label>

            <label className="field">
              <span>Opponents: {draft.npcCount}</span>
              <input
                type="range"
                min={2}
                max={5}
                value={draft.npcCount}
                onChange={(e) => setDraft({ npcCount: Number(e.target.value) })}
              />
              <div className="npc-dots">
                {Array.from({ length: draft.npcCount + 1 }, (_, i) => (
                  <span key={i} className="npc-dot" style={{ background: PLAYER_COLORS[i].hex }} title={i === 0 ? "You" : "NPC"} />
                ))}
              </div>
            </label>

            <label className="field">
              <span>Victory Points: {draft.victoryTarget}</span>
              <input
                type="range"
                min={6}
                max={15}
                value={draft.victoryTarget}
                onChange={(e) => setDraft({ victoryTarget: Number(e.target.value) })}
              />
              <small className="hint">{draft.victoryTarget <= 8 ? "Quick brawl" : draft.victoryTarget >= 13 ? "Epic marathon" : "Standard game"}</small>
            </label>

            <label className="field">
              <span>Seed</span>
              <div className="seed-row">
                <input
                  type="text"
                  value={draft.seed}
                  onChange={(e) => setDraft({ seed: e.target.value.toUpperCase() })}
                />
                <button className="btn btn-sm" onClick={() => { audio.click(); randomizeSeed(); }}>
                  🎲
                </button>
              </div>
            </label>
          </div>

          <div className="setup-preview">
            <BoardPreview />
            <div className="preview-caption">Live preview · seed {draft.seed}</div>
          </div>
        </div>

        <div className="chaos-section">
          <div className="chaos-head">
            <h3>Chaos Modifiers</h3>
            {chaosCount >= 4 && <span className="warn-chip">⚠ unstable match likely</span>}
          </div>
          <div className="chaos-grid">
            {(Object.keys(CHAOS_LABELS) as (keyof ChaosModifiers)[]).map((k) => (
              <button
                key={k}
                className={draft.chaos[k] ? "chaos-card active" : "chaos-card"}
                onClick={() => { audio.click(); toggleChaos(k); }}
              >
                <span className="chaos-emoji">{CHAOS_LABELS[k].emoji}</span>
                <span className="chaos-name">{CHAOS_LABELS[k].name}</span>
                <span className="chaos-blurb">{CHAOS_LABELS[k].blurb}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="setup-footer">
          <div className="roster-preview">
            {Array.from({ length: draft.npcCount }, (_, i) => {
              const keys = Object.keys(PERSONALITY_INFO) as (keyof typeof PERSONALITY_INFO)[];
              const info = PERSONALITY_INFO[keys[i % keys.length]];
              return (
                <span key={i} className="roster-chip">
                  {info.emoji} {info.label}
                </span>
              );
            })}
          </div>
          <button className="btn btn-huge" onClick={() => { audio.unlock(); audio.upgrade(); startGame(); }}>
            GENERATE WORLD →
          </button>
        </div>
      </div>
    </div>
  );
}

function tileCount(m: "small" | "medium" | "large"): number {
  const r = MAP_RADII[m];
  return 3 * r * (r + 1) + 1;
}
