import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId?: string;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
  isolate?: boolean;
  className?: string;
}

interface ErrorDisplayProps {
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId?: string;
  onRetry?: () => void;
  onReport?: () => void;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  errorInfo,
  errorId,
  onRetry,
  onReport
}) => (
  <div className="error-boundary">
    <div className="error-boundary__container">
      <div className="error-boundary__icon">
        <span className="error-icon">⚠️</span>
      </div>
      
      <div className="error-boundary__content">
        <h2 className="error-boundary__title">Something went wrong</h2>
        <p className="error-boundary__message">
          An unexpected error occurred. Please try again or report this issue.
        </p>
        
        {errorId && (
          <div className="error-boundary__id">
            <small>Error ID: {errorId}</small>
          </div>
        )}
      </div>

      <div className="error-boundary__actions">
        {onRetry && (
          <button className="btn btn-primary" onClick={onRetry}>
            Try Again
          </button>
        )}
        {onReport && (
          <button className="btn btn-secondary" onClick={onReport}>
            Report Issue
          </button>
        )}
      </div>

      <details className="error-boundary__details">
        <summary>Technical Details</summary>
        <div className="error-boundary__stack">
          {error && (
            <div className="error-stack">
              <h4>Error:</h4>
              <pre>{error.toString()}</pre>
            </div>
          )}
          {errorInfo?.componentStack && (
            <div className="component-stack">
              <h4>Component Stack:</h4>
              <pre>{errorInfo.componentStack}</pre>
            </div>
          )}
          {error?.stack && (
            <div className="error-stack-trace">
              <h4>Stack Trace:</h4>
              <pre>{error.stack}</pre>
            </div>
          )}
        </div>
      </details>
    </div>
  </div>
);

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId: number | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorId: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError } = this.props;
    
    this.setState({
      error,
      errorInfo,
      errorId: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Error Boundary Caught Error');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.groupEnd();
    }

    // Call custom error handler
    if (onError) {
      try {
        onError(error, errorInfo);
      } catch (handlerError) {
        console.error('Error in error handler:', handlerError);
      }
    }

    // Report error to monitoring service
    this.reportError(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetOnPropsChange, resetKeys } = this.props;
    const { hasError } = this.state;

    if (hasError && prevProps.resetKeys !== resetKeys) {
      if (resetOnPropsChange) {
        this.resetErrorBoundary();
      }
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  private reportError = async (error: Error, errorInfo: ErrorInfo) => {
    try {
      // Here you would integrate with your error reporting service
      // e.g., Sentry, LogRocket, etc.
      const errorReport = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      };

      // Send to error reporting service
      // await errorReportingService.report(errorReport);
      console.log('Error report (would be sent):', errorReport);
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  };

  private resetErrorBoundary = () => {
    this.resetTimeoutId = window.setTimeout(() => {
      this.setState({ 
        hasError: false, 
        error: undefined, 
        errorInfo: undefined,
        errorId: undefined 
      });
    }, 0);
  };

  private handleRetry = () => {
    this.resetErrorBoundary();
  };

  private handleReport = () => {
    const { error, errorInfo } = this.state;
    if (error && errorInfo) {
      this.reportError(error, errorInfo);
      // Show success message or navigate to feedback form
    }
  };

  render() {
    const { hasError, error, errorInfo, errorId } = this.state;
    const { children, fallback, isolate, className } = this.props;

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      const errorDisplay = (
        <ErrorDisplay
          error={error}
          errorInfo={errorInfo}
          errorId={errorId}
          onRetry={this.handleRetry}
          onReport={this.handleReport}
        />
      );

      if (isolate) {
        return (
          <div className={`error-boundary-isolate ${className || ''}`}>
            {errorDisplay}
          </div>
        );
      }

      return errorDisplay;
    }

    return children;
  }
}

// Higher-order component for wrapping components with error boundary
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) => {
  const WrappedComponent: React.FC<P> = (props) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
};

// Hook for handling errors in functional components
export const useErrorHandler = () => {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const handleError = React.useCallback((error: Error) => {
    setError(error);
  }, []);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return { handleError, resetError };
};

export default ErrorBoundary;