import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  loadLanguage,
  translate,
  translateMessage,
  formatDate,
  LANGUAGE_KEY,
  type Language,
} from './i18n-core';
export { languageNames, type Language } from './i18n-core';

const Context = createContext<{ language: Language; setLanguage: (language: Language) => void }>({
  language: 'uz',
  setLanguage: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setCurrent] = useState<Language>(loadLanguage);
  function setLanguage(next: Language) {
    setCurrent(next);
    try {
      localStorage.setItem(LANGUAGE_KEY, next);
    } catch {
      /* Language still changes for this session. */
    }
  }
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = translate(language, 'Tempo — твой учебный ритм');
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', translate(language, 'Учись, планируй и находи время для себя.'));
  }, [language]);
  return <Context.Provider value={{ language, setLanguage }}>{children}</Context.Provider>;
}

export function useI18n() {
  const context = useContext(Context);
  const t = (key: string, values?: Record<string, string | number>) =>
    values ? translate(context.language, key, values) : translateMessage(context.language, key);
  const plural = (n: number, words: [string, string, string]) => {
    const a = n % 100;
    const b = n % 10;
    const index =
      context.language === 'ru'
        ? a > 10 && a < 20
          ? 2
          : b === 1
            ? 0
            : b >= 2 && b <= 4
              ? 1
              : 2
        : n === 1
          ? 0
          : 2;
    return t(words[index]);
  };
  const dateLabel = (date: Date, options: Intl.DateTimeFormatOptions) =>
    formatDate(context.language, date, options);
  return { ...context, t, plural, dateLabel };
}
