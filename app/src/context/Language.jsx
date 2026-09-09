import { useSyncExternalStore } from 'react';
import { getLanguage, setLanguage, t } from '../domain/language';
const subscribe = (callback) => {
  window.addEventListener('rental-language', callback);
  return () => window.removeEventListener('rental-language', callback);
};
// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage() { return useSyncExternalStore(subscribe, getLanguage, () => 'pt-BR'); }
export default function LanguageSelect() {
  const language = useLanguage();
  return <label className="language-select">{t('Language')}<select aria-label={t('System language')} value={language} onChange={e => setLanguage(e.target.value)}><option value="pt-BR">Português</option><option value="en">English</option></select></label>;
}
