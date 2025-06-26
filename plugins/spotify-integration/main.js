/**
 * Spotify Integration Plugin for 2SEARX2COOL
 * Main process code
 */

class SpotifyIntegrationPlugin {
  constructor() {
    this.name = 'Spotify Integration';
    this.version = '1.0.0';
    this.spotifyApi = null;
    this.currentTrack = null;
    this.isPlaying = false;
    this.searchCache = new Map();
  }

  /**
   * Plugin activation
   * @param {PluginContext} context - Plugin context from 2SEARX2COOL
   */
  async activate(context) {
    this.context = context;
    this.logger = context.logger;
    this.api = context.api;
    this.store = context.store;

    this.logger.info('Spotify Integration plugin activated');

    // Initialize Spotify connection
    await this.initializeSpotify();

    // Register IPC handlers
    this.registerHandlers();

    // Setup MIDI mappings for Spotify control
    this.setupMidiMappings();

    // Start periodic status updates
    this.startStatusUpdates();
  }

  /**
   * Plugin deactivation
   */
  async deactivate() {
    this.logger.info('Spotify Integration plugin deactivating');

    // Stop status updates
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
    }

    // Clean up IPC handlers
    this.api.ipc.removeAllListeners('spotify-search');
    this.api.ipc.removeAllListeners('spotify-play');
    this.api.ipc.removeAllListeners('spotify-pause');
    this.api.ipc.removeAllListeners('spotify-next');
    this.api.ipc.removeAllListeners('spotify-previous');
    this.api.ipc.removeAllListeners('spotify-volume');

    // Clear cache
    this.searchCache.clear();
  }

  /**
   * Initialize Spotify connection
   */
  async initializeSpotify() {
    try {
      // Get stored credentials
      const credentials = await this.store.get('spotify-credentials');
      
      if (!credentials) {
        this.logger.warn('No Spotify credentials found');
        this.api.ui.showNotification({
          title: 'Spotify Integration',
          body: 'Please configure your Spotify credentials in settings'
        });
        return;
      }

      // Initialize API (placeholder - would use actual Spotify SDK)
      this.spotifyApi = {
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        accessToken: null
      };

      // Authenticate
      await this.authenticate();

      this.logger.info('Spotify connection initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Spotify:', error);
    }
  }

  /**
   * Register IPC handlers
   */
  registerHandlers() {
    // Search handler
    this.api.ipc.on('spotify-search', async (event, query) => {
      try {
        const results = await this.searchSpotify(query);
        event.sender.send('spotify-search-results', results);
      } catch (error) {
        this.logger.error('Spotify search error:', error);
        event.sender.send('spotify-search-error', error.message);
      }
    });

    // Playback controls
    this.api.ipc.on('spotify-play', async (event, uri) => {
      if (uri) {
        await this.playTrack(uri);
      } else {
        await this.resume();
      }
    });

    this.api.ipc.on('spotify-pause', async () => {
      await this.pause();
    });

    this.api.ipc.on('spotify-next', async () => {
      await this.nextTrack();
    });

    this.api.ipc.on('spotify-previous', async () => {
      await this.previousTrack();
    });

    this.api.ipc.on('spotify-volume', async (event, volume) => {
      await this.setVolume(volume);
    });

    // Status request
    this.api.ipc.on('spotify-get-status', (event) => {
      event.sender.send('spotify-status', {
        isPlaying: this.isPlaying,
        currentTrack: this.currentTrack,
        connected: !!this.spotifyApi
      });
    });
  }

  /**
   * Setup MIDI mappings for hardware control
   */
  setupMidiMappings() {
    if (!this.api.hardware || !this.api.hardware.midi) {
      return;
    }

    // Listen for MIDI messages
    this.api.hardware.midi.onMessage((message) => {
      // Example: Map MIDI CC 1 to volume
      if (message.type === 'cc' && message.controller === 1) {
        const volume = message.value / 127; // Normalize to 0-1
        this.setVolume(volume);
      }

      // Example: Map MIDI note 60 (Middle C) to play/pause
      if (message.type === 'noteon' && message.note === 60) {
        if (this.isPlaying) {
          this.pause();
        } else {
          this.resume();
        }
      }
    });

    this.logger.info('MIDI mappings configured for Spotify control');
  }

  /**
   * Search Spotify
   */
  async searchSpotify(query) {
    // Check cache first
    const cacheKey = `search:${query}`;
    if (this.searchCache.has(cacheKey)) {
      const cached = this.searchCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 300000) { // 5 minutes
        return cached.results;
      }
    }

    // Perform search (placeholder implementation)
    const results = {
      tracks: [],
      albums: [],
      artists: [],
      playlists: []
    };

    // In a real implementation, this would use the Spotify Web API
    // For now, we'll integrate with 2SEARX2COOL's search
    const searxResults = await this.api.search(`${query} site:spotify.com`);
    
    // Process and transform results
    results.tracks = searxResults.results
      .filter(r => r.url.includes('/track/'))
      .map(r => ({
        id: r.url.split('/track/')[1],
        name: r.title,
        artist: r.content,
        url: r.url
      }));

    // Cache results
    this.searchCache.set(cacheKey, {
      results,
      timestamp: Date.now()
    });

    // Limit cache size
    if (this.searchCache.size > 100) {
      const firstKey = this.searchCache.keys().next().value;
      this.searchCache.delete(firstKey);
    }

    return results;
  }

  /**
   * Play a track
   */
  async playTrack(uri) {
    this.logger.info(`Playing track: ${uri}`);
    
    // Placeholder - would use actual Spotify SDK
    this.currentTrack = {
      uri,
      name: 'Track Name',
      artist: 'Artist Name',
      duration: 180000
    };
    
    this.isPlaying = true;
    this.broadcastStatus();
  }

  /**
   * Resume playback
   */
  async resume() {
    this.isPlaying = true;
    this.broadcastStatus();
  }

  /**
   * Pause playback
   */
  async pause() {
    this.isPlaying = false;
    this.broadcastStatus();
  }

  /**
   * Next track
   */
  async nextTrack() {
    this.logger.info('Skipping to next track');
    // Implementation would go here
    this.broadcastStatus();
  }

  /**
   * Previous track
   */
  async previousTrack() {
    this.logger.info('Going to previous track');
    // Implementation would go here
    this.broadcastStatus();
  }

  /**
   * Set volume
   */
  async setVolume(volume) {
    this.logger.info(`Setting volume to ${Math.round(volume * 100)}%`);
    // Implementation would go here
  }

  /**
   * Authenticate with Spotify
   */
  async authenticate() {
    // Placeholder - would implement OAuth flow
    this.logger.info('Authenticating with Spotify...');
  }

  /**
   * Start periodic status updates
   */
  startStatusUpdates() {
    this.statusInterval = setInterval(() => {
      if (this.isPlaying && this.currentTrack) {
        this.broadcastStatus();
      }
    }, 1000);
  }

  /**
   * Broadcast current status
   */
  broadcastStatus() {
    this.api.ipc.send('spotify-status-update', {
      isPlaying: this.isPlaying,
      currentTrack: this.currentTrack,
      connected: !!this.spotifyApi
    });
  }
}

// Export plugin
module.exports = {
  default: SpotifyIntegrationPlugin,
  activate: async function(context) {
    const plugin = new SpotifyIntegrationPlugin();
    await plugin.activate(context);
    return plugin;
  }
};