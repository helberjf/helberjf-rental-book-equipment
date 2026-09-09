import { pt } from './translations.js';

let language = typeof localStorage === 'undefined' ? 'pt-BR' : localStorage.getItem('rental-book-language') || 'pt-BR';
if (typeof document !== 'undefined') document.documentElement.lang = language === 'en' ? 'en-GB' : 'pt-BR';
export const getLanguage = () => language;
export const getLocale = () => language === 'en' ? 'en-GB' : 'pt-BR';
export function setLanguage(value) {
  language = value === 'en' ? 'en' : 'pt-BR';
  localStorage.setItem('rental-book-language', language);
  document.documentElement.lang = getLocale();
  window.dispatchEvent(new Event('rental-language'));
}
export const t = (text) => language === 'en' ? text : pt[text] ?? text;
