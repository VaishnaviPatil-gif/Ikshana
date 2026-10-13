/**
 * @file LanguageToggle.jsx
 * @description Button component to toggle between English and Hindi.
 */
import React from 'react';
import { useLanguage } from './LanguageProvider';

export function LanguageToggle({ style = {} }) {
  const { language, setLanguage } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'hi' : 'en');
  };

  return (
    <button
      onClick={toggleLanguage}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px 8px',
        background: 'transparent',
        border: '1px solid #cbd5e1',
        borderRadius: '4px',
        color: '#0f2e59',
        fontSize: '0.75rem',
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'all 0.2s',
        ...style
      }}
      title={language === 'en' ? 'Switch to Hindi' : 'Switch to English'}
    >
      {language === 'en' ? 'हि' : 'EN'}
    </button>
  );
}

export default LanguageToggle;
