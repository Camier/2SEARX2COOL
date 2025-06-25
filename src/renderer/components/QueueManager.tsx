import React, { useState, useEffect } from 'react';
import { Track } from '../../main/services/MusicPlayerService';

/**
 * Week 4 Day 2: Queue Manager Component
 * 
 * Displays and manages the playback queue with
 * drag-and-drop reordering and queue controls.
 */

interface QueueManagerProps {
  isVisible: boolean;
  onClose: () => void;
  className?: string;
}

interface QueueItem extends Track {
  isCurrentTrack?: boolean;
}

export const QueueManager: React.FC<QueueManagerProps> = ({
  isVisible,
  onClose,
  className = ''
}) => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  
  // Load queue state
  useEffect(() => {
    const loadQueue = async () => {
      try {
        const state = await window.electron.ipcRenderer.invoke('get-player-state');
        const queueWithCurrent = state.queue.map((track: Track, index: number) => ({
          ...track,
          isCurrentTrack: index === state.currentIndex
        }));
        setQueue(queueWithCurrent);
        setCurrentIndex(state.currentIndex);
      } catch (error) {
        console.error('Failed to load queue:', error);
      }
    };
    
    if (isVisible) {
      loadQueue();
    }
    
    // Listen for queue updates
    const unsubscribes = [
      window.electron.ipcRenderer.on('queue-change', (newQueue: Track[]) => {
        const queueWithCurrent = newQueue.map((track, index) => ({
          ...track,
          isCurrentTrack: index === currentIndex
        }));
        setQueue(queueWithCurrent);
      }),
      
      window.electron.ipcRenderer.on('track-change', (track: Track) => {
        setQueue(prev => prev.map((item, index) => ({
          ...item,
          isCurrentTrack: index === currentIndex
        })));
      })
    ];
    
    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [isVisible, currentIndex]);
  
  // Play specific track from queue
  const handlePlayTrack = async (track: Track, index: number) => {
    try {
      await window.electron.ipcRenderer.invoke('player-play', track, false);
    } catch (error) {
      console.error('Failed to play track from queue:', error);
    }
  };
  
  // Remove track from queue
  const handleRemoveTrack = async (trackId: string) => {
    try {
      await window.electron.ipcRenderer.invoke('player-remove-from-queue', trackId);
    } catch (error) {
      console.error('Failed to remove track from queue:', error);
    }
  };
  
  // Clear entire queue
  const handleClearQueue = async () => {
    try {
      await window.electron.ipcRenderer.invoke('player-clear-queue');
    } catch (error) {
      console.error('Failed to clear queue:', error);
    }
  };
  
  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };
  
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };
  
  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };
  
  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      return;
    }
    
    // Reorder queue locally first for immediate feedback
    const newQueue = [...queue];
    const draggedItem = newQueue[draggedIndex];
    newQueue.splice(draggedIndex, 1);
    newQueue.splice(dropIndex, 0, draggedItem);
    setQueue(newQueue);
    
    // TODO: Implement queue reordering in backend
    // await window.electron.ipcRenderer.invoke('player-reorder-queue', draggedIndex, dropIndex);
    
    setDraggedIndex(null);
    setDragOverIndex(null);
  };
  
  // Format duration
  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  if (!isVisible) return null;
  
  return (
    <div className={`fixed inset-y-0 right-0 w-96 bg-white shadow-lg border-l border-gray-200 z-50 ${className}`}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">Queue</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              {queue.length} track{queue.length !== 1 ? 's' : ''}
            </span>
            {queue.length > 0 && (
              <button
                onClick={handleClearQueue}
                className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                title="Clear queue"
              >
                Clear
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-gray-200 transition-colors"
              title="Close queue"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Queue items */}
        <div className="flex-1 overflow-y-auto">
          {queue.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <p>No tracks in queue</p>
                <p className="text-sm">Add tracks from search results</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {queue.map((track, index) => (
                <div
                  key={`${track.id}-${index}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`
                    flex items-center gap-3 p-3 cursor-pointer transition-colors group
                    ${track.isCurrentTrack 
                      ? 'bg-blue-50 border-l-4 border-blue-500' 
                      : 'hover:bg-gray-50'
                    }
                    ${draggedIndex === index ? 'opacity-50' : ''}
                    ${dragOverIndex === index ? 'bg-blue-100' : ''}
                  `}
                >
                  {/* Drag handle */}
                  <div className="text-gray-400 group-hover:text-gray-600">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 16a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
                    </svg>
                  </div>
                  
                  {/* Track info */}
                  <div 
                    className="flex-1 min-w-0"
                    onClick={() => handlePlayTrack(track, index)}
                  >
                    <div className="flex items-center gap-2">
                      {track.isCurrentTrack && (
                        <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                      )}
                      <div className="min-w-0">
                        <h4 className={`font-medium truncate ${track.isCurrentTrack ? 'text-blue-800' : 'text-gray-800'}`}>
                          {track.title}
                        </h4>
                        <p className={`text-sm truncate ${track.isCurrentTrack ? 'text-blue-600' : 'text-gray-600'}`}>
                          {track.artist}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Duration and actions */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-12 text-right">
                      {formatDuration(track.duration)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveTrack(track.id);
                      }}
                      className="p-1 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                      title="Remove from queue"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer with queue stats */}
        {queue.length > 0 && (
          <div className="p-3 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-between text-xs text-gray-600">
              <span>
                Total: {queue.length} track{queue.length !== 1 ? 's' : ''}
              </span>
              <span>
                Duration: {formatDuration(queue.reduce((total, track) => total + (track.duration || 0), 0))}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};