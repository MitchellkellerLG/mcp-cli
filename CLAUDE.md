# mcp-cli

Lightweight Bun-based CLI for calling any MCP (Model Context Protocol) server from the shell. Designed for AI agents — token-efficient, JSON output, stdin/pipe friendly.

## What it does

Wraps stdio and HTTP MCP servers behind a single CLI. You discover tools, inspect schemas, and call tools without loading full server context into your prompt. A lazy-spawn daemon keeps connections warm (60s idle timeout) so repeated calls within a session don't pay cold-start cost.

## Install

```bash
# Global install via bun
bun install -g https://github.com/philschmid/mcp-cli

# Or build a standalone binary for Windows
bun run build:windows   # outputs dist/mcp-cli-windows-x64.exe

# Dev run (no build needed)
bun run src/index.ts
```

## Config file

Create `mcp_servers.json` in the working directory or `~/.config/mcp/mcp_servers.json`.

Config resolution order:
1. `MCP_CONFIG_PATH` env var
2. `-c/--config` CLI flag
3. `./mcp_servers.json`
4. `~/.mcp_servers.json`
5. `~/.config/mcp/mcp_servers.json`

Format is identical to Claude Desktop / Gemini / VS Code MCP config:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    },
    "remote": {
      "url": "https://mcp.example.com",
      "headers": { "Authorization": "Bearer ${TOKEN}" }
    }
  }
}
```

Use `${VAR_NAME}` for env var substitution. Missing vars error by default — set `MCP_STRICT_ENV=false` to warn instead.

## Subcommands

```bash
mcp-cli                              # List all servers and their tools
mcp-cli -d                           # List with descriptions
mcp-cli info <server>                # Show server details + all tool names
mcp-cli info <server> <tool>         # Show full tool schema (JSON)
mcp-cli info <server>/<tool>         # Slash format also works
mcp-cli grep "<pattern>"             # Search tools across all servers (glob: *file*)
mcp-cli call <server> <tool>         # Call tool — reads JSON from stdin automatically
mcp-cli call <server> <tool> '{}'    # Call with inline JSON args
```

## Calling tools

```bash
# Inline JSON
mcp-cli call filesystem read_file '{"path": "./README.md"}'

# Stdin (pipe)
echo '{"path": "./README.md"}' | mcp-cli call filesystem read_file

# Heredoc (safest for complex JSON with quotes)
mcp-cli call server tool <<EOF
{"content": "Text with 'single' and \"double\" quotes"}
EOF

# Pipe result through jq
mcp-cli call github search_repositories '{"query": "mcp"}' | jq '.content[0].text'
```

## Tool filtering (per server)

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."],
      "allowedTools": ["read_file", "list_directory"],
      "disabledTools": ["delete_file"]
    }
  }
}
```

`disabledTools` takes precedence over `allowedTools`. Glob patterns (`read_*`, `*file*`) are supported.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `MCP_CONFIG_PATH` | none | Override config file path |
| `MCP_DEBUG` | false | Verbose debug output to stderr |
| `MCP_TIMEOUT` | 1800 | Request timeout in seconds |
| `MCP_CONCURRENCY` | 5 | Parallel server connections |
| `MCP_MAX_RETRIES` | 3 | Retry count on transient errors (0 = off) |
| `MCP_RETRY_DELAY` | 1000 | Base retry delay in ms |
| `MCP_STRICT_ENV` | true | Error on missing `${VAR}` substitutions |
| `MCP_NO_DAEMON` | false | Disable connection caching (fresh connect each call) |
| `MCP_DAEMON_TIMEOUT` | 60 | Idle connection timeout in seconds |

## Gotchas

- **No `list` subcommand** — bare `mcp-cli` or `mcp-cli info` lists servers. `mcp-cli list` throws UNKNOWN_SUBCOMMAND.
- **No `run` subcommand** — use `call`. `mcp-cli run server tool` fails.
- **Ambiguous bare invocations** — `mcp-cli server tool` without a verb (info/call) throws AMBIGUOUS. Always use the subcommand.
- **Stdin is auto-detected** — when calling with no JSON arg and stdin has data, it reads from stdin. No `-` flag needed.
- **Daemon keeps connections warm** — if a server process is misbehaving between calls, set `MCP_NO_DAEMON=true` to force fresh connections.
- **env var substitution at load time** — `${VAR}` in config is resolved when config loads, not per-call. Changing env mid-session has no effect without restarting.
- **Requires Bun** — not Node. `bun >= 1.0.0` required. Uses `bun run`, not `node`.

## Build commands

```bash
bun run dev           # Run from source (no build)
bun run build         # Compile for current platform
bun run build:windows # Windows x64 exe → dist/mcp-cli-windows-x64.exe
bun run build:all     # All platforms
bun test              # Unit tests
bun run typecheck     # tsc --noEmit
bun run lint:fix      # Biome lint + autofix
```
