# Security and Privacy Rule

Manager Simulator is a game that runs entirely on the player's machine:
no server, no accounts, no online services (HLD § Non-Goals). The repository is
**public**. Every change is checked against this list before it is committed;
the `/commit` skill reviews the diff against it. **A violation blocks the
commit.** It is fixed, not noted for later.

## Secrets and repository hygiene

- No API keys, tokens, passwords or private keys in code, config or history.
  gitleaks scans staged changes on every commit and the full history in
  `/security-audit`.
- If a secret is ever committed, treat it as leaked: revoke and rotate it
  first. Rewriting history doesn't make it secret again, because the repo is
  public.
- Never commit `.env*`, `.claude/settings.local.json`, `node_modules/` or build
  output. `.claude/settings.json` holds no absolute local paths or tokens.
- No real people's data and no employer-confidential material. Situations draw
  on real management experience, but names, companies, internal tools and
  incidents are fictionalized.

## No network, no tracking

The game makes no network requests. Any of the following is a design change
that needs an HLD update first, not just a code review:

- `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator.sendBeacon`,
  or loading scripts, fonts or images from another origin at runtime.
- Analytics, telemetry, crash reporting, ads, or any third-party SDK that
  phones home.
- Fingerprinting or identifiers that persist beyond the game's own save data.

Test tooling is not the game. The AI playtester (`npm run playtest:ai`,
`playtest/ai/`) calls the Claude API from the developer's machine, sending only
the text of the game's own screens and its persona prompt. It reads credentials
from the environment and never writes them anywhere, runs only when asked
(never in `npm test`, the playtest suite or CI), and writes its reports to a
folder git ignores. Its SDK is a development dependency the game never loads.

## Dependencies

- Keep runtime dependencies to a minimum; prefer none. Each one needs a reason
  in the commit message.
- `package-lock.json` is committed and installs use it (`npm ci` in CI).
- `npm audit --omit=dev` must report no moderate-or-higher vulnerability.
  Dev-only advisories are reported but don't block.
- GitHub Actions, when added, are pinned to a version or SHA and run with
  least-privilege `permissions:`.

## Untrusted input

Treat as untrusted anything the game did not just compute itself:

- **Save data** (`localStorage`, imported save files): parse inside
  `try`/`catch`, validate shape, types and ranges, and reject or reset rather
  than crash. A tampered save must not run code or corrupt other state.
- **Situation content and other data files**: loaded as data and validated
  against their schema. Never executed: no `eval`, `new Function`, dynamic
  `import()` of content paths, or string-built regular expressions from
  content.
- **URL parameters and query strings** (debug flags, shared seeds): parsed
  strictly against an allowlist.

## Rendering

- Content and player-entered text reach the DOM as text (`textContent`, or a
  framework's escaped interpolation), never through `innerHTML`,
  `outerHTML`, `insertAdjacentHTML`, `document.write` or
  `dangerouslySetInnerHTML`.
- No `javascript:` URLs; links the game opens are constants. The one exception
  is exporting a save, which downloads through a link to an object URL the game
  creates from the save and revokes straight after; it never navigates.
- When the game is deployed, it is served with a Content-Security-Policy that
  disallows inline script and `unsafe-eval`, plus `X-Content-Type-Options:
  nosniff` and `frame-ancestors` set.
- The game's address is `https://www.manager-simulator.io`, served by
  CloudFront from a private S3 bucket (`infra/site.yml`, see
  `docs/decisions/hosting.md`). CloudFront sends the Content-Security-Policy
  with `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Strict-Transport-Security` and
  `Referrer-Policy: no-referrer`; the bare domain redirects to `www`. The
  production build also carries the policy in a `<meta>` tag (UI-BUILD-002),
  so a copy served anywhere else is still held to it.
- The game's old address on GitHub Pages serves only a static page that sends
  visitors to the domain (`redirect/`): no script, nothing to frame, and a
  policy of its own that allows nothing to load. GitHub Pages cannot send
  headers; with no game there, it needs none.

## AWS

- The deploy assumes a role through GitHub's OpenID Connect provider, trusted
  only for this repository's `main` branch and allowed only to write the
  site's bucket and invalidate its distribution. No AWS access keys live in
  the repository, GitHub or the workflow.
- Account ids, role ARNs, bucket names and distribution ids are not
  committed; the workflow reads them from GitHub secrets.
- The bucket blocks all public access and is readable only by its
  distribution; access logging is off, since the game collects nothing about
  its players.
- Changes to the stack go through `infra/site.yml` and its tests, like any
  other code, and are deployed with `aws cloudformation deploy`.

## Determinism is not a security control, but keep it

`Math.random` and `Date.now` are not used in the simulation; randomness comes
from the seeded generator in the simulation state (SIM-STATE-004). The one
exception is the UI choosing a new run's seed, which it draws from
`crypto.getRandomValues` and saves with the run (no screen shows it,
UI-SHELL-008); everything after the seed is
deterministic, so this does not break reproducible runs. This rule
lives here because a reviewer scanning for `Math.random` will find it.

## Debug-only code

- Debug tools (seed pickers, state editors, cheat panels) are excluded from
  production builds (`import.meta.env.DEV` or equivalent), and checked at
  every call site.
