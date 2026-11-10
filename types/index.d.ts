declare module 'claude-code' {
  interface PluginState {
    'dev-tab': {
      ports: number[]
      // 'default' or a lowercase bundle id from BROWSERS
      browser: string
      installed: string[]
      defaultId: string
    }
  }
}

export type Port = number
