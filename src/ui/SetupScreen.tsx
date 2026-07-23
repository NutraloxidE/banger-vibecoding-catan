import { useMemo, useState } from 'react';
import { useGame } from '../game/store';
import { MatchConfig, MapSize, Difficulty, Terrain } from '../game/types';
import { generateBoard, pickGoldenTile } from '../game/board';
import { randomSeedString, RNG } from '../game/rng';
import { pickNpcs, PLAYER_COLORS } from '../game/names';
import { sfx } from '../audio/sfx';
import { useT } from './useT';
import { LangToggle } from './LangToggle';

const MAP_TILES: Record<MapSize, number> = { small: 19, medium: 37, large: 61 };

// World presets — each bundles a full set of chaos toggles, from "really just
// Catan" up to "everything cranked". Selecting one applies its flags; tweaking
// any individual modifier afterward drops back to "Custom". Banger is default.
type PresetKey = 'normal' | 'banger' | 'core' | 'maxxing';
interface PresetFlags {
  worldEvents: boolean;
  turbo: boolean;
  friendlyRobber: boolean;
  maximumSheep: boolean;
  drama: boolean;
  goldenHex: boolean;
  crazyCards: boolean;
}
const PRESET_ORDER: PresetKey[] = ['normal', 'banger', 'core', 'maxxing'];
const PRESET_EMOJI: Record<PresetKey, string> = { normal: '🌾', banger: '🔥', core: '💥', maxxing: '🌋' };
const PRESETS: Record<PresetKey, PresetFlags> = {
  normal:  { worldEvents: false, turbo: false, friendlyRobber: false, maximumSheep: false, drama: false, goldenHex: false, crazyCards: false },
  banger:  { worldEvents: true,  turbo: false, friendlyRobber: false, maximumSheep: false, drama: true,  goldenHex: false, crazyCards: false },
  core:    { worldEvents: true,  turbo: false, friendlyRobber: false, maximumSheep: false, drama: true,  goldenHex: true,  crazyCards: true  },
  maxxing: { worldEvents: true,  turbo: true,  friendlyRobber: true,  maximumSheep: true,  drama: true,  goldenHex: true,  crazyCards: true  },
};
function matchPreset(f: PresetFlags): PresetKey | null {
  return PRESET_ORDER.find((k) => {
    const p = PRESETS[k];
    return (Object.keys(p) as (keyof PresetFlags)[]).every((key) => p[key] === f[key]);
  }) ?? null;
}

// 2D colors for the live preview (matches the 3D board's terrain palette)
const PREVIEW_COLOR: Record<Terrain, string> = {
  forest: '#2f8f4a',
  hills: '#c06a3d',
  fields: '#e3c24a',
  pasture: '#8fd05e',
  mountains: '#8d93a1',
  desert: '#e0cd8f',
};

// Live SVG preview of the exact board this seed + size will generate.
function MapPreview({ mapSize, seed, goldenHex }: { mapSize: MapSize; seed: string; goldenHex: boolean }) {
  const board = useMemo(() => generateBoard(mapSize, seed.trim() || 'x'), [mapSize, seed]);
  const golden = useMemo(
    () => (goldenHex ? pickGoldenTile(board, seed.trim() || 'x') : null),
    [board, seed, goldenHex],
  );

  const S = 30; // px per world unit
  const shrink = 0.93; // gap between hexes
  const pad = S * 1.2;
  const xs = board.tiles.map((t) => t.x * S);
  const ys = board.tiles.map((t) => t.z * S);
  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;

  const hexPoints = (cx: number, cy: number) => {
    const pts: string[] = [];
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 180) * (60 * k - 30);
      pts.push(`${(cx + Math.cos(a) * S * shrink).toFixed(1)},${(cy + Math.sin(a) * S * shrink).toFixed(1)}`);
    }
    return pts.join(' ');
  };

  return (
    <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}>
      {board.tiles.map((tile) => {
        const cx = tile.x * S, cy = tile.z * S;
        const hot = tile.token === 6 || tile.token === 8;
        return (
          <g key={tile.id}>
            <polygon points={hexPoints(cx, cy)} fill={PREVIEW_COLOR[tile.terrain]}
              stroke={golden === tile.id ? '#ffce4a' : 'none'} strokeWidth={golden === tile.id ? 3 : 0} />
            {tile.token !== null && (
              <text x={cx} y={cy + S * 0.2} textAnchor="middle"
                fontSize={S * 0.58} fontWeight={700}
                fill={hot ? '#b91c1c' : '#1c2430'} fontFamily="inherit">
                {tile.token}
              </text>
            )}
            {golden === tile.id && (
              <text x={cx} y={cy - S * 0.42} textAnchor="middle" fontSize={S * 0.5}>✨</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function SetupScreen() {
  const newGame = useGame((s) => s.newGame);
  const goTitle = useGame((s) => s.goTitle);
  const lastConfig = useGame((s) => s.lastConfig);
  const t = useT();

  const [mapSize, setMapSize] = useState<MapSize>(lastConfig?.mapSize ?? 'medium');
  const [npcCount, setNpcCount] = useState(lastConfig?.npcCount ?? 3);
  const [difficulty, setDifficulty] = useState<Difficulty>(lastConfig?.difficulty ?? 'normal');
  const [targetVp, setTargetVp] = useState(lastConfig?.targetVp ?? 10);
  const [seed, setSeed] = useState(randomSeedString());
  const [worldEvents, setWorldEvents] = useState(lastConfig?.worldEvents ?? true);
  const [turbo, setTurbo] = useState(false);
  const [friendlyRobber, setFriendlyRobber] = useState(false);
  const [maximumSheep, setMaximumSheep] = useState(false);
  const [drama, setDrama] = useState(true);
  const [goldenHex, setGoldenHex] = useState(false);
  const [crazyCards, setCrazyCards] = useState(false);

  const chaosCount = [turbo, friendlyRobber, maximumSheep, goldenHex, crazyCards].filter(Boolean).length;

  // Which preset (if any) the current toggle state exactly matches.
  const activePreset = matchPreset({ worldEvents, turbo, friendlyRobber, maximumSheep, drama, goldenHex, crazyCards });
  const applyPreset = (key: PresetKey) => {
    const p = PRESETS[key];
    setWorldEvents(p.worldEvents);
    setTurbo(p.turbo);
    setFriendlyRobber(p.friendlyRobber);
    setMaximumSheep(p.maximumSheep);
    setDrama(p.drama);
    setGoldenHex(p.goldenHex);
    setCrazyCards(p.crazyCards);
  };

  // Rivals this seed will actually produce (same RNG path as buildMatch)
  const roster = useMemo(() => {
    const rng = new RNG((seed.trim() || 'x') + ':players');
    return pickNpcs(rng, npcCount, difficulty);
  }, [seed, npcCount, difficulty]);

  const start = () => {
    sfx.buildBig();
    const config: MatchConfig = {
      mapSize, npcCount, difficulty, targetVp,
      seed: seed.trim() || randomSeedString(),
      worldEvents,
      chaos: { turbo, friendlyRobber, maximumSheep, drama, goldenHex, crazyCards },
    };
    newGame(config);
  };

  const vpCaption = targetVp <= 8 ? t('setup.vpQuick') : targetVp <= 11 ? t('setup.vpStandard') : t('setup.vpLong');

  const chaosCards: { key: string; emoji: string; name: string; desc: string; on: boolean; toggle: () => void }[] = [
    { key: 'turbo', emoji: '⚡', name: t('chaos.turbo'), desc: t('chaos.turboD'), on: turbo, toggle: () => setTurbo(!turbo) },
    { key: 'events', emoji: '🌪️', name: t('chaos.events'), desc: t('chaos.eventsD'), on: worldEvents, toggle: () => setWorldEvents(!worldEvents) },
    { key: 'golden', emoji: '✨', name: t('chaos.golden'), desc: t('chaos.goldenD'), on: goldenHex, toggle: () => setGoldenHex(!goldenHex) },
    { key: 'friendly', emoji: '🥺', name: t('chaos.friendly'), desc: t('chaos.friendlyD'), on: friendlyRobber, toggle: () => setFriendlyRobber(!friendlyRobber) },
    { key: 'drama', emoji: '🎭', name: t('chaos.drama'), desc: t('chaos.dramaD'), on: drama, toggle: () => setDrama(!drama) },
    { key: 'sheep', emoji: '🐑', name: t('chaos.sheep'), desc: t('chaos.sheepD'), on: maximumSheep, toggle: () => setMaximumSheep(!maximumSheep) },
    { key: 'crazy', emoji: '🃏', name: t('chaos.crazy'), desc: t('chaos.crazyD'), on: crazyCards, toggle: () => setCrazyCards(!crazyCards) },
  ];

  return (
    <div className="screen setup-screen">
      <div className="setup-panel cfg">
        <div className="cfg-head">
          <button className="btn btn-ghost" onClick={() => { sfx.click(); goTitle(); }}>{t('setup.back')}</button>
          <h2 className="cfg-title">{t('setup.title')}</h2>
          <div className="cfg-head-spacer" />
          <LangToggle compact />
        </div>

        <h3 className="cfg-label">{t('setup.preset')}</h3>
        <div className="preset-grid">
          {PRESET_ORDER.map((k) => (
            <button key={k} className={`preset-card ${activePreset === k ? 'on' : ''}`}
              onClick={() => { sfx.click(); applyPreset(k); }}>
              <span className="preset-emoji">{PRESET_EMOJI[k]}</span>
              <span className="preset-name">{t(`preset.${k}`)}</span>
              <span className="preset-desc">{t(`preset.${k}D`)}</span>
            </button>
          ))}
        </div>
        {activePreset === null && <div className="preset-custom">{t('preset.customD')}</div>}

        <div className="map-preview">
          <MapPreview mapSize={mapSize} seed={seed} goldenHex={goldenHex} />
          <div className="map-caption">{t('setup.livePreview', { seed: seed.trim() || '—' })}</div>
        </div>

        <h3 className="cfg-label">{t('setup.mapSize')}</h3>
        <div className="size-seg">
          {(['small', 'medium', 'large'] as MapSize[]).map((m) => (
            <button key={m} className={`size-btn ${mapSize === m ? 'on' : ''}`}
              onClick={() => { sfx.click(); setMapSize(m); }}>
              <span className="size-name">{t(`setup.${m}`)}</span>
              <span className="size-sub">{t('setup.tiles', { n: MAP_TILES[m] })}</span>
            </button>
          ))}
        </div>

        <h3 className="cfg-label">{t('setup.opponents', { n: npcCount })}</h3>
        <input type="range" min={1} max={3} value={npcCount}
          onChange={(e) => setNpcCount(Number(e.target.value))} />
        <div className="dots-row">
          {Array.from({ length: npcCount + 1 }, (_, i) => (
            <span key={i} className="p-dot" style={{ background: PLAYER_COLORS[i] }} />
          ))}
        </div>

        <h3 className="cfg-label">{t('setup.difficulty')}</h3>
        <div className="size-seg">
          {(['chill', 'normal', 'ruthless'] as Difficulty[]).map((d) => (
            <button key={d} className={`size-btn ${difficulty === d ? 'on' : ''}`}
              onClick={() => { sfx.click(); setDifficulty(d); }}>
              <span className="size-name">{t(`diff.${d}`)}</span>
            </button>
          ))}
        </div>

        <h3 className="cfg-label">{t('setup.victoryPoints', { n: targetVp })}</h3>
        <input type="range" min={7} max={20} value={targetVp}
          onChange={(e) => setTargetVp(Number(e.target.value))} />
        <div className="vp-caption">{vpCaption}</div>

        <h3 className="cfg-label">{t('setup.seed')}</h3>
        <div className="seed-row">
          <input className="seed-input" value={seed} onChange={(e) => setSeed(e.target.value)}
            spellCheck={false} maxLength={24} />
          <button className="btn btn-ghost" onClick={() => { sfx.click(); setSeed(randomSeedString()); }}>🎲</button>
        </div>

        <h3 className="cfg-label">{t('setup.chaos')}</h3>
        <div className="chaos-grid">
          {chaosCards.map((c) => (
            <button key={c.key} className={`chaos-card ${c.on ? 'on' : ''}`}
              onClick={() => { sfx.click(); c.toggle(); }}>
              <span className="chaos-emoji">{c.emoji}</span>
              <span className="chaos-name">{c.name}</span>
              <span className="chaos-desc">{c.desc}</span>
            </button>
          ))}
        </div>
        {chaosCount >= 2 && (
          <div className="warn-box">{t('setup.chaosWarn', { n: chaosCount })}</div>
        )}

        <div className="pers-chips">
          {roster.map((n) => (
            <span key={n.name} className="pers-chip" title={t(`tag.${n.name}`)}>
              {n.emoji} {t(`pers.${n.personality}`)}
            </span>
          ))}
        </div>

        <button className="btn btn-huge btn-gold cfg-generate" onClick={start}>
          {t('setup.generate')}
        </button>
      </div>
    </div>
  );
}
