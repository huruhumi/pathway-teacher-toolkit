import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AppQueryProvider } from '@shared/providers/QueryProvider';
import { installGlobalErrorHandlers } from '@shared/services/logger';

installGlobalErrorHandlers();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppQueryProvider>
      <App />
    </AppQueryProvider>
  </React.StrictMode>
);