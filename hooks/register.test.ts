import { expect, test } from 'claude-code/testing'

import { ownedPorts, serverName } from './register'

test('a port counts only when its process runs in this worktree, not a nested one', async () => {
  const listen = 'p1\nf9\nn*:5173\np2\nf9\nn127.0.0.1:5174\np3\nf9\nn*:7000\n'
  const cwd = 'p1\nfcwd\nn/repo/apps/web\np2\nfcwd\nn/repo/.claude/worktrees/x\np3\nfcwd\nn/repo-other\n'
  const worktrees = ['/repo', '/repo/.claude/worktrees/x']

  expect(ownedPorts(listen, cwd, worktrees, '/repo')).toEqual(new Map([[5173, '1']]))
  expect(ownedPorts(listen, cwd, worktrees, '/repo/.claude/worktrees/x')).toEqual(new Map([[5174, '2']]))
})

test("Claude Code's own listener is not a dev server", async () => {
  const listen = 'p1\ncnode\nn*:5173\np2\nc2.1.318\nn127.0.0.1:65232\np3\ncclaude\nn127.0.0.1:65300\n'
  const cwd = 'p1\nfcwd\nn/repo\np2\nfcwd\nn/repo\np3\nfcwd\nn/repo\n'

  expect(ownedPorts(listen, cwd, ['/repo'], '/repo')).toEqual(new Map([[5173, '1']]))
})

test('the server name is the tool, not the interpreter or its flags', async () => {
  expect(serverName('node /repo/node_modules/.bin/vite --port 5173')).toBe('vite')
  expect(serverName('node /repo/node_modules/next/dist/bin/next dev')).toBe('next')
  expect(serverName('/opt/homebrew/Cellar/python@3.14/Python.app/Contents/MacOS/Python -m http.server 8000')).toBe('http.server')
  expect(serverName('/Users/me/.cargo/bin/trunk serve')).toBe('trunk')
  expect(serverName('')).toBe('')
})
