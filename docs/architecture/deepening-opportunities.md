# Deepening Opportunities

Concrete improvements to reduce coupling, hide implementation details, and improve testability.

---

## 1. `config.ts` exports too many implementation details

**Problem:** `config.ts` exports `getSocketDir`, `getSocketPath`, `getPidPath`, `getConfigHash`, and all `DEFAULT_*` constants. These are internal to the daemon subsystem and have leaked through the public interface. Callers (`daemon.ts`, `daemon-client.ts`, `client.ts`) import 10+ symbols from config, creating a wide coupling surface.

**Proposed Solution:** Create a `daemon-config.ts` module that owns the daemon-specific path helpers and constants (`getSocketDir`, `getSocketPath`, `getPidPath`, `getConfigHash`, `DEFAULT_DAEMON_TIMEOUT_SECONDS`). Export only what is needed by command modules from `config.ts`. `daemon.ts` and `daemon-client.ts` import from `daemon-config.ts` instead.

**Impact: MEDIUM** — Reduces config.ts exports by ~6, clarifies what is "server config" vs "daemon infrastructure". Makes both modules independently testable.

---

## 2. `errors.ts` is missing a throw helper

**Problem:** `errors.ts` exports factory functions that return `CliError` objects, but callers must manually call `formatCliError()` and then either `throw` or `console.error + process.exit`. The same 3-line pattern (`console.error(formatCliError(...)); process.exit(...)`) appears 20+ times across command modules.

**Proposed Solution:** Add two helpers:
```ts
export function throwCliError(error: CliError): never
export function exitWithError(error: CliError): never
```
`throwCliError` formats and throws (for code that catches). `exitWithError` formats, writes to stderr, and exits (for top-level command handlers). Commands collapse from 3 lines to 1.

**Impact: MEDIUM** — Reduces command module boilerplate, eliminates the repeated `formatCliError` call site pattern, and makes error handling more consistent.

---

## 3. Daemon PID file functions are leaking through `daemon.ts` exports

**Problem:** `daemon.ts` exports `writePidFile`, `readPidFile`, `removePidFile`, `removeSocketFile`, `isProcessRunning`, and `killProcess`. These are only used by `daemon-client.ts`. The daemon worker (`runDaemon`) and the daemon client (`getDaemonConnection`) are split across two files but share low-level process and file management functions through exports — creating a two-way coupling.

**Proposed Solution:** Move PID file and process management into a `daemon-state.ts` module. Both `daemon.ts` and `daemon-client.ts` import from there. Neither exports these functions to the rest of the codebase. This creates a clear daemon subsystem boundary:

```
daemon-state.ts   -- PID files, socket files, process checks
daemon.ts         -- runDaemon (uses daemon-state)
daemon-client.ts  -- getDaemonConnection (uses daemon-state)
```

**Impact: HIGH** — Eliminates cross-file circular coupling concern, makes each file independently testable with a mockable `daemon-state`, and clarifies the subsystem boundary.

---

## 4. `client.ts` exports `connectToServer`, `listTools`, `callTool` but they are internal

**Problem:** `connectToServer`, `listTools`, and `callTool` are transport-level primitives used only inside `client.ts` and `daemon.ts`. Exporting them exposes the transport layer to the rest of the codebase. Any command module could bypass `getConnection` and call the transport directly, skipping tool filtering and daemon routing.

**Proposed Solution:** Unexport `connectToServer`, `listTools`, `callTool`. `daemon.ts` should either import them from a shared internal module or the daemon should use the `getConnection` interface. All external callers use only `getConnection` and `McpConnection`.

**Impact: HIGH** — Enforces that tool filtering is always applied. Eliminates the possibility of a command accidentally bypassing the daemon or filtering layer.

---

## 5. `isTransientError` in `client.ts` is exported but has no external callers

**Problem:** `isTransientError` is exported from `client.ts` and is referenced in tests, but no production command module calls it directly — it is only used internally by `withRetry`. Exporting it leaks the retry policy contract to callers.

**Proposed Solution:** Keep `isTransientError` exported for testability (it encodes an important policy), but document it explicitly as a testing boundary, not a public API. Alternatively, move tests that exercise it into an internal test helper file.

**Impact: LOW** — No runtime impact. Purely a documentation/convention fix.

---

## 6. Stdin detection in `call.ts` is a hidden seam

**Problem:** `parseArgs` in `call.ts` directly reads `process.stdin` and checks `process.stdin.isTTY`. This makes the function untestable without process-level mocking. The timeout and stdin read logic is also embedded inside `parseArgs`, making it difficult to unit-test argument parsing separately from I/O.

**Proposed Solution:** Extract the stdin-reading logic into a separate function:
```ts
async function readStdin(timeoutMs: number): Promise<string>
```
`parseArgs` accepts an optional `stdinReader` parameter (defaulting to `readStdin`). Tests can inject a mock reader without touching `process.stdin`.

**Impact: MEDIUM** — Unblocks unit testing of `parseArgs` without integration overhead. Follows the same pattern as Jest/Bun dependency injection for I/O.
