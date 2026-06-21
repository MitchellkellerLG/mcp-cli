---
paths:
  - "src/**/*.ts"
---

# Error Handling Convention

All user-facing errors must use the structured `CliError` pattern from `src/errors.ts`.

- Every error returns a `CliError` object with `code`, `type`, `message`, and optionally `details` + `suggestion`.
- Error types are SCREAMING_SNAKE_CASE constants (e.g. `TOOL_NOT_FOUND`, `CONFIG_INVALID_JSON`).
- The `suggestion` field must contain an actionable recovery command or next step -- this CLI is designed for LLM agents, so machine-recoverable errors are critical.
- Errors go to stderr via `formatCliError()`. Never `console.error()` a raw string in command handlers.
- Exit codes map to `ErrorCode` enum: 1 = client error, 2 = server error, 3 = network, 4 = auth.
- New command modules in `src/commands/` export a single async function matching the pattern `export async function fooCommand(opts: FooOptions): Promise<void>`.
