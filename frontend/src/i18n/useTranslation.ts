import { useApp } from '../context/AppContext';
import { translations, Translations, Language } from './translations';

export interface UseTranslationReturn {
  t: ((key: keyof Translations) => string) & Translations;
  language: Language;
  setLanguage: (lang: Language) => void;
}

export function useTranslation(): UseTranslationReturn {
  const { language, setLanguage } = useApp();
  const dict = translations[language] || translations.de;

  const tFunc = ((key: keyof Translations) => {
    return dict[key] || translations.de[key] || String(key);
  }) as ((key: keyof Translations) => string) & Translations;

  Object.assign(tFunc, dict);

  return { t: tFunc, language, setLanguage };
}
