import React, { useState, useEffect, useCallback } from 'react';

interface MIDIDevice {
  id: string;
  name: string;
  manufacturer: string;
  type: 'input' | 'output';
  state: 'connected' | 'disconnected';
}

interface AudioDevice {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
  groupId: string;
}

interface HardwareControlsProps {
  onMIDIMessage?: (message: any) => void;
  onAudioDeviceChange?: (device: AudioDevice) => void;
  className?: string;
}

interface ControlState {
  midiEnabled: boolean;
  audioEnabled: boolean;
  selectedAudioInput?: string;
  selectedAudioOutput?: string;
  volume: number;
  muted: boolean;
}

export const HardwareControls: React.FC<HardwareControlsProps> = ({
  onMIDIMessage,
  onAudioDeviceChange,
  className = ''
}) => {
  const [midiDevices, setMidiDevices] = useState<MIDIDevice[]>([]);
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [controlState, setControlState] = useState<ControlState>({
    midiEnabled: false,
    audioEnabled: false,
    volume: 0.8,
    muted: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // MIDI Access
  const initializeMIDI = async () => {
    try {
      if (!navigator.requestMIDIAccess) {
        throw new Error('Web MIDI API not supported');
      }

      const midiAccess = await navigator.requestMIDIAccess();
      
      const updateDevices = () => {
        const devices: MIDIDevice[] = [];
        
        midiAccess.inputs.forEach((input) => {
          devices.push({
            id: input.id || '',
            name: input.name || 'Unknown Input',
            manufacturer: input.manufacturer || 'Unknown',
            type: 'input',
            state: input.state || 'disconnected'
          });
        });

        midiAccess.outputs.forEach((output) => {
          devices.push({
            id: output.id || '',
            name: output.name || 'Unknown Output',
            manufacturer: output.manufacturer || 'Unknown',
            type: 'output',
            state: output.state || 'disconnected'
          });
        });

        setMidiDevices(devices);
      };

      // Set up MIDI message handling
      midiAccess.inputs.forEach((input) => {
        input.onmidimessage = (message) => {
          if (onMIDIMessage) {
            onMIDIMessage({
              data: Array.from(message.data),
              timestamp: message.timeStamp,
              deviceId: input.id,
              deviceName: input.name
            });
          }
        };
      });

      midiAccess.onstatechange = updateDevices;
      updateDevices();

      setControlState(prev => ({ ...prev, midiEnabled: true }));
      setError(null);

    } catch (err) {
      console.error('MIDI initialization failed:', err);
      setError(err instanceof Error ? err.message : 'MIDI initialization failed');
    }
  };

  // Audio Device Management
  const initializeAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Stop the stream, we just needed permission

      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDeviceList: AudioDevice[] = devices
        .filter(device => device.kind === 'audioinput' || device.kind === 'audiooutput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `${device.kind} ${device.deviceId.slice(0, 8)}`,
          kind: device.kind as 'audioinput' | 'audiooutput',
          groupId: device.groupId
        }));

      setAudioDevices(audioDeviceList);
      setControlState(prev => ({ ...prev, audioEnabled: true }));
      setError(null);

    } catch (err) {
      console.error('Audio initialization failed:', err);
      setError(err instanceof Error ? err.message : 'Audio initialization failed');
    }
  };

  const handleMIDIToggle = async () => {
    if (!controlState.midiEnabled) {
      setIsLoading(true);
      await initializeMIDI();
      setIsLoading(false);
    } else {
      setControlState(prev => ({ ...prev, midiEnabled: false }));
      setMidiDevices([]);
    }
  };

  const handleAudioToggle = async () => {
    if (!controlState.audioEnabled) {
      setIsLoading(true);
      await initializeAudio();
      setIsLoading(false);
    } else {
      setControlState(prev => ({ ...prev, audioEnabled: false }));
      setAudioDevices([]);
    }
  };

  const handleVolumeChange = (volume: number) => {
    setControlState(prev => ({ ...prev, volume, muted: volume === 0 }));
  };

  const handleMuteToggle = () => {
    setControlState(prev => ({ 
      ...prev, 
      muted: !prev.muted,
      volume: prev.muted ? 0.8 : 0
    }));
  };

  const handleAudioDeviceSelect = (deviceId: string, kind: 'audioinput' | 'audiooutput') => {
    const device = audioDevices.find(d => d.deviceId === deviceId);
    if (!device) return;

    if (kind === 'audioinput') {
      setControlState(prev => ({ ...prev, selectedAudioInput: deviceId }));
    } else {
      setControlState(prev => ({ ...prev, selectedAudioOutput: deviceId }));
    }

    if (onAudioDeviceChange) {
      onAudioDeviceChange(device);
    }
  };

  // Listen for device changes
  useEffect(() => {
    const handleDeviceChange = () => {
      if (controlState.audioEnabled) {
        initializeAudio();
      }
    };

    navigator.mediaDevices?.addEventListener('devicechange', handleDeviceChange);
    
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [controlState.audioEnabled]);

  return (
    <div className={`hardware-controls ${className}`}>
      <div className="hardware-controls__header">
        <h3>Hardware Controls</h3>
        {error && (
          <div className="error-message">
            <span className="error-icon">⚠</span>
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* MIDI Controls */}
      <div className="control-section">
        <div className="control-section__header">
          <h4>MIDI</h4>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={controlState.midiEnabled}
              onChange={handleMIDIToggle}
              disabled={isLoading}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        {controlState.midiEnabled && (
          <div className="device-list">
            {midiDevices.length === 0 ? (
              <p className="no-devices">No MIDI devices detected</p>
            ) : (
              midiDevices.map(device => (
                <div key={device.id} className="device-item">
                  <div className="device-info">
                    <span className="device-name">{device.name}</span>
                    <span className="device-manufacturer">{device.manufacturer}</span>
                  </div>
                  <span className={`device-status ${device.state}`}>
                    {device.state}
                  </span>
                  <span className={`device-type ${device.type}`}>
                    {device.type}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Audio Controls */}
      <div className="control-section">
        <div className="control-section__header">
          <h4>Audio</h4>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={controlState.audioEnabled}
              onChange={handleAudioToggle}
              disabled={isLoading}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        {controlState.audioEnabled && (
          <div className="audio-controls">
            {/* Volume Control */}
            <div className="volume-control">
              <label className="control-label">Volume</label>
              <div className="volume-slider-container">
                <button
                  className={`mute-button ${controlState.muted ? 'muted' : ''}`}
                  onClick={handleMuteToggle}
                >
                  {controlState.muted ? '🔇' : '🔊'}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={controlState.volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="volume-slider"
                />
                <span className="volume-value">
                  {Math.round(controlState.volume * 100)}%
                </span>
              </div>
            </div>

            {/* Audio Input Devices */}
            <div className="device-selector">
              <label className="control-label">Audio Input</label>
              <select
                value={controlState.selectedAudioInput || ''}
                onChange={(e) => handleAudioDeviceSelect(e.target.value, 'audioinput')}
                className="device-select"
              >
                <option value="">Select input device...</option>
                {audioDevices
                  .filter(device => device.kind === 'audioinput')
                  .map(device => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </option>
                  ))}
              </select>
            </div>

            {/* Audio Output Devices */}
            <div className="device-selector">
              <label className="control-label">Audio Output</label>
              <select
                value={controlState.selectedAudioOutput || ''}
                onChange={(e) => handleAudioDeviceSelect(e.target.value, 'audiooutput')}
                className="device-select"
              >
                <option value="">Select output device...</option>
                {audioDevices
                  .filter(device => device.kind === 'audiooutput')
                  .map(device => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="loading-indicator">
          <span>Initializing hardware...</span>
        </div>
      )}
    </div>
  );
};

export default HardwareControls;