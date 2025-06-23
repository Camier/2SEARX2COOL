import { Plugin, PluginContext, SearchResult, SearchOptions } from '2searx2cool/plugin';
import axios from 'axios';

interface MusicMetadata {
  artist: string;
  album: string;
  year: number;
  genre: string[];
  duration: number;
}

export default class MusicEnhancerPlugin extends Plugin {
  private apiKey: string = '';
  private enhanceEnabled: boolean = true;

  constructor(context: PluginContext) {
    super(context, {
      id: 'example-music-enhancer',
      name: 'Music Search Enhancer',
      version: '1.0.0'
    });
  }

  async onActivate(): Promise<void> {
    // Load settings
    this.apiKey = await this.context.settings.get('music-enhancer.apiKey', '');
    this.enhanceEnabled = await this.context.settings.get('music-enhancer.enhanceResults', true);

    // Register search engine
    this.context.search.registerEngine({
      id: 'musicbrainz',
      name: 'MusicBrainz',
      category: 'music',
      search: this.searchMusicBrainz.bind(this)
    });

    // Register command
    this.context.commands.register('music-enhancer.analyze', {
      execute: this.analyzeResults.bind(this)
    });

    // Listen for search completion
    this.context.events.on('search:complete', this.onSearchComplete.bind(this));

    this.context.logger.info('Music Enhancer plugin activated');
  }

  async onDeactivate(): Promise<void> {
    // Cleanup
    this.context.events.off('search:complete', this.onSearchComplete.bind(this));
    this.context.logger.info('Music Enhancer plugin deactivated');
  }

  private async searchMusicBrainz(query: string, options: SearchOptions): Promise<SearchResult[]> {
    try {
      const response = await axios.get('https://musicbrainz.org/ws/2/recording', {
        params: {
          query,
          fmt: 'json',
          limit: options.limit || 20
        },
        headers: {
          'User-Agent': '2SEARX2COOL-MusicEnhancer/1.0.0'
        }
      });

      return response.data.recordings.map((recording: any) => ({
        title: recording.title,
        url: `https://musicbrainz.org/recording/${recording.id}`,
        description: this.formatDescription(recording),
        engine: 'musicbrainz',
        category: 'music',
        metadata: {
          artist: recording['artist-credit']?.[0]?.name,
          duration: recording.length,
          releases: recording.releases?.length || 0
        }
      }));
    } catch (error) {
      this.context.logger.error('MusicBrainz search failed:', error);
      return [];
    }
  }

  private formatDescription(recording: any): string {
    const parts = [];
    
    if (recording['artist-credit']?.[0]?.name) {
      parts.push(`by ${recording['artist-credit'][0].name}`);
    }
    
    if (recording.length) {
      const duration = this.formatDuration(recording.length);
      parts.push(`Duration: ${duration}`);
    }
    
    if (recording.releases?.length > 0) {
      parts.push(`Appears on ${recording.releases.length} release(s)`);
    }
    
    return parts.join(' • ');
  }

  private formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  private async onSearchComplete(results: SearchResult[]): Promise<void> {
    if (!this.enhanceEnabled) return;

    // Filter music results
    const musicResults = results.filter(r => r.category === 'music');
    
    if (musicResults.length === 0) return;

    // Enhance results with additional metadata
    for (const result of musicResults) {
      try {
        const metadata = await this.fetchAdditionalMetadata(result);
        if (metadata) {
          result.metadata = { ...result.metadata, ...metadata };
          
          // Update description with enhanced info
          result.description = this.enhanceDescription(result, metadata);
        }
      } catch (error) {
        this.context.logger.debug(`Failed to enhance result: ${result.url}`, error);
      }
    }
  }

  private async fetchAdditionalMetadata(result: SearchResult): Promise<MusicMetadata | null> {
    // Simulate fetching additional metadata
    // In a real plugin, this would make API calls to music services
    return {
      artist: result.metadata?.artist || 'Unknown Artist',
      album: 'Unknown Album',
      year: new Date().getFullYear(),
      genre: ['Electronic', 'Ambient'],
      duration: result.metadata?.duration || 0
    };
  }

  private enhanceDescription(result: SearchResult, metadata: MusicMetadata): string {
    const parts = [result.description];
    
    if (metadata.album && metadata.year) {
      parts.push(`Album: ${metadata.album} (${metadata.year})`);
    }
    
    if (metadata.genre.length > 0) {
      parts.push(`Genre: ${metadata.genre.join(', ')}`);
    }
    
    return parts.join(' • ');
  }

  private async analyzeResults(): Promise<void> {
    const results = await this.context.storage.get('lastSearchResults');
    
    if (!results || !Array.isArray(results)) {
      this.context.ui.showNotification({
        title: 'No Results',
        body: 'No search results to analyze',
        type: 'info'
      });
      return;
    }

    const musicResults = results.filter((r: SearchResult) => r.category === 'music');
    
    const analysis = {
      totalResults: results.length,
      musicResults: musicResults.length,
      engines: [...new Set(musicResults.map((r: SearchResult) => r.engine))],
      averageScore: musicResults.reduce((sum: number, r: SearchResult) => sum + (r.score || 0), 0) / musicResults.length
    };

    this.context.ui.showNotification({
      title: 'Music Results Analysis',
      body: `Found ${analysis.musicResults} music results from ${analysis.engines.length} engines`,
      type: 'success'
    });

    // Store analysis
    await this.context.storage.set('lastAnalysis', analysis);
  }
}