# Commit Message Rule

Every git commit must have a meaningful message. Follow these requirements:

## Format

```
<type>: <short summary> (≤72 chars)

- <what changed and why, one bullet per logical change>
- <additional context if non-obvious>
```

## Types

| Type | Use when |
|------|----------|
| `feat` | New gameplay or player-facing functionality |
| `fix` | Bug fix |
| `refactor` | Code restructure with no behavior change |
| `ui` | Layout, styling or animation only |
| `content` | Situation content or other game data, no code change |
| `spec` | Intent docs only: HLD, LLDs, EARS specs, decision docs |
| `test` | Tests only |
| `docs` | Other documentation (README, AGENTS.md, skills, rules) |
| `build` | Build tooling, dependencies, TypeScript or Vitest config |
| `chore` | Housekeeping with no build or behavior impact |
| `security` | Security or privacy-related changes |

A change that walks the arrow (spec, tests and code together) takes the type of
its outcome, usually `feat` or `fix`, not `spec`.

## Feature areas

Reference the affected area in the summary where it aids scanning: `sim`
(simulation core), `situations` (situation engine), `levels` (career level
modules), `review` (performance review and progression), `loop` (turn loop),
`ui`, `save`, `content`, `lid` (the intent docs and workflow itself).

## Rules

- **Never** use vague messages like `"fix"`, `"update"`, `"wip"`, or `"changes"`.
- The summary line must describe **what** changed, not just **where**.
- If multiple files changed, list each logical change as a bullet in the body.
- Cite the EARS spec IDs a change implements or alters (`SIM-ADV-011`), or the
  prefix when there are many (`SIM-EFFECT-*`).
- State the *reason* for anything non-obvious — particularly workarounds, which
  otherwise get "cleaned up" later by someone who cannot see why they exist.
- Say the tests pass only if they were run for this commit and passed.

## Examples

Good:

```
feat: make low trust weaken the player's motivation boosts

- Positive motivation effects from player actions and situation choices now
  scale with the target's trust (SIM-EFFECT-010)
- Situation choices count as the player acting; otherwise trust would stop
  mattering inside situations
```

```
spec: define behind-schedule projects in the simulation core

- Projects record a start week; behind schedule compares share of scope done
  with share of time elapsed (SIM-QUERY-005)
- Stress rule now refers to overdue or behind-schedule projects
```

Bad:

```
update files
fix bug
wip
```
