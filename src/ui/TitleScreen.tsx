import { useGame } from '../game/store';
import { TitleScene } from '../scene/TitleScene';
import { sfx } from '../audio/sfx';
import { useT } from './useT';
import { LangToggle } from './LangToggle';

export function TitleScreen() {
  const goSetup = useGame((s) => s.goSetup);
  const continueGame = useGame((s) => s.continueGame);
  const savedAvailable = useGame((s) => s.savedAvailable);
  const clearSave = useGame((s) => s.clearSave);
  const t = useT();

  return (
    <div className="screen title-screen">
      <div className="scene-bg"><TitleScene /></div>
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
