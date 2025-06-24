import React from 'react';

type SpinnerSize = 'small' | 'medium' | 'large';
type SpinnerVariant = 'primary' | 'secondary' | 'light' | 'dark';

interface LoadingSpinnerProps {
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  message?: string;
  overlay?: boolean;
  className?: string;
}

const sizeClasses: Record<SpinnerSize, string> = {
  small: 'spinner-small',
  medium: 'spinner-medium',
  large: 'spinner-large'
};

const variantClasses: Record<SpinnerVariant, string> = {
  primary: 'spinner-primary',
  secondary: 'spinner-secondary',
  light: 'spinner-light',
  dark: 'spinner-dark'
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  variant = 'primary',
  message,
  overlay = false,
  className = ''
}) => {
  const spinnerClasses = [
    'loading-spinner',
    sizeClasses[size],
    variantClasses[variant],
    className
  ].filter(Boolean).join(' ');

  const SpinnerElement = (
    <div className={spinnerClasses}>
      <div className="spinner-circle">
        <div className="spinner-inner"></div>
      </div>
      {message && (
        <div className="spinner-message">
          {message}
        </div>
      )}
    </div>
  );

  if (overlay) {
    return (
      <div className="loading-overlay">
        <div className="loading-overlay__backdrop"></div>
        <div className="loading-overlay__content">
          {SpinnerElement}
        </div>
      </div>
    );
  }

  return SpinnerElement;
};

// Specialized components for common use cases
export const LoadingOverlay: React.FC<Omit<LoadingSpinnerProps, 'overlay'>> = (props) => (
  <LoadingSpinner {...props} overlay={true} />
);

export const InlineSpinner: React.FC<Omit<LoadingSpinnerProps, 'size' | 'overlay'>> = (props) => (
  <LoadingSpinner {...props} size="small" overlay={false} />
);

export const FullPageSpinner: React.FC<Omit<LoadingSpinnerProps, 'size' | 'overlay'>> = (props) => (
  <LoadingSpinner {...props} size="large" overlay={true} />
);

// Hook for managing loading states
export const useLoading = (initialState = false) => {
  const [isLoading, setIsLoading] = React.useState(initialState);
  const [loadingMessage, setLoadingMessage] = React.useState<string | undefined>();

  const startLoading = (message?: string) => {
    setLoadingMessage(message);
    setIsLoading(true);
  };

  const stopLoading = () => {
    setIsLoading(false);
    setLoadingMessage(undefined);
  };

  return {
    isLoading,
    loadingMessage,
    startLoading,
    stopLoading
  };
};

export default LoadingSpinner;