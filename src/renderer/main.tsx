import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/app.css';

// Error handling for unhandled rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  window.api?.error?.report?.(event.reason);
});

// Initialize React application
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find root element');
}

const root = ReactDOM.createRoot(rootElement);

// Render the application
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Hot Module Replacement (HMR) support for development
if (module.hot) {
  module.hot.accept('./App', () => {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  });
}

// Log app initialization
console.log('2SEARX2COOL Renderer Process Initialized');

// Analytics tracking
window.api?.analytics?.trackEvent?.('app_start', {
  timestamp: new Date().toISOString(),
  version: process.env.npm_package_version || '1.0.0'
});