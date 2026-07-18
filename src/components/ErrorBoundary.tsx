import * as React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: React.ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error inside ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center" id="error-boundary-screen">
          <div className="w-full max-w-md bg-white border border-neutral-200 rounded-2xl p-8 shadow-xs space-y-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 border border-red-150">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">
                {this.props.fallbackTitle || 'Something went wrong'}
              </h1>
              <p className="text-neutral-500 text-xs leading-relaxed">
                The application encountered an unexpected runtime error and could not render this screen. 
                Your session is safe. You can try refreshing the view.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-neutral-50 border border-neutral-250 rounded-lg text-left overflow-x-auto max-h-32 text-[10px] font-mono text-neutral-600">
                <span className="font-bold text-neutral-800">Error:</span>{' '}
                {(import.meta as any).env.PROD
                  ? 'An unexpected application error occurred. Diagnostic details have been recorded.'
                  : this.state.error.message}
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-850 text-white font-semibold text-xs rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-3xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
