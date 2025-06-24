import { useState, useEffect, useCallback } from 'react';
import { MidiDevice, AudioDevice, MidiMessage } from '../../shared/types';

interface UseHardwareReturn {
  midiDevices: MidiDevice[];
  audioDevices: AudioDevice[];
  connectedMidiDevice: string | null;
  isLoading: boolean;
  error: string | null;
  refreshDevices: () => Promise<void>;
  connectMidiDevice: (deviceId: string) => Promise<void>;
  onMidiMessage: (callback: (message: MidiMessage) => void) => void;
  analyzeAudio: () => Promise<any>;
}

export function useHardware(): UseHardwareReturn {
  const [midiDevices, setMidiDevices] = useState<MidiDevice[]>([]);
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [connectedMidiDevice, setConnectedMidiDevice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshDevices = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [midiDevicesResult, audioDevicesResult] = await Promise.all([
        window.api.hardware.midi.getDevices(),
        window.api.hardware.audio.getDevices()
      ]);

      setMidiDevices(midiDevicesResult);
      setAudioDevices(audioDevicesResult);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh hardware devices';
      setError(errorMessage);
      console.error('Error refreshing hardware devices:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const connectMidiDevice = useCallback(async (deviceId: string) => {
    try {
      setError(null);
      await window.api.hardware.midi.connect(deviceId);
      setConnectedMidiDevice(deviceId);
      
      // Update the device status in the list
      setMidiDevices(prevDevices => 
        prevDevices.map(device => ({
          ...device,
          connected: device.id === deviceId
        }))
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect MIDI device';
      setError(errorMessage);
      console.error('Error connecting MIDI device:', err);
    }
  }, []);

  const onMidiMessage = useCallback((callback: (message: MidiMessage) => void) => {
    window.api.hardware.midi.onMessage(callback);
  }, []);

  const analyzeAudio = useCallback(async () => {
    try {
      setError(null);
      const analysisResult = await window.api.hardware.audio.analyze();
      return analysisResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to analyze audio';
      setError(errorMessage);
      console.error('Error analyzing audio:', err);
      throw err;
    }
  }, []);

  useEffect(() => {
    // Initial device refresh
    refreshDevices();

    // Set up periodic refresh for device status
    const intervalId = setInterval(() => {
      refreshDevices();
    }, 10000); // Refresh every 10 seconds

    // Cleanup function
    return () => {
      clearInterval(intervalId);
      // Clean up any MIDI message listeners
      window.api.ipc.removeAllListeners('midi:message');
    };
  }, [refreshDevices]);

  return {
    midiDevices,
    audioDevices,
    connectedMidiDevice,
    isLoading,
    error,
    refreshDevices,
    connectMidiDevice,
    onMidiMessage,
    analyzeAudio
  };
}