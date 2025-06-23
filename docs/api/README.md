# 2SEARX2COOL API Documentation

## Overview

2SEARX2COOL provides several APIs for extending functionality and integrating with external services.

## Table of Contents

1. [Plugin API](./plugin-api.md)
2. [IPC API](./ipc-api.md)
3. [Search API](./search-api.md)
4. [Window Management API](./window-api.md)
5. [Configuration API](./config-api.md)
6. [Error Handling API](./error-api.md)

## Core Concepts

### Architecture

2SEARX2COOL follows Electron's multi-process architecture:

```
┌─────────────────┐     IPC      ┌─────────────────┐
│   Main Process  │◄────────────►│ Renderer Process│
│                 │               │                 │
│  - App Logic    │               │  - UI           │
│  - File System  │               │  - User Input   │
│  - Native APIs  │               │  - Display      │
└─────────────────┘               └─────────────────┘
         ▲                                 ▲
         │          Preload Script         │
         └─────────────────────────────────┘
                   (Bridge APIs)
```

### Security Model

All APIs follow strict security guidelines:
- Input validation on all endpoints
- Sanitization of user data
- Limited scope permissions
- Secure IPC communication

### Error Handling

All APIs return consistent error objects:

```typescript
interface APIError {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
}
```

## Quick Start

### Using the Plugin API

```typescript
import { PluginAPI } from '2searx2cool';

class MyPlugin extends PluginAPI {
  async onActivate() {
    // Plugin initialization
  }
  
  async onSearch(query: string) {
    // Handle search
  }
}
```

### Using the IPC API

```typescript
// In renderer process
const result = await window.api.search.perform('my query');

// In main process
ipcMain.handle('search:perform', async (event, query) => {
  return await searchManager.search(query);
});
```

## API Reference

See individual API documentation files for detailed reference:

- [Plugin API Reference](./plugin-api.md)
- [IPC API Reference](./ipc-api.md)
- [Search API Reference](./search-api.md)
- [Window API Reference](./window-api.md)
- [Configuration API Reference](./config-api.md)
- [Error API Reference](./error-api.md)