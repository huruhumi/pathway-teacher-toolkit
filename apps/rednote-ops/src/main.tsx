import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AppQueryProvider } from '@shared/providers/QueryProvider';
import { installGlobalErrorHandlers } from '@shared/services/logger';

installGlobalErrorHandlers();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppQueryProvider>
      <App />
    </AppQueryProvider>
  </StrictMode>,
);
