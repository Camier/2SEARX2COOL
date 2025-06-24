import React, { useState, useEffect } from 'react';

interface SettingsSection {
  id: string;
  title: string;
  icon?: string;
  settings: Setting[];
}

interface Setting {
  key: string;
  label: string;
  description?: string;
  type: 'boolean' | 'string' | 'number' | 'select' | 'multiselect' | 'color' | 'range';
  value: any;
  options?: Array<{ value: any; label: string }>;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
  disabled?: boolean;
  validation?: (value: any) => string | null;
}

interface SettingsPanelProps {
  sections: SettingsSection[];
  onSettingChange?: (sectionId: string, key: string, value: any) => void;
  onSave?: (settings: Record<string, Record<string, any>>) => Promise<void>;
  onReset?: (sectionId?: string) => Promise<void>;
  onExport?: () => Promise<void>;
  onImport?: (settings: Record<string, Record<string, any>>) => Promise<void>;
  className?: string;
  readonly?: boolean;
}

const SettingControl: React.FC<{
  setting: Setting;
  value: any;
  onChange: (value: any) => void;
  error?: string;
}> = ({ setting, value, onChange, error }) => {
  const handleChange = (newValue: any) => {
    if (setting.validation) {
      const validationError = setting.validation(newValue);
      if (validationError) {
        return; // Don't update if validation fails
      }
    }
    onChange(newValue);
  };

  const renderControl = () => {
    switch (setting.type) {
      case 'boolean':
        return (
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => handleChange(e.target.checked)}
              disabled={setting.disabled}
            />
            <span className="toggle-slider"></span>
          </label>
        );

      case 'string':
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            disabled={setting.disabled}
            required={setting.required}
            className="setting-input"
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value || 0}
            onChange={(e) => handleChange(Number(e.target.value))}
            disabled={setting.disabled}
            required={setting.required}
            min={setting.min}
            max={setting.max}
            step={setting.step}
            className="setting-input"
          />
        );

      case 'range':
        return (
          <div className="range-control">
            <input
              type="range"
              value={value || setting.min || 0}
              onChange={(e) => handleChange(Number(e.target.value))}
              disabled={setting.disabled}
              min={setting.min || 0}
              max={setting.max || 100}
              step={setting.step || 1}
              className="range-slider"
            />
            <span className="range-value">{value}</span>
          </div>
        );

      case 'select':
        return (
          <select
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            disabled={setting.disabled}
            required={setting.required}
            className="setting-select"
          >
            <option value="">Select...</option>
            {setting.options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'multiselect':
        return (
          <div className="multiselect-control">
            {setting.options?.map(option => (
              <label key={option.value} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={Array.isArray(value) && value.includes(option.value)}
                  onChange={(e) => {
                    const currentValues = Array.isArray(value) ? value : [];
                    const newValues = e.target.checked
                      ? [...currentValues, option.value]
                      : currentValues.filter(v => v !== option.value);
                    handleChange(newValues);
                  }}
                  disabled={setting.disabled}
                />
                <span className="checkbox-text">{option.label}</span>
              </label>
            ))}
          </div>
        );

      case 'color':
        return (
          <input
            type="color"
            value={value || '#000000'}
            onChange={(e) => handleChange(e.target.value)}
            disabled={setting.disabled}
            className="color-input"
          />
        );

      default:
        return <span>Unsupported setting type: {setting.type}</span>;
    }
  };

  return (
    <div className={`setting-control ${error ? 'has-error' : ''}`}>
      <div className="setting-header">
        <label className="setting-label">{setting.label}</label>
        {setting.required && <span className="required-indicator">*</span>}
      </div>
      
      {setting.description && (
        <p className="setting-description">{setting.description}</p>
      )}
      
      <div className="setting-input-container">
        {renderControl()}
      </div>
      
      {error && (
        <div className="setting-error">
          <span className="error-icon">⚠</span>
          <span className="error-text">{error}</span>
        </div>
      )}
    </div>
  );
};

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  sections,
  onSettingChange,
  onSave,
  onReset,
  onExport,
  onImport,
  className = '',
  readonly = false
}) => {
  const [activeSection, setActiveSection] = useState<string>(sections[0]?.id || '');
  const [settings, setSettings] = useState<Record<string, Record<string, any>>>({});
  const [errors, setErrors] = useState<Record<string, Record<string, string>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Initialize settings from sections
  useEffect(() => {
    const initialSettings: Record<string, Record<string, any>> = {};
    sections.forEach(section => {
      initialSettings[section.id] = {};
      section.settings.forEach(setting => {
        initialSettings[section.id][setting.key] = setting.value;
      });
    });
    setSettings(initialSettings);
  }, [sections]);

  const handleSettingChange = (sectionId: string, key: string, value: any) => {
    if (readonly) return;

    const newSettings = {
      ...settings,
      [sectionId]: {
        ...settings[sectionId],
        [key]: value
      }
    };

    setSettings(newSettings);
    setHasChanges(true);

    // Validate setting
    const section = sections.find(s => s.id === sectionId);
    const setting = section?.settings.find(s => s.key === key);
    if (setting?.validation) {
      const error = setting.validation(value);
      setErrors(prev => ({
        ...prev,
        [sectionId]: {
          ...prev[sectionId],
          [key]: error || ''
        }
      }));
    }

    if (onSettingChange) {
      onSettingChange(sectionId, key, value);
    }
  };

  const handleSave = async () => {
    if (!onSave || readonly) return;

    setIsSaving(true);
    try {
      await onSave(settings);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async (sectionId?: string) => {
    if (!onReset || readonly) return;

    const confirmed = window.confirm(
      sectionId 
        ? 'Reset all settings in this section to default values?'
        : 'Reset all settings to default values?'
    );
    
    if (!confirmed) return;

    try {
      await onReset(sectionId);
      setHasChanges(false);
      setErrors({});
    } catch (error) {
      console.error('Failed to reset settings:', error);
    }
  };

  const handleExport = async () => {
    if (!onExport) return;

    try {
      await onExport();
    } catch (error) {
      console.error('Failed to export settings:', error);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!onImport || !event.target.files?.[0]) return;

    const file = event.target.files[0];
    
    try {
      const text = await file.text();
      const importedSettings = JSON.parse(text);
      await onImport(importedSettings);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to import settings:', error);
      alert('Failed to import settings. Please check the file format.');
    }

    // Reset file input
    event.target.value = '';
  };

  const getFilteredSections = () => {
    if (!searchTerm) return sections;

    return sections.map(section => ({
      ...section,
      settings: section.settings.filter(setting =>
        setting.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        setting.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    })).filter(section => section.settings.length > 0);
  };

  const hasErrors = () => {
    return Object.values(errors).some(sectionErrors =>
      Object.values(sectionErrors).some(error => error)
    );
  };

  const filteredSections = getFilteredSections();
  const activeSettings = filteredSections.find(s => s.id === activeSection);

  return (
    <div className={`settings-panel ${className}`}>
      <div className="settings-panel__header">
        <h2>Settings</h2>
        
        <div className="settings-panel__search">
          <input
            type="text"
            placeholder="Search settings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="settings-panel__actions">
          {!readonly && (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => handleReset()}
                disabled={isSaving}
              >
                Reset All
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={isSaving || !hasChanges || hasErrors()}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          )}
          
          <div className="import-export-actions">
            <button className="btn btn-secondary" onClick={handleExport}>
              Export
            </button>
            <label className="btn btn-secondary">
              Import
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="settings-panel__content">
        <div className="settings-sidebar">
          {filteredSections.map(section => (
            <button
              key={section.id}
              className={`sidebar-item ${activeSection === section.id ? 'active' : ''}`}
              onClick={() => setActiveSection(section.id)}
            >
              {section.icon && <span className="sidebar-icon">{section.icon}</span>}
              <span className="sidebar-title">{section.title}</span>
              {section.settings.length > 0 && (
                <span className="sidebar-count">{section.settings.length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="settings-main">
          {activeSettings ? (
            <div className="settings-section">
              <div className="settings-section__header">
                <h3>{activeSettings.title}</h3>
                {!readonly && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleReset(activeSettings.id)}
                  >
                    Reset Section
                  </button>
                )}
              </div>

              <div className="settings-section__content">
                {activeSettings.settings.map(setting => (
                  <SettingControl
                    key={setting.key}
                    setting={setting}
                    value={settings[activeSettings.id]?.[setting.key]}
                    onChange={(value) => handleSettingChange(activeSettings.id, setting.key, value)}
                    error={errors[activeSettings.id]?.[setting.key]}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="settings-empty">
              <h3>No settings found</h3>
              <p>Try adjusting your search terms or select a different section.</p>
            </div>
          )}
        </div>
      </div>

      {hasChanges && !readonly && (
        <div className="settings-panel__footer">
          <div className="unsaved-changes-indicator">
            <span className="indicator-icon">●</span>
            <span>You have unsaved changes</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPanel;