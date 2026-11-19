---
name: security-audit
description: Comprehensive, repo-wide security and privacy audit of Manager Simulator, not just a diff. Checks secrets in the full git history, dependencies and supply chain, the no-network/no-tracking promise, untrusted input (save data, content files, URL parameters), DOM injection sinks, debug-only code, and the built and deployed output. Read-only; reports findings by severity and fixes nothing without asking. For reviewing only the pending diff, use /security-review instead.
argument-hint: [source | deps | build | full]
---

`/commit` checks each **diff** against `.claude/rules/security.md`. This skill
checks **everything that already exists**: old code that predates a rule,
history that was never scanned, drift between what the design promises (no
network, no tracking, local-only) and what the code does, and what actually
ships in the build. Run it before a public release or deployment, after adding
a dependency, save/load, content loading or any DOM rendering, and whenever the
rules change.

**Arguments.** `source` runs sections 1, 3–6. `deps` runs section 2. `build`
runs section 7. `full` or nothing runs everything.

**This is an audit, not a fix.** Don't edit, commit or push anything while it
runs. Report first (section 8). The user decides what to fix, and each fix goes
through `/commit` like any other change. The standard is
`.claude/rules/security.md`. Where it conflicts with a documented decision in
`docs/high-level-design.md` or an LLD under `docs/intent/`, the design wins;
read them before reporting something as a violation.

For every check, **record a result even when it is clean**. A check with no
recorded result is indistinguishable from one that was skipped. Many checks
cover parts of the game that may not exist yet (UI, saves, content loading,
deployment); for those, record "not present yet" rather than skipping.

## 0. Preconditions

```bash
command -v gitleaks
git status --short
git rev-parse --short HEAD
gh repo view --json visibility
```

- Missing gitleaks: `brew install gitleaks`. Don't skip its checks.
- Run `npx tsc --noEmit` and `npx vitest run`. A failing test is a finding at
  the severity of what it checks.
- Note the commit audited and any uncommitted changes, so the report says what
  was audited.

Read the full source rather than relying only on grep. The greps below find
candidates; reading confirms them.

## 1. Secrets and repo hygiene

```bash
gitleaks git --no-banner --redact -v          # the entire history
gitleaks dir --no-banner --redact -v .        # untracked files too
git ls-files | grep -Ei '\.env|\.pem|\.key|secret|credential|settings\.local\.json'
git log --all --diff-filter=A --name-only --format= | sort -u | grep -Ei '\.env|\.pem|\.key|settings\.local'
```

- Any secret in history is **Critical** even if since deleted: the repo is
  public. The remedy is revoke and rotate, not a history rewrite.
- `.gitignore` still covers everything `.claude/rules/security.md` says must
  never be committed.
- `.claude/settings.json` (if tracked) holds no tokens or absolute local paths.
- **Confidential or personal material.** Read `docs/references/` and all
  situation content for real people's names, employer names, internal tool or
  system names, or real incidents. In a public repo these are **High**.

## 2. Dependencies and supply chain

```bash
npm audit --omit=dev
npm audit
npm ls --omit=dev --depth=0
```

- Prod moderate+ is a finding; dev-only advisories are Info.
- Every runtime dependency is justified (a commit message or design doc says
  why). An unused or unjustified one is Low.
- `package-lock.json` is committed and consistent (`npm ci --dry-run`).
- `.github/workflows/*.yml`, if present: actions pinned to a version or SHA,
  least-privilege `permissions:`, no `pull_request_target` checking out PR
  code, no secrets echoed.

## 3. No network, no tracking

The HLD promises a local-only game with no online services.

```bash
grep -rnE 'fetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|navigator\.(userAgent|plugins|hardwareConcurrency)|import\(\s*[^\x27"]' src index.html 2>/dev/null
grep -rnE 'https?://' src index.html 2>/dev/null
```

- Any request at runtime, or a script, font or image loaded from another
  origin, is **High** unless the HLD has been changed to allow it.
- Analytics, telemetry, crash reporting or ad code: **High**.
- Fingerprinting signals collected for anything but gameplay: **Medium**.

## 4. Untrusted input

- **Save data.** Find every read from `localStorage`, `sessionStorage`,
  IndexedDB or an imported file. Each must parse inside `try`/`catch` and
  validate shape, types and ranges before use. Try mentally: invalid JSON, a
  missing field, a string where a number was expected, a negative or huge
  number, `NaN`, an unknown enum value, a huge array, a `__proto__` key. A
  crash or corrupted state is **Medium**; code execution is **Critical**.
- **Content files** (situations and other game data). Loaded as data and
  validated against a schema; never executed. Any `eval`, `new Function`,
  dynamic `import()` of a content-derived path, or `RegExp` built from content
  is **High**.
- **URL parameters.** Parsed against an allowlist. A parameter that reaches
  the DOM, a path, or the simulation unvalidated is **Medium**.
- Check tests exist for the malformed cases. Missing tests for a validator is
  **Low**.

## 5. Rendering and the DOM

```bash
grep -rnE 'innerHTML|outerHTML|insertAdjacentHTML|document\.write|dangerouslySetInnerHTML|javascript:|on[a-z]+=\s*["\x27]' src index.html 2>/dev/null
```

- Content or save-derived text reaching an HTML sink is **High** (stored XSS
  via a shared save or content file).
- Links opened by the game are constants; one built from content or save data
  is **Medium**.

## 6. Determinism and debug-only code

```bash
grep -rnE 'Math\.random|Date\.now|new Date\(|performance\.now' src
grep -rnE 'import\.meta\.env\.DEV|DEBUG|cheat|godMode' src
```

- `Math.random` or wall-clock time inside `src/sim/` breaks reproducible runs
  (SIM-STATE-004): **Low** (correctness, not security), but report it.
- Debug tools (seed pickers, state editors, cheats) reachable in a production
  build: **Medium**. Check each call site, not just the definition.

## 7. The built and deployed output

Only when a build exists (`npm run build` produces `dist/`). If there is no
build script yet, record "not present yet".

```bash
npm run build
find dist -type f | sort
grep -rlE 'sourceMappingURL' dist
grep -rnE 'localhost|127\.0\.0\.1|DEBUG|cheat' dist
```

- No source maps, test files, `docs/`, or `.claude/` in `dist/` unless
  deliberately shipped: **Low**.
- Debug tools present in the production bundle: **Medium**.
- If the game is deployed, fetch the live page headers
  (`curl -sI <url>`): Content-Security-Policy without `unsafe-inline` or
  `unsafe-eval` in `script-src`, `X-Content-Type-Options: nosniff`,
  `frame-ancestors`, HTTPS with HSTS. Missing CSP is **Medium**; the rest
  **Low**.

## 8. Report

Present the report in chat in this structure:

```
# Security Audit — <date> — <commit> — scope: <scope>

## Summary
<2–4 sentences: overall posture, count by severity, the single most important fix>

## Findings
### [CRITICAL|HIGH|MEDIUM|LOW|INFO] <short title>
- **Where:** `path/to/file.ts:line`
- **Rule:** <section of .claude/rules/security.md>
- **Issue:** <what is wrong>
- **Exploit scenario:** <concrete: who, what input, what they gain>
- **Fix:** <specific change>

## Checked and passing
<every check from sections 0–7 with its result, including "not present yet">

## Not checked
<anything skipped and why>
```

Severity guide:

- **Critical** — secret in history, code execution from save data or content.
- **High** — network calls or tracking the design doesn't allow, stored XSS via
  content or saves, confidential or real personal material in the public repo.
- **Medium** — crash or corruption from malformed saves, debug tools in
  production, missing CSP when deployed, prod dependency advisory.
- **Low** — defense-in-depth gaps, missing tests for validators,
  nondeterminism in the simulation.
- **Info** — hardening suggestions and design notes.

Only report findings you verified by reading the code or command output. If
uncertain, put it under Info with what would confirm it.

Finally, offer to (a) publish the report as a private artifact for sharing, and
(b) fix findings in severity order, each as its own `security:` commit with
tests, through `/commit`.
