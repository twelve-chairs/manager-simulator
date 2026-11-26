# manager-simulator

A game that simulates the career of a software engineering manager, from line manager to senior manager (managing managers) to director and above (overseeing whole organizations).

## LID
- Mode: Full
- Version: 1.4.6

## Linked-Intent Development (MANDATORY)

**Consult the `linked-intent-dev` skill for ALL code changes.** All changes flow through the arrow of intent in one direction:

```
HLD → LLDs → EARS → Tests → Code
```

- **All changes**: consult the `linked-intent-dev` skill if your harness provides it; otherwise read `docs/lid/workflow.md` before making changes, and if it is missing and `## LID` records no decline, offer the user once to add it from https://raw.githubusercontent.com/jszmajda/lid/v1.4.6/plugins/linked-intent-dev/skills/update-lid/references/workflow-doc.md (on decline, add `- Workflow doc: declined` to `## LID`). The workflow in one line: HLD check → LLD → EARS specs → edge audit → failing tests first → code — inspected at each phase.
- **Bug fixes**: walk the arrow like any other change — find where behavior diverged from intent and cascade from there. No short-circuit.

Each phase's output is inspected — by the user or an inspector they name — before the next begins; ambiguous spec readings go back to the user. **Docs carry current intent, written to be read cold** — write each doc as if authored fresh today, from current intent alone: no narration of how it changed, no meaning that needs the conversation that produced it, no rebuttals to questions only a past discussion raised. Rationale, considered alternatives, and constraints a fresh author would independently write stay; record rejected alternatives and why in the LLD's Decisions & Alternatives table, not as asides in body prose.

**Memory vs. intent.** Before saving durable project knowledge to agent or tool memory, test whether it is project *intent* — would a fresh agent, in any tool, next session, need it to build this system correctly? If yes, record it in the arrow (HLD / LLD / EARS / decision doc), which travels and cascades — not in private, per-tool memory, where intent escapes the arrow. Knowledge about the user or how they like to work stays in memory.

### Navigation

| What you need | Where to look |
|---|---|
| High-level design | `docs/high-level-design.md` |
| Design tree (sub-HLDs, LLDs, their specs) | `docs/intent/` — one folder per node |
| EARS specs | beside each design doc as `{node}-specs.md` in the node's folder under `docs/intent/` |
| Decision docs | `docs/decisions/` (project-level) and `docs/intent/<segment>/decisions/` |

### Terminology

- **HLD**: High-Level Design — single project-level doc at `docs/high-level-design.md`.
- **LLD**: Low-Level Design — detailed component design doc in `docs/intent/`. The design layer is a recursive tree: the root is the HLD, leaf LLDs own EARS, and a component deep enough to outgrow one doc becomes a sub-HLD (HLD-shaped, owns no EARS) with children beneath it. "HLD" and "LLD" are roles by position; depth-2 (one HLD over flat leaf LLDs) is the default.
- **EARS**: Easy Approach to Requirements Syntax — structured one-line requirements beside each design doc as `{node}-specs.md` in the node's folder under `docs/intent/`. IDs are path-concatenated — the root-to-leaf path of the owning segment plus a number — so a prefix grep gathers a subtree. Markers: `[x]` implemented, `[ ]` active gap, `[D]` deferred.
- **Arrow**: the unidirectional chain from vision to code (HLD → LLDs → EARS → Tests → Code). Strictly a DAG of intent.
- **Arrow segment**: the territory owned by one leaf LLD — the LLD itself plus the specs, tests, and code that cite its EARS IDs. The boundary is the leaf prefix. Within-segment cascade is free; across-segment cascade pauses.
- **Cascade**: propagating a change downstream through the arrow so adjacent levels stay coherent.

### Code annotations

Annotate code and tests with `@spec` comments citing EARS IDs:

```
// @spec AUTH-UI-001, AUTH-UI-002
```

Place the annotation at the *entry point of the behavior's implementation graph* — the topmost function or module owning the specified behavior, not every helper. When a behavior spans multiple subsystems (UI + API + database, for example), annotate at the entry point in each subsystem. Tests follow the same rule: annotate the test that directly exercises the spec, not every inner assertion.

## Workflow

- Commit with `/commit` (`.claude/skills/commit/`): it checks the arrow, runs `npm run typecheck`, `npm run lint`, `npm test` and, when the game itself changed, `npm run test:e2e`, scans for secrets, reviews the diff against `.claude/rules/security-and-privacy.md`, commits per `.claude/rules/commit-messages.md`, pushes, then waits for the pushed commit's Deploy run and its SonarQube Cloud check and treats a failure of either as a failing test. Judge every check by its exit code, not by filtered output.
- `npm test` includes the balance checks (`tests/balance/`): scripted strategies play seeded runs, and sound practice must beat every naive strategy. A change to tuning, rules or situation content can fail them. Fix the game's tuning or content first; loosening a balance threshold needs its own justification. A new situation needs an entry in the harness's better-choice table. `npm run balance` prints the full table.
- Every push to `main` runs the typecheck, the tests and the build in GitHub Actions and publishes the game to `https://www.manager-simulator.io` (S3 and CloudFront, `infra/site.yml`, deployed by a role the workflow assumes through OpenID Connect) and to the GitHub Pages copy kept while players move their saves; a failing check stops the deploy. Pull requests to `main` run the same checks without publishing. Actions in `.github/workflows/` are pinned to commit SHAs.
- Every build is stamped with a version, `v<major>.<minor>.<commit count> (<commit>)`, shown on the start screen (UI-BUILD-004). The count rises by itself with every push to `main` and starts again from 1 at the commit that raises major or minor; raise major or minor by hand in `package.json` (and `package-lock.json`) when the game changes in a way worth naming. CI checkouts that build the game need `fetch-depth: 0`, or the build is stamped `unversioned`.
- `npm run playtest` plays whole runs with scripted players and checks every screen, plus scenarios, saves, phone width, dark mode and the keyboard (`playtest/`, under a minute locally; runs promoted to senior manager, and then to director, play on for up to three more years at each). Run it after a change to rules, tuning, content or the UI; it also runs weekly in GitHub Actions, together with `npm run balance` at 200 seeds. `PLAYTEST_URL=https://www.manager-simulator.io/ npm run playtest` plays the live site instead of the local build. Each run attaches a summary to the HTML report (`npx playwright show-report`), and the success-metric playtests (`playtest/metrics.playtest.ts`) attach and print a scorecard of proxies for the HLD's success metrics; only the reaction check fails the run, the rest are reported. Read the scorecard after a change to pacing, content or tuning. Human sessions follow `playtest/HUMAN.md`.
- `npm run playtest:ai` has Claude play the game as a newcomer (`playtest/ai/`) and answer the human script, writing a report to `playtest-results/` (git ignores it). It calls the Claude API with the credentials in the environment and costs money, so run it only when the user asks, and say roughly what a run costs first (`AI_MODEL=sonnet` plays the decisions on Sonnet 5.5 and keeps the interview on Opus, for several times less); it never runs in `npm test`, the playtest suite or CI. `playtest/ai-dry.playtest.ts` checks its driver with a fake client at no cost.
- `.mcp.json` defines a Playwright MCP server for exploratory checks in a real browser: an in-memory profile, navigation only to the local dev and preview servers and the live site, and a pinned version. Use it to look at and play the game while changing the UI; the end-to-end suite in `e2e/` is what guards against regressions.
- CodeQL scans the TypeScript on pushes and pull requests to `main` and weekly, and OpenSSF Scorecard grades the supply-chain practices on pushes to `main` and weekly; both report on the repository's Security tab. Treat a new CodeQL finding like a failing test. Keep `.github/workflows/scorecard.yml` in the shape Scorecard requires to publish (read-only top-level permissions, only its approved actions), or the badge stops updating. Name no file `security.md` (or `.markdown`, `.adoc`, `.rst`) anywhere but the root `SECURITY.md`: Scorecard's Security-Policy check finds the root file but scores the contents of any other file with that name (ossf/scorecard#5198), which is why the security rule is `.claude/rules/security-and-privacy.md`.
- SonarQube Cloud analyses `main` on every push (automatic analysis, project `twelve-chairs_manager-simulator`) and holds it to the Sonar way quality gate on new code: A ratings for reliability, security and maintainability, every hotspot reviewed, and at most 3% duplication. It has no coverage data, so the gate has no coverage condition. Treat a failing gate like a failing test; `/security-audit` reads the ratings, issues and gate through the `sonarqube` MCP tools.
- Dependabot opens weekly grouped pull requests for the npm dev tools and the pinned actions, a week after each release. Merge one only once its checks pass, and read the release notes of anything that runs in CI.
- Audit the whole repo with `/security-audit` (`.claude/skills/security-audit/`) before a release or deployment.
- The repository is public: no secrets, no real people's data, no employer-confidential material.
