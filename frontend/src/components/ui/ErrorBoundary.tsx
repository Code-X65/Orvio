import * as React from 'react';
import { ErrorState } from './ErrorState';
import { RefreshCw, ArrowLeft } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Unhandled React ErrorBoundary caught an exception:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorState
          error={this.state.error}
          title="Something Went Wrong"
          description="An unexpected error occurred while rendering this view. You can reload the page or return to your launchpad."
          onRetry={this.handleReset}
          secondaryAction={{
            label: 'Return to Launchpad',
            href: '/dashboard',
            icon: <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />,
          }}
          variant="page"
        />
      );
    }

    return this.props.children;
  }
}
