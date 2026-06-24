# Triage Labels

Five canonical states for every issue in this repo.

---

## needs-triage

**When to apply:** Default state for all new issues. No one has reviewed it yet.

**Who acts next:** Maintainer. Review within 48 hours. Assign another label after reading.

**Example:** User opens "mcp-cli crashes when config has no servers" — no one has confirmed it or looked at the code.

---

## needs-info

**When to apply:** The issue cannot be reproduced or scoped without more data from the reporter.

**Who acts next:** Reporter. Maintainer comments with specific questions. Issue stalls until info is provided.

**Example:** "Connection fails on my machine" with no error output, Bun version, or config structure attached. Agent cannot proceed.

---

## ready-for-agent

**When to apply:** The issue is scoped, reproducible, and contained to a single module or well-understood path. A concrete failing test case or error code is identified.

**Who acts next:** AI coding agent. Agent reads the relevant source files, writes a fix, runs `bun test`, and opens a PR.

**Example:** "filterTools does not handle glob `?` character correctly — unit test in `tests/filter.test.ts` fails." Fully self-contained.

---

## ready-for-human

**When to apply:** The issue requires human judgment: security implications, API design decisions, cross-platform behavior that can't be verified in CI, or access to external infrastructure.

**Who acts next:** Maintainer or contributor. Agent should not attempt without explicit approval.

**Example:** "Daemon socket permissions on multi-user Linux — should we use 0700 or 0600?" Requires policy decision, not just a code fix.

---

## wontfix

**When to apply:** The maintainer has decided not to address this issue. Reasons: out of scope, by design, superseded, or infeasible given project constraints.

**Who acts next:** Maintainer closes with a short explanation. Reporter may fork if they disagree.

**Example:** "Add interactive TUI mode" — out of scope for a shell-composable, agent-optimized CLI that deliberately avoids interactivity.
