/**
 * @file LanguageProvider.jsx
 * @description React Context for multi-language support (i18n).
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations } from './translations';

const LanguageContext = createContext(null);

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('sarvas_lang') || 'en';
  });

  useEffect(() => {
    localStorage.setItem('sarvas_lang', language);
    document.documentElement.lang = language;
  }, [language]);

  const t = useCallback((key) => {
    const dict = translations[language] || translations['en'];
    // Fallback to English if key is missing in Hindi
    return dict[key] || translations['en'][key] || key;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}
