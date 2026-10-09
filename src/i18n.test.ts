import { afterEach, describe, expect, it, vi } from 'vitest';
import source from './App.tsx?raw';
import { formatDate, loadLanguage, translate, translateMessage } from './i18n-core';
import translations from './translations.json';
import { DAYS, SHORT_DAYS, TYPES, FREQUENCIES } from './model';

afterEach(() => vi.unstubAllGlobals());

describe('languages', () => {
  it('defaults to Uzbek and respects an explicitly saved language', () => {
    vi.stubGlobal('localStorage', { getItem: () => null });
    expect(loadLanguage()).toBe('uz');
    vi.stubGlobal('localStorage', { getItem: () => 'en' });
    expect(loadLanguage()).toBe('en');
    vi.stubGlobal('localStorage', { getItem: () => 'fr' });
    expect(loadLanguage()).toBe('uz');
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
    });
    expect(loadLanguage()).toBe('uz');
  });
  it('has Uzbek and English translations for every static interface key', () => {
    const keys = [...source.matchAll(/\bt\('([^']+)'/g)].map((match) => match[1]);
    for (const key of [...keys, ...DAYS, ...SHORT_DAYS, ...TYPES, ...Object.values(FREQUENCIES)]) {
      expect(Object.hasOwn(translations, key), key).toBe(true);
      expect(translate('en', key), key).not.toMatch(/[А-Яа-яЁё]/);
      expect(translate('uz', key), key).not.toMatch(/[А-Яа-яЁё]/);
    }
  });
  it('preserves interpolation placeholders in every translation', () => {
    for (const [key, values] of Object.entries(translations)) {
      expect(values).toHaveLength(2);
      const placeholders = (text: string) =>
        [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      for (const value of values) {
        expect(value.trim()).not.toBe('');
        expect(placeholders(value), key).toEqual(placeholders(key));
      }
    }
    expect(translate('en', '{count} дисциплин в пространстве', { count: 6 })).toBe(
      '6 subjects in your workspace',
    );
  });
  it('translates nested validation errors without translating user data', () => {
    expect(
      translateMessage(
        'en',
        'Ошибка в расписании: Преподаватель уже занят: Loyihalarni boshqarish, 09:00–10:20.',
      ),
    ).toBe('Schedule error: The teacher is already busy: Loyihalarni boshqarish, 09:00–10:20.');
    expect(translateMessage('uz', 'Sattarova Sapura Beknazarovna')).toBe(
      'Sattarova Sapura Beknazarovna',
    );
  });
  it('formats Uzbek dates even in browsers without Uzbek ICU data', () => {
    const date = new Date(2026, 9, 9);
    expect(formatDate('uz', date, { day: 'numeric', month: 'long', year: 'numeric' })).toBe(
      '9 oktabr 2026',
    );
    expect(formatDate('uz', date, { day: '2-digit', month: '2-digit', year: 'numeric' })).toBe(
      '09.10.2026',
    );
    expect(formatDate('en', date, { day: 'numeric', month: 'long' })).toBe('9 October');
  });
});
