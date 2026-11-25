import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { initSecureStore } from './secureStore.js';
import './styles.css';

initSecureStore().finally(() => createRoot(document.getElementById('root')).render(<App />));
