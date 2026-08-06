---
name: update-fdc
description: Run one interactive kfdc curator pass — the same curator/prompt.md the headless timer runs, but in-session so the operator can watch it reason and vet each write. Use when asked to "run the curator", "update the FDC", or to curate the korg queue by hand.
---

# /update-fdc — interactive curator pass

One prompt, two entry points: `bin/update-fdc` runs `curator/prompt.md`
headless (`claude -p`, korg-only tool surface, kmon-pattern timer); this
skill runs the **same file** interactively. The prompt file is the single
source of truth — if this skill and the wrapper ever disagree, the prompt
wins. Do not restate, summarize, or fork its rules here.

1. Read `curator/prompt.md` at the repo root and follow it exactly, with
   two interactive amendments:
   - Use this session's korg MCP tools (they point at the same production
     korg the headless run writes to — these are real writes).
   - Before each write (`relate` / `add_comment` / `update_comment`), state
     the write and its prose basis in one line. This is the supervised mode
     the timer doesn't get; the operator is watching precisely to vet the
     writes.
2. If the korg MCP tools are unavailable in this session, stop and say so —
   never simulate the pass.
3. Finish with the prompt's run report, plus one extra section: anything
   the operator should consider tuning in `curator/prompt.md` based on
   this pass (mis-parsed prose, references that wouldn't resolve, writes
   you wanted to make but the rules forbade).
