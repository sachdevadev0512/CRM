import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

document.title = 'Middha Ventures Startup intake';

// Turnstile is only needed by the form, so it is not loaded on the marketing site.
const turnstileScript = document.createElement('script');
turnstileScript.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
turnstileScript.async = true;
turnstileScript.defer = true;
document.head.appendChild(turnstileScript);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
