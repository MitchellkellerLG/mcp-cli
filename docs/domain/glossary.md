# Ubiquitous Language Glossary

Terms extracted directly from the source code and config schema of mcp-cli.

| Term | Definition | Key Files |
|------|-----------|----------|
| **MCP Server** | An external process or HTTP endpoint that implements the Model Context Protocol and exposes tools. Can be stdio-based (local process) or HTTP-based (remote URL). | `src/config.ts` — `ServerConfig`, `StdioServerConfig`, `HttpServerConfig` |
| **Tool** | A named callable function exposed by an MCP server. Has a name, optional description, and a JSON Schema input schema. | `src/client.ts` — `ToolInfo`; `src/commands/call.ts` |
| **Target** | A `"server/tool"` string that uniquely identifies a tool on a server. Used as the primary addressing format in call and info commands. | `src/commands/call.ts` — `parseTarget()` |
| **Config** | The `mcp_servers.json` file that declares all MCP servers. Shares format with Claude Desktop, Gemini CLI, and VS Code. | `src/config.ts` — `McpServersConfig`, `loadConfig()` |
| **Daemon** | A background Bun process that maintains a persistent connection to one MCP server, exposed via a Unix socket. Avoids cold-start latency on repeated CLI calls. | `src/daemon.ts` — `runDaemon()` |
| **DaemonConnection** | The IPC client interface returned when connecting through the daemon. Wraps listTools, callTool, getInstructions, and close behind the same McpConnection interface as direct connections. | `src/daemon-client.ts` — `DaemonConnection` |
| **McpConnection** | The unified connection abstraction used by all commands. Wraps both daemon and direct connections behind one interface. Exposes `listTools`, `callTool`, `getInstructions`, `close`, and an `isDaemon` flag. | `src/client.ts` — `McpConnection` |
| **CliError** | A structured error object with `code` (exit code), `type` (SCREAMING_SNAKE_CASE error name), `message`, optional `details`, and optional `suggestion` for recovery. Designed for LLM agent consumption. | `src/errors.ts` — `CliError`, `formatCliError()` |
| **ErrorCode** | Enum mapping error categories to process exit codes: CLIENT_ERROR=1, SERVER_ERROR=2, NETWORK_ERROR=3, AUTH_ERROR=4. | `src/errors.ts` — `ErrorCode` |
| **allowedTools** | Config-level array of glob patterns. If set, only tools matching at least one pattern are visible to the CLI. | `src/config.ts` — `BaseServerConfig.allowedTools` |
| **disabledTools** | Config-level array of glob patterns. Tools matching any pattern are hidden, regardless of `allowedTools`. Takes precedence. | `src/config.ts` — `BaseServerConfig.disabledTools` |
| **filterTools** | The function that applies `allowedTools` and `disabledTools` to a tool list using glob matching. Called by `McpConnection.listTools()`. | `src/config.ts` — `filterTools()` |
| **PID file** | A JSON file at `/tmp/mcp-cli-{uid}/{server}.pid` that records the daemon's PID and config hash. Used for stale detection and orphan cleanup. | `src/daemon.ts` — `PidFileContent`, `writePidFile()` |
| **Config hash** | A 16-char SHA-256 prefix of the serialized server config. Stored in the PID file. If the hash changes between CLI calls, the old daemon is killed and a new one is spawned. | `src/config.ts` — `getConfigHash()` |
| **Env var substitution** | The mechanism that replaces `${VAR_NAME}` placeholders in config values with environment variable values at load time. Controlled by `MCP_STRICT_ENV`. | `src/config.ts` — `substituteEnvVars()` |
| **StdioServerConfig** | Config type for a local MCP server launched as a subprocess. Has `command`, `args`, `env`, and optional `cwd`. | `src/config.ts` — `StdioServerConfig` |
| **HttpServerConfig** | Config type for a remote MCP server accessed via HTTP. Has `url`, optional `headers`, and optional `timeout`. | `src/config.ts` — `HttpServerConfig` |
| **transient error** | An error worth retrying automatically: network codes (`ECONNREFUSED`, `ETIMEDOUT`, etc.) or HTTP 429/502/503/504 responses. Non-transient errors (auth, config, validation) fail immediately. | `src/client.ts` — `isTransientError()` |
| **Socket dir** | The directory holding all daemon sockets and PID files: `/tmp/mcp-cli-{uid}/`. Created with mode 0700 to prevent other users from accessing it. | `src/config.ts` — `getSocketDir()` |
| **DAEMON_READY** | The string written to the daemon's stdout to signal that it has connected to the MCP server and is ready to accept IPC requests. The parent CLI waits for this before sending the first request. | `src/daemon.ts` — `runDaemon()` |
