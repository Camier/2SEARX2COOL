// Error boundary for renderer process
// This runs in the renderer context to catch and report errors

(function() {
  'use strict';

  const errorQueue = [];
  let isReporting = false;

  // Create error info object
  function createErrorInfo(error, source, context) {
    return {
      timestamp: Date.now(),
      message: error.message || String(error),
      stack: error.stack,
      source: source,
      url: window.location.href,
      userAgent: navigator.userAgent,
      context: context || {},
      handled: false
    };
  }

  // Report errors to main process
  async function reportErrors() {
    if (isReporting || errorQueue.length === 0) return;
    
    isReporting = true;
    const errors = [...errorQueue];
    errorQueue.length = 0;

    try {
      for (const errorInfo of errors) {
        if (window.api && window.api.errors) {
          await window.api.errors.report(errorInfo);
        } else {
          console.error('Error API not available:', errorInfo);
        }
      }
    } catch (e) {
      console.error('Failed to report errors:', e);
      // Re-queue errors
      errorQueue.unshift(...errors);
    } finally {
      isReporting = false;
    }
  }

  // Global error handler
  window.addEventListener('error', function(event) {
    const errorInfo = createErrorInfo(event.error || new Error(event.message), 'window-error', {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });

    errorQueue.push(errorInfo);
    reportErrors();

    // Prevent default error handling if we successfully queued it
    if (errorQueue.includes(errorInfo)) {
      event.preventDefault();
    }
  });

  // Unhandled promise rejection handler
  window.addEventListener('unhandledrejection', function(event) {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    const errorInfo = createErrorInfo(error, 'unhandled-promise', {
      promise: event.promise
    });

    errorQueue.push(errorInfo);
    reportErrors();

    // Prevent default handling
    event.preventDefault();
  });

  // Console error interceptor
  const originalConsoleError = console.error;
  console.error = function(...args) {
    originalConsoleError.apply(console, args);

    const error = args[0] instanceof Error ? args[0] : new Error(args.join(' '));
    const errorInfo = createErrorInfo(error, 'console-error', {
      args: args.map(arg => {
        if (arg instanceof Error) return { message: arg.message, stack: arg.stack };
        if (typeof arg === 'object') return JSON.stringify(arg);
        return String(arg);
      })
    });

    errorQueue.push(errorInfo);
    reportErrors();
  };

  // Resource loading errors
  window.addEventListener('error', function(event) {
    if (event.target !== window) {
      // This is a resource loading error
      const target = event.target;
      const errorInfo = createErrorInfo(
        new Error(`Failed to load resource: ${target.src || target.href}`),
        'resource-error',
        {
          tagName: target.tagName,
          src: target.src,
          href: target.href,
          id: target.id,
          className: target.className
        }
      );

      errorQueue.push(errorInfo);
      reportErrors();
    }
  }, true);

  // Network errors for fetch/XHR
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    return originalFetch.apply(this, args).catch(error => {
      const errorInfo = createErrorInfo(error, 'fetch-error', {
        url: args[0],
        options: args[1]
      });

      errorQueue.push(errorInfo);
      reportErrors();

      throw error; // Re-throw to maintain normal error flow
    });
  };

  // XHR error handling
  const XHROpen = XMLHttpRequest.prototype.open;
  const XHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    this._errorBoundaryUrl = url;
    this._errorBoundaryMethod = method;
    return XHROpen.apply(this, [method, url, ...args]);
  };

  XMLHttpRequest.prototype.send = function(...args) {
    this.addEventListener('error', function() {
      const errorInfo = createErrorInfo(
        new Error(`XHR failed: ${this._errorBoundaryMethod} ${this._errorBoundaryUrl}`),
        'xhr-error',
        {
          method: this._errorBoundaryMethod,
          url: this._errorBoundaryUrl,
          status: this.status,
          statusText: this.statusText
        }
      );

      errorQueue.push(errorInfo);
      reportErrors();
    });

    return XHRSend.apply(this, args);
  };

  // IPC errors
  if (window.api) {
    // Wrap all API calls to catch errors
    const wrapApi = (obj, path = '') => {
      for (const key in obj) {
        const value = obj[key];
        const fullPath = path ? `${path}.${key}` : key;

        if (typeof value === 'function') {
          const original = value;
          obj[key] = async function(...args) {
            try {
              return await original.apply(this, args);
            } catch (error) {
              const errorInfo = createErrorInfo(error, 'ipc-error', {
                api: fullPath,
                args: args
              });

              errorQueue.push(errorInfo);
              reportErrors();

              throw error; // Re-throw to maintain normal error flow
            }
          };
        } else if (typeof value === 'object' && value !== null) {
          wrapApi(value, fullPath);
        }
      }
    };

    wrapApi(window.api);
  }

  // Report any queued errors periodically
  setInterval(reportErrors, 5000);

  // Report errors before page unload
  window.addEventListener('beforeunload', function() {
    if (errorQueue.length > 0) {
      // Try synchronous reporting as last resort
      if (window.api && window.api.errors && window.api.errors.reportSync) {
        window.api.errors.reportSync(errorQueue);
      }
    }
  });

  // Provide manual error reporting function
  window.reportError = function(error, context) {
    const errorInfo = createErrorInfo(
      error instanceof Error ? error : new Error(String(error)),
      'manual',
      context
    );

    errorQueue.push(errorInfo);
    reportErrors();
  };

  // Error recovery UI
  window.showErrorRecovery = function(error) {
    const recoveryUI = document.createElement('div');
    recoveryUI.id = 'error-recovery-ui';
    recoveryUI.innerHTML = `
      <style>
        #error-recovery-ui {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.9);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        #error-recovery-content {
          max-width: 600px;
          padding: 40px;
          text-align: center;
        }
        #error-recovery-ui h2 {
          color: #ff4444;
          margin-bottom: 20px;
        }
        #error-recovery-ui pre {
          background: #222;
          padding: 20px;
          border-radius: 8px;
          text-align: left;
          overflow: auto;
          max-height: 200px;
          margin: 20px 0;
          font-size: 12px;
        }
        #error-recovery-actions {
          margin-top: 30px;
        }
        #error-recovery-actions button {
          background: #4CAF50;
          color: white;
          border: none;
          padding: 12px 24px;
          margin: 0 10px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
        }
        #error-recovery-actions button:hover {
          background: #45a049;
        }
        #error-recovery-actions button.secondary {
          background: #666;
        }
        #error-recovery-actions button.secondary:hover {
          background: #555;
        }
      </style>
      <div id="error-recovery-content">
        <h2>⚠️ An Error Occurred</h2>
        <p>${error.message || 'Unknown error'}</p>
        <pre>${error.stack || 'No stack trace available'}</pre>
        <div id="error-recovery-actions">
          <button onclick="window.location.reload()">Reload Page</button>
          <button class="secondary" onclick="document.getElementById('error-recovery-ui').remove()">Dismiss</button>
          <button class="secondary" onclick="window.api.app.restart()">Restart App</button>
        </div>
      </div>
    `;

    document.body.appendChild(recoveryUI);
  };

  console.log('Error boundary initialized');
})();