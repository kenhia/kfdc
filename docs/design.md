# kfdc visual identity

Decided 2026-08-04 with the approved concept
([`design/kfdc-concept.html`](design/kfdc-concept.html) — self-contained,
open in a browser). The board is a **night-ops FDC plotting board**: dark
olive-charcoal ground, manila ink, grease-pencil accents. Single-theme dark
is a deliberate commitment, not an omission.

## Rules that outrank taste

- **Dense on purpose.** Widescreen, information-first, breaks
  whitespace-worship deliberately. Never "clean it up" into a marketing page.
- **The FDC vocabulary is load-bearing** (Ken is ex-11C): Fire Missions
  (active sprints) · On Deck / priorities of fire (ranked queue) ·
  Deconfliction (sequencing collisions) · Commander's Call (blocked on Ken) ·
  Operations (multi-project programs) · Sensor Net (health/risk) ·
  Net Log (radio traffic on the fires net — what changed since you last
  looked, observed times, panel codes FM/CC/OD/OP).
- **Proposed/unbuilt things get dashed borders** (grease-pencil); live data
  gets solid. Never blur that line.
- Status is encoded in form + color, never color alone (chips carry text).
- Data and labels in mono (`ui-monospace`), prose in system sans;
  `tabular-nums` wherever digits align.

## Tokens

| Token | Value | Role |
|---|---|---|
| `--ground` | `#15170f` | page ground (olive-charcoal) |
| `--panel` / `--panel-2` | `#1c1f15` / `#22261a` | surfaces |
| `--line` / `--line-soft` | `#383d2a` / `#2a2e1f` | rules, borders |
| `--ink` | `#e9e3cc` | primary text (manila) |
| `--muted` / `--faint` | `#a29d85` / `#757060` | secondary / tertiary |
| `--amber` | `#e2a63d` | active / firing / attention |
| `--red` | `#e0603f` | blocked / risk / awaiting-Ken |
| `--green` | `#97ba6b` | done / clear / healthy |
| `--cyan` | `#8fb5ba` | project chips / queued info |

Semantic colors (red/green/amber lights) are reserved for state; `--cyan`
identifies projects everywhere. Panel headers: mono, uppercase,
letter-spaced, underlined by `--line-soft`.
