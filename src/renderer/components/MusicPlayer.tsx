import React, { useState, useEffect, useRef } from 'react';
import { Track } from '../../main/services/MusicPlayerService';

/**
 * Week 4 Day 2: Music Player Component
 * 
 * Main player interface with controls, progress bar,
 * and integration with the MusicPlayerService.
 */

interface PlaybackState {
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

interface MusicPlayerProps {
  className?: string;
}

export const MusicPlayer: React.FC<MusicPlayerProps> = ({ className = '' }) => {
  const [state, setState] = useState<PlaybackState>({
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
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);
  
  // Initialize player state
  useEffect(() => {
    const initializePlayer = async () => {
      try {
        const playerState = await window.electron.ipcRenderer.invoke('get-player-state');
        setState(playerState);
      } catch (error) {
        console.error('Failed to initialize player state:', error);
      }
    };
    
    initializePlayer();
    
    // Listen for player state updates
    const unsubscribes = [
      window.electron.ipcRenderer.on('player-state-change', (newState: PlaybackState) => {
        setState(newState);
      }),
      
      window.electron.ipcRenderer.on('track-change', (track: Track) => {
        setState(prev => ({ ...prev, currentTrack: track }));
      }),
      
      window.electron.ipcRenderer.on('time-update', (currentTime: number) => {
        if (!isDragging) {
          setState(prev => ({ ...prev, currentTime }));
        }
      }),
      
      window.electron.ipcRenderer.on('duration-change', (duration: number) => {
        setState(prev => ({ ...prev, duration }));
      }),
      
      window.electron.ipcRenderer.on('volume-change', (volume: number) => {
        setState(prev => ({ ...prev, volume }));
      })
    ];
    
    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [isDragging]);
  
  // Player controls
  const handlePlayPause = async () => {
    try {
      if (state.isPlaying) {
        await window.electron.ipcRenderer.invoke('player-pause');
      } else if (state.isPaused) {
        await window.electron.ipcRenderer.invoke('player-resume');
      } else if (state.currentTrack) {
        await window.electron.ipcRenderer.invoke('player-play', state.currentTrack);
      }
    } catch (error) {
      console.error('Failed to toggle playback:', error);
    }
  };
  
  const handleStop = async () => {
    try {
      await window.electron.ipcRenderer.invoke('player-stop');
    } catch (error) {
      console.error('Failed to stop playback:', error);
    }
  };
  
  const handlePrevious = async () => {
    try {
      await window.electron.ipcRenderer.invoke('player-previous');
    } catch (error) {
      console.error('Failed to play previous:', error);
    }
  };
  
  const handleNext = async () => {
    try {
      await window.electron.ipcRenderer.invoke('player-next');
    } catch (error) {
      console.error('Failed to play next:', error);
    }
  };
  
  const handleSeek = async (time: number) => {
    try {
      await window.electron.ipcRenderer.invoke('player-seek', time);
    } catch (error) {
      console.error('Failed to seek:', error);
    }
  };
  
  const handleVolumeChange = async (volume: number) => {
    try {
      await window.electron.ipcRenderer.invoke('player-set-volume', volume);
    } catch (error) {
      console.error('Failed to set volume:', error);
    }
  };
  
  const handleRepeatToggle = async () => {
    const modes: ('none' | 'one' | 'all')[] = ['none', 'one', 'all'];
    const currentIndex = modes.indexOf(state.repeat);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    
    try {
      await window.electron.ipcRenderer.invoke('player-set-repeat', nextMode);
    } catch (error) {
      console.error('Failed to set repeat mode:', error);
    }
  };
  
  const handleShuffleToggle = async () => {
    try {
      await window.electron.ipcRenderer.invoke('player-set-shuffle', !state.shuffle);
    } catch (error) {
      console.error('Failed to toggle shuffle:', error);
    }
  };
  
  // Progress bar handling
  const handleProgressMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    updateProgressFromMouse(e);
  };
  
  const handleProgressMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      updateProgressFromMouse(e);
    }
  };
  
  const handleProgressMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      handleSeek(dragTime);
    }
  };
  
  const updateProgressFromMouse = (e: React.MouseEvent) => {
    if (progressRef.current && state.duration > 0) {
      const rect = progressRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const time = percentage * state.duration;
      setDragTime(time);
    }
  };
  
  // Volume bar handling
  const handleVolumeMouseDown = (e: React.MouseEvent) => {
    updateVolumeFromMouse(e);
  };
  
  const updateVolumeFromMouse = (e: React.MouseEvent) => {
    if (volumeRef.current) {
      const rect = volumeRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      handleVolumeChange(percentage);
    }
  };
  
  // Format time helper
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Get progress percentage
  const getProgressPercentage = (): number => {
    if (state.duration === 0) return 0;
    const time = isDragging ? dragTime : state.currentTime;
    return (time / state.duration) * 100;
  };
  
  // Get repeat icon
  const getRepeatIcon = () => {
    switch (state.repeat) {
      case 'one':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" />
            <text x="10" y="14" fontSize="6" textAnchor="middle" fill="currentColor">1</text>
          </svg>
        );
      case 'all':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
    }
  };
  
  if (!state.currentTrack) {
    return (
      <div className={`bg-gray-800 text-white p-4 ${className}`}>
        <div className="flex items-center justify-center">
          <p className="text-gray-400">No track selected</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`bg-gray-800 text-white p-4 ${className}`}>
      <div className="flex items-center gap-4">
        {/* Track info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">{state.currentTrack.title}</h3>
          <p className="text-sm text-gray-400 truncate">{state.currentTrack.artist}</p>
          {state.currentTrack.album && (
            <p className="text-xs text-gray-500 truncate">{state.currentTrack.album}</p>
          )}
        </div>
        
        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Shuffle */}
          <button
            onClick={handleShuffleToggle}
            className={`p-2 rounded-full transition-colors ${
              state.shuffle ? 'text-green-400 bg-green-400/20' : 'text-gray-400 hover:text-white'
            }`}
            title="Shuffle"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zM5 4a1 1 0 011-1h8a1 1 0 011 1v12a1 1 0 01-1 1H6a1 1 0 01-1-1V4z" />
              <path d="M8 6h4v2h-2v4h2v2H8V6z" />
            </svg>
          </button>
          
          {/* Previous */}
          <button
            onClick={handlePrevious}
            className="p-2 rounded-full text-gray-400 hover:text-white transition-colors"
            title="Previous"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" />
            </svg>
          </button>
          
          {/* Play/Pause */}
          <button
            onClick={handlePlayPause}
            className="p-3 rounded-full bg-white text-gray-800 hover:bg-gray-200 transition-colors"
            title={state.isPlaying ? 'Pause' : 'Play'}
          >
            {state.isPlaying ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            )}
          </button>
          
          {/* Next */}
          <button
            onClick={handleNext}
            className="p-2 rounded-full text-gray-400 hover:text-white transition-colors"
            title="Next"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798l-5.445-3.63z" />
            </svg>
          </button>
          
          {/* Repeat */}
          <button
            onClick={handleRepeatToggle}
            className={`p-2 rounded-full transition-colors ${
              state.repeat !== 'none' ? 'text-green-400 bg-green-400/20' : 'text-gray-400 hover:text-white'
            }`}
            title={`Repeat: ${state.repeat}`}
          >
            {getRepeatIcon()}
          </button>
          
          {/* Stop */}
          <button
            onClick={handleStop}
            className="p-2 rounded-full text-gray-400 hover:text-white transition-colors"
            title="Stop"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        
        {/* Volume control */}
        <div className="flex items-center gap-2 min-w-0 w-24">
          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.824L4.465 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.465l3.918-3.824a1 1 0 011.617.824zM14 5a1 1 0 011.414 0 7 7 0 010 9.899 1 1 0 01-1.414-1.415 5 5 0 000-7.07A1 1 0 0114 5z" clipRule="evenodd" />
          </svg>
          <div
            ref={volumeRef}
            className="flex-1 h-2 bg-gray-600 rounded-full cursor-pointer"
            onMouseDown={handleVolumeMouseDown}
          >
            <div
              className="h-full bg-white rounded-full"
              style={{ width: `${state.volume * 100}%` }}
            />
          </div>
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="mt-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-400 w-12 text-right">
            {formatTime(isDragging ? dragTime : state.currentTime)}
          </span>
          <div
            ref={progressRef}
            className="flex-1 h-2 bg-gray-600 rounded-full cursor-pointer"
            onMouseDown={handleProgressMouseDown}
            onMouseMove={handleProgressMouseMove}
            onMouseUp={handleProgressMouseUp}
            onMouseLeave={handleProgressMouseUp}
          >
            <div
              className="h-full bg-white rounded-full transition-none"
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
          <span className="text-gray-400 w-12">
            {formatTime(state.duration)}
          </span>
        </div>
      </div>
    </div>
  );
};