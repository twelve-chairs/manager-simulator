<div align="center">

# Manager Simulator

**You just got promoted. Now five engineers, two projects and a pager are yours.**

A browser game about the career of a software engineering manager, where the people remember what you did and good management actually wins.

[![Play now](https://img.shields.io/badge/%E2%96%B6%20play%20now-in%20your%20browser-d98e04?style=for-the-badge)](https://twelve-chairs.github.io/manager-simulator/)

[![Deploy](https://github.com/twelve-chairs/manager-simulator/actions/workflows/deploy.yml/badge.svg)](https://github.com/twelve-chairs/manager-simulator/actions/workflows/deploy.yml)
[![Status: early development](https://img.shields.io/badge/status-early%20development-orange)](#status)
[![Last commit](https://img.shields.io/github/last-commit/twelve-chairs/manager-simulator)](https://github.com/twelve-chairs/manager-simulator/commits/main)
[![Top language](https://img.shields.io/github/languages/top/twelve-chairs/manager-simulator)](https://github.com/twelve-chairs/manager-simulator)
[![Runtime dependencies: 0](https://img.shields.io/badge/runtime%20dependencies-0-brightgreen)](package.json)
[![Tracking: none](https://img.shields.io/badge/tracking-none-brightgreen)](#private-by-design)

</div>

---

## A week in the job

Monday morning, the project check-in: *Billing migration is behind. Re-plan it with the team, cut scope, move the deadline, or push on?*

Tuesday, a design review lands on your desk. You could do it yourself, but you're tired. Give it to Dario, who's strong and calm? Or to Lena, who'd be stretched by it and wants to grow?

> Dario shrugs. "Fine. But that's the third thing this week."

Wednesday night, the pager goes off and Ada is on call. Back her up, take over, or trust her with it?

Friday, the recap tells you who's more stressed, who learned something, and what slipped while you were busy. Next week, they remember.

## What makes it different

- **People, not spreadsheets.** Every engineer has a personality and a memory of what happened between you. The same choice lands differently on a quiet engineer and a blunt one.
- **Habits do the routine, so the week can be about the moments.** Decide who takes night pages, how often you hold 1:1s, who signs routine approvals, how much ceremony the team runs and whose growth you focus on, then change them as the team changes.
- **Your energy is the budget.** Everything you take on yourself costs you. Four weeks running on fumes and you burn out.
- **Consequences you can trace.** Push back on a design review and it comes back as tech debt. Ignore what someone wants and they start looking around. The quarterly review connects the outcome to the choices that caused it.
- **Good management actually wins.** On every build, a balance harness plays over a hundred seeded runs with scripted strategies, and the build fails unless sound practice clearly outscores always saying yes, always delegating, doing everything yourself and doing nothing.

## Status

**Early development, and playable from start to finish.** The first career level, **line manager**, runs in the browser from your first day to promotion, burnout or being managed out:

- a week of short scenes: design reviews, customer requests, night pages, interviews, project check-ins, and authored story situations;
- five standing habits, quarterly goals from your manager and a review every 13 weeks;
- a guided first three weeks, and How to play on hand throughout;
- your run saves in the browser after every move, and can be exported to a file and imported again.

**Next up:** the senior manager level (managing managers), then director and above, where whole organizations become the people you look after.

## Private by design

The game runs entirely in your browser. There are no accounts, no servers, no analytics and no network requests, and the page's Content-Security-Policy makes the browser enforce that. Your saved run stays on your machine.

## How it's built

Plain TypeScript and the DOM: no framework and no runtime dependencies.

- **A deterministic simulation** of people, teams, projects and your standing. A run is fully reproducible from its seed and your choices, which is also how saves work.
- **Authored situations** written as Markdown files, compiled to data at build time and validated against a schema. Their outcomes are chosen by the state of the team, never by dice.
- **[Linked-intent development](AGENTS.md):** every change flows from the design docs, through requirements and tests, to code. Start with the [high-level design](docs/high-level-design.md).

## Development

Requires Node.js.

```bash
npm ci              # install dependencies
npm run dev         # play locally at the address Vite prints
npm run build       # build the static game into dist/
npm run preview     # serve the built game
npm test            # run the tests once
npm run test:watch  # run the tests on every change
npm run typecheck   # check types
npm run balance     # play 200 seeded runs per scripted strategy and print the balance table
```

Every push to `main` is typechecked, tested, built and published to [GitHub Pages](https://twelve-chairs.github.io/manager-simulator/).

## Layout

| Path | Contents |
|---|---|
| `src/sim/` | Simulation core |
| `src/situations/` | Situation engine |
| `src/levels/line-manager/` | Line manager career level |
| `src/loop/` | Turn loop |
| `src/review/` | Performance review |
| `src/save/` | Save / load: a run saved as its seed and commands, rebuilt by replaying them |
| `src/ui/` | Browser UI; `index.html` at the root loads it |
| `src/actions.ts` | Player action catalogue: every career level's action ids, which situation content is checked against |
| `src/personalities.ts` | Personality catalogue: the traits career levels give people, which situation content is checked against |
| `content/situations/` | Authored situations: Markdown with YAML front matter, one per file |
| `tests/` | Tests for each component, beside the folders above (`tests/sim/`, `tests/levels/`, and so on) |
| `tests/balance/` | Balance harness: scripted strategies play seeded runs to check that sound management outperforms naive habits |
| `scripts/` | Build-time tools, such as the situation content compiler |
| `.github/workflows/deploy.yml` | Builds, tests and publishes the game to GitHub Pages on every push to `main` |
| `vite.config.ts` | Build configuration, including the plugin that compiles situations into the page |
| `docs/high-level-design.md` | Project-level design |
| `docs/intent/` | Component designs and their requirements (EARS specs) |
| `docs/decisions/` | Project-level decision records |
| `docs/references/` | Source material the design draws on |
