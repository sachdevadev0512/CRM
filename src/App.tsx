import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import FormPortal from './components/FormPortal';
import { isSupabaseConfigured } from './services/dbService';
import { ShieldAlert } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';

const AdminCRM = lazy(() => import('./components/AdminCRM'));

export default function App() {
  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-neutral-900 text-white flex flex-col justify-center items-center p-6 text-center" id="config-error-root">
        <div className="w-full max-w-md bg-neutral-950 border border-neutral-800 rounded-2xl p-8 shadow-xl space-y-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-950/80 border border-red-900/60 text-red-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight text-neutral-100">Supabase is not configured</h1>
            <p className="text-neutral-400 text-xs leading-relaxed">
              The database environment variables are missing or invalid. Please configure your project credentials to continue.
            </p>
          </div>
          <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-lg text-left text-xs space-y-2 font-mono text-neutral-300">
            <div className="text-neutral-500 font-bold text-[10px] uppercase tracking-wider">Required Environment Keys</div>
            <div className="flex justify-between items-center text-[11px] pt-1 border-t border-neutral-800">
              <span>VITE_SUPABASE_URL</span>
              <span className="text-red-400 font-bold">MISSING / PLACEHOLDER</span>
            </div>
            <div className="flex justify-between items-center text-[11px] pt-1">
              <span>VITE_SUPABASE_ANON_KEY</span>
              <span className="text-red-400 font-bold">MISSING / PLACEHOLDER</span>
            </div>
          </div>
          <p className="text-[11px] text-neutral-500 leading-relaxed">
            Please add actual values for these keys in the <b>Secrets panel</b> (Settings / Environment Variables) or your local <b>.env</b> configuration file.
          </p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-neutral-50/50 flex flex-col font-sans" id="mv-app-root">
        <main className="flex-1 overflow-y-auto">
          <Routes>
            {/* Route / -> FormPortal (public, no auth, no admin code loaded) */}
            <Route path="/" element={<ErrorBoundary fallbackTitle="Form Submission Error"><FormPortal /></ErrorBoundary>} />

            {/* Route /admin/* -> the CRM shell, lazy-loaded */}
            <Route
              path="/admin/*"
              element={
                <ErrorBoundary fallbackTitle="Admin CRM Error">
                  <Suspense
                    fallback={
                      <div className="flex flex-col items-center justify-center min-h-screen gap-3 bg-neutral-50/50">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900"></div>
                        <span className="text-xs text-neutral-400 font-mono">Loading Admin CRM...</span>
                      </div>
                    }
                  >
                    <AdminCRM />
                  </Suspense>
                </ErrorBoundary>
              }
            />

            {/* Fallback routing */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
