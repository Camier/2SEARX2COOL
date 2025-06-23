/**
 * HardwareManager.ts - Hardware Integration with MIDI Support
 * 
 * Manages hardware devices and integrations:
 * - MIDI input/output devices
 * - System hardware monitoring
 * - Device detection and management
 * - Hardware-based shortcuts and controls
 * - Audio device management
 */

import { EventEmitter } from 'events';
import { configStore } from '../config/ConfigStore';

// MIDI interfaces (optional dependencies)
let easymidi: any;
let naudiodon: any;

// Try to import MIDI libraries
try {
  easymidi = require('easymidi');
} catch (error) {
  console.log('🎹 [HARDWARE-MANAGER] MIDI support not available (easymidi not installed)');
}

try {
  naudiodon = require('naudiodon');
} catch (error) {
  console.log('🔊 [HARDWARE-MANAGER] Audio device support not available (naudiodon not installed)');
}

interface MidiDevice {
  id: string;
  name: string;
  type: 'input' | 'output';
  connected: boolean;
  manufacturer?: string;
  version?: string;
}

interface MidiMapping {
  control: number;
  channel?: number;
  action: string;
  parameter?: string;
  value?: number;
}

interface AudioDevice {
  id: number;
  name: string;
  type: 'input' | 'output';
  channels: number;
  sampleRate: number;
  available: boolean;
}

interface HardwareStatus {
  midiEnabled: boolean;
  midiDevices: MidiDevice[];
  audioDevices: AudioDevice[];
  systemInfo: {
    platform: string;
    arch: string;
    cpuUsage: number;
    memoryUsage: number;
  };
}

export class HardwareManager extends EventEmitter {
  private midiEnabled: boolean = false;
  private midiDevices = new Map<string, any>();
  private midiMappings = new Map<string, MidiMapping>();
  private audioDevices: AudioDevice[] = [];
  private systemMonitor: NodeJS.Timeout | null = null;

  constructor() {
    super();
    
    this.midiEnabled = configStore.get('hardware', 'midi', 'enabled') || false;
    
    if (this.midiEnabled) {
      this.initializeMIDI();
    }
    
    this.initializeAudioDevices();
    this.loadMidiMappings();
    this.startSystemMonitoring();

    console.log('🎛️ [HARDWARE-MANAGER] Initialized');
  }

  /**
   * Initialize MIDI system
   */
  private async initializeMIDI(): Promise<void> {
    if (!easymidi) {
      console.warn('⚠️ [HARDWARE-MANAGER] MIDI initialization failed: easymidi not available');
      return;
    }

    try {
      // Get available MIDI devices
      const inputDevices = easymidi.getInputs();
      const outputDevices = easymidi.getOutputs();

      console.log(`🎹 [HARDWARE-MANAGER] Found ${inputDevices.length} MIDI input devices`);
      console.log(`🎹 [HARDWARE-MANAGER] Found ${outputDevices.length} MIDI output devices`);

      // Setup input devices
      inputDevices.forEach((deviceName: string, index: number) => {
        try {
          const device = new easymidi.Input(deviceName);
          const deviceId = `input_${index}`;
          
          this.midiDevices.set(deviceId, {
            device,
            info: {
              id: deviceId,
              name: deviceName,
              type: 'input',
              connected: true
            }
          });

          // Setup event listeners
          this.setupMidiInputListeners(deviceId, device);
          
          console.log(`✅ [HARDWARE-MANAGER] MIDI input connected: ${deviceName}`);
        } catch (error) {
          console.error(`❌ [HARDWARE-MANAGER] Failed to connect MIDI input ${deviceName}:`, error);
        }
      });

      // Setup output devices
      outputDevices.forEach((deviceName: string, index: number) => {
        try {
          const device = new easymidi.Output(deviceName);
          const deviceId = `output_${index}`;
          
          this.midiDevices.set(deviceId, {
            device,
            info: {
              id: deviceId,
              name: deviceName,
              type: 'output',
              connected: true
            }
          });
          
          console.log(`✅ [HARDWARE-MANAGER] MIDI output connected: ${deviceName}`);
        } catch (error) {
          console.error(`❌ [HARDWARE-MANAGER] Failed to connect MIDI output ${deviceName}:`, error);
        }
      });

      this.emit('midi-initialized', {
        inputCount: inputDevices.length,
        outputCount: outputDevices.length
      });

    } catch (error) {
      console.error('❌ [HARDWARE-MANAGER] MIDI initialization failed:', error);
    }
  }

  /**
   * Setup MIDI input event listeners
   */
  private setupMidiInputListeners(deviceId: string, device: any): void {
    // Control Change messages
    device.on('cc', (message: any) => {
      this.handleMidiControlChange(deviceId, message);
    });

    // Note messages
    device.on('noteon', (message: any) => {
      this.handleMidiNote(deviceId, 'noteon', message);
    });

    device.on('noteoff', (message: any) => {
      this.handleMidiNote(deviceId, 'noteoff', message);
    });

    // Pitch bend
    device.on('pitch', (message: any) => {
      this.handleMidiPitch(deviceId, message);
    });

    // Program change
    device.on('program', (message: any) => {
      this.handleMidiProgram(deviceId, message);
    });
  }

  /**
   * Handle MIDI control change messages
   */
  private handleMidiControlChange(deviceId: string, message: any): void {
    const { controller, value, channel } = message;
    const mappingKey = `${deviceId}_cc_${controller}_${channel || 0}`;
    const mapping = this.midiMappings.get(mappingKey);

    if (mapping) {
      this.executeMidiAction(mapping, value);
    }

    this.emit('midi-cc', { deviceId, controller, value, channel });
  }

  /**
   * Handle MIDI note messages
   */
  private handleMidiNote(deviceId: string, type: 'noteon' | 'noteoff', message: any): void {
    const { note, velocity, channel } = message;
    
    this.emit('midi-note', { deviceId, type, note, velocity, channel });
  }

  /**
   * Handle MIDI pitch bend messages
   */
  private handleMidiPitch(deviceId: string, message: any): void {
    const { value, channel } = message;
    
    this.emit('midi-pitch', { deviceId, value, channel });
  }

  /**
   * Handle MIDI program change messages
   */
  private handleMidiProgram(deviceId: string, message: any): void {
    const { number, channel } = message;
    
    this.emit('midi-program', { deviceId, number, channel });
  }

  /**
   * Execute MIDI action based on mapping
   */
  private executeMidiAction(mapping: MidiMapping, value: number): void {
    try {
      switch (mapping.action) {
        case 'search':
          this.emit('hardware-action', { action: 'search', value });
          break;
          
        case 'volume':
          this.emit('hardware-action', { action: 'volume', value: value / 127 });
          break;
          
        case 'next-result':
          if (value > 64) { // Only on button press (high value)
            this.emit('hardware-action', { action: 'next-result' });
          }
          break;
          
        case 'previous-result':
          if (value > 64) {
            this.emit('hardware-action', { action: 'previous-result' });
          }
          break;
          
        case 'toggle-play':
          if (value > 64) {
            this.emit('hardware-action', { action: 'toggle-play' });
          }
          break;
          
        case 'custom':
          this.emit('hardware-action', { 
            action: 'custom', 
            parameter: mapping.parameter,
            value 
          });
          break;
          
        default:
          console.warn(`⚠️ [HARDWARE-MANAGER] Unknown MIDI action: ${mapping.action}`);
      }
    } catch (error) {
      console.error('❌ [HARDWARE-MANAGER] MIDI action execution failed:', error);
    }
  }

  /**
   * Initialize audio devices
   */
  private initializeAudioDevices(): void {
    if (!naudiodon) {
      console.log('🔊 [HARDWARE-MANAGER] Audio device enumeration not available');
      return;
    }

    try {
      const devices = naudiodon.getDevices();
      
      this.audioDevices = devices.map((device: any, index: number) => ({
        id: index,
        name: device.name,
        type: device.maxInputChannels > 0 ? 'input' : 'output',
        channels: Math.max(device.maxInputChannels, device.maxOutputChannels),
        sampleRate: device.defaultSampleRate,
        available: true
      }));

      console.log(`🔊 [HARDWARE-MANAGER] Found ${this.audioDevices.length} audio devices`);
      
      this.emit('audio-devices-updated', this.audioDevices);
      
    } catch (error) {
      console.error('❌ [HARDWARE-MANAGER] Audio device initialization failed:', error);
    }
  }

  /**
   * Load MIDI mappings from configuration
   */
  private loadMidiMappings(): void {
    const mappings = configStore.get('hardware', 'midi', 'mappings') || [];
    
    mappings.forEach((mapping: any) => {
      const key = `${mapping.deviceId || 'default'}_cc_${mapping.control}_${mapping.channel || 0}`;
      this.midiMappings.set(key, mapping);
    });

    console.log(`🎛️ [HARDWARE-MANAGER] Loaded ${this.midiMappings.size} MIDI mappings`);
  }

  /**
   * Add MIDI mapping
   */
  addMidiMapping(deviceId: string, mapping: Omit<MidiMapping, 'deviceId'>): void {
    const key = `${deviceId}_cc_${mapping.control}_${mapping.channel || 0}`;
    const fullMapping = { ...mapping, deviceId };
    
    this.midiMappings.set(key, fullMapping);
    
    // Save to configuration
    const allMappings = Array.from(this.midiMappings.values());
    configStore.set('hardware', 'midi', 'mappings', allMappings);
    
    console.log(`✅ [HARDWARE-MANAGER] Added MIDI mapping: ${key}`);
    this.emit('midi-mapping-added', { deviceId, mapping: fullMapping });
  }

  /**
   * Remove MIDI mapping
   */
  removeMidiMapping(deviceId: string, control: number, channel = 0): void {
    const key = `${deviceId}_cc_${control}_${channel}`;
    
    if (this.midiMappings.delete(key)) {
      // Update configuration
      const allMappings = Array.from(this.midiMappings.values());
      configStore.set('hardware', 'midi', 'mappings', allMappings);
      
      console.log(`🗑️ [HARDWARE-MANAGER] Removed MIDI mapping: ${key}`);
      this.emit('midi-mapping-removed', { deviceId, control, channel });
    }
  }

  /**
   * Start system monitoring
   */
  private startSystemMonitoring(): void {
    this.systemMonitor = setInterval(() => {
      this.updateSystemInfo();
    }, 5000); // Update every 5 seconds
  }

  /**
   * Update system information
   */
  private updateSystemInfo(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const systemInfo = {
      platform: process.platform,
      arch: process.arch,
      cpuUsage: cpuUsage.user + cpuUsage.system,
      memoryUsage: memUsage.heapUsed / 1024 / 1024 // MB
    };

    this.emit('system-info-updated', systemInfo);
  }

  /**
   * Get connected MIDI devices
   */
  getMidiDevices(): MidiDevice[] {
    return Array.from(this.midiDevices.values()).map(device => device.info);
  }

  /**
   * Get audio devices
   */
  getAudioDevices(): AudioDevice[] {
    return [...this.audioDevices];
  }

  /**
   * Get hardware status
   */
  getHardwareStatus(): HardwareStatus {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      midiEnabled: this.midiEnabled,
      midiDevices: this.getMidiDevices(),
      audioDevices: this.getAudioDevices(),
      systemInfo: {
        platform: process.platform,
        arch: process.arch,
        cpuUsage: cpuUsage.user + cpuUsage.system,
        memoryUsage: memUsage.heapUsed / 1024 / 1024
      }
    };
  }

  /**
   * Send MIDI message to output device
   */
  sendMidiMessage(deviceId: string, type: string, message: any): boolean {
    const deviceWrapper = this.midiDevices.get(deviceId);
    
    if (!deviceWrapper || deviceWrapper.info.type !== 'output') {
      console.error(`❌ [HARDWARE-MANAGER] MIDI output device not found: ${deviceId}`);
      return false;
    }

    try {
      const device = deviceWrapper.device;
      
      switch (type) {
        case 'cc':
          device.send('cc', message);
          break;
        case 'noteon':
          device.send('noteon', message);
          break;
        case 'noteoff':
          device.send('noteoff', message);
          break;
        default:
          console.warn(`⚠️ [HARDWARE-MANAGER] Unknown MIDI message type: ${type}`);
          return false;
      }
      
      return true;
    } catch (error) {
      console.error('❌ [HARDWARE-MANAGER] MIDI send failed:', error);
      return false;
    }
  }

  /**
   * Enable/disable MIDI
   */
  setMidiEnabled(enabled: boolean): void {
    this.midiEnabled = enabled;
    configStore.set('hardware', 'midi', 'enabled', enabled);
    
    if (enabled && this.midiDevices.size === 0) {
      this.initializeMIDI();
    } else if (!enabled) {
      this.disconnectAllMidiDevices();
    }
    
    this.emit('midi-enabled-changed', enabled);
  }

  /**
   * Disconnect all MIDI devices
   */
  private disconnectAllMidiDevices(): void {
    this.midiDevices.forEach((deviceWrapper, deviceId) => {
      try {
        if (deviceWrapper.device && typeof deviceWrapper.device.close === 'function') {
          deviceWrapper.device.close();
        }
      } catch (error) {
        console.error(`❌ [HARDWARE-MANAGER] Failed to close MIDI device ${deviceId}:`, error);
      }
    });
    
    this.midiDevices.clear();
    console.log('🔌 [HARDWARE-MANAGER] All MIDI devices disconnected');
  }

  /**
   * Refresh device lists
   */
  async refreshDevices(): Promise<void> {
    console.log('🔄 [HARDWARE-MANAGER] Refreshing device lists...');
    
    if (this.midiEnabled) {
      this.disconnectAllMidiDevices();
      await this.initializeMIDI();
    }
    
    this.initializeAudioDevices();
    
    this.emit('devices-refreshed');
  }

  /**
   * Get MIDI mappings
   */
  getMidiMappings(): MidiMapping[] {
    return Array.from(this.midiMappings.values());
  }

  /**
   * Test MIDI connection
   */
  testMidiConnection(deviceId: string): boolean {
    const deviceWrapper = this.midiDevices.get(deviceId);
    return deviceWrapper ? deviceWrapper.info.connected : false;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.systemMonitor) {
      clearInterval(this.systemMonitor);
      this.systemMonitor = null;
    }
    
    this.disconnectAllMidiDevices();
    this.removeAllListeners();
    
    console.log('🧹 [HARDWARE-MANAGER] Cleanup completed');
  }
}

// Create singleton instance
export const hardwareManager = new HardwareManager();

// Export types
export type { MidiDevice, MidiMapping, AudioDevice, HardwareStatus };