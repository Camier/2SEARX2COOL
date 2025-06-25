import { EventEmitter } from 'events';
import * as path from 'path';
import { PersonalScoreService } from './PersonalScoreService';

/**
 * Week 4 Day 2: Music Player Service
 * 
 * Handles audio playback, play tracking, and integration
 * with the personal scoring system.
 */

export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  filePath?: string;
  url?: string;
  source: 'local' | 'web' | 'hybrid';
}

export interface PlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  currentTrack: Track | null;
  currentTime: number;
  duration: number;
  volume: number;
  queue: Track[];
  currentIndex: number;
  repeat: 'none' | 'one' | 'all';
  shuffle: boolean;
}

export interface PlaySession {
  trackId: string;
  startTime: number;
  endTime?: number;
  duration: number;
  completionPercentage: number;
  wasSkipped: boolean;
  volume: number;
}

export class MusicPlayerService extends EventEmitter {
  private personalScoreService: PersonalScoreService;
  private audioElement: HTMLAudioElement | null = null;
  private state: PlaybackState;
  private currentSession: PlaySession | null = null;
  private updateInterval: NodeJS.Timeout | null = null;
  private preloadedTracks = new Map<string, HTMLAudioElement>();
  
  constructor(personalScoreService: PersonalScoreService) {
    super();
    this.personalScoreService = personalScoreService;
    
    this.state = {
      isPlaying: false,
      isPaused: false,
      currentTrack: null,
      currentTime: 0,
      duration: 0,
      volume: 0.8,
      queue: [],
      currentIndex: -1,
      repeat: 'none',
      shuffle: false
    };
    
    this.setupAudioEvents();
  }
  
  /**
   * Initialize audio element and set up event listeners
   */
  private setupAudioEvents() {
    if (typeof window !== 'undefined') {
      this.audioElement = new Audio();
      this.audioElement.volume = this.state.volume;
      
      this.audioElement.addEventListener('loadedmetadata', () => {
        this.state.duration = this.audioElement?.duration || 0;
        this.emit('durationChange', this.state.duration);
      });
      
      this.audioElement.addEventListener('timeupdate', () => {
        if (this.audioElement) {
          this.state.currentTime = this.audioElement.currentTime;
          this.emit('timeUpdate', this.state.currentTime);
          this.updatePlaySession();
        }
      });
      
      this.audioElement.addEventListener('ended', () => {
        this.handleTrackEnded();
      });
      
      this.audioElement.addEventListener('error', (error) => {
        console.error('Audio playback error:', error);
        this.emit('error', error);
      });
      
      this.audioElement.addEventListener('canplaythrough', () => {
        this.emit('canPlay');
      });
    }
  }
  
  /**
   * Play a specific track
   */
  async playTrack(track: Track, addToQueue = true): Promise<void> {
    try {
      // End current session if exists
      if (this.currentSession) {
        await this.endPlaySession(false);
      }
      
      // Add to queue if not already there
      if (addToQueue && !this.state.queue.find(t => t.id === track.id)) {
        this.state.queue.push(track);
      }
      
      // Update current track and index
      this.state.currentTrack = track;
      this.state.currentIndex = this.state.queue.findIndex(t => t.id === track.id);
      
      // Load and play audio
      if (this.audioElement) {
        const audioSource = track.filePath || track.url;
        if (!audioSource) {
          throw new Error('No audio source available for track');
        }
        
        this.audioElement.src = audioSource;
        await this.audioElement.load();
        await this.audioElement.play();
        
        this.state.isPlaying = true;
        this.state.isPaused = false;
        
        // Start play session tracking
        this.startPlaySession(track);
        
        // Start progress updates
        this.startProgressUpdates();
        
        this.emit('trackChange', track);
        this.emit('playStateChange', this.state.isPlaying);
      }
    } catch (error) {
      console.error('Failed to play track:', error);
      this.emit('error', error);
    }
  }
  
  /**
   * Pause playback
   */
  pause(): void {
    if (this.audioElement && this.state.isPlaying) {
      this.audioElement.pause();
      this.state.isPlaying = false;
      this.state.isPaused = true;
      
      this.stopProgressUpdates();
      this.emit('playStateChange', this.state.isPlaying);
    }
  }
  
  /**
   * Resume playback
   */
  resume(): void {
    if (this.audioElement && this.state.isPaused) {
      this.audioElement.play();
      this.state.isPlaying = true;
      this.state.isPaused = false;
      
      this.startProgressUpdates();
      this.emit('playStateChange', this.state.isPlaying);
    }
  }
  
  /**
   * Stop playback
   */
  async stop(): Promise<void> {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
      
      this.state.isPlaying = false;
      this.state.isPaused = false;
      this.state.currentTime = 0;
      
      this.stopProgressUpdates();
      
      // End current session
      if (this.currentSession) {
        await this.endPlaySession(true);
      }
      
      this.emit('playStateChange', this.state.isPlaying);
      this.emit('timeUpdate', 0);
    }
  }
  
  /**
   * Seek to specific time
   */
  seek(time: number): void {
    if (this.audioElement && this.state.duration > 0) {
      const clampedTime = Math.max(0, Math.min(time, this.state.duration));
      this.audioElement.currentTime = clampedTime;
      this.state.currentTime = clampedTime;
      this.emit('timeUpdate', clampedTime);
    }
  }
  
  /**
   * Set volume (0-1)
   */
  setVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.state.volume = clampedVolume;
    
    if (this.audioElement) {
      this.audioElement.volume = clampedVolume;
    }
    
    this.emit('volumeChange', clampedVolume);
  }
  
  /**
   * Play next track in queue
   */
  async playNext(): Promise<void> {
    if (this.state.queue.length === 0) return;
    
    let nextIndex: number;
    
    if (this.state.shuffle) {
      // Random next track
      nextIndex = Math.floor(Math.random() * this.state.queue.length);
    } else {
      // Sequential next track
      nextIndex = this.state.currentIndex + 1;
      
      if (nextIndex >= this.state.queue.length) {
        if (this.state.repeat === 'all') {
          nextIndex = 0;
        } else {
          return; // End of queue
        }
      }
    }
    
    const nextTrack = this.state.queue[nextIndex];
    if (nextTrack) {
      await this.playTrack(nextTrack, false);
    }
  }
  
  /**
   * Play previous track in queue
   */
  async playPrevious(): Promise<void> {
    if (this.state.queue.length === 0) return;
    
    // If we're more than 3 seconds into the current track, restart it
    if (this.state.currentTime > 3) {
      this.seek(0);
      return;
    }
    
    let prevIndex: number;
    
    if (this.state.shuffle) {
      // Random previous track
      prevIndex = Math.floor(Math.random() * this.state.queue.length);
    } else {
      // Sequential previous track
      prevIndex = this.state.currentIndex - 1;
      
      if (prevIndex < 0) {
        if (this.state.repeat === 'all') {
          prevIndex = this.state.queue.length - 1;
        } else {
          prevIndex = 0; // Stay at first track
        }
      }
    }
    
    const prevTrack = this.state.queue[prevIndex];
    if (prevTrack) {
      await this.playTrack(prevTrack, false);
    }
  }
  
  /**
   * Add track to queue
   */
  addToQueue(track: Track): void {
    this.state.queue.push(track);
    this.emit('queueChange', this.state.queue);
  }
  
  /**
   * Remove track from queue
   */
  removeFromQueue(trackId: string): void {
    const index = this.state.queue.findIndex(t => t.id === trackId);
    if (index !== -1) {
      this.state.queue.splice(index, 1);
      
      // Adjust current index if needed
      if (index < this.state.currentIndex) {
        this.state.currentIndex--;
      } else if (index === this.state.currentIndex) {
        // Currently playing track was removed
        this.state.currentIndex = -1;
        this.state.currentTrack = null;
      }
      
      this.emit('queueChange', this.state.queue);
    }
  }
  
  /**
   * Clear queue
   */
  clearQueue(): void {
    this.state.queue = [];
    this.state.currentIndex = -1;
    this.emit('queueChange', this.state.queue);
  }
  
  /**
   * Set repeat mode
   */
  setRepeat(mode: 'none' | 'one' | 'all'): void {
    this.state.repeat = mode;
    this.emit('repeatChange', mode);
  }
  
  /**
   * Toggle shuffle
   */
  setShuffle(enabled: boolean): void {
    this.state.shuffle = enabled;
    this.emit('shuffleChange', enabled);
  }
  
  /**
   * Get current playback state
   */
  getState(): PlaybackState {
    return { ...this.state };
  }
  
  /**
   * Start tracking play session
   */
  private startPlaySession(track: Track): void {
    this.currentSession = {
      trackId: track.id,
      startTime: Date.now(),
      duration: 0,
      completionPercentage: 0,
      wasSkipped: false,
      volume: this.state.volume
    };
  }
  
  /**
   * Update current play session
   */
  private updatePlaySession(): void {
    if (this.currentSession && this.state.duration > 0) {
      this.currentSession.duration = this.state.currentTime;
      this.currentSession.completionPercentage = 
        (this.state.currentTime / this.state.duration) * 100;
    }
  }
  
  /**
   * End current play session and record it
   */
  private async endPlaySession(wasSkipped: boolean): Promise<void> {
    if (this.currentSession) {
      this.currentSession.endTime = Date.now();
      this.currentSession.wasSkipped = wasSkipped;
      
      // Record play if significant progress was made (>30 seconds or >25% completion)
      const significantPlay = 
        this.currentSession.duration > 30 || 
        this.currentSession.completionPercentage > 25;
      
      if (significantPlay) {
        try {
          await this.personalScoreService.recordPlay(
            this.currentSession.trackId,
            Math.floor(this.currentSession.duration),
            this.currentSession.completionPercentage
          );
          
          this.emit('playRecorded', this.currentSession);
        } catch (error) {
          console.error('Failed to record play session:', error);
        }
      }
      
      this.currentSession = null;
    }
  }
  
  /**
   * Handle track ended
   */
  private async handleTrackEnded(): Promise<void> {
    await this.endPlaySession(false);
    
    if (this.state.repeat === 'one') {
      // Repeat current track
      if (this.state.currentTrack) {
        this.seek(0);
        await this.playTrack(this.state.currentTrack, false);
      }
    } else {
      // Play next track
      await this.playNext();
    }
  }
  
  /**
   * Start progress update interval
   */
  private startProgressUpdates(): void {
    this.stopProgressUpdates();
    this.updateInterval = setInterval(() => {
      if (this.audioElement && this.state.isPlaying) {
        this.state.currentTime = this.audioElement.currentTime;
        this.emit('timeUpdate', this.state.currentTime);
        this.updatePlaySession();
      }
    }, 1000);
  }
  
  /**
   * Stop progress update interval
   */
  private stopProgressUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
  
  /**
   * Preload tracks for better performance
   */
  async preloadTrack(track: Track): Promise<void> {
    if (this.preloadedTracks.has(track.id)) return;
    
    try {
      const audio = new Audio();
      const source = track.filePath || track.url;
      
      if (source) {
        audio.src = source;
        audio.preload = 'metadata';
        this.preloadedTracks.set(track.id, audio);
      }
    } catch (error) {
      console.error('Failed to preload track:', error);
    }
  }
  
  /**
   * Clean up resources
   */
  dispose(): void {
    this.stop();
    this.stopProgressUpdates();
    
    if (this.audioElement) {
      this.audioElement.src = '';
      this.audioElement = null;
    }
    
    this.preloadedTracks.clear();
    this.removeAllListeners();
  }
}