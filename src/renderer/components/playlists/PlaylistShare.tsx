import React, { useState, useEffect, useCallback } from 'react';
import './PlaylistShare.css';

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

interface PlaylistShareProps {
  playlistId: string;
  playlistName: string;
  currentShares?: PlaylistShare[];
  onCreateShare: (permissions: SharePermission[], expiresAt?: number) => Promise<PlaylistShare>;
  onUpdateShare: (shareId: string, permissions: SharePermission[], expiresAt?: number) => Promise<void>;
  onRevokeShare: (shareId: string) => Promise<void>;
  onCopyLink: (shareUrl: string) => void;
  baseShareUrl?: string;
  className?: string;
}

interface ShareFormData {
  permissions: SharePermission[];
  expirationOption: 'never' | '1hour' | '1day' | '1week' | '1month' | 'custom';
  customExpiration?: string;
}

const DEFAULT_PERMISSIONS: SharePermission[] = [
  { type: 'view', enabled: true },
  { type: 'download', enabled: false },
  { type: 'copy', enabled: false },
  { type: 'collaborate', enabled: false }
];

const EXPIRATION_OPTIONS = [
  { value: 'never', label: 'Never expires', hours: 0 },
  { value: '1hour', label: '1 hour', hours: 1 },
  { value: '1day', label: '1 day', hours: 24 },
  { value: '1week', label: '1 week', hours: 168 },
  { value: '1month', label: '1 month', hours: 720 },
  { value: 'custom', label: 'Custom date', hours: 0 }
];

export const PlaylistShare: React.FC<PlaylistShareProps> = ({
  playlistId,
  playlistName,
  currentShares = [],
  onCreateShare,
  onUpdateShare,
  onRevokeShare,
  onCopyLink,
  baseShareUrl = 'https://app.example.com/shared',
  className = ''
}) => {
  const [shares, setShares] = useState<PlaylistShare[]>(currentShares);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingShare, setEditingShare] = useState<PlaylistShare | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ShareFormData>({
    permissions: [...DEFAULT_PERMISSIONS],
    expirationOption: 'never'
  });

  // Update shares when props change
  useEffect(() => {
    setShares(currentShares);
  }, [currentShares]);

  // Calculate expiration timestamp
  const calculateExpiration = useCallback((option: string, customDate?: string): number | undefined => {
    if (option === 'never') return undefined;
    
    if (option === 'custom' && customDate) {
      return new Date(customDate).getTime();
    }

    const optionData = EXPIRATION_OPTIONS.find(opt => opt.value === option);
    if (optionData && optionData.hours > 0) {
      return Date.now() + (optionData.hours * 60 * 60 * 1000);
    }

    return undefined;
  }, []);

  // Handle permission change
  const handlePermissionChange = useCallback((type: SharePermission['type'], enabled: boolean) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.map(perm =>
        perm.type === type ? { ...perm, enabled } : perm
      )
    }));
  }, []);

  // Handle create share
  const handleCreateShare = useCallback(async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const expiresAt = calculateExpiration(formData.expirationOption, formData.customExpiration);
      const newShare = await onCreateShare(formData.permissions, expiresAt);
      
      setShares(prev => [...prev, newShare]);
      setShowCreateForm(false);
      setFormData({
        permissions: [...DEFAULT_PERMISSIONS],
        expirationOption: 'never'
      });
    } catch (error) {
      console.error('Failed to create share:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, formData, calculateExpiration, onCreateShare]);

  // Handle update share
  const handleUpdateShare = useCallback(async (share: PlaylistShare) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const expiresAt = calculateExpiration(formData.expirationOption, formData.customExpiration);
      await onUpdateShare(share.id, formData.permissions, expiresAt);
      
      setShares(prev => prev.map(s => 
        s.id === share.id 
          ? { ...s, permissions: formData.permissions, expiresAt }
          : s
      ));
      setEditingShare(null);
    } catch (error) {
      console.error('Failed to update share:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, formData, calculateExpiration, onUpdateShare]);

  // Handle revoke share
  const handleRevokeShare = useCallback(async (shareId: string) => {
    if (!confirm('Are you sure you want to revoke this share? The link will no longer work.')) {
      return;
    }

    try {
      await onRevokeShare(shareId);
      setShares(prev => prev.filter(s => s.id !== shareId));
    } catch (error) {
      console.error('Failed to revoke share:', error);
    }
  }, [onRevokeShare]);

  // Handle copy link
  const handleCopyLink = useCallback((share: PlaylistShare) => {
    const shareUrl = `${baseShareUrl}/${share.token}`;
    onCopyLink(shareUrl);
  }, [baseShareUrl, onCopyLink]);

  // Start editing share
  const startEditShare = useCallback((share: PlaylistShare) => {
    setEditingShare(share);
    setFormData({
      permissions: [...share.permissions],
      expirationOption: share.expiresAt ? 'custom' : 'never',
      customExpiration: share.expiresAt ? new Date(share.expiresAt).toISOString().split('T')[0] : undefined
    });
    setShowCreateForm(true);
  }, []);

  // Cancel editing
  const cancelEditing = useCallback(() => {
    setEditingShare(null);
    setShowCreateForm(false);
    setFormData({
      permissions: [...DEFAULT_PERMISSIONS],
      expirationOption: 'never'
    });
  }, []);

  // Format date
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Check if share is expired
  const isShareExpired = (share: PlaylistShare): boolean => {
    return share.expiresAt ? share.expiresAt < Date.now() : false;
  };

  // Get permission label
  const getPermissionLabel = (type: SharePermission['type']): string => {
    switch (type) {
      case 'view': return 'View playlist';
      case 'download': return 'Download tracks';
      case 'copy': return 'Copy to library';
      case 'collaborate': return 'Edit playlist';
      default: return type;
    }
  };

  // Get permission description
  const getPermissionDescription = (type: SharePermission['type']): string => {
    switch (type) {
      case 'view': return 'Allow viewing playlist details and tracks';
      case 'download': return 'Allow downloading tracks (if available)';
      case 'copy': return 'Allow copying playlist to personal library';
      case 'collaborate': return 'Allow adding/removing tracks and editing details';
      default: return '';
    }
  };

  return (
    <div className={`playlist-share ${className}`}>
      {/* Header */}
      <div className="share-header">
        <div className="header-info">
          <h3>Share "{playlistName}"</h3>
          <p>{shares.length} active share{shares.length !== 1 ? 's' : ''}</p>
        </div>

        <button
          className="create-share-button primary"
          onClick={() => setShowCreateForm(true)}
          disabled={showCreateForm}
        >
          ➕ Create Share Link
        </button>
      </div>

      {/* Create/Edit form */}
      {showCreateForm && (
        <div className="share-form">
          <div className="form-header">
            <h4>{editingShare ? 'Edit Share' : 'Create New Share'}</h4>
            <button className="close-form" onClick={cancelEditing}>×</button>
          </div>

          <div className="form-content">
            {/* Permissions */}
            <div className="form-section">
              <h5>Permissions</h5>
              <div className="permissions-list">
                {formData.permissions.map(permission => (
                  <label key={permission.type} className="permission-item">
                    <input
                      type="checkbox"
                      checked={permission.enabled}
                      onChange={(e) => handlePermissionChange(permission.type, e.target.checked)}
                    />
                    <div className="permission-info">
                      <div className="permission-label">
                        {getPermissionLabel(permission.type)}
                      </div>
                      <div className="permission-description">
                        {getPermissionDescription(permission.type)}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Expiration */}
            <div className="form-section">
              <h5>Expiration</h5>
              <div className="expiration-options">
                {EXPIRATION_OPTIONS.map(option => (
                  <label key={option.value} className="expiration-option">
                    <input
                      type="radio"
                      name="expiration"
                      value={option.value}
                      checked={formData.expirationOption === option.value}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        expirationOption: e.target.value as any 
                      }))}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>

              {formData.expirationOption === 'custom' && (
                <div className="custom-expiration">
                  <input
                    type="datetime-local"
                    value={formData.customExpiration || ''}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      customExpiration: e.target.value 
                    }))}
                    min={new Date().toISOString().slice(0, 16)}
                    className="expiration-input"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="form-actions">
            <button
              className="cancel-button"
              onClick={cancelEditing}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              className="save-button primary"
              onClick={editingShare ? () => handleUpdateShare(editingShare) : handleCreateShare}
              disabled={isSubmitting || !formData.permissions.some(p => p.enabled)}
            >
              {isSubmitting ? 'Saving...' : (editingShare ? 'Update Share' : 'Create Share')}
            </button>
          </div>
        </div>
      )}

      {/* Existing shares */}
      <div className="shares-list">
        {shares.length === 0 ? (
          <div className="empty-shares">
            <div className="empty-icon">🔗</div>
            <h4>No shares created yet</h4>
            <p>Create a share link to allow others to access this playlist</p>
          </div>
        ) : (
          shares.map(share => {
            const expired = isShareExpired(share);
            const shareUrl = `${baseShareUrl}/${share.token}`;

            return (
              <div key={share.id} className={`share-item ${expired ? 'expired' : ''}`}>
                <div className="share-info">
                  <div className="share-header-item">
                    <div className="share-status">
                      {expired ? (
                        <span className="status-badge expired">Expired</span>
                      ) : (
                        <span className="status-badge active">Active</span>
                      )}
                    </div>
                    <div className="share-stats">
                      <span className="access-count">{share.accessCount} access{share.accessCount !== 1 ? 'es' : ''}</span>
                    </div>
                  </div>

                  <div className="share-details">
                    <div className="share-url">
                      <code>{shareUrl}</code>
                    </div>
                    
                    <div className="share-metadata">
                      <span>Created: {formatDate(share.createdAt)}</span>
                      {share.expiresAt && (
                        <span>Expires: {formatDate(share.expiresAt)}</span>
                      )}
                      {share.lastAccessedAt && (
                        <span>Last accessed: {formatDate(share.lastAccessedAt)}</span>
                      )}
                    </div>

                    <div className="share-permissions">
                      {share.permissions
                        .filter(p => p.enabled)
                        .map(permission => (
                          <span key={permission.type} className="permission-badge">
                            {getPermissionLabel(permission.type)}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>

                <div className="share-actions">
                  <button
                    className="copy-link-button"
                    onClick={() => handleCopyLink(share)}
                    title="Copy share link"
                    disabled={expired}
                  >
                    📋
                  </button>
                  
                  <button
                    className="edit-share-button"
                    onClick={() => startEditShare(share)}
                    title="Edit share"
                    disabled={expired}
                  >
                    ✏️
                  </button>
                  
                  <button
                    className="revoke-share-button"
                    onClick={() => handleRevokeShare(share.id)}
                    title="Revoke share"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Info footer */}
      <div className="share-info-footer">
        <div className="info-item">
          <strong>Security:</strong> Share links are secure and can be revoked at any time
        </div>
        <div className="info-item">
          <strong>Privacy:</strong> Only users with the exact link can access your playlist
        </div>
      </div>
    </div>
  );
};

export default PlaylistShare;