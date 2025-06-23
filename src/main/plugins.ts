import { ipcMain } from 'electron'
import { join } from 'path'
import * as fs from 'fs/promises'
import { Plugin } from '../shared/types'

class PluginManager {
  private plugins: Map<string, Plugin> = new Map()
  private pluginInstances: Map<string, any> = new Map()

  async loadPlugins(): Promise<void> {
    const pluginsDir = join(__dirname, '../../plugins')
    
    try {
      const entries = await fs.readdir(pluginsDir, { withFileTypes: true })
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          await this.loadPlugin(join(pluginsDir, entry.name))
        }
      }
    } catch (error) {
      console.error('Failed to load plugins:', error)
    }
  }

  private async loadPlugin(pluginPath: string): Promise<void> {
    try {
      const packageJson = JSON.parse(
        await fs.readFile(join(pluginPath, 'package.json'), 'utf-8')
      )

      const plugin: Plugin = {
        id: packageJson.name,
        name: packageJson['2searx2cool']?.displayName || packageJson.name,
        description: packageJson.description,
        version: packageJson.version,
        enabled: false
      }

      this.plugins.set(plugin.id, plugin)

      // Load plugin if enabled in settings
      if (this.isPluginEnabled(plugin.id)) {
        await this.enablePlugin(plugin.id)
      }
    } catch (error) {
      console.error(`Failed to load plugin from ${pluginPath}:`, error)
    }
  }

  async enablePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) throw new Error(`Plugin ${pluginId} not found`)

    try {
      const PluginClass = require(join(__dirname, '../../plugins', pluginId))
      const instance = new PluginClass.default()
      
      if (instance.activate) {
        await instance.activate(this.createPluginContext(pluginId))
      }
      
      this.pluginInstances.set(pluginId, instance)
      plugin.enabled = true
    } catch (error) {
      console.error(`Failed to enable plugin ${pluginId}:`, error)
      throw error
    }
  }

  async disablePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) throw new Error(`Plugin ${pluginId} not found`)

    const instance = this.pluginInstances.get(pluginId)
    if (instance && instance.deactivate) {
      await instance.deactivate()
    }

    this.pluginInstances.delete(pluginId)
    plugin.enabled = false
  }

  private createPluginContext(pluginId: string): any {
    return {
      pluginId,
      // Add plugin API methods here
    }
  }

  private isPluginEnabled(pluginId: string): boolean {
    // TODO: Load from user settings
    return false
  }

  getPlugins(): Plugin[] {
    return Array.from(this.plugins.values())
  }
}

const pluginManager = new PluginManager()

export async function initializePlugins(): Promise<void> {
  await pluginManager.loadPlugins()

  // Setup IPC handlers
  ipcMain.handle('list-plugins', () => pluginManager.getPlugins())
  ipcMain.handle('enable-plugin', (_, pluginId: string) => pluginManager.enablePlugin(pluginId))
  ipcMain.handle('disable-plugin', (_, pluginId: string) => pluginManager.disablePlugin(pluginId))
}