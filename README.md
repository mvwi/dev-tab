# dev-tab

A Claude Code mod that shows a band above the prompt with a button for each dev server running from this worktree. Press one to bring up its browser tab.

- Checks listening ports every 5 seconds. A port counts when its process runs inside this worktree and not inside a worktree nested under it. Claude Code's own listener doesn't count.
- If a tab on that port is already open, it focuses that tab. Otherwise it opens `http://localhost:<port>`.
- Pick the browser from the menu in the band: your default, or any of Chrome, Brave, Edge, Vivaldi, Arc, Safari or Firefox that you have installed. Firefox can't be scripted, so it always opens a new tab.
- macOS only: it uses `lsof`, `osascript`, `mdfind` and `open`.

## Install

At the prompt of a terminal session:

```
/plugin install dev-tab --marketplace mvwi/dev-tab
```

Answer `y` to add the marketplace, then pick a scope.

From a shell:

```bash
claude plugin install dev-tab --marketplace mvwi/dev-tab
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `mvwi/dev-tab`, then Add plugin.

### Without installing a plugin

```bash
git clone https://github.com/mvwi/dev-tab ~/.claude/mods/dev-tab
```

Then add `~/.claude/mods/dev-tab` to `CLAUDE_CODE_PLUGIN_DIRS` under `env` in `~/.claude/settings.json` (join several paths with `:`) and restart Claude Code. Update with `git pull`.

## License

[MIT](LICENSE)
