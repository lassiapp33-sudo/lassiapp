import fr from './fr';
import en from './en';
import useLanguageStore from '../store/languageStore';

export type { Translations } from './types';
export type { Lang } from '../store/languageStore';

export function useT() {
  const lang = useLanguageStore(s => s.lang);
  return lang === 'en' ? en : fr;
}
