---
name: commit
description: Check the change against the arrow of intent, run the typecheck and tests (fixing the code if they fail), scan for secrets and review the diff against the security rules, update README.md and AGENTS.md if relevant, commit all staged/unstaged changes, and push to GitHub.
argument-hint: [optional commit message override]
---

Follow these steps in order.

## 1. Assess changes

Run `git status` and `git diff HEAD` to understand what has changed, including
untracked files.

## 2. Check the arrow of intent

This project uses linked-intent development (see `AGENTS.md`). Before
committing, check the changed segments are coherent:

- Every `@spec` ID cited in changed code or tests exists in a
  `docs/intent/**/*-specs.md` file:

  ```bash
  ids=$(grep -rhoE '\*\*[A-Z]+(-[A-Z]+)*-[0-9]{3}\*\*' docs/intent | tr -d '*' | sort -u)
  for id in $(grep -rhoE '@spec [A-Z0-9, -]+' src tests | grep -oE '[A-Z]+(-[A-Z]+)*-[0-9]{3}' | sort -u); do
    echo "$ids" | grep -qx "$id" || echo "dangling: $id"
  done
  ```

- Every spec marked `[x]` in a changed spec file has a test citing it, and every
  spec whose code and tests landed in this change is marked `[x]`.
- Code that changes behavior has a spec behind it. If the diff contains
  behavior with no spec (code ahead of intent), **stop and tell the user**: it
  needs to walk the arrow (`linked-intent-dev` skill) before it is committed.
  Don't write the spec silently here.

Report the result even when clean: "Arrow: N specs cited, none dangling".

## 3. Update README.md

**Check `README.md` on every commit.** It is the first thing anyone arriving at
the public repo reads, and it goes stale silently. Update anything the change
has made wrong or incomplete:

- What the game is and its current state (which career levels and systems
  exist and are playable)
- How to install, run, test and build (`npm` scripts)
- The layout of `src/`, `tests/` and `docs/`, if files were added, removed or
  moved
- Links that now point at something renamed or deleted

**Check the GitHub repository description too.** It is the line beside the repo
on GitHub and in search results, and it says what the game is, including how far
the career ladder goes. Read it with
`gh repo view --json description --jq .description`; when the change makes it
wrong (a career level added or removed, the game described differently in the
README's opening), update it with `gh repo edit --description "<text>"`, keeping
it in step with the README's tagline.

If nothing in the README or the description is affected, say so explicitly in
your report rather than skipping the step silently.

Keep the division of labour: the README says **what the project is and how to
run it**; `docs/high-level-design.md` and `docs/intent/` say **what it should do
and why**; `AGENTS.md` says **how agents work in this repo**. Link rather than
copy.

## 4. Update AGENTS.md if relevant

Update only if a workflow changed: a new npm script agents must run, a new
rule or skill, a new environment gotcha (for example, Google Drive sync
behavior), or a change to the `## LID` block. Do not record product intent
there; that belongs in the arrow.

## 5. Clean .claude/settings.json

If `.claude/settings.json` exists, move any entries in the `permissions.allow`
array that contain absolute local paths — anything matching `/Users/`,
`/home/`, `/private/`, or a `/tmp/` reference with a specific filename (not a
wildcard pattern like `Bash(npx:*)`) — into `.claude/settings.local.json`.
Merge with existing entries; do not duplicate. Save both files if changes were
made. `.claude/settings.local.json` is gitignored; never stage it.

## 6. Typecheck, lint and test

Run, in order:

1. `npx tsc --noEmit` — must report no errors.
2. `npm run lint` — must report no errors or warnings. Fix the code rather than switching a rule off; a rule that is wrong for this project is changed in `.oxlintrc.json`, with the reason in the commit message.
3. `npx vitest run` — must pass.
4. `npm run test:e2e` — must pass. It builds the game and plays it in Chromium; run it whenever the change touches `src/`, `index.html`, styles, assets or the build, and say so when it was skipped for a docs-only change. The first time on a machine, `npm run playwright:install` downloads the browser.

Do not commit if any of them fails. **Judge each by its exit code** (`npm run lint; echo $?`), never by grepping or tailing its output: a filter that does not match a tool's error format reads as a pass, and a failing lint once went unnoticed through 19 commits that way.

**If a test fails, fix the code, not the test.** Read the failure, find the
cause, fix it, and run again until it passes. Change a test only when the
change being committed deliberately changes the behavior it checks — which
means its spec changed too — and say so in the report and commit message.
Never delete, skip or weaken a test to get a commit through. If the fix needs
a product decision, stop and ask the user.

**Then check the tests cover the change.** New specs get tests citing them; a
bug fix gets the test that would have caught it; untrusted input (save data,
content files) gets tests for malformed cases.

Report the result: how many tests ran and passed, and which were added or
changed and why.

## 7. Security review

1. Scan staged and unstaged changes for secrets:

   ```bash
   gitleaks git --pre-commit --no-banner --redact -v
   gitleaks dir --no-banner --redact -v --max-target-megabytes 5 src tests docs .claude
   ```

2. If `package.json` or `package-lock.json` changed, run `npm audit --omit=dev`.
   Moderate or higher blocks the commit; dev-only advisories are reported.

3. Read the full diff against `.claude/rules/security-and-privacy.md`. Grep the changed
   files for the sinks it names:

   ```bash
   git diff HEAD --name-only | grep -E '\.(ts|tsx|js|html)$' | xargs -r grep -nE \
     'innerHTML|outerHTML|insertAdjacentHTML|document\.write|dangerouslySetInnerHTML|eval\(|new Function|fetch\(|XMLHttpRequest|WebSocket|sendBeacon|Math\.random|Date\.now|javascript:'
   ```

Then decide:

- **Any security violation blocks the commit**: a secret, a network call or
  third-party tracking, unvalidated save or content data, an HTML injection
  sink, or employer-confidential or real personal data in content. Fix it, or
  stop and ask the user if the fix is a product decision.
- For a large or risky change (save/load, content loading, anything touching
  the DOM with content), also run `/code-review` on the diff and act on what it
  finds.

Report the result even when clean: "Security: no secrets, no rule violations",
or the list of what was fixed.

## 8. Commit

Stage deliberately with `git add <paths>` after reading `git status`. Never
`git add -A` blindly. Never stage `.claude/settings.local.json`, `.env*`,
`node_modules/`, `dist/`, `.DS_Store` or `.idea/workspace.xml`.

Write the message following `.claude/rules/commit-messages.md`. If the user
supplied `$ARGUMENTS`, use that as the summary line (still applying the correct
type prefix).

Append a co-author trailer naming the model that actually wrote the commit —
substitute your own model name, do not copy the example verbatim:

```
Co-Authored-By: Claude <your model name> <noreply@anthropic.com>
```

e.g. `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. A hardcoded name
here goes stale and misattributes the work to a model that did not do it.

Never pass `--no-verify`.

## 9. Push

Run `git push` after a successful commit. The remote is
`https://github.com/twelve-chairs/manager-simulator.git` (public) and the
default branch is `main`. If the branch has no upstream yet, use
`git push -u origin <branch>`.

## 10. Check CI and SonarQube on the pushed commit

The push is not done until GitHub Actions and SonarQube Cloud have passed it.
Both run after the push, so no earlier step can see what they find.

1. Wait for the Deploy workflow's run on the pushed commit and read its result:

   ```bash
   sha=$(git rev-parse HEAD)
   id=$(gh run list --workflow deploy.yml --commit "$sha" --json databaseId --jq '.[0].databaseId')
   gh run watch "$id" --exit-status; echo "deploy exit: $?"
   ```

   A failure means the game did not deploy. Read it with `gh run view "$id" --log-failed`.
2. Read SonarQube Cloud's check on the same commit. It is posted as a check run named "SonarCloud Code Analysis":

   ```bash
   gh api "repos/twelve-chairs/manager-simulator/commits/$sha/check-runs" --jq '.check_runs[] | [.name, .status, .conclusion] | @tsv'
   ```

   Wait until it is `completed`. When it is not `success`, read the quality gate
   with the `sonarqube` MCP tools (`get_project_quality_gate_status`, project
   `twelve-chairs_manager-simulator`), and the failing condition's issues with
   `search_sonar_issues_in_projects` (`inNewCodePeriod: true`, filtered to that
   software quality).

**A failing deploy or quality gate is a failing test.** Fix it in a follow-up
commit through these same steps, and do not report the change as done until both
pass.

## 11. Report

Summarize: the commit hash and message summary line, the arrow check (step 2),
README and AGENTS.md (updated or not, and why), test results (step 6), the
security review (step 7), and the CI and quality gate results (step 10).
