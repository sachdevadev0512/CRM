import ErrorBoundary from '../../../shared/src/ErrorBoundary';
import FormPortal from '../FormPortal';

export default function ApplyNow() {
  return (
    <div className="bg-neutral-50 font-sans text-neutral-900 rounded-2xl overflow-hidden">
      <ErrorBoundary fallbackTitle="Form Submission Error">
        <FormPortal />
      </ErrorBoundary>
    </div>
  );
}
