import { useGame } from '../game/store';
import { t as rawT, Lang } from '../i18n';

// React hook: returns a translator bound to the current language so components
// re-render when the language setting changes.
export function useT() {
  const lang = useGame((s) => s.settings.lang) as Lang;
  return (key: string, params?: Record<string, string | number>) => rawT(key, params, lang);
}

export function useLang(): Lang {
  return useGame((s) => s.settings.lang) as Lang;
}
