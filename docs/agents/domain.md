# Domain Layout

## Context Type: Single-Context

This is a single-context CLI tool. There is one domain: MCP server management and tool invocation from the shell.

There are no multi-tenant concerns, no separate bounded contexts, and no domain isolation between modules. All source code lives under `src/` and shares the same type universe.

---

## Domain Structure

```
src/
  index.ts          - CLI entry point, argument parsing, command dispatch
  config.ts         - Config loading, env var substitution, tool filtering, daemon paths
  client.ts         - MCP transport connections (stdio/HTTP), retry logic, unified McpConnection
  daemon.ts         - Background daemon worker (Unix socket IPC server, idle lifecycle)
  daemon-client.ts  - Daemon IPC client (spawn, ping, stale detection, orphan cleanup)
  errors.ts         - Structured CliError type, all error factory functions
  output.ts         - Terminal formatting (ANSI colors, server/tool display, JSON)
  version.ts        - Version constant
  commands/
    call.ts         - call subcommand: parse target, read args, execute tool
    grep.ts         - grep subcommand: glob-match tools across all servers
    info.ts         - info subcommand: server details or tool schema
    list.ts         - list subcommand: all servers and their tools
```

---

## Where Domain Docs Should Live

| Doc type | Location |
|---|---|
| Glossary and ubiquitous language | `docs/domain/glossary.md` |
| Architecture decisions | `docs/domain/adr/` |
| Interface depth analysis | `docs/architecture/interface-depth.md` |
| Deepening opportunities | `docs/architecture/deepening-opportunities.md` |
| Automation recommendations | `docs/engineering/automation-recommendations.md` |
| Issue triage | `docs/agents/` |

There is no client-specific or tenant-specific knowledge to partition. If the project ever grows to support multi-instance orchestration, a `docs/domain/bounded-contexts.md` would be the right place to document that split.
