export type Server = { port: number; name: string }

declare module 'claude-code' {
  interface PluginState {
    'dev-tab': {
      // Listening ports of this worktree whose `/` answers HTML, with the tool's name
      servers: Server[]
      // 'default' or a lowercase bundle id from BROWSERS
      browser: string
      installed: string[]
      defaultId: string
    }
  }
}
