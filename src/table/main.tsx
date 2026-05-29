import React from 'react';
import { createRoot } from 'react-dom/client';
import { TableApp } from './TableApp';
import '../styles/index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <TableApp />
  </React.StrictMode>
);
