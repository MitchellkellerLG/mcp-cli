# Interface Depth Analysis

Measures how well each module hides complexity behind its public interface.

**Depth ratio** = internal functions / exported functions. Higher is better: it means more work is done invisibly, with a lean surface callers must learn.

- SHALLOW: ratio < 2 — little hidden complexity, callers see most of what the module does
- ADEQUATE: ratio 2–5 — reasonable encapsulation
- DEEP: ratio > 5 — well-encapsulated; internal complexity is high relative to what callers need to know

---

## Summary Table

| Module | Exported | Internal | Ratio | Verdict |
|---|---|---|---|---|
| `src/config.ts` | 13 | 6 | 0.46 | SHALLOW |
| `src/errors.ts` | 15 | 0 | 0.0 | SHALLOW |
| `src/client.ts` | 9 | 5 | 0.56 | SHALLOW |
| `src/daemon.ts` | 8 | 3 | 0.38 | SHALLOW |
| `src/daemon-client.ts` | 3 | 4 | 1.33 | SHALLOW |
| `src/output.ts` | 6 | 2 | 0.33 | SHALLOW |
| `src/index.ts` | 0 | 5 | N/A | Entry point |
| `src/commands/call.ts` | 1 | 2 | 2.0 | ADEQUATE |
| `src/commands/grep.ts` | 1 | 1 | 1.0 | SHALLOW |
| `src/commands/info.ts` | 1 | 1 | 1.0 | SHALLOW |
| `src/commands/list.ts` | 1 | 0 | 0.0 | SHALLOW |

---

## Module Details

### `src/config.ts`

**Exported (13):** `filterTools`, `isToolAllowed`, `isHttpServer`, `isStdioServer`, `DEFAULT_TIMEOUT_SECONDS`, `DEFAULT_TIMEOUT_MS`, `DEFAULT_CONCURRENCY`, `DEFAULT_MAX_RETRIES`, `DEFAULT_RETRY_DELAY_MS`, `DEFAULT_DAEMON_TIMEOUT_SECONDS`, `debug`, `getTimeoutMs`, `getConcurrencyLimit`, `getMaxRetries`, `getRetryDelayMs`, `isDaemonEnabled`, `getDaemonTimeoutMs`, `getSocketDir`, `getSocketPath`, `getPidPath`, `getConfigHash`, `loadConfig`, `getServerConfig`, `listServerNames`

(Count: 13 distinct callable exports; several are constants)

**Internal (6):** `matchesPattern`, `matchesAnyPattern`, `isStrictEnvMode`, `substituteEnvVars`, `substituteEnvVarsInObject`, `getDefaultConfigPaths`

**Verdict: SHALLOW** — The module exposes nearly every function it contains. Constants like `DEFAULT_TIMEOUT_SECONDS`, `getSocketDir`, `getPidPath` are implementation details that leak through the interface. Callers import 20+ symbols from config, creating high coupling.

---

### `src/errors.ts`

**Exported (15):** `ErrorCode` (enum), `CliError` (interface), `formatCliError`, `configNotFoundError`, `configSearchError`, `configInvalidJsonError`, `configMissingFieldError`, `serverNotFoundError`, `serverConnectionError`, `toolNotFoundError`, `toolExecutionError`, `toolDisabledError`, `invalidTargetError`, `invalidJsonArgsError`, `unknownOptionError`, `missingArgumentError`, `ambiguousCommandError`, `unknownSubcommandError`, `tooManyArgumentsError`

**Internal (0):** None — the module is 100% interface.

**Verdict: SHALLOW** — This is a pure factory module (intentionally flat). All exports are needed by other modules. This is acceptable for an errors module, but callers directly construct error strings rather than going through one unified `throw` helper.

---

### `src/client.ts`

**Exported (9):** `ConnectedClient`, `McpConnection`, `ServerInfo`, `ToolInfo`, `isTransientError`, `safeClose`, `connectToServer`, `listTools`, `getTool`, `callTool`, `getConnection`, `debug`, `getTimeoutMs`, `getConcurrencyLimit`

**Internal (5):** `RetryConfig`, `getRetryConfig`, `calculateDelay`, `sleep`, `withRetry`, `createHttpTransport`, `createStdioTransport`

**Verdict: SHALLOW** — The retry internals (`withRetry`, `calculateDelay`, `sleep`, `getRetryConfig`) are correctly hidden. However, `connectToServer`, `listTools`, and `callTool` are exported even though external callers only need `getConnection`. Commands currently import `connectToServer` via `daemon.ts`, and `listTools`/`callTool` directly in the daemon worker — this leaks transport-level details.

---

### `src/daemon.ts`

**Exported (8):** `DaemonRequest`, `DaemonResponse`, `writePidFile`, `readPidFile`, `removePidFile`, `removeSocketFile`, `isProcessRunning`, `killProcess`, `runDaemon`

**Internal (3):** `PidFileContent` (type), `cleanup` (closure), `resetIdleTimer` (closure), `handleRequest` (closure)

**Verdict: SHALLOW** — PID file management functions (`writePidFile`, `readPidFile`, `removePidFile`) and process management (`isProcessRunning`, `killProcess`) are all exported and used by `daemon-client.ts`. A cleaner design would keep these inside a daemon management object and only export `runDaemon`.

---

### `src/daemon-client.ts`

**Exported (3):** `DaemonConnection`, `getDaemonConnection`, `cleanupOrphanedDaemons`

**Internal (4):** `generateRequestId`, `sendRequest`, `isDaemonValid`, `spawnDaemon`

**Verdict: SHALLOW** — This is the best-encapsulated module. Three exports hide four internal functions. Callers need only `getDaemonConnection` and `cleanupOrphanedDaemons`. However, the ratio is still below 2 because the internal count is small.

---

### `src/output.ts`

**Exported (6):** `formatServerList`, `formatSearchResults`, `formatServerDetails`, `formatToolSchema`, `formatToolResult`, `formatJson`, `formatError`

**Internal (2):** `shouldColorize`, `color`

**Verdict: SHALLOW** — All six format functions are exported and used. ANSI color logic is correctly hidden. The module is flat by design (pure formatting), which is appropriate.

---

### `src/commands/call.ts`

**Exported (1):** `callCommand`

**Internal (2):** `parseTarget`, `parseArgs`

**Verdict: ADEQUATE** — Best ratio in the commands group. `parseTarget` and `parseArgs` are internal helpers; callers only use `callCommand`. This is the intended pattern for all command modules.

---

### `src/commands/grep.ts`, `info.ts`, `list.ts`

**Exported (1 each):** `grepCommand`, `infoCommand`, `listCommand`

**Internal (1, 1, 0):** Minor internal helpers or none.

**Verdict: SHALLOW** — Same single-export pattern as call.ts, but with fewer internal helpers. Acceptable for simple commands; no action needed.
