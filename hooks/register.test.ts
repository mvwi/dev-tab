import { expect, test } from 'claude-code/testing'

import { ownedPorts } from './register'

test('a port counts only when its process runs in this worktree, not a nested one', async () => {
  const listen = 'p1\nf9\nn*:5173\np2\nf9\nn127.0.0.1:5174\np3\nf9\nn*:7000\n'
  const cwd = 'p1\nfcwd\nn/repo/apps/web\np2\nfcwd\nn/repo/.claude/worktrees/x\np3\nfcwd\nn/repo-other\n'
  const worktrees = ['/repo', '/repo/.claude/worktrees/x']

  expect(ownedPorts(listen, cwd, worktrees, '/repo')).toEqual([5173])
  expect(ownedPorts(listen, cwd, worktrees, '/repo/.claude/worktrees/x')).toEqual([5174])
})

test("Claude Code's own listener is not a dev server", async () => {
  const listen = 'p1\ncnode\nn*:5173\np2\nc2.1.318\nn127.0.0.1:65232\np3\ncclaude\nn127.0.0.1:65300\n'
  const cwd = 'p1\nfcwd\nn/repo\np2\nfcwd\nn/repo\np3\nfcwd\nn/repo\n'

  expect(ownedPorts(listen, cwd, ['/repo'], '/repo')).toEqual([5173])
})
