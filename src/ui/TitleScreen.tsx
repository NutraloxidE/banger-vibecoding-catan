import { useMemo, useRef, useState } from 'react';
import { useGame } from '../game/store';
import { TitleScene } from '../scene/TitleScene';
import {
  DEFAULT_TILE_PALETTE_TUNING,
  TilePaletteColors,
  TilePaletteTuning,
} from '../scene/Tiles';
import { sfx } from '../audio/sfx';
import { useT } from './useT';
import { LangToggle } from './LangToggle';

const CALIBRATION_TAP_GAP_MS = 900;
const COLOR_CONTROLS: { key: keyof TilePaletteColors; label: string }[] = [
  { key: 'forest', label: '森' },
  { key: 'fields', label: '麦' },
  { key: 'mountains', label: '石' },
  { key: 'pasture', label: '羊' },
  { key: 'hills', label: '土' },
  { key: 'desert', label: '砂漠' },
  { key: 'sand', label: '砂浜' },
  { key: 'sandSide', label: '側面' },
];

function defaultTuning(): TilePaletteTuning {
  return {
    ...DEFAULT_TILE_PALETTE_TUNING,
    colors: { ...DEFAULT_TILE_PALETTE_TUNING.colors },
  };
}

function tuningText(tuning: TilePaletteTuning) {
  return [
    'HEXFALL_TILE_PALETTE_V2',
    JSON.stringify({
      lightness: Number(tuning.lightness.toFixed(3)),
      saturation: Number(tuning.saturation.toFixed(3)),
      facetContrast: Number(tuning.facetContrast.toFixed(3)),
      sandLightness: Number(tuning.sandLightness.toFixed(3)),
      colors: tuning.colors,
    }),
  ].join('\n');
}

export function TitleScreen() {
  const goSetup = useGame((s) => s.goSetup);
  const continueGame = useGame((s) => s.continueGame);
  const savedAvailable = useGame((s) => s.savedAvailable);
  const clearSave = useGame((s) => s.clearSave);
  const t = useT();
  const [paletteTuning, setPaletteTuning] = useState<TilePaletteTuning>(defaultTuning);
  const [calibrationOpen, setCalibrationOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const tapSequence = useRef({ count: 0, lastAt: 0 });
  const calibrationText = useMemo(() => tuningText(paletteTuning), [paletteTuning]);

  const unlockCalibration = () => {
    const now = performance.now();
    const count = now - tapSequence.current.lastAt <= CALIBRATION_TAP_GAP_MS
      ? tapSequence.current.count + 1
      : 1;
    tapSequence.current = { count, lastAt: now };
    if (count >= 7) {
      tapSequence.current = { count: 0, lastAt: 0 };
      setCalibrationOpen(true);
    }
  };

  const updateTuning = (key: keyof TilePaletteTuning, value: number) => {
    setCopied(false);
    setPaletteTuning((current) => ({ ...current, [key]: value }));
  };

  const updateColor = (key: keyof TilePaletteColors, value: string) => {
    setCopied(false);
    setPaletteTuning((current) => ({
      ...current,
      colors: { ...current.colors, [key]: value.toLowerCase() },
    }));
  };

  const copyCalibrationText = async () => {
    try {
      await navigator.clipboard.writeText(calibrationText);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = calibrationText;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    setCopied(true);
  };

  return (
    <div className="screen title-screen">
      <div className="scene-bg"><TitleScene paletteTuning={paletteTuning} /></div>
      {!calibrationOpen && (
        <button
          type="button"
          className="palette-calibration-hotspot"
          tabIndex={-1}
          aria-label="Open tile palette calibration"
          onPointerDown={unlockCalibration}
        />
      )}
      {calibrationOpen && (
        <section className="palette-calibration-panel" aria-label="Tile palette calibration">
          <div className="palette-calibration-head">
            <div>
              <div className="palette-calibration-kicker">HIDDEN TOOL</div>
              <h2>タイル配色調整</h2>
            </div>
            <button type="button" className="palette-calibration-close" onClick={() => setCalibrationOpen(false)} aria-label="閉じる">×</button>
          </div>
          <label>
            <span>明るさ <output>{paletteTuning.lightness.toFixed(3)}</output></span>
            <input type="range" min="-0.1" max="0.3" step="0.005" value={paletteTuning.lightness}
              onInput={(event) => updateTuning('lightness', Number(event.currentTarget.value))} />
          </label>
          <label>
            <span>彩度 <output>{paletteTuning.saturation.toFixed(2)}×</output></span>
            <input type="range" min="0.25" max="1.5" step="0.01" value={paletteTuning.saturation}
              onInput={(event) => updateTuning('saturation', Number(event.currentTarget.value))} />
          </label>
          <label>
            <span>濃淡差 <output>{paletteTuning.facetContrast.toFixed(3)}</output></span>
            <input type="range" min="0" max="0.12" step="0.005" value={paletteTuning.facetContrast}
              onInput={(event) => updateTuning('facetContrast', Number(event.currentTarget.value))} />
          </label>
          <label>
            <span>砂浜の明るさ <output>{paletteTuning.sandLightness.toFixed(3)}</output></span>
            <input type="range" min="-0.1" max="0.2" step="0.005" value={paletteTuning.sandLightness}
              onInput={(event) => updateTuning('sandLightness', Number(event.currentTarget.value))} />
          </label>
          <div className="palette-calibration-section-title">ベース色</div>
          <div className="palette-calibration-colors">
            {COLOR_CONTROLS.map(({ key, label }) => (
              <label className="palette-calibration-color" key={key}>
                <span>{label} <output>{paletteTuning.colors[key]}</output></span>
                <input
                  type="color"
                  value={paletteTuning.colors[key]}
                  aria-label={`${label}の色`}
                  onInput={(event) => updateColor(key, event.currentTarget.value)}
                />
              </label>
            ))}
          </div>
          <textarea className="palette-calibration-text" readOnly value={calibrationText} aria-label="コピー用の調整値" />
          <div className="palette-calibration-actions">
            <button type="button" className="btn btn-ghost" onClick={() => {
              setCopied(false);
              setPaletteTuning(defaultTuning());
            }}>初期値に戻す</button>
            <button type="button" className="btn btn-gold" onClick={copyCalibrationText}>
              {copied ? 'コピーしました' : '調整値をコピー'}
            </button>
          </div>
          <p>コピーしたテキストをCodexへそのまま貼り付けてください。</p>
        </section>
      )}
      <div className="title-lang"><LangToggle /></div>
      <div className="title-overlay">
        <div className="title-block">
          <div className="title-kicker">{t('title.kicker')}</div>
          <h1 className="title-logo">HEXFALL</h1>
          <div className="title-sub">{t('title.sub')}</div>
        </div>
        <div className="title-buttons">
          <button
            className="btn btn-huge btn-gold"
            onClick={() => { sfx.click(); sfx.startMusic(); goSetup(); }}
          >
            {t('title.start')}
          </button>
          {savedAvailable && (
            <button className="btn btn-big" onClick={() => { sfx.click(); sfx.startMusic(); continueGame(); }}>
              {t('title.continue')}
            </button>
          )}
          {savedAvailable && (
            <button className="btn btn-ghost" onClick={() => { sfx.click(); clearSave(); }}>
              {t('title.reset')}
            </button>
          )}
        </div>
        <div className="title-footer">{t('title.footer')}</div>
      </div>
    </div>
  );
}
