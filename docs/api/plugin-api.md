# Plugin API

The Plugin API allows developers to extend 2SEARX2COOL functionality through custom plugins.

## Overview

Plugins can:
- Add custom search engines
- Modify search results
- Add UI components
- Hook into application lifecycle
- Store persistent data

## Creating a Plugin

### Basic Structure

```typescript
import { Plugin, PluginContext } from '2searx2cool/plugin';

export default class MyPlugin extends Plugin {
  constructor(context: PluginContext) {
    super(context, {
      id: 'my-plugin',
      name: 'My Plugin',
      version: '1.0.0',
      description: 'A sample plugin',
      author: 'Your Name',
      homepage: 'https://github.com/you/my-plugin'
    });
  }

  async onActivate(): Promise<void> {
    // Called when plugin is activated
    this.context.logger.info('Plugin activated');
  }

  async onDeactivate(): Promise<void> {
    // Called when plugin is deactivated
    this.context.logger.info('Plugin deactivated');
  }
}
```

### Plugin Manifest

Each plugin requires a `plugin.json` manifest:

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "A sample plugin",
  "author": "Your Name",
  "main": "./dist/index.js",
  "engines": {
    "2searx2cool": ">=0.3.0"
  },
  "permissions": [
    "search",
    "storage",
    "ui"
  ],
  "contributes": {
    "searchEngines": [
      {
        "id": "my-engine",
        "name": "My Search Engine",
        "category": "general"
      }
    ],
    "commands": [
      {
        "command": "my-plugin.doSomething",
        "title": "Do Something"
      }
    ]
  }
}
```

## API Reference

### Plugin Class

#### Properties

```typescript
interface Plugin {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly context: PluginContext;
  readonly isActive: boolean;
}
```

#### Methods

##### `onActivate(): Promise<void>`
Called when the plugin is activated. Use this for initialization.

##### `onDeactivate(): Promise<void>`
Called when the plugin is deactivated. Clean up resources here.

##### `onSearch(query: string, options: SearchOptions): Promise<SearchResult[]>`
Called when a search is performed. Return additional results.

##### `onSearchComplete(results: SearchResult[]): Promise<SearchResult[]>`
Called after search completes. Modify or filter results.

### PluginContext

The context object provides access to APIs:

```typescript
interface PluginContext {
  // Logging
  logger: Logger;
  
  // Storage
  storage: PluginStorage;
  
  // Events
  events: EventEmitter;
  
  // UI
  ui: UIManager;
  
  // Settings
  settings: SettingsManager;
  
  // Search
  search: SearchManager;
}
```

### Storage API

Plugins can store data persistently:

```typescript
// Store data
await context.storage.set('key', { value: 'data' });

// Retrieve data
const data = await context.storage.get('key');

// Remove data
await context.storage.remove('key');

// Clear all data
await context.storage.clear();
```

### Event API

Subscribe to application events:

```typescript
// Subscribe to events
context.events.on('search:start', (query) => {
  console.log('Search started:', query);
});

context.events.on('window:created', (window) => {
  console.log('Window created:', window.id);
});

// Emit custom events
context.events.emit('my-plugin:event', data);
```

### UI API

Add UI components:

```typescript
// Add menu item
context.ui.addMenuItem({
  id: 'my-plugin.menu',
  label: 'My Plugin Action',
  accelerator: 'CmdOrCtrl+Shift+M',
  click: () => this.doSomething()
});

// Add context menu
context.ui.addContextMenu({
  id: 'my-plugin.context',
  label: 'My Plugin',
  visible: (params) => params.selectionText?.length > 0,
  click: (params) => this.handleSelection(params.selectionText)
});

// Show notification
context.ui.showNotification({
  title: 'My Plugin',
  body: 'Operation completed',
  icon: 'path/to/icon.png'
});
```

## Search Engine Integration

### Adding a Custom Search Engine

```typescript
export class MySearchEngine implements SearchEngine {
  readonly id = 'my-engine';
  readonly name = 'My Search Engine';
  readonly category = 'general';
  
  async search(query: string, options: SearchOptions): Promise<SearchResult[]> {
    // Perform search
    const response = await fetch(`https://api.example.com/search?q=${query}`);
    const data = await response.json();
    
    // Transform to SearchResult format
    return data.results.map(item => ({
      title: item.title,
      url: item.url,
      description: item.description,
      engine: this.id,
      score: item.relevance
    }));
  }
}

// Register in plugin
export default class MyPlugin extends Plugin {
  async onActivate() {
    this.context.search.registerEngine(new MySearchEngine());
  }
}
```

## Best Practices

### Performance

1. **Lazy Loading**: Load resources only when needed
2. **Debouncing**: Debounce search and input handlers
3. **Caching**: Cache API responses appropriately
4. **Cleanup**: Always clean up in `onDeactivate()`

### Security

1. **Input Validation**: Always validate user input
2. **Sanitization**: Sanitize data before display
3. **Permissions**: Request only necessary permissions
4. **HTTPS**: Use HTTPS for all external requests

### Error Handling

```typescript
async onSearch(query: string): Promise<SearchResult[]> {
  try {
    return await this.performSearch(query);
  } catch (error) {
    this.context.logger.error('Search failed:', error);
    
    // Graceful degradation
    return [];
  }
}
```

## Examples

### Simple Search Modifier

```typescript
export default class SearchModifierPlugin extends Plugin {
  async onSearchComplete(results: SearchResult[]): Promise<SearchResult[]> {
    // Add custom scoring
    return results.map(result => ({
      ...result,
      score: result.score * this.calculateBoost(result)
    }));
  }
  
  private calculateBoost(result: SearchResult): number {
    // Custom logic
    return result.url.includes('github.com') ? 1.5 : 1.0;
  }
}
```

### Data Storage Plugin

```typescript
export default class HistoryPlugin extends Plugin {
  async onActivate() {
    // Initialize storage
    const history = await this.context.storage.get('history') || [];
    
    // Listen for searches
    this.context.events.on('search:complete', async (query) => {
      history.push({
        query,
        timestamp: Date.now()
      });
      
      // Keep last 100 items
      if (history.length > 100) {
        history.shift();
      }
      
      await this.context.storage.set('history', history);
    });
  }
}
```

## Plugin Development Tools

### Testing

```typescript
import { PluginTestHarness } from '2searx2cool/test';

describe('MyPlugin', () => {
  let harness: PluginTestHarness;
  let plugin: MyPlugin;
  
  beforeEach(() => {
    harness = new PluginTestHarness();
    plugin = new MyPlugin(harness.context);
  });
  
  test('should activate successfully', async () => {
    await plugin.onActivate();
    expect(plugin.isActive).toBe(true);
  });
});
```

### Debugging

Enable plugin debugging:

```bash
# Set environment variable
DEBUG=2searx2cool:plugins npm start

# Or in plugin
this.context.logger.debug('Debug info', { data });
```

## Publishing

1. Build your plugin
2. Create a GitHub release
3. Submit to plugin registry via PR
4. Users can install via Plugin Manager

## API Versioning

The Plugin API follows semantic versioning. Check compatibility:

```typescript
if (!this.context.isCompatible('0.3.0')) {
  throw new Error('This plugin requires 2SEARX2COOL 0.3.0 or higher');
}
```