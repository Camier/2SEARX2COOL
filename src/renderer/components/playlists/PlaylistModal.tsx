import React, { useCallback, useEffect } from 'react';
import { PlaylistEditor } from './PlaylistEditor';
import { PlaylistShare } from './PlaylistShare';
import './PlaylistModal.css';

interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  genre?: string;
  year?: number;
  popularity?: number;
  dateAdded?: number;
  playCount?: number;
  lastPlayed?: number;
  rating?: number;
  bpm?: number;
  key?: string;
  energy?: number;
  danceability?: number;
  acousticness?: number;
  valence?: number;
  url?: string;
  artwork?: string;
}

interface SmartPlaylistRule {
  field: string;
  operator: string;
  value: string;
}

interface Playlist {
  id: string;
  name: string;
  description?: string;
  type: 'normal' | 'smart';
  isPublic: boolean;
  tags: string[];
  tracks: Track[];
  smartRules: SmartPlaylistRule[];
  createdAt: number;
  updatedAt: number;
  trackCount: number;
  duration: number;
  artwork?: string;
}

interface PlaylistShare {
  id: string;
  token: string;
  permissions: SharePermission[];
  expiresAt?: number;
  createdAt: number;
  accessCount: number;
  lastAccessedAt?: number;
}

interface SharePermission {
  type: 'view' | 'download' | 'copy' | 'collaborate';
  enabled: boolean;
}

type ModalType = 'editor' | 'share';

interface PlaylistModalProps {
  isOpen: boolean;
  type: ModalType;
  playlist?: Playlist;
  onClose: () => void;
  onSave: (playlist: Partial<Playlist>) => Promise<void>;
  onCreateShare: (permissions: SharePermission[], expiresAt?: number) => Promise<PlaylistShare>;
  onUpdateShare: (shareId: string, permissions: SharePermission[], expiresAt?: number) => Promise<void>;
  onRevokeShare: (shareId: string) => Promise<void>;
  onCopyLink: (shareUrl: string) => void;
  currentShares?: PlaylistShare[];
  className?: string;
}

export const PlaylistModal: React.FC<PlaylistModalProps> = ({
  isOpen,
  type,
  playlist,
  onClose,
  onSave,
  onCreateShare,
  onUpdateShare,
  onRevokeShare,
  onCopyLink,
  currentShares = [],
  className = ''
}) => {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  // Handle save from editor
  const handleEditorSave = useCallback(async (playlistData: Partial<Playlist>) => {
    try {
      await onSave(playlistData);
      onClose();
    } catch (error) {
      console.error('Failed to save playlist:', error);
      // Error handling would be done by the parent component
    }
  }, [onSave, onClose]);

  if (!isOpen) return null;

  return (
    <div className={`playlist-modal-overlay ${className}`} onClick={handleBackdropClick}>
      <div className="playlist-modal">
        <div className="modal-header">
          <h2 className="modal-title">
            {type === 'editor' 
              ? (playlist ? `Edit "${playlist.name}"` : 'Create New Playlist')
              : `Share "${playlist?.name}"`
            }
          </h2>
          <button className="modal-close" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        <div className="modal-content">
          {type === 'editor' && (
            <PlaylistEditor
              playlist={playlist}
              onSave={handleEditorSave}
              onCancel={onClose}
              className="modal-editor"
            />
          )}

          {type === 'share' && playlist && (
            <PlaylistShare
              playlistId={playlist.id}
              playlistName={playlist.name}
              currentShares={currentShares}
              onCreateShare={onCreateShare}
              onUpdateShare={onUpdateShare}
              onRevokeShare={onRevokeShare}
              onCopyLink={onCopyLink}
              className="modal-share"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PlaylistModal;