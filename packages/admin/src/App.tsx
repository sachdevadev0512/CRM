import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AdminCRM from './AdminCRM';
import ErrorBoundary from '../../shared/src/ErrorBoundary';

export default function App() {
  return (
    <BrowserRouter basename="/admin">
      <div className="min-h-screen bg-neutral-50/50 flex flex-col font-sans" id="mv-app-root">
        <main className="flex-1 overflow-y-auto">
          <ErrorBoundary fallbackTitle="Admin CRM Error">
            <Routes>
              <Route path="/*" element={<AdminCRM />} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </BrowserRouter>
  );
}
