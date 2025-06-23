# IPC API

Inter-Process Communication (IPC) API for communication between main and renderer processes.

## Overview

The IPC API provides secure, typed communication channels between Electron's main and renderer processes. All communication is validated and sanitized for security.

## Architecture

```
Renderer Process          Preload Script              Main Process
     │                         │                          │
     │   invoke('api:call')    │                          │
     ├────────────────────────►│                          │
     │                         │   ipcRenderer.invoke()   │
     │                         ├─────────────────────────►│
     │                         │                          │ handle('api:call')
     │                         │        response          │ process request
     │◄────────────────────────┼──────────────────────────┤
     │                         │                          │
```

## API Channels

### Search API

#### `search:perform`
Perform a search query.

```typescript
// Renderer
const results = await window.api.search.perform('query', {
  engines: ['google', 'bing'],
  limit: 50
});

// Main handler
ipcMain.handle('search:perform', async (event, query, options) => {
  return await searchManager.search(query, options);
});
```

#### `search:getSuggestions`
Get search suggestions.

```typescript
// Renderer
const suggestions = await window.api.search.getSuggestions('par');
// Returns: ['paris', 'park', 'party', ...]
```

#### `search:cancel`
Cancel ongoing search.

```typescript
// Renderer
await window.api.search.cancel(searchId);
```

### Window API

#### `window:create`
Create a new window.

```typescript
// Renderer
const windowId = await window.api.window.create({
  width: 800,
  height: 600,
  url: 'https://example.com'
});
```

#### `window:close`
Close a window.

```typescript
// Renderer
await window.api.window.close(windowId);
```

#### `window:minimize/maximize/restore`
Control window state.

```typescript
// Renderer
await window.api.window.minimize();
await window.api.window.maximize();
await window.api.window.restore();
```

### Configuration API

#### `config:get`
Get configuration value.

```typescript
// Renderer
const theme = await window.api.config.get('theme');
const allConfig = await window.api.config.get(); // Get all
```

#### `config:set`
Set configuration value.

```typescript
// Renderer
await window.api.config.set('theme', 'dark');
await window.api.config.set({
  theme: 'dark',
  language: 'en'
});
```

#### `config:reset`
Reset configuration to defaults.

```typescript
// Renderer
await window.api.config.reset(); // Reset all
await window.api.config.reset('theme'); // Reset specific
```

### Storage API

#### `storage:get/set/remove`
Persistent storage operations.

```typescript
// Renderer
// Set
await window.api.storage.set('user.preferences', { theme: 'dark' });

// Get
const prefs = await window.api.storage.get('user.preferences');

// Remove
await window.api.storage.remove('user.preferences');

// Clear all
await window.api.storage.clear();
```

### System API

#### `system:getInfo`
Get system information.

```typescript
// Renderer
const info = await window.api.system.getInfo();
// Returns: { platform, arch, version, memory, cpu }
```

#### `system:openExternal`
Open external URLs.

```typescript
// Renderer
await window.api.system.openExternal('https://example.com');
```

#### `system:showItemInFolder`
Show file in system file manager.

```typescript
// Renderer
await window.api.system.showItemInFolder('/path/to/file');
```

## Preload Script API

The preload script exposes a safe API to renderer:

```typescript
// preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  search: {
    perform: (query: string, options?: SearchOptions) => 
      ipcRenderer.invoke('search:perform', query, options),
    
    getSuggestions: (query: string) =>
      ipcRenderer.invoke('search:getSuggestions', query),
      
    cancel: (searchId: string) =>
      ipcRenderer.invoke('search:cancel', searchId)
  },
  
  window: {
    create: (options: WindowOptions) =>
      ipcRenderer.invoke('window:create', options),
      
    close: (id?: string) =>
      ipcRenderer.invoke('window:close', id),
      
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    restore: () => ipcRenderer.invoke('window:restore')
  },
  
  // Event subscriptions
  on: (channel: string, callback: Function) => {
    const subscription = (event: any, ...args: any[]) => callback(...args);
    ipcRenderer.on(channel, subscription);
    
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  }
});
```

## Event System

### Subscribing to Events

```typescript
// Renderer
const unsubscribe = window.api.on('search:progress', (progress) => {
  console.log(`Search ${progress.percent}% complete`);
});

// Clean up
unsubscribe();
```

### Available Events

#### Search Events
- `search:start` - Search started
- `search:progress` - Search progress update
- `search:complete` - Search completed
- `search:error` - Search error

#### Window Events
- `window:created` - Window created
- `window:closed` - Window closed
- `window:focused` - Window focused
- `window:blurred` - Window lost focus

#### System Events
- `update:available` - Update available
- `update:downloaded` - Update downloaded
- `system:suspend` - System suspending
- `system:resume` - System resumed

## Security

### Input Validation

All IPC calls are validated:

```typescript
// Main process
ipcMain.handle('search:perform', async (event, query, options) => {
  // Validate input
  if (typeof query !== 'string' || query.length > 1000) {
    throw new Error('Invalid query');
  }
  
  if (options && !isValidSearchOptions(options)) {
    throw new Error('Invalid options');
  }
  
  // Process request
  return await searchManager.search(query, options);
});
```

### Permission Checks

```typescript
ipcMain.handle('system:openExternal', async (event, url) => {
  // Check URL safety
  if (!isValidUrl(url) || !isAllowedProtocol(url)) {
    throw new Error('Invalid URL');
  }
  
  // Check user permission
  const allowed = await promptUser(`Open ${url} in browser?`);
  if (!allowed) {
    throw new Error('User denied permission');
  }
  
  return shell.openExternal(url);
});
```

## Error Handling

### Error Format

```typescript
interface IPCError {
  code: string;
  message: string;
  details?: any;
}
```

### Handling Errors

```typescript
// Renderer
try {
  const results = await window.api.search.perform('query');
} catch (error) {
  if (error.code === 'SEARCH_TIMEOUT') {
    // Handle timeout
  } else if (error.code === 'NETWORK_ERROR') {
    // Handle network error
  } else {
    // Handle generic error
  }
}
```

## Type Safety

### TypeScript Definitions

```typescript
// types/api.d.ts
declare global {
  interface Window {
    api: {
      search: {
        perform(query: string, options?: SearchOptions): Promise<SearchResult[]>;
        getSuggestions(query: string): Promise<string[]>;
        cancel(searchId: string): Promise<void>;
      };
      window: {
        create(options: WindowOptions): Promise<string>;
        close(id?: string): Promise<void>;
        minimize(): Promise<void>;
        maximize(): Promise<void>;
        restore(): Promise<void>;
      };
      config: {
        get<T = any>(key?: string): Promise<T>;
        set(key: string, value: any): Promise<void>;
        set(values: Record<string, any>): Promise<void>;
        reset(key?: string): Promise<void>;
      };
      storage: {
        get<T = any>(key: string): Promise<T | null>;
        set(key: string, value: any): Promise<void>;
        remove(key: string): Promise<void>;
        clear(): Promise<void>;
      };
      system: {
        getInfo(): Promise<SystemInfo>;
        openExternal(url: string): Promise<void>;
        showItemInFolder(path: string): Promise<void>;
      };
      on(channel: string, callback: Function): () => void;
    };
  }
}
```

## Best Practices

### 1. Always Use Type-Safe Calls

```typescript
// Good
const results = await window.api.search.perform('query', {
  engines: ['google'],
  limit: 50
});

// Bad - no type safety
const results = await ipcRenderer.invoke('search:perform', 'query');
```

### 2. Handle Errors Gracefully

```typescript
async function performSearch(query: string) {
  try {
    const results = await window.api.search.perform(query);
    displayResults(results);
  } catch (error) {
    showError('Search failed. Please try again.');
    console.error('Search error:', error);
  }
}
```

### 3. Clean Up Event Listeners

```typescript
useEffect(() => {
  const unsubscribe = window.api.on('search:progress', updateProgress);
  
  return () => {
    unsubscribe();
  };
}, []);
```

### 4. Validate in Both Processes

```typescript
// Renderer - basic validation
if (!query.trim()) {
  showError('Please enter a search query');
  return;
}

// Main - thorough validation
if (typeof query !== 'string' || query.length > 1000) {
  throw new Error('Invalid query');
}
```

## Testing

### Mocking IPC in Tests

```typescript
// test-utils/mock-api.ts
export const mockApi = {
  search: {
    perform: jest.fn().mockResolvedValue([]),
    getSuggestions: jest.fn().mockResolvedValue([]),
    cancel: jest.fn().mockResolvedValue(undefined)
  }
};

// In tests
beforeEach(() => {
  window.api = mockApi;
});

test('should perform search', async () => {
  mockApi.search.perform.mockResolvedValue([
    { title: 'Result 1', url: 'https://example.com' }
  ]);
  
  const results = await searchFunction('test');
  expect(results).toHaveLength(1);
});
```