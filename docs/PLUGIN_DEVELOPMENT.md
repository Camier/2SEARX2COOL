# Plugin Development Guide

## Overview

2SEARX2COOL supports three types of plugins:

1. **Main Process Plugins**: Run in the Electron main process, have access to Node.js APIs
2. **Renderer Plugins**: Run in the renderer process, can modify the UI
3. **Preload Plugins**: Bridge between main and renderer processes

## Plugin Structure

```
my-plugin/
├── package.json
├── index.ts
├── main/
│   └── index.ts
├── renderer/
│   └── index.ts
├── preload/
│   └── index.ts
└── assets/
    └── icon.png
```

## Basic Plugin Example

```typescript
// index.ts
import { Plugin } from '@2searx2cool/plugin-api'

export default class MyPlugin implements Plugin {
  id = 'my-plugin'
  name = 'My Plugin'
  description = 'A sample plugin'
  version = '1.0.0'
  
  // Called when plugin is activated
  async activate(context: PluginContext) {
    console.log('Plugin activated!')
    
    // Register commands
    context.registerCommand('my-plugin.hello', () => {
      console.log('Hello from my plugin!')
    })
    
    // Add menu items
    context.addMenuItem({
      label: 'My Plugin Action',
      accelerator: 'CmdOrCtrl+Shift+M',
      click: () => {
        context.executeCommand('my-plugin.hello')
      }
    })
  }
  
  // Called when plugin is deactivated
  async deactivate() {
    console.log('Plugin deactivated!')
  }
}
```

## Plugin API

### Context Object

The plugin context provides access to various APIs:

```typescript
interface PluginContext {
  // Command registration
  registerCommand(id: string, handler: Function): Disposable
  executeCommand(id: string, ...args: any[]): Promise<any>
  
  // Menu system
  addMenuItem(item: MenuItem): Disposable
  
  // Storage
  getPluginStorage(): Storage
  
  // Events
  on(event: string, handler: Function): Disposable
  emit(event: string, ...args: any[]): void
  
  // UI
  showNotification(message: string, type?: 'info' | 'warning' | 'error'): void
  
  // IPC
  ipc: {
    send(channel: string, ...args: any[]): void
    on(channel: string, handler: Function): Disposable
    invoke(channel: string, ...args: any[]): Promise<any>
  }
}
```

## Publishing Your Plugin

1. Add plugin metadata to `package.json`:
```json
{
  "name": "2searx2cool-plugin-my-plugin",
  "version": "1.0.0",
  "2searx2cool": {
    "type": "plugin",
    "main": "dist/index.js"
  }
}
```

2. Build your plugin:
```bash
npm run build
```

3. Publish to npm:
```bash
npm publish
```

## Best Practices

1. **Performance**: Keep initialization fast
2. **Error Handling**: Always handle errors gracefully
3. **Cleanup**: Clean up resources in `deactivate()`
4. **Settings**: Use the storage API for persistent settings
5. **Documentation**: Document your plugin's features and settings

## Examples

Check out these example plugins:
- [Download Manager Plugin](https://github.com/Camier/2SEARX2COOL/tree/main/plugins/download-manager)
- [Lyrics Sync Plugin](https://github.com/Camier/2SEARX2COOL/tree/main/plugins/lyrics-sync)
- [Discord RPC Plugin](https://github.com/Camier/2SEARX2COOL/tree/main/plugins/discord-rpc)