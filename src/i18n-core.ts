import translations from './translations.json';

export type Language = 'uz' | 'en' | 'ru';
export const LANGUAGE_KEY = 'tempo-language';
export const LOCALES: Record<Language, string> = { uz: 'uz-UZ', en: 'en-GB', ru: 'ru-RU' };
export const languageNames: Record<Language, string> = {
  uz: 'O‘zbekcha',
  en: 'English',
  ru: 'Русский',
};
const dictionary: Record<string, string[]> = translations;

export function translate(
  language: Language,
  key: string,
  values: Record<string, string | number> = {},
) {
  const text = language === 'ru' ? key : (dictionary[key]?.[language === 'uz' ? 0 : 1] ?? key);
  return text.replace(/\{(\w+)\}/g, (match, name: string) => String(values[name] ?? match));
}

export function translateMessage(language: Language, text: string): string {
  for (const prefix of [
    'Ошибка в расписании',
    'У группы уже есть занятие',
    'Аудитория уже занята',
    'Преподаватель уже занят',
  ]) {
    if (text.startsWith(`${prefix}: `))
      return `${translate(language, prefix)}: ${translateMessage(language, text.slice(prefix.length + 2))}`;
  }
  return translate(language, text);
}

export function loadLanguage(): Language {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    return saved === 'ru' || saved === 'en' || saved === 'uz' ? saved : 'uz';
  } catch {
    return 'uz';
  }
}

export function formatDate(
  language: Language,
  date: Date,
  options: Intl.DateTimeFormatOptions,
): string {
  // Some embedded browsers ship incomplete Uzbek ICU data and display months as M01…M12.
  if (language !== 'uz') return new Intl.DateTimeFormat(LOCALES[language], options).format(date);
  const months = [
    'yanvar',
    'fevral',
    'mart',
    'aprel',
    'may',
    'iyun',
    'iyul',
    'avgust',
    'sentabr',
    'oktabr',
    'noyabr',
    'dekabr',
  ];
  const day = options.day
    ? options.day === '2-digit'
      ? String(date.getDate()).padStart(2, '0')
      : String(date.getDate())
    : '';
  const month = !options.month
    ? ''
    : options.month === 'numeric' || options.month === '2-digit'
      ? String(date.getMonth() + 1).padStart(options.month === '2-digit' ? 2 : 1, '0')
      : options.month === 'short'
        ? months[date.getMonth()].slice(0, 3)
        : months[date.getMonth()];
  const year = options.year
    ? String(date.getFullYear()).slice(options.year === '2-digit' ? -2 : 0)
    : '';
  return [day, month, year]
    .filter(Boolean)
    .join(options.month === 'numeric' || options.month === '2-digit' ? '.' : ' ');
}
