import React, { useState, useEffect, useCallback } from 'react';
import './PlaylistEditor.css';

interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  source: string;
  url: string;
}

interface SmartPlaylistRule {
  id: string;
  field: string;
  operator: string;
  value: string;
  logicalOperator?: 'AND' | 'OR';
}

interface PlaylistData {
  id?: string;
  name: string;
  description?: string;
  type: 'normal' | 'smart';
  isPublic: boolean;
  tags: string[];
  tracks?: Track[];
  smartRules?: SmartPlaylistRule[];
  coverArt?: string;
}

interface PlaylistEditorProps {
  playlist?: PlaylistData;
  onSave: (playlist: PlaylistData) => void;
  onCancel: () => void;
  className?: string;
}

interface PlaylistEditorState {
  formData: PlaylistData;
  errors: Record<string, string>;
  isSubmitting: boolean;
  activeTab: 'basic' | 'tracks' | 'rules' | 'settings';
  draggedTrack: Track | null;
  tagInput: string;
}

export const PlaylistEditor: React.FC<PlaylistEditorProps> = ({
  playlist,
  onSave,
  onCancel,
  className = ''
}) => {
  const [state, setState] = useState<PlaylistEditorState>({
    formData: {
      name: '',
      description: '',
      type: 'normal',
      isPublic: false,
      tags: [],
      tracks: [],
      smartRules: []
    },
    errors: {},
    isSubmitting: false,
    activeTab: 'basic',
    draggedTrack: null,
    tagInput: ''
  });

  // Initialize form data
  useEffect(() => {
    if (playlist) {
      setState(prev => ({
        ...prev,
        formData: { ...playlist }
      }));
    }
  }, [playlist]);

  // Validate form
  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    if (!state.formData.name.trim()) {
      errors.name = 'Playlist name is required';
    }

    if (state.formData.name.length > 100) {
      errors.name = 'Playlist name must be less than 100 characters';
    }

    if (state.formData.description && state.formData.description.length > 500) {
      errors.description = 'Description must be less than 500 characters';
    }

    if (state.formData.type === 'smart' && (!state.formData.smartRules || state.formData.smartRules.length === 0)) {
      errors.smartRules = 'Smart playlists must have at least one rule';
    }

    setState(prev => ({ ...prev, errors }));
    return Object.keys(errors).length === 0;
  }, [state.formData]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setState(prev => ({ ...prev, isSubmitting: true }));

    try {
      await onSave(state.formData);
    } catch (error) {
      setState(prev => ({
        ...prev,
        errors: { submit: error instanceof Error ? error.message : 'Failed to save playlist' }
      }));
    } finally {
      setState(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  // Handle input changes
  const handleInputChange = (field: keyof PlaylistData, value: any) => {
    setState(prev => ({
      ...prev,
      formData: { ...prev.formData, [field]: value },
      errors: { ...prev.errors, [field]: undefined }
    }));
  };

  // Handle tag management
  const handleAddTag = () => {
    if (!state.tagInput.trim()) return;

    const newTag = state.tagInput.trim().toLowerCase();
    if (!state.formData.tags.includes(newTag)) {
      handleInputChange('tags', [...state.formData.tags, newTag]);
    }
    setState(prev => ({ ...prev, tagInput: '' }));
  };

  const handleRemoveTag = (tagToRemove: string) => {
    handleInputChange('tags', state.formData.tags.filter(tag => tag !== tagToRemove));
  };

  // Handle track management
  const handleRemoveTrack = (trackId: string) => {
    handleInputChange('tracks', state.formData.tracks?.filter(track => track.id !== trackId) || []);
  };

  const handleMoveTrack = (fromIndex: number, toIndex: number) => {
    const tracks = [...(state.formData.tracks || [])];
    const [movedTrack] = tracks.splice(fromIndex, 1);
    tracks.splice(toIndex, 0, movedTrack);
    handleInputChange('tracks', tracks);
  };

  // Handle smart rule management
  const handleAddSmartRule = () => {
    const newRule: SmartPlaylistRule = {
      id: Date.now().toString(),
      field: 'title',
      operator: 'contains',
      value: '',
      logicalOperator: state.formData.smartRules?.length ? 'AND' : undefined
    };

    handleInputChange('smartRules', [...(state.formData.smartRules || []), newRule]);
  };

  const handleUpdateSmartRule = (ruleId: string, updates: Partial<SmartPlaylistRule>) => {
    const updatedRules = state.formData.smartRules?.map(rule =>
      rule.id === ruleId ? { ...rule, ...updates } : rule
    ) || [];

    handleInputChange('smartRules', updatedRules);
  };

  const handleRemoveSmartRule = (ruleId: string) => {
    handleInputChange('smartRules', state.formData.smartRules?.filter(rule => rule.id !== ruleId) || []);
  };

  // Format duration
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Render basic info tab
  const renderBasicTab = () => (
    <div className="tab-content">
      <div className="form-group">
        <label htmlFor="name" className="form-label">
          Playlist Name *
        </label>
        <input
          id="name"
          type="text"
          value={state.formData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          className={`form-input ${state.errors.name ? 'error' : ''}`}
          placeholder="Enter playlist name..."
          maxLength={100}
        />
        {state.errors.name && <span className="error-message">{state.errors.name}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="description" className="form-label">
          Description
        </label>
        <textarea
          id="description"
          value={state.formData.description || ''}
          onChange={(e) => handleInputChange('description', e.target.value)}
          className={`form-textarea ${state.errors.description ? 'error' : ''}`}
          placeholder="Enter playlist description..."
          rows={3}
          maxLength={500}
        />
        {state.errors.description && <span className="error-message">{state.errors.description}</span>}
      </div>

      <div className="form-group">
        <label className="form-label">Playlist Type</label>
        <div className="radio-group">
          <label className="radio-option">
            <input
              type="radio"
              name="type"
              value="normal"
              checked={state.formData.type === 'normal'}
              onChange={(e) => handleInputChange('type', e.target.value)}
            />
            <span className="radio-label">
              <strong>Normal Playlist</strong>
              <small>Manually add and organize tracks</small>
            </span>
          </label>
          <label className="radio-option">
            <input
              type="radio"
              name="type"
              value="smart"
              checked={state.formData.type === 'smart'}
              onChange={(e) => handleInputChange('type', e.target.value)}
            />
            <span className="radio-label">
              <strong>Smart Playlist</strong>
              <small>Automatically populated based on rules</small>
            </span>
          </label>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Tags</label>
        <div className="tag-input-container">
          <input
            type="text"
            value={state.tagInput}
            onChange={(e) => setState(prev => ({ ...prev, tagInput: e.target.value }))}
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
            className="tag-input"
            placeholder="Add tags..."
          />
          <button
            type="button"
            onClick={handleAddTag}
            className="add-tag-button"
            disabled={!state.tagInput.trim()}
          >
            Add
          </button>
        </div>
        {state.formData.tags.length > 0 && (
          <div className="tag-list">
            {state.formData.tags.map(tag => (
              <span key={tag} className="tag">
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="remove-tag-button"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // Render tracks tab
  const renderTracksTab = () => (
    <div className="tab-content">
      {state.formData.type === 'smart' ? (
        <div className="info-message">
          <p>Smart playlists are automatically populated based on rules. Configure rules in the "Rules" tab.</p>
        </div>
      ) : (
        <>
          <div className="tracks-header">
            <h3>Tracks ({state.formData.tracks?.length || 0})</h3>
            <button type="button" className="add-tracks-button">
              Add Tracks
            </button>
          </div>

          {(!state.formData.tracks || state.formData.tracks.length === 0) ? (
            <div className="empty-tracks">
              <div className="empty-icon">🎵</div>
              <p>No tracks in this playlist yet</p>
              <button type="button" className="add-tracks-button primary">
                Add Your First Track
              </button>
            </div>
          ) : (
            <div className="track-list">
              {state.formData.tracks.map((track, index) => (
                <div key={track.id} className="track-item">
                  <div className="track-handle">⋮⋮</div>
                  <div className="track-number">{index + 1}</div>
                  <div className="track-info">
                    <div className="track-title">{track.title}</div>
                    <div className="track-artist">{track.artist}</div>
                  </div>
                  <div className="track-duration">{formatDuration(track.duration)}</div>
                  <button
                    type="button"
                    onClick={() => handleRemoveTrack(track.id)}
                    className="remove-track-button"
                    title="Remove track"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  // Render smart rules tab
  const renderRulesTab = () => (
    <div className="tab-content">
      {state.formData.type !== 'smart' ? (
        <div className="info-message">
          <p>Rules are only available for smart playlists. Change the playlist type to "Smart Playlist" to configure rules.</p>
        </div>
      ) : (
        <>
          <div className="rules-header">
            <h3>Smart Playlist Rules</h3>
            <button type="button" onClick={handleAddSmartRule} className="add-rule-button">
              Add Rule
            </button>
          </div>

          {state.errors.smartRules && (
            <div className="error-message">{state.errors.smartRules}</div>
          )}

          {(!state.formData.smartRules || state.formData.smartRules.length === 0) ? (
            <div className="empty-rules">
              <div className="empty-icon">🧠</div>
              <p>No rules defined yet</p>
              <button type="button" onClick={handleAddSmartRule} className="add-rule-button primary">
                Add Your First Rule
              </button>
            </div>
          ) : (
            <div className="rules-list">
              {state.formData.smartRules.map((rule, index) => (
                <div key={rule.id} className="rule-item">
                  {index > 0 && (
                    <div className="logical-operator">
                      <select
                        value={rule.logicalOperator || 'AND'}
                        onChange={(e) => handleUpdateSmartRule(rule.id, { logicalOperator: e.target.value as 'AND' | 'OR' })}
                        className="operator-select"
                      >
                        <option value="AND">AND</option>
                        <option value="OR">OR</option>
                      </select>
                    </div>
                  )}

                  <div className="rule-controls">
                    <select
                      value={rule.field}
                      onChange={(e) => handleUpdateSmartRule(rule.id, { field: e.target.value })}
                      className="field-select"
                    >
                      <option value="title">Title</option>
                      <option value="artist">Artist</option>
                      <option value="album">Album</option>
                      <option value="genre">Genre</option>
                      <option value="year">Year</option>
                      <option value="duration">Duration</option>
                      <option value="rating">Rating</option>
                      <option value="playCount">Play Count</option>
                      <option value="dateAdded">Date Added</option>
                    </select>

                    <select
                      value={rule.operator}
                      onChange={(e) => handleUpdateSmartRule(rule.id, { operator: e.target.value })}
                      className="operator-select"
                    >
                      <option value="contains">Contains</option>
                      <option value="equals">Equals</option>
                      <option value="startsWith">Starts With</option>
                      <option value="endsWith">Ends With</option>
                      <option value="greaterThan">Greater Than</option>
                      <option value="lessThan">Less Than</option>
                      <option value="greaterEqual">Greater or Equal</option>
                      <option value="lessEqual">Less or Equal</option>
                    </select>

                    <input
                      type="text"
                      value={rule.value}
                      onChange={(e) => handleUpdateSmartRule(rule.id, { value: e.target.value })}
                      className="value-input"
                      placeholder="Enter value..."
                    />

                    <button
                      type="button"
                      onClick={() => handleRemoveSmartRule(rule.id)}
                      className="remove-rule-button"
                      title="Remove rule"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  // Render settings tab
  const renderSettingsTab = () => (
    <div className="tab-content">
      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={state.formData.isPublic}
            onChange={(e) => handleInputChange('isPublic', e.target.checked)}
          />
          <span className="checkbox-text">
            <strong>Make playlist public</strong>
            <small>Allow others to view and share this playlist</small>
          </span>
        </label>
      </div>

      <div className="form-group">
        <label className="form-label">Cover Art</label>
        <div className="cover-art-section">
          {state.formData.coverArt ? (
            <div className="current-cover">
              <img src={state.formData.coverArt} alt="Playlist cover" />
              <button
                type="button"
                onClick={() => handleInputChange('coverArt', undefined)}
                className="remove-cover-button"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="no-cover">
              <div className="cover-placeholder">🎵</div>
              <p>No cover art selected</p>
            </div>
          )}
          <button type="button" className="upload-cover-button">
            Choose Image
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`playlist-editor ${className}`}>
      <div className="editor-header">
        <h2>{playlist ? 'Edit Playlist' : 'Create Playlist'}</h2>
        <div className="header-actions">
          <button type="button" onClick={onCancel} className="cancel-button">
            Cancel
          </button>
          <button
            type="submit"
            form="playlist-form"
            className="save-button primary"
            disabled={state.isSubmitting}
          >
            {state.isSubmitting ? 'Saving...' : (playlist ? 'Save Changes' : 'Create Playlist')}
          </button>
        </div>
      </div>

      <div className="editor-tabs">
        <button
          type="button"
          className={`tab-button ${state.activeTab === 'basic' ? 'active' : ''}`}
          onClick={() => setState(prev => ({ ...prev, activeTab: 'basic' }))}
        >
          Basic Info
        </button>
        <button
          type="button"
          className={`tab-button ${state.activeTab === 'tracks' ? 'active' : ''}`}
          onClick={() => setState(prev => ({ ...prev, activeTab: 'tracks' }))}
        >
          Tracks
        </button>
        <button
          type="button"
          className={`tab-button ${state.activeTab === 'rules' ? 'active' : ''}`}
          onClick={() => setState(prev => ({ ...prev, activeTab: 'rules' }))}
          disabled={state.formData.type !== 'smart'}
        >
          Rules
        </button>
        <button
          type="button"
          className={`tab-button ${state.activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setState(prev => ({ ...prev, activeTab: 'settings' }))}
        >
          Settings
        </button>
      </div>

      <form id="playlist-form" onSubmit={handleSubmit} className="editor-form">
        {state.errors.submit && (
          <div className="submit-error">{state.errors.submit}</div>
        )}

        <div className="tab-panels">
          {state.activeTab === 'basic' && renderBasicTab()}
          {state.activeTab === 'tracks' && renderTracksTab()}
          {state.activeTab === 'rules' && renderRulesTab()}
          {state.activeTab === 'settings' && renderSettingsTab()}
        </div>
      </form>
    </div>
  );
};

export default PlaylistEditor;