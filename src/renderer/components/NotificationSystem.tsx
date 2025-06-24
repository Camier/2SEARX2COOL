import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';

type NotificationType = 'success' | 'error' | 'warning' | 'info';
type NotificationPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';

interface Notification {
  id: string;
  type: NotificationType;
  title?: string;
  message: string;
  duration?: number; // 0 = persistent
  actions?: NotificationAction[];
  icon?: string;
  timestamp: number;
}

interface NotificationAction {
  label: string;
  action: () => void;
  style?: 'primary' | 'secondary' | 'danger';
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  success: (message: string, options?: Partial<Omit<Notification, 'type' | 'id' | 'timestamp'>>) => string;
  error: (message: string, options?: Partial<Omit<Notification, 'type' | 'id' | 'timestamp'>>) => string;
  warning: (message: string, options?: Partial<Omit<Notification, 'type' | 'id' | 'timestamp'>>) => string;
  info: (message: string, options?: Partial<Omit<Notification, 'type' | 'id' | 'timestamp'>>) => string;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationSystemProps {
  position?: NotificationPosition;
  maxNotifications?: number;
  defaultDuration?: number;
  className?: string;
}

const NotificationItem: React.FC<{
  notification: Notification;
  onClose: (id: string) => void;
  position: NotificationPosition;
}> = ({ notification, onClose, position }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (notification.duration && notification.duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, notification.duration);
      return () => clearTimeout(timer);
    }
  }, [notification.duration]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onClose(notification.id);
    }, 300); // Match CSS transition duration
  };

  const getTypeIcon = () => {
    if (notification.icon) return notification.icon;
    
    switch (notification.type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '';
    }
  };

  const getTypeClass = () => {
    return `notification-${notification.type}`;
  };

  const getAnimationClass = () => {
    const baseClass = 'notification-item';
    const positionClass = position.includes('right') ? 'slide-right' : 'slide-left';
    
    if (isLeaving) return `${baseClass} ${positionClass} leaving`;
    if (isVisible) return `${baseClass} ${positionClass} visible`;
    return `${baseClass} ${positionClass}`;
  };

  return (
    <div className={`${getAnimationClass()} ${getTypeClass()}`}>
      <div className="notification-content">
        <div className="notification-icon">
          {getTypeIcon()}
        </div>
        
        <div className="notification-body">
          {notification.title && (
            <div className="notification-title">
              {notification.title}
            </div>
          )}
          <div className="notification-message">
            {notification.message}
          </div>
          
          {notification.actions && notification.actions.length > 0 && (
            <div className="notification-actions">
              {notification.actions.map((action, index) => (
                <button
                  key={index}
                  className={`notification-action ${action.style || 'secondary'}`}
                  onClick={() => {
                    action.action();
                    handleClose();
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <button
          className="notification-close"
          onClick={handleClose}
          aria-label="Close notification"
        >
          ×
        </button>
      </div>
      
      {notification.duration && notification.duration > 0 && (
        <div 
          className="notification-progress"
          style={{
            animationDuration: `${notification.duration}ms`
          }}
        />
      )}
    </div>
  );
};

export const NotificationSystem: React.FC<NotificationSystemProps> = ({
  position = 'top-right',
  maxNotifications = 5,
  defaultDuration = 5000,
  className = ''
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: Date.now(),
      duration: notification.duration ?? defaultDuration
    };

    setNotifications(prev => {
      const updated = [newNotification, ...prev];
      // Limit total notifications
      return updated.slice(0, maxNotifications);
    });

    return id;
  }, [maxNotifications, defaultDuration]);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Convenience methods
  const success = useCallback((message: string, options?: Partial<Omit<Notification, 'type' | 'id' | 'timestamp'>>) => {
    return addNotification({ ...options, type: 'success', message });
  }, [addNotification]);

  const error = useCallback((message: string, options?: Partial<Omit<Notification, 'type' | 'id' | 'timestamp'>>) => {
    return addNotification({ ...options, type: 'error', message, duration: options?.duration ?? 0 }); // Errors persist by default
  }, [addNotification]);

  const warning = useCallback((message: string, options?: Partial<Omit<Notification, 'type' | 'id' | 'timestamp'>>) => {
    return addNotification({ ...options, type: 'warning', message });
  }, [addNotification]);

  const info = useCallback((message: string, options?: Partial<Omit<Notification, 'type' | 'id' | 'timestamp'>>) => {
    return addNotification({ ...options, type: 'info', message });
  }, [addNotification]);

  const contextValue: NotificationContextType = {
    notifications,
    addNotification,
    removeNotification,
    clearAll,
    success,
    error,
    warning,
    info
  };

  const getPositionClass = () => {
    return `notifications-${position}`;
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      <div className={`notification-system ${getPositionClass()} ${className}`}>
        {notifications.map(notification => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onClose={removeNotification}
            position={position}
          />
        ))}
        
        {notifications.length > 3 && (
          <div className="notification-overflow">
            <button
              className="clear-all-button"
              onClick={clearAll}
            >
              Clear all ({notifications.length})
            </button>
          </div>
        )}
      </div>
    </NotificationContext.Provider>
  );
};

// Provider component for app-wide notifications
export const NotificationProvider: React.FC<{ 
  children: React.ReactNode;
  systemProps?: NotificationSystemProps;
}> = ({ children, systemProps }) => {
  return (
    <>
      {children}
      <NotificationSystem {...systemProps} />
    </>
  );
};

// Hook for creating toast notifications with common patterns
export const useToast = () => {
  const { success, error, warning, info } = useNotifications();

  const toast = {
    success: (message: string, title?: string) => success(message, { title }),
    error: (message: string, title?: string) => error(message, { title }),
    warning: (message: string, title?: string) => warning(message, { title }),
    info: (message: string, title?: string) => info(message, { title }),
    
    // Specialized toasts
    promise: async <T,>(
      promise: Promise<T>,
      {
        loading = 'Loading...',
        success = 'Success!',
        error = 'Something went wrong'
      }: {
        loading?: string;
        success?: string | ((data: T) => string);
        error?: string | ((error: any) => string);
      } = {}
    ) => {
      const loadingId = info(loading, { duration: 0 });
      
      try {
        const result = await promise;
        const successMessage = typeof success === 'function' ? success(result) : success;
        success(successMessage);
        return result;
      } catch (err) {
        const errorMessage = typeof error === 'function' ? error(err) : error;
        error(errorMessage);
        throw err;
      } finally {
        // Remove loading notification
        setTimeout(() => {
          // This would need to be implemented in the context
        }, 100);
      }
    }
  };

  return toast;
};

export default NotificationSystem;