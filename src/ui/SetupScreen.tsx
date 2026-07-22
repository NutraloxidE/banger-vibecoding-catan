import { useMemo, useState } from 'react';
import { useGame } from '../game/store';
import { MatchConfig, MapSize, Difficulty } from '../game/types';
import { MAP_RADIUS } from '../game/board';
import { randomSeedString, RNG } from '../game/rng';
import { NPC_POOL } from '../game/names';
import { sfx } from '../audio/sfx';
import { useT } from './useT';
import { LangToggle } from './LangToggle';

const MAP_TILES: Record<MapSize, number> = { small: 19, medium: 37, large: 61 };

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

  const chaosCount = [turbo, friendlyRobber, maximumSheep].filter(Boolean).length;

  const previewHexes = useMemo(() => {
    const rng = new RNG(seed + mapSize);
    const colors = ['#2f8f4a', '#c06a3d', '#e3c24a', '#8fd05e', '#8d93a1', '#e0cd8f'];
    return Array.from({ length: MAP_TILES[mapSize] }, () => colors[rng.int(colors.length)]);
  }, [seed, mapSize]);

  const start = () => {
    sfx.buildBig();
    const config: MatchConfig = {
      mapSize, npcCount, difficulty, targetVp,
      seed: seed.trim() || randomSeedString(),
      worldEvents,
      chaos: { turbo, friendlyRobber, maximumSheep, drama },
    };
    newGame(config);
  };

  const estMinutes = Math.round((targetVp * (turbo ? 1.4 : 2.2) * (MAP_RADIUS[mapSize] + 1)) / 3);

  return (
    <div className="screen setup-screen">
      <div className="setup-lang"><LangToggle /></div>
      <div className="setup-panel">
        <h2 className="setup-title">{t('setup.title')}</h2>

        <div className="setup-grid">
          <section className="setup-card">
            <h3>{t('setup.mapSize')}</h3>
            <div className="seg">
              {(['small', 'medium', 'large'] as MapSize[]).map((m) => (
                <button key={m} className={`seg-btn ${mapSize === m ? 'on' : ''}`}
                  onClick={() => { sfx.click(); setMapSize(m); }}>
                  {t(`setup.${m}`)} <span className="dim">{t('setup.hexes', { n: MAP_TILES[m] })}</span>
                </button>
              ))}
            </div>
            <div className="hex-preview">
              {previewHexes.map((c, i) => (
                <span key={i} className="hex-dot" style={{ background: c }} />
              ))}
            </div>
          </section>

          <section className="setup-card">
            <h3>{t('setup.rivals')}</h3>
            <div className="seg">
              {[1, 2, 3].map((n) => (
                <button key={n} className={`seg-btn ${npcCount === n ? 'on' : ''}`}
                  onClick={() => { sfx.click(); setNpcCount(n); }}>
                  {t(n > 1 ? 'setup.npcs' : 'setup.npc', { n })}
                </button>
              ))}
            </div>
            <div className="npc-roster">
              {NPC_POOL.slice(0, 4).map((n) => (
                <div key={n.name} className="npc-mini" title={`${t(`pers.${n.personality}`)} — ${t(`tag.${n.name}`)}`}>
                  <span className="npc-mini-emoji">{n.emoji}</span> {n.name}
                </div>
              ))}
              <div className="dim tiny">{t('setup.pool', { n: NPC_POOL.length })}</div>
            </div>
            <h3>{t('setup.difficulty')}</h3>
            <div className="seg">
              {(['chill', 'normal', 'ruthless'] as Difficulty[]).map((d) => (
                <button key={d} className={`seg-btn ${difficulty === d ? 'on' : ''}`}
                  onClick={() => { sfx.click(); setDifficulty(d); }}>
                  {t(`diff.${d}`)}
                </button>
              ))}
            </div>
          </section>

          <section className="setup-card">
            <h3>{t('setup.victoryTarget', { n: targetVp })}</h3>
            <input type="range" min={7} max={14} value={targetVp}
              onChange={(e) => setTargetVp(Number(e.target.value))} />
            <div className="dim tiny">{t('setup.estMatch', { n: estMinutes })}</div>
            <h3>{t('setup.seed')}</h3>
            <div className="seed-row">
              <input className="seed-input" value={seed} onChange={(e) => setSeed(e.target.value)}
                spellCheck={false} maxLength={24} />
              <button className="btn btn-ghost" onClick={() => { sfx.click(); setSeed(randomSeedString()); }}>🎲</button>
            </div>
            <label className="chk">
              <input type="checkbox" checked={worldEvents} onChange={(e) => setWorldEvents(e.target.checked)} />
              {t('setup.worldEvents')}
            </label>
          </section>

          <section className="setup-card">
            <h3>{t('setup.chaos')}</h3>
            <label className="chk">
              <input type="checkbox" checked={turbo} onChange={(e) => setTurbo(e.target.checked)} />
              <span dangerouslySetInnerHTML={{ __html: t('setup.turbo') }} />
            </label>
            <label className="chk">
              <input type="checkbox" checked={friendlyRobber} onChange={(e) => setFriendlyRobber(e.target.checked)} />
              <span dangerouslySetInnerHTML={{ __html: t('setup.friendly') }} />
            </label>
            <label className="chk">
              <input type="checkbox" checked={maximumSheep} onChange={(e) => setMaximumSheep(e.target.checked)} />
              <span dangerouslySetInnerHTML={{ __html: t('setup.maxSheep') }} />
            </label>
            <label className="chk">
              <input type="checkbox" checked={drama} onChange={(e) => setDrama(e.target.checked)} />
              <span dangerouslySetInnerHTML={{ __html: t('setup.drama') }} />
            </label>
            {chaosCount >= 2 && (
              <div className="warn-box">{t('setup.chaosWarn', { n: chaosCount })}</div>
            )}
          </section>
        </div>

        <div className="setup-footer">
          <button className="btn btn-ghost" onClick={() => { sfx.click(); goTitle(); }}>{t('setup.back')}</button>
          <button className="btn btn-huge btn-gold" onClick={start}>{t('setup.generate')}</button>
        </div>
      </div>
    </div>
  );
}
