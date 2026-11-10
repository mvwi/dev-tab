import { atom, read, update } from 'claude-code'
import type { Engine, Register } from 'claude-code'

type Kind = 'chromium' | 'safari' | 'arc' | 'other'

// Keys are bundle ids, lowercased as LaunchServices stores them.
// Chrome, Brave, Edge and Vivaldi share Chrome's AppleScript terms.
const BROWSERS: Record<string, { app: string; kind: Kind }> = {
  'com.google.chrome': { app: 'Google Chrome', kind: 'chromium' },
  'com.brave.browser': { app: 'Brave Browser', kind: 'chromium' },
  'com.microsoft.edgemac': { app: 'Microsoft Edge', kind: 'chromium' },
  'com.vivaldi.vivaldi': { app: 'Vivaldi', kind: 'chromium' },
  'company.thebrowser.browser': { app: 'Arc', kind: 'arc' },
  'com.apple.safari': { app: 'Safari', kind: 'safari' },
  'org.mozilla.firefox': { app: 'Firefox', kind: 'other' },
}

const ports = atom({ plugin: 'dev-tab', key: 'ports' } as const, [] as number[])
const browser = atom({ plugin: 'dev-tab', key: 'browser' } as const, 'default')
const installed = atom({ plugin: 'dev-tab', key: 'installed' } as const, [] as string[])
const defaultId = atom({ plugin: 'dev-tab', key: 'defaultId' } as const, '')

// Ports whose listening process has its cwd in `root` and not in a worktree nested under it.
export function ownedPorts(listenOut: string, cwdOut: string, worktrees: string[], root: string): number[] {
  const byPid = parseListeners(listenOut)
  const inside = (dir: string, wt: string) => dir === wt || dir.startsWith(wt + '/')
  const out = new Set<number>()
  let pid = ''
  for (const line of cwdOut.split('\n')) {
    if (line[0] === 'p') pid = line.slice(1)
    if (line[0] !== 'n') continue
    const dir = line.slice(1)
    const owner = worktrees.filter(wt => inside(dir, wt)).sort((a, b) => b.length - a.length)[0]
    if (owner === root) byPid.get(pid)?.forEach(p => out.add(p))
  }
  return [...out].sort((a, b) => a - b)
}

// Claude Code sessions listen on a local port too. The native install runs a binary named
// after its version (e.g. `2.1.318`), so lsof reports that as the command.
const isClaude = (cmd: string) => cmd === 'claude' || /^\d+\.\d+\.\d+$/.test(cmd)

// `lsof -F pcn` output: `p<pid>` starts a process, `c<command>` names it, `n<addr>:<port>` follows per socket.
export function parseListeners(out: string): Map<string, Set<number>> {
  const byPid = new Map<string, Set<number>>()
  let pid = ''
  let skip = false
  for (const line of out.split('\n')) {
    if (line[0] === 'p') { pid = line.slice(1); skip = false }
    if (line[0] === 'c') skip = isClaude(line.slice(1))
    if (line[0] !== 'n' || skip) continue
    const port = Number(line.slice(line.lastIndexOf(':') + 1))
    if (!Number.isInteger(port)) continue
    if (!byPid.has(pid)) byPid.set(pid, new Set())
    byPid.get(pid)!.add(port)
  }
  return byPid
}

// AppleScript that focuses a tab already on the port and prints "found", else "none".
// The app name comes from BROWSERS and the port is a number, so neither needs escaping.
export function focusScript(app: string, kind: Kind, port: number): string {
  const select = {
    chromium: 'set active tab index of w to i\nset index of w to 1',
    safari: 'set current tab of w to t\nset index of w to 1',
    // shortcut: untested against Arc's spaces, adjust if it misses tabs in other spaces
    arc: 'tell t to select',
    other: '',
  }[kind]
  return `if application "${app}" is not running then return "none"
tell application "${app}"
  repeat with w in windows
    set i to 0
    repeat with t in tabs of w
      set i to i + 1
      set u to URL of t
      repeat with h in {"http://localhost:${port}/", "http://127.0.0.1:${port}/", "https://localhost:${port}/", "https://127.0.0.1:${port}/"}
        if u starts with h then
          ${select}
          activate
          return "found"
        end if
      end repeat
    end repeat
  end repeat
end tell
return "none"`
}

async function refreshPorts($: Engine, root: string, worktrees: string[]) {
  const listen = await $.process.run(['lsof', '-nP', '-iTCP', '-sTCP:LISTEN', '-Fpcn'])
  const pids = [...parseListeners(listen.stdout).keys()]
  // lsof exits 1 when a pid vanished between calls; its output still holds the rest.
  const cwd = pids.length ? (await $.process.run(['lsof', '-a', '-p', pids.join(','), '-d', 'cwd', '-Fpn'])).stdout : ''
  const next = ownedPorts(listen.stdout, cwd, worktrees, root)
  const prev = await read($, ports)
  if (next.join() !== prev.join()) await update($, ports, () => next)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)

    const top = await $.process.run(['git', 'rev-parse', '--show-toplevel'], { cwd: e.cwd })
    const root = top.exitCode === 0 ? top.stdout.trim() : e.cwd
    const list = await $.process.run(['git', 'worktree', 'list', '--porcelain'], { cwd: e.cwd })
    const worktrees = list.stdout.split('\n').filter(l => l.startsWith('worktree ')).map(l => l.slice(9))
    if (!worktrees.includes(root)) worktrees.push(root)

    const saved = await $.store.get('browser')
    if (typeof saved === 'string') await update($, browser, () => saved)

    const handlers = await $.process.run(['plutil', '-extract', 'LSHandlers', 'json', '-o', '-', `${await $.env.get('HOME')}/Library/Preferences/com.apple.LaunchServices/com.apple.launchservices.secure.plist`])
    if (handlers.exitCode === 0) {
      const https = (JSON.parse(handlers.stdout) as { LSHandlerURLScheme?: string; LSHandlerRoleAll?: string }[])
        .find(h => h.LSHandlerURLScheme === 'https')
      await update($, defaultId, () => https?.LSHandlerRoleAll?.toLowerCase() ?? '')
    }

    const query = Object.keys(BROWSERS).map(id => `kMDItemCFBundleIdentifier ==[c] "${id}"`).join(' || ')
    const found = await $.process.run(['mdfind', query])
    const names = found.stdout.split('\n').map(p => p.split('/').pop()?.replace(/\.app$/, ''))
    await update($, installed, () => Object.keys(BROWSERS).filter(id => names.includes(BROWSERS[id].app)))

    await refreshPorts($, root, worktrees)
    $.clock.every(5000, () => refreshPorts($, root, worktrees))

    return started
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const live = await read($, ports)
    if (e.props.hasSurvey || live.length === 0) return next(e)

    const choice = await read($, browser)
    const def = BROWSERS[await read($, defaultId)]
    const options = [
      { value: 'default', label: `Default${def ? ` (${def.app})` : ''}` },
      ...(await read($, installed)).map(id => ({ value: id, label: BROWSERS[id].app })),
    ]

    const show = async (port: number) => {
      const id = choice === 'default' ? await read($, defaultId) : choice
      const target = BROWSERS[id]
      const url = `http://localhost:${port}`
      if (target && target.kind !== 'other') {
        const res = await $.process.run(['osascript', '-e', focusScript(target.app, target.kind, port)])
        if (res.exitCode !== 0) $.ui.toast(`Couldn't script ${target.app}: ${res.stderr.trim()}`)
        if (res.stdout.trim() === 'found') return
      }
      await $.process.run(target ? ['open', '-a', target.app, url] : ['open', url])
    }

    const { Box, Button, Select, Text } = $.ui.resolve(e)

    return (
      <Box>
        <Text dimColor>dev server </Text>
        {live.map(port => (
          <Button key={`port-${port}`} label={`:${port}`} onPress={() => void show(port)} />
        ))}
        {Select && (
          <Select
            key="browser"
            label=" in "
            options={options}
            value={choice}
            onSelect={value => {
              void update($, browser, () => value)
              void $.store.set('browser', value)
            }}
          />
        )}
      </Box>
    )
  })
}
