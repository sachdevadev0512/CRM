import FormPortal from './FormPortal';
import ErrorBoundary from '../../shared/src/ErrorBoundary';

export default function App() {
  return (
    <div className="min-h-screen bg-neutral-50/50 flex flex-col font-sans" id="mv-app-root">
      <main className="flex-1 overflow-y-auto">
        <ErrorBoundary fallbackTitle="Form Submission Error">
          <FormPortal />
        </ErrorBoundary>
      </main>
    </div>
  );
}
