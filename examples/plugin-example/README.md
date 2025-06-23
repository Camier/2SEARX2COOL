# Music Search Enhancer Plugin Example

This is an example plugin for 2SEARX2COOL that demonstrates how to:
- Add a custom search engine (MusicBrainz)
- Enhance search results with additional metadata
- Register commands and menu items
- Store plugin data persistently
- Handle plugin settings

## Structure

```
plugin-example/
├── plugin.json          # Plugin manifest
├── src/
│   └── index.ts        # Main plugin code
├── icons/
│   └── musicbrainz.png # Engine icon
├── dist/               # Built plugin (generated)
└── README.md           # This file
```

## Development

### Prerequisites

- Node.js >= 16
- 2SEARX2COOL >= 0.3.0
- TypeScript

### Setup

```bash
# Install dependencies
npm install

# Build the plugin
npm run build

# Watch for changes
npm run watch
```

### Testing

```bash
# Run tests
npm test

# Test in 2SEARX2COOL
npm run package
# Then install the .zip file through Plugin Manager
```

## Features

### Custom Search Engine

The plugin adds MusicBrainz as a search engine:

```typescript
this.context.search.registerEngine({
  id: 'musicbrainz',
  name: 'MusicBrainz',
  category: 'music',
  search: this.searchMusicBrainz.bind(this)
});
```

### Result Enhancement

Automatically enhances music search results:

```typescript
this.context.events.on('search:complete', async (results) => {
  // Enhance music results with metadata
});
```

### Commands

Adds an "Analyze Music Results" command:

```typescript
this.context.commands.register('music-enhancer.analyze', {
  execute: this.analyzeResults.bind(this)
});
```

### Settings

Configurable through settings:
- API Key for external services
- Toggle automatic enhancement

## API Usage

### Storage API

```typescript
// Store data
await this.context.storage.set('key', data);

// Retrieve data
const data = await this.context.storage.get('key');
```

### Settings API

```typescript
// Get setting
const apiKey = await this.context.settings.get('music-enhancer.apiKey');

// Listen for changes
this.context.settings.onChange('music-enhancer.apiKey', (newValue) => {
  this.apiKey = newValue;
});
```

### UI API

```typescript
// Show notification
this.context.ui.showNotification({
  title: 'Enhancement Complete',
  body: 'Music results have been enhanced',
  type: 'success'
});
```

## Building for Distribution

```bash
# Build and package
npm run package

# Creates music-enhancer-1.0.0.zip
```

## License

MIT