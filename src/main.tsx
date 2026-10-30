import React from 'react';
import ReactDOM from 'react-dom/client';
import CloudApp from './CloudApp';
import './styles.css';
import { LanguageProvider } from './i18n';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LanguageProvider>
      <CloudApp />
    </LanguageProvider>
  </React.StrictMode>,
);
