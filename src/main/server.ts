import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { app } from 'electron'
import * as fs from 'fs'

export interface ServerStatus {
  running: boolean
  url?: string
  error?: string
  mode: 'bundled' | 'external' | 'hybrid'
}

export class SearXNGServer {
  private process: ChildProcess | null = null
  private status: ServerStatus = {
    running: false,
    mode: (process.env.DEPLOYMENT_MODE as any) || 'hybrid'
  }

  constructor() {
    // Check if external server is configured
    if (process.env.SEARXNG_URL && process.env.DEPLOYMENT_MODE !== 'bundled') {
      this.status.url = process.env.SEARXNG_URL
      this.status.mode = 'external'
    }
  }

  async start(): Promise<void> {
    if (this.status.mode === 'external') {
      this.status.running = true
      return
    }

    if (this.process) {
      console.warn('Server is already running')
      return
    }

    try {
      const pythonPath = this.getPythonPath()
      const serverPath = this.getServerPath()

      if (!fs.existsSync(serverPath)) {
        throw new Error(`Server not found at ${serverPath}`)
      }

      this.process = spawn(pythonPath, [serverPath], {
        cwd: join(serverPath, '..'),
        env: {
          ...process.env,
          FLASK_APP: 'app.py',
          FLASK_ENV: 'production'
        }
      })

      this.process.stdout?.on('data', (data) => {
        console.log(`Server: ${data}`)
      })

      this.process.stderr?.on('data', (data) => {
        console.error(`Server Error: ${data}`)
      })

      this.process.on('exit', (code) => {
        console.log(`Server exited with code ${code}`)
        this.process = null
        this.status.running = false
      })

      // Wait for server to start
      await this.waitForServer()
      
      this.status.running = true
      this.status.url = 'http://localhost:5000'
    } catch (error) {
      this.status.error = error.message
      throw error
    }
  }

  stop(): void {
    if (this.process) {
      this.process.kill()
      this.process = null
      this.status.running = false
    }
  }

  getStatus(): ServerStatus {
    return { ...this.status }
  }

  private getPythonPath(): string {
    // In production, use bundled Python
    if (app.isPackaged) {
      return join(process.resourcesPath, 'python', 'python')
    }
    // In development, use system Python
    return 'python3'
  }

  private getServerPath(): string {
    if (app.isPackaged) {
      return join(process.resourcesPath, 'server', 'app.py')
    }
    // In development, assume server is in a sibling directory
    return join(__dirname, '../../../searxng-cool/orchestrator/app.py')
  }

  private async waitForServer(maxAttempts = 30): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch('http://localhost:5000/health')
        if (response.ok) return
      } catch (e) {
        // Server not ready yet
      }
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    throw new Error('Server failed to start')
  }
}