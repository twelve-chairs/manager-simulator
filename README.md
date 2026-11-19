# Manager Simulator

A browser game about the career of a software engineering manager: from line manager, to senior manager (managing managers), to director and above (overseeing whole organizations). Each career level plays as a different game, and the situations are written so that sound management practice tends to work better, making the game something of a training simulator.

The design is in [docs/high-level-design.md](docs/high-level-design.md).

## Status

Early development. The **simulation core** exists: the deterministic model of people, teams, projects and the player's standing, including performance ratings, coaching plans and PIPs. There is no situation engine, career level, UI or playable game yet.

## Development

Requires Node.js.

```bash
npm ci              # install dependencies
npm test            # run the tests once
npm run test:watch  # run the tests on every change
npm run typecheck   # check types
```

## Layout

| Path | Contents |
|---|---|
| `src/sim/` | Simulation core |
| `tests/sim/` | Simulation core tests |
| `docs/high-level-design.md` | Project-level design |
| `docs/intent/` | Component designs and their requirements (EARS specs) |
| `docs/decisions/` | Project-level decision records |
| `docs/references/` | Source material the design draws on |

The project uses [linked-intent development](AGENTS.md): every change flows from the design docs through requirements and tests to code.
