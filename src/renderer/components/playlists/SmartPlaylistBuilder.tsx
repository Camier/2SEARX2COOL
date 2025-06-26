import React, { useState, useCallback } from 'react';
import './SmartPlaylistBuilder.css';

interface SmartPlaylistRule {
  id: string;
  field: string;
  operator: string;
  value: string;
  logicalOperator?: 'AND' | 'OR';
}

interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  rules: Omit<SmartPlaylistRule, 'id'>[];
  icon: string;
}

interface SmartPlaylistBuilderProps {
  rules: SmartPlaylistRule[];
  onChange: (rules: SmartPlaylistRule[]) => void;
  onPreview?: (rules: SmartPlaylistRule[]) => void;
  className?: string;
}

const FIELD_OPTIONS = [
  { value: 'title', label: 'Title', type: 'text' },
  { value: 'artist', label: 'Artist', type: 'text' },
  { value: 'album', label: 'Album', type: 'text' },
  { value: 'genre', label: 'Genre', type: 'text' },
  { value: 'year', label: 'Year', type: 'number' },
  { value: 'duration', label: 'Duration (seconds)', type: 'number' },
  { value: 'rating', label: 'Rating', type: 'number' },
  { value: 'playCount', label: 'Play Count', type: 'number' },
  { value: 'dateAdded', label: 'Date Added', type: 'date' },
  { value: 'lastPlayed', label: 'Last Played', type: 'date' },
  { value: 'fileSize', label: 'File Size (MB)', type: 'number' },
  { value: 'bitrate', label: 'Bitrate (kbps)', type: 'number' },
  { value: 'format', label: 'File Format', type: 'text' },
  { value: 'source', label: 'Source', type: 'text' }
];

const TEXT_OPERATORS = [
  { value: 'contains', label: 'Contains' },
  { value: 'equals', label: 'Equals' },
  { value: 'startsWith', label: 'Starts with' },
  { value: 'endsWith', label: 'Ends with' },
  { value: 'notContains', label: 'Does not contain' },
  { value: 'notEquals', label: 'Does not equal' },
  { value: 'isEmpty', label: 'Is empty' },
  { value: 'isNotEmpty', label: 'Is not empty' }
];

const NUMBER_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'notEquals', label: 'Does not equal' },
  { value: 'greaterThan', label: 'Greater than' },
  { value: 'lessThan', label: 'Less than' },
  { value: 'greaterEqual', label: 'Greater or equal' },
  { value: 'lessEqual', label: 'Less or equal' },
  { value: 'between', label: 'Between' },
  { value: 'notBetween', label: 'Not between' }
];

const DATE_OPERATORS = [
  { value: 'equals', label: 'On date' },
  { value: 'before', label: 'Before' },
  { value: 'after', label: 'After' },
  { value: 'between', label: 'Between' },
  { value: 'lastDays', label: 'Last X days' },
  { value: 'lastWeeks', label: 'Last X weeks' },
  { value: 'lastMonths', label: 'Last X months' }
];

const RULE_TEMPLATES: RuleTemplate[] = [
  {
    id: 'recently-added',
    name: 'Recently Added',
    description: 'Tracks added in the last 30 days',
    icon: '🆕',
    rules: [
      { field: 'dateAdded', operator: 'lastDays', value: '30' }
    ]
  },
  {
    id: 'highly-rated',
    name: 'Highly Rated',
    description: 'Tracks with 4+ star rating',
    icon: '⭐',
    rules: [
      { field: 'rating', operator: 'greaterEqual', value: '4' }
    ]
  },
  {
    id: 'frequently-played',
    name: 'Frequently Played',
    description: 'Tracks played more than 10 times',
    icon: '🔥',
    rules: [
      { field: 'playCount', operator: 'greaterThan', value: '10' }
    ]
  },
  {
    id: 'long-tracks',
    name: 'Long Tracks',
    description: 'Tracks longer than 6 minutes',
    icon: '⏰',
    rules: [
      { field: 'duration', operator: 'greaterThan', value: '360' }
    ]
  },
  {
    id: 'high-quality',
    name: 'High Quality',
    description: 'High bitrate lossless tracks',
    icon: '💎',
    rules: [
      { field: 'bitrate', operator: 'greaterEqual', value: '320' },
      { field: 'format', operator: 'contains', value: 'flac', logicalOperator: 'OR' }
    ]
  },
  {
    id: 'rock-classics',
    name: 'Rock Classics',
    description: 'Rock tracks from the 70s-90s',
    icon: '🎸',
    rules: [
      { field: 'genre', operator: 'contains', value: 'rock' },
      { field: 'year', operator: 'between', value: '1970-1999', logicalOperator: 'AND' }
    ]
  }
];

export const SmartPlaylistBuilder: React.FC<SmartPlaylistBuilderProps> = ({
  rules,
  onChange,
  onPreview,
  className = ''
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [showTemplates, setShowTemplates] = useState(false);

  // Get field type for operator selection
  const getFieldType = (field: string): string => {
    const fieldOption = FIELD_OPTIONS.find(option => option.value === field);
    return fieldOption?.type || 'text';
  };

  // Get operators for field type
  const getOperatorsForField = (field: string) => {
    const fieldType = getFieldType(field);
    switch (fieldType) {
      case 'number':
        return NUMBER_OPERATORS;
      case 'date':
        return DATE_OPERATORS;
      default:
        return TEXT_OPERATORS;
    }
  };

  // Add new rule
  const addRule = useCallback(() => {
    const newRule: SmartPlaylistRule = {
      id: Date.now().toString(),
      field: 'title',
      operator: 'contains',
      value: '',
      logicalOperator: rules.length > 0 ? 'AND' : undefined
    };

    onChange([...rules, newRule]);
  }, [rules, onChange]);

  // Update rule
  const updateRule = useCallback((ruleId: string, updates: Partial<SmartPlaylistRule>) => {
    const updatedRules = rules.map(rule => {
      if (rule.id === ruleId) {
        const updatedRule = { ...rule, ...updates };
        
        // Reset operator if field type changed
        if (updates.field && updates.field !== rule.field) {
          const operators = getOperatorsForField(updates.field);
          updatedRule.operator = operators[0]?.value || 'contains';
          updatedRule.value = '';
        }
        
        return updatedRule;
      }
      return rule;
    });

    onChange(updatedRules);
  }, [rules, onChange]);

  // Remove rule
  const removeRule = useCallback((ruleId: string) => {
    const filteredRules = rules.filter(rule => rule.id !== ruleId);
    
    // Remove logical operator from first rule if it exists
    if (filteredRules.length > 0 && filteredRules[0].logicalOperator) {
      filteredRules[0] = { ...filteredRules[0], logicalOperator: undefined };
    }

    onChange(filteredRules);
  }, [rules, onChange]);

  // Apply template
  const applyTemplate = useCallback((template: RuleTemplate) => {
    const templateRules: SmartPlaylistRule[] = template.rules.map((rule, index) => ({
      ...rule,
      id: `${Date.now()}-${index}`,
      logicalOperator: index > 0 ? (rule.logicalOperator || 'AND') : undefined
    }));

    onChange(templateRules);
    setSelectedTemplate(template.id);
    setShowTemplates(false);
  }, [onChange]);

  // Clear all rules
  const clearRules = useCallback(() => {
    onChange([]);
    setSelectedTemplate('');
  }, [onChange]);

  // Handle preview
  const handlePreview = useCallback(() => {
    onPreview?.(rules);
  }, [rules, onPreview]);

  // Render rule input based on field type and operator
  const renderRuleInput = (rule: SmartPlaylistRule) => {
    const fieldType = getFieldType(rule.field);
    const operator = rule.operator;

    if (operator === 'isEmpty' || operator === 'isNotEmpty') {
      return null; // No input needed for these operators
    }

    switch (fieldType) {
      case 'number':
        if (operator === 'between' || operator === 'notBetween') {
          const [min, max] = rule.value.split('-');
          return (
            <div className="range-input">
              <input
                type="number"
                value={min || ''}
                onChange={(e) => {
                  const newValue = `${e.target.value}-${max || ''}`;
                  updateRule(rule.id, { value: newValue });
                }}
                className="range-min"
                placeholder="Min"
              />
              <span className="range-separator">to</span>
              <input
                type="number"
                value={max || ''}
                onChange={(e) => {
                  const newValue = `${min || ''}-${e.target.value}`;
                  updateRule(rule.id, { value: newValue });
                }}
                className="range-max"
                placeholder="Max"
              />
            </div>
          );
        }
        return (
          <input
            type="number"
            value={rule.value}
            onChange={(e) => updateRule(rule.id, { value: e.target.value })}
            className="rule-input"
            placeholder="Enter number..."
          />
        );

      case 'date':
        if (operator === 'between') {
          const [start, end] = rule.value.split('-');
          return (
            <div className="range-input">
              <input
                type="date"
                value={start || ''}
                onChange={(e) => {
                  const newValue = `${e.target.value}-${end || ''}`;
                  updateRule(rule.id, { value: newValue });
                }}
                className="range-min"
              />
              <span className="range-separator">to</span>
              <input
                type="date"
                value={end || ''}
                onChange={(e) => {
                  const newValue = `${start || ''}-${e.target.value}`;
                  updateRule(rule.id, { value: newValue });
                }}
                className="range-max"
              />
            </div>
          );
        }
        if (operator.startsWith('last')) {
          return (
            <input
              type="number"
              value={rule.value}
              onChange={(e) => updateRule(rule.id, { value: e.target.value })}
              className="rule-input"
              placeholder="Enter number..."
              min="1"
            />
          );
        }
        return (
          <input
            type="date"
            value={rule.value}
            onChange={(e) => updateRule(rule.id, { value: e.target.value })}
            className="rule-input"
          />
        );

      default:
        return (
          <input
            type="text"
            value={rule.value}
            onChange={(e) => updateRule(rule.id, { value: e.target.value })}
            className="rule-input"
            placeholder="Enter text..."
          />
        );
    }
  };

  return (
    <div className={`smart-playlist-builder ${className}`}>
      {/* Header */}
      <div className="builder-header">
        <div className="header-left">
          <h3>Smart Playlist Rules</h3>
          <span className="rule-count">{rules.length} rule{rules.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="header-actions">
          <button
            className="template-button"
            onClick={() => setShowTemplates(!showTemplates)}
          >
            📋 Templates
          </button>
          
          {rules.length > 0 && onPreview && (
            <button
              className="preview-button"
              onClick={handlePreview}
            >
              👁️ Preview
            </button>
          )}

          <button
            className="add-rule-button primary"
            onClick={addRule}
          >
            ➕ Add Rule
          </button>
        </div>
      </div>

      {/* Templates panel */}
      {showTemplates && (
        <div className="templates-panel">
          <div className="templates-header">
            <h4>Rule Templates</h4>
            <button
              className="close-templates"
              onClick={() => setShowTemplates(false)}
            >
              ×
            </button>
          </div>

          <div className="templates-grid">
            {RULE_TEMPLATES.map(template => (
              <div
                key={template.id}
                className={`template-card ${selectedTemplate === template.id ? 'selected' : ''}`}
                onClick={() => applyTemplate(template)}
              >
                <div className="template-icon">{template.icon}</div>
                <div className="template-info">
                  <div className="template-name">{template.name}</div>
                  <div className="template-description">{template.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rules list */}
      <div className="rules-container">
        {rules.length === 0 ? (
          <div className="empty-rules">
            <div className="empty-icon">🧠</div>
            <h4>No rules defined</h4>
            <p>Add rules to automatically populate this smart playlist</p>
            <button
              className="add-rule-button primary"
              onClick={addRule}
            >
              Add Your First Rule
            </button>
          </div>
        ) : (
          <div className="rules-list">
            {rules.map((rule, index) => (
              <div key={rule.id} className="rule-item">
                {/* Logical operator */}
                {index > 0 && (
                  <div className="logical-operator">
                    <select
                      value={rule.logicalOperator || 'AND'}
                      onChange={(e) => updateRule(rule.id, { 
                        logicalOperator: e.target.value as 'AND' | 'OR' 
                      })}
                      className="logical-select"
                    >
                      <option value="AND">AND</option>
                      <option value="OR">OR</option>
                    </select>
                  </div>
                )}

                {/* Rule definition */}
                <div className="rule-definition">
                  <div className="rule-controls">
                    {/* Field selector */}
                    <select
                      value={rule.field}
                      onChange={(e) => updateRule(rule.id, { field: e.target.value })}
                      className="field-select"
                    >
                      {FIELD_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>

                    {/* Operator selector */}
                    <select
                      value={rule.operator}
                      onChange={(e) => updateRule(rule.id, { operator: e.target.value })}
                      className="operator-select"
                    >
                      {getOperatorsForField(rule.field).map(operator => (
                        <option key={operator.value} value={operator.value}>
                          {operator.label}
                        </option>
                      ))}
                    </select>

                    {/* Value input */}
                    <div className="value-container">
                      {renderRuleInput(rule)}
                    </div>

                    {/* Remove button */}
                    <button
                      className="remove-rule-button"
                      onClick={() => removeRule(rule.id)}
                      title="Remove rule"
                    >
                      ×
                    </button>
                  </div>

                  {/* Rule preview text */}
                  <div className="rule-preview">
                    {index > 0 && (
                      <span className="preview-operator">
                        {rule.logicalOperator} 
                      </span>
                    )}
                    <span className="preview-text">
                      {FIELD_OPTIONS.find(f => f.value === rule.field)?.label}{' '}
                      {getOperatorsForField(rule.field).find(o => o.value === rule.operator)?.label.toLowerCase()}{' '}
                      {rule.value && !['isEmpty', 'isNotEmpty'].includes(rule.operator) && (
                        <strong>"{rule.value}"</strong>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer actions */}
      {rules.length > 0 && (
        <div className="builder-footer">
          <div className="footer-info">
            <span>Tracks matching {rules.length > 1 ? 'all' : 'the'} rule{rules.length !== 1 ? 's' : ''} above will be included</span>
          </div>
          
          <div className="footer-actions">
            <button
              className="clear-button"
              onClick={clearRules}
            >
              Clear All
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartPlaylistBuilder;