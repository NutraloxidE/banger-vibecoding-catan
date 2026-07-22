import { useGame } from '../game/store';
import { LANGS, LANG_LABEL, Lang } from '../i18n';
import { sfx } from '../audio/sfx';

// Small EN / 日本語 segmented toggle, reused on the title, setup, and HUD.
export function LangToggle({ compact }: { compact?: boolean }) {
  const lang = useGame((s) => s.settings.lang);
  const setSetting = useGame((s) => s.setSetting);
  return (
    <div className={`lang-toggle ${compact ? 'compact' : ''}`}>
      {LANGS.map((l: Lang) => (
        <button key={l} className={`lang-btn ${lang === l ? 'on' : ''}`}
          onClick={() => { sfx.click(); setSetting('lang', l); }}>
          {LANG_LABEL[l]}
        </button>
      ))}
    </div>
  );
}
