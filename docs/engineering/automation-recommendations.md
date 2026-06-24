# Automation Recommendations

Claude Code automations for the mcp-cli development workflow.

---

## Pre-Commit Hooks

### 1. Type check on staged TypeScript files

**What:** Run `bun run typecheck` before every commit.

**Why it helps:** The project uses `tsc --noEmit` for type checking. TypeScript errors are a leading source of broken builds. Catching them at commit time costs 2-3 seconds instead of a CI round-trip.

**Implementation sketch:**
```bash
# .claude/settings.json hook: PreToolUse on Bash writing to src/
bun run typecheck
```

---

### 2. Biome lint + autofix on staged files

**What:** Run `bun run lint:fix` before commit to auto-fix style issues.

**Why it helps:** Biome is already configured (`biome.json`). Without a hook, lint drift accumulates. Autofix means developers rarely need to manually address style issues.

**Implementation sketch:**
```bash
bun run lint:fix
git add -u  # re-stage after autofix
```

---

### 3. Run unit tests before commit

**What:** Run `bun test tests/*.test.ts` (unit only, skip integration) before commit.

**Why it helps:** Integration tests take ~35 seconds and require a live MCP server. Unit tests run in under 1 second. Blocking on unit tests catches regressions before they hit CI.

**Implementation sketch:**
```bash
bun test tests/config.test.ts tests/output.test.ts tests/client.test.ts tests/errors.test.ts tests/filter.test.ts tests/errors-and-client.test.ts
```

---

## Skills That Would Benefit This Repo

### 4. `tdd` skill — test-first development for new command modules

**What:** Invoke the `tdd` skill when adding a new subcommand (e.g., a `watch` or `proxy` command).

**Why it helps:** The existing commands follow a clear pattern (`export async function fooCommand(opts): Promise<void>`). A TDD session scaffolds the test file, writes failing cases for argument parsing and error paths, then implements the command to pass them. The pattern is mechanical enough that an agent can drive it end-to-end.

**Implementation sketch:**
```
/tdd — implement a new `watch` command that monitors a server for tool list changes
```

---

### 5. `code-review` skill — review PRs that touch daemon or client code

**What:** Run `code-review --fix` on any PR that modifies `src/daemon.ts`, `src/daemon-client.ts`, or `src/client.ts`.

**Why it helps:** The daemon lifecycle (spawn, ping, stale detection, orphan cleanup, idle timeout) is the most complex part of the codebase and the hardest to manually test. An automated review pass catches race conditions, missed cleanup paths, and retry policy regressions.

**Implementation sketch:**
```
/code-review --fix
```

---

## MCP Server Connections That Would Help

### 6. GitHub MCP server — issue and PR management

**What:** Connect the `github` MCP server (configured in `mcp_servers.json`) so agents can read issues, create PRs, and check CI status without leaving the CLI session.

**Why it helps:** The repo's issue tracker is GitHub. An agent fixing a `ready-for-agent` issue can read the issue, implement the fix, run tests, and open a PR — all through `mcp-cli call github ...` — without switching context.

**Implementation sketch:**
```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}" }
    }
  }
}
```

---

## Custom Agents for Common Tasks

### 7. `daemon-debugger` agent — diagnose daemon state

**What:** A short agent that checks `/tmp/mcp-cli-{uid}/`, reads PID files, confirms processes are running, pings each daemon socket, and reports stale/healthy state.

**Why it helps:** When users report "connection fails" issues, the first diagnostic step is always checking daemon state. This agent automates that triage.

**Implementation sketch:**
```
Agent reads: src/daemon.ts, src/daemon-client.ts, src/config.ts (getSocketDir, getPidPath)
Agent runs: ls /tmp/mcp-cli-$(id -u)/ → reads each .pid file → checks kill -0 <pid> → reports
```

---

### 8. `integration-test-runner` agent — set up and run integration tests

**What:** An agent that starts a local MCP server (e.g., `@modelcontextprotocol/server-filesystem`) against the test directory, writes a temporary `mcp_servers.json`, runs `bun test tests/integration/`, and cleans up.

**Why it helps:** Integration tests require manual setup today. An agent can run the full suite on demand without manual config steps.

**Implementation sketch:**
```
Agent writes: /tmp/mcp-cli-test/mcp_servers.json with filesystem server pointing at repo root
Agent runs: bun test --timeout 30000 tests/integration/
Agent cleans: /tmp/mcp-cli-test/
```

---

## File Watchers / Background Automations

### 9. Watch `src/` for changes and re-run unit tests

**What:** A background watcher that runs unit tests whenever a file in `src/` changes.

**Why it helps:** Bun has native file watching. During active development, immediate test feedback eliminates the manual `bun test` loop.

**Implementation sketch:**
```bash
bun --watch test tests/config.test.ts tests/output.test.ts tests/client.test.ts tests/errors.test.ts tests/filter.test.ts tests/errors-and-client.test.ts
```

---

### 10. Post-build validation — verify the compiled binary works

**What:** After `bun run build`, automatically run `dist/mcp-cli --version` and `dist/mcp-cli --help` to confirm the binary is not broken.

**Why it helps:** The build produces a standalone binary. A silent build failure (wrong entry point, missing module) produces a binary that segfaults or prints nothing. A 2-line smoke test catches this immediately.

**Implementation sketch:**
```bash
bun run build && ./dist/mcp-cli --version && ./dist/mcp-cli --help > /dev/null && echo "Binary OK"
```
