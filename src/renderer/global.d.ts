declare global {
  interface Window {
    api: {
      server: {
        getStatus: () => Promise<any>;
        start: () => Promise<void>;
        stop: () => Promise<void>;
        onStatusChange: (callback: (status: any) => void) => void;
      };
      search: {
        performSearch: (params: any) => Promise<any>;
        query: (query: string, options?: any) => Promise<any>;
        nextResult?: () => void;
        previousResult?: () => void;
      };
      config: {
        get: (key?: string) => Promise<any>;
        set: (key: string, value: any) => Promise<void>;
        getAll: () => Promise<any>;
      };
      hardware?: {
        onAction?: (callback: (action: any) => void) => void;
        offAction?: (callback: (action: any) => void) => void;
      };
      notifications?: {
        show?: (options: any) => void;
      };
      analytics?: {
        trackEvent?: (event: string, data: any) => void;
      };
      error?: {
        report?: (error: any) => void;
      };
      player?: {
        toggle?: () => void;
        setVolume?: (volume: number) => void;
      };
      preferences: {
        get: (key?: string) => Promise<any>;
        set: (key: string, value: any) => Promise<void>;
        reset: () => Promise<void>;
      };
    };
  }
}

export {};