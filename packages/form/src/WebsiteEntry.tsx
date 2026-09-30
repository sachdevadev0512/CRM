import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './website/index.css';
import App from './website/App.jsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
