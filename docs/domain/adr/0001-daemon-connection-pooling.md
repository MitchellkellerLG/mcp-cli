# ADR-0001: Daemon-Based Connection Pooling via Unix Sockets

## Status

Accepted

## Context

MCP servers that use stdio transport must be launched as subprocesses. This incurs a cold-start latency on every CLI invocation — process fork, MCP handshake, capability negotiation. For a CLI called repeatedly within an AI agent loop (e.g., Claude Code calling `mcp-cli info` then `mcp-cli call` in sequence), this latency compounds and degrades the agent's responsiveness.

The CLI needed a way to keep MCP server connections warm between invocations without requiring the user to manage a long-running process.

Alternative approaches considered:

1. **No pooling** — simple, but every call pays cold-start cost.
2. **Named process managed by systemd/launchd** — requires install-time setup, admin rights on some systems, and OS-specific code.
3. **Shared memory or file-based IPC** — complex serialization, locking concerns.
4. **Unix socket daemon per server, auto-spawned** — lazy, zero configuration, self-cleaning.

## Decision

Each MCP server gets its own background daemon process. The daemon is spawned on first use, listens on a Unix socket at `/tmp/mcp-cli-{uid}/{server}.sock`, and self-terminates after a configurable idle timeout (default: 60 seconds).

The CLI client checks for a valid daemon (PID file exists, process is alive, config hash matches) before spawning. If the daemon is valid, it sends requests over the socket. If the daemon fails or is disabled (`MCP_NO_DAEMON=1`), it falls back to a direct connection transparently.

A SHA-256 config hash (first 16 chars) is stored in the PID file. If the server's config changes between CLI calls, the old daemon is killed and a new one is spawned automatically — no manual restart required.

## Consequences

**Good:**

- Repeated CLI calls within a session pay only IPC latency, not process fork + MCP handshake.
- Zero user configuration. Daemon lifecycle is fully automatic.
- Stale daemons are detected and replaced without user intervention.
- `MCP_NO_DAEMON=1` provides a clean escape hatch for debugging or CI environments.
- Socket directory is created with mode 0700, limiting access to the current user.

**Bad:**

- Daemon adds a background Bun process per active MCP server — visible in `ps`.
- Unix sockets do not work on Windows. The daemon path is disabled there; all connections are direct.
- If the daemon crashes silently (without updating the PID file), the next CLI call will fail with a socket connection error and fall back to direct, which adds latency on that call.
- The 5-second spawn timeout means a slow MCP server startup can still cause the client to fall back to a direct connection on first use.
- Debugging daemon state requires `MCP_DEBUG=1` or inspecting `/tmp/mcp-cli-{uid}/` directly.
