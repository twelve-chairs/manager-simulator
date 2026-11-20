# Manager Simulator

A browser game about the career of a software engineering manager: from line manager, to senior manager (managing managers), to director and above (overseeing whole organizations). Each career level plays as a different game, and the situations are written so that sound management practice tends to work better, making the game something of a training simulator.

The design is in [docs/high-level-design.md](docs/high-level-design.md).

## Status

Early development, and **playable**: the line manager level runs in the browser from start to promotion, burnout or being managed out, with eleven authored situations and a short onboarding: your manager walks you through your first three weeks, and a How to play section stays on the week screen. The run saves in the browser after every move and resumes on reload, and can be exported to a file and imported again.

The **simulation core** exists: the deterministic model of people, teams, projects and the player's standing, including performance ratings, coaching plans and PIPs. The **situation engine** exists too: it validates authored situations, selects and binds them each turn, and applies the player's choices to the simulation. The first career level, **line manager**, has its rules: a weekly hours budget spent through a calendar of actions, an inbox of hands-on demands to handle or delegate, hiring, and the scorecard its reviews read. The **turn loop** runs a career week by week as commands applied to one saveable, replayable run. The **performance review** scores each quarter against the level's targets, rates the player, and decides whether they continue, are promoted or are managed out. The **UI** renders the run in the browser as plain DOM with no runtime dependencies.

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

## Layout

| Path | Contents |
|---|---|
| `src/sim/` | Simulation core |
| `tests/sim/` | Simulation core tests |
| `src/situations/` | Situation engine |
| `src/levels/line-manager/` | Line manager career level |
| `src/loop/` | Turn loop |
| `src/review/` | Performance review |
| `src/save/` | Save / load: a run saved as its seed and commands, rebuilt by replaying them |
| `tests/save/` | Save / load tests |
| `src/ui/` | Browser UI; `index.html` at the root loads it |
| `tests/ui/` | UI and build tests |
| `tests/balance/` | Balance harness: scripted strategies play seeded runs to check that sound management outperforms naive habits |
| `tests/review/` | Performance review tests |
| `tests/loop/` | Turn loop tests |
| `src/actions.ts` | Player action catalogue: every career level's action ids, which situation content is checked against |
| `tests/levels/` | Career level tests |
| `tests/situations/` | Situation engine tests |
| `content/situations/` | Authored situations: Markdown with YAML front matter, one per file |
| `scripts/` | Build-time tools, such as the situation content compiler |
| `vite.config.ts` | Build configuration, including the plugin that compiles situations into the page |
| `docs/high-level-design.md` | Project-level design |
| `docs/intent/` | Component designs and their requirements (EARS specs) |
| `docs/decisions/` | Project-level decision records |
| `docs/references/` | Source material the design draws on |

The project uses [linked-intent development](AGENTS.md): every change flows from the design docs through requirements and tests to code.
