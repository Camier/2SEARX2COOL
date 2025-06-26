import React, { useState, useCallback } from 'react';
import { EnhancedSearchInterface } from './components/EnhancedSearchInterface';
import { MusicPlayer } from './components/MusicPlayer';
import { QueueManager } from './components/QueueManager';
import { LibraryBrowser } from './components/library/LibraryBrowser';
import { 
  PlaylistManager, 
  PlaylistDetailView, 
  PlaylistModal,
  type Playlist,
  type Track,
  type PlaylistShareData,
  type SharePermission 
} from './components/playlists';
import './components/library/Library.css';

/**
 * Week 4 Day 4: Main Application Component with Complete Playlist System
 * 
 * Integrates the enhanced search interface, library browser, playlist system
 * and all Week 3-4 features into the main application.
 */
type ViewState = 'search' | 'library' | 'playlists' | 'playlist-detail';
type ModalState = 'editor' | 'share' | null;

function App() {
  const [isQueueVisible, setIsQueueVisible] = useState(false);
  const [currentView, setCurrentView] = useState<ViewState>('search');
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [modalState, setModalState] = useState<ModalState>(null);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [playlistShares, setPlaylistShares] = useState<PlaylistShareData[]>([]);

  // Playlist handlers
  const handlePlaylistSelect = useCallback((playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setCurrentView('playlist-detail');
  }, []);

  const handlePlaylistCreate = useCallback(() => {
    setEditingPlaylist(null);
    setModalState('editor');
  }, []);

  const handlePlaylistEdit = useCallback((playlist?: Playlist) => {
    setEditingPlaylist(playlist || selectedPlaylist);
    setModalState('editor');
  }, [selectedPlaylist]);

  const handlePlaylistDelete = useCallback(async (playlistId?: string) => {
    const targetPlaylist = playlistId 
      ? { id: playlistId, name: 'this playlist' } 
      : selectedPlaylist;
    
    if (!targetPlaylist) return;

    const confirmMessage = `Are you sure you want to delete "${targetPlaylist.name}"?\n\nThis action cannot be undone.`;
    
    if (confirm(confirmMessage)) {
      try {
        // TODO: Call actual API to delete playlist
        console.log('Deleting playlist:', targetPlaylist.id);
        
        // If we're viewing the deleted playlist, go back to playlists
        if (selectedPlaylist?.id === targetPlaylist.id) {
          setSelectedPlaylist(null);
          setCurrentView('playlists');
        }
      } catch (error) {
        console.error('Failed to delete playlist:', error);
        alert('Failed to delete playlist. Please try again.');
      }
    }
  }, [selectedPlaylist]);

  const handlePlaylistSave = useCallback(async (playlistData: Partial<Playlist>) => {
    try {
      // TODO: Call actual API to save playlist
      console.log('Saving playlist:', playlistData);
      
      // Mock successful save
      if (editingPlaylist) {
        console.log('Updated existing playlist');
      } else {
        console.log('Created new playlist');
      }
    } catch (error) {
      console.error('Failed to save playlist:', error);
      throw error; // Re-throw so modal can handle error
    }
  }, [editingPlaylist]);

  const handlePlaylistPlay = useCallback((playlist: Playlist) => {
    console.log('Playing playlist:', playlist.name);
    // TODO: Integrate with actual music player
  }, []);

  const handleAddToQueue = useCallback((tracks: Track[]) => {
    console.log('Adding tracks to queue:', tracks.length);
    // TODO: Integrate with actual queue manager
  }, []);

  const handlePlaylistShare = useCallback((playlist?: Playlist) => {
    const targetPlaylist = playlist || selectedPlaylist;
    if (!targetPlaylist) return;
    
    setSelectedPlaylist(targetPlaylist);
    setModalState('share');
  }, [selectedPlaylist]);

  const handleTrackSelect = useCallback((track: Track) => {
    console.log('Selected track:', track.title);
    // TODO: Integrate with actual player
  }, []);

  const handleTrackReorder = useCallback((tracks: Track[]) => {
    console.log('Reordered tracks:', tracks.length);
    // TODO: Update playlist with new track order
  }, []);

  const handleTrackRemove = useCallback((trackId: string) => {
    console.log('Removing track:', trackId);
    // TODO: Remove track from playlist
  }, []);

  const handleAddTracks = useCallback(() => {
    console.log('Add tracks to playlist');
    // TODO: Open track selector or library browser
  }, []);

  // Share handlers
  const handleCreateShare = useCallback(async (permissions: SharePermission[], expiresAt?: number): Promise<PlaylistShareData> => {
    try {
      // TODO: Call actual API to create share
      const mockShare: PlaylistShareData = {
        id: `share-${Date.now()}`,
        token: `token-${Math.random().toString(36).substr(2, 9)}`,
        permissions,
        expiresAt,
        createdAt: Date.now(),
        accessCount: 0
      };
      
      setPlaylistShares(prev => [...prev, mockShare]);
      return mockShare;
    } catch (error) {
      console.error('Failed to create share:', error);
      throw error;
    }
  }, []);

  const handleUpdateShare = useCallback(async (shareId: string, permissions: SharePermission[], expiresAt?: number) => {
    try {
      // TODO: Call actual API to update share
      setPlaylistShares(prev => prev.map(share => 
        share.id === shareId 
          ? { ...share, permissions, expiresAt }
          : share
      ));
    } catch (error) {
      console.error('Failed to update share:', error);
      throw error;
    }
  }, []);

  const handleRevokeShare = useCallback(async (shareId: string) => {
    try {
      // TODO: Call actual API to revoke share
      setPlaylistShares(prev => prev.filter(share => share.id !== shareId));
    } catch (error) {
      console.error('Failed to revoke share:', error);
      throw error;
    }
  }, []);

  const handleCopyLink = useCallback((shareUrl: string) => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      // TODO: Show success notification
      console.log('Share link copied to clipboard');
    }).catch((error) => {
      console.error('Failed to copy link:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    });
  }, []);

  const handleBackToPlaylists = useCallback(() => {
    setSelectedPlaylist(null);
    setCurrentView('playlists');
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalState(null);
    setEditingPlaylist(null);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <div className="flex-1 flex flex-col">
        <div className="container mx-auto px-4 py-8 flex-1">
          <header className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-800">
                  2SEARX2COOL Music Library
                </h1>
                <p className="text-gray-600 mt-2">
                  Your personal music library with intelligent search and scoring
                </p>
              </div>
              
              {/* Queue toggle button */}
              <button
                onClick={() => setIsQueueVisible(!isQueueVisible)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  isQueueVisible 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                } border border-gray-300 shadow-sm`}
                title="Toggle queue"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  Queue
                </div>
              </button>
            </div>
            
            {/* Navigation tabs */}
            <nav className="flex gap-4 border-b border-gray-200">
              <button
                onClick={() => setCurrentView('search')}
                className={`pb-3 px-4 font-medium transition-colors relative ${
                  currentView === 'search'
                    ? 'text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Search Music
                {currentView === 'search' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                )}
              </button>
              <button
                onClick={() => setCurrentView('library')}
                className={`pb-3 px-4 font-medium transition-colors relative ${
                  currentView === 'library'
                    ? 'text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                My Library
                {currentView === 'library' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                )}
              </button>
              <button
                onClick={() => handleBackToPlaylists()}
                className={`pb-3 px-4 font-medium transition-colors relative ${
                  currentView === 'playlists' || currentView === 'playlist-detail'
                    ? 'text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {currentView === 'playlist-detail' && selectedPlaylist 
                  ? `Playlist: ${selectedPlaylist.name}`
                  : 'Playlists'
                }
                {(currentView === 'playlists' || currentView === 'playlist-detail') && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                )}
              </button>
            </nav>
          </header>
          
          <main className="flex-1 pb-32">
            {currentView === 'search' && <EnhancedSearchInterface />}
            {currentView === 'library' && <LibraryBrowser />}
            {currentView === 'playlists' && (
              <PlaylistManager
                onPlaylistSelect={handlePlaylistSelect}
                onPlaylistCreate={handlePlaylistCreate}
                onPlaylistEdit={handlePlaylistEdit}
                onPlaylistDelete={handlePlaylistDelete}
              />
            )}
            {currentView === 'playlist-detail' && selectedPlaylist && (
              <PlaylistDetailView
                playlist={selectedPlaylist}
                onBack={handleBackToPlaylists}
                onEdit={() => handlePlaylistEdit()}
                onDelete={() => handlePlaylistDelete()}
                onPlay={handlePlaylistPlay}
                onAddToQueue={handleAddToQueue}
                onSharePlaylist={() => handlePlaylistShare()}
                onTrackSelect={handleTrackSelect}
                onTrackReorder={handleTrackReorder}
                onTrackRemove={handleTrackRemove}
                onAddTracks={handleAddTracks}
              />
            )}
          </main>
        </div>
        
        {/* Music Player - Fixed at bottom */}
        <div className="fixed bottom-0 left-0 right-0 z-40">
          <MusicPlayer />
        </div>
      </div>
      
      {/* Queue Manager - Slide-out panel */}
      <QueueManager 
        isVisible={isQueueVisible}
        onClose={() => setIsQueueVisible(false)}
      />
      
      {/* Footer */}
      <footer className="py-4 border-t border-gray-200 text-center text-sm text-gray-500 bg-white">
        <p>Powered by ACRCloud, SearXNG, and your listening habits</p>
      </footer>

      {/* Playlist Modal */}
      <PlaylistModal
        isOpen={modalState !== null}
        type={modalState || 'editor'}
        playlist={modalState === 'editor' ? editingPlaylist : selectedPlaylist}
        onClose={handleCloseModal}
        onSave={handlePlaylistSave}
        onCreateShare={handleCreateShare}
        onUpdateShare={handleUpdateShare}
        onRevokeShare={handleRevokeShare}
        onCopyLink={handleCopyLink}
        currentShares={playlistShares}
      />
    </div>
  );
}

export default App;