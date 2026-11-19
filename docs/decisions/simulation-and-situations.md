---
node: high-level-design
---

# Decision: Simulated organization with authored situations

## Context

The game's core structure decides where its depth comes from, how content is produced, and what every other component is shaped around: the per-level mechanics, the review and progression rules, the content pipeline and the UI all depend on whether the game is driven by written scenarios, by a simulation, or by both. Getting it wrong is expensive to reverse, because changing it means rebuilding most of the game.

## Decision Elements

- **Per-level distinctness** — *major* (tenet: *A fresh role over a continuous system*). How naturally the structure supports each career level being a different job, not the same job at a larger scale.
- **Learnability** — *major* (tenet: *Learnable over ambiguous*). Whether a player can learn which choices are better and why, and see that learning pay off in later play.
- **Traceable consequences** — *major*. Whether a player can connect a bad outcome to the earlier decisions or neglect that caused it.
- **Replayability** — *moderate*. Whether a second and third run play differently enough to be worth it.
- **Build and balance cost** — *moderate* (tenet: *Fun over authenticity*). Engineering and tuning effort before the game is fun to play.
- **Content cost per hour of play** — *moderate*. How much writing is needed to fill a run without repetition.

## Options in the Domain

### Narrative decision game

Each turn presents a small number of written situations drawn from a pool. Each situation offers a few choices, and each choice moves a handful of global meters (team health, delivery, reputation with your boss, stress). Career levels change which pool is active and which meters exist. There is no model of individual people beyond what the writing says.

- **Per-level distinctness — partial.** Levels can differ in their situations and meters, but the underlying interaction (read a card, pick a choice) stays the same at every level.
- **Learnability — strong.** Each situation's better choice is authored directly and can be explained in the writing itself.
- **Traceable consequences — partial.** Effects are visible as meter changes, but delayed consequences need explicit flags authored into the content, and they tend to be few.
- **Replayability — weak.** Players learn the pool; once the right answers are known, later runs offer little new.
- **Build and balance cost — strong.** Small engine; balance is mostly tuning numbers on cards.
- **Content cost per hour of play — weak.** Every minute of play is written content; the pool must be large to avoid repetition.

*Summary:* cheapest to build and easiest to teach with, but its depth is capped by the amount of writing.

### Systemic simulation

A detailed model of every person (skills, motivation, career goals, relationships), every team and every project, advanced each turn by rules. The player acts through a fixed set of actions (1:1s, hiring, staffing, escalations, budget), and outcomes emerge from the model. Career levels change which actions are available and which parts of the model are directly visible.

- **Per-level distinctness — strong.** Each level can expose a different slice of the model and a different action set; acting through simulated managers falls out of the model naturally.
- **Learnability — partial.** Better strategies exist, but the reasons behind outcomes are spread across many interacting rules and are hard to read without explanatory content.
- **Traceable consequences — partial.** All consequences are real, but they are diffuse; without authored moments, players struggle to see which decision mattered.
- **Replayability — strong.** Different seeds and choices produce different organizations and different problems.
- **Build and balance cost — weak.** Largest engine, hardest to balance, and tends toward spreadsheet play unless heavily presented.
- **Content cost per hour of play — strong.** Play time comes from the model, not from writing.

*Summary:* deepest and most replayable, at the highest build cost and with weak legibility.

### Hybrid: simulation with authored situations

A lighter model of people, teams, projects and the player's standing produces state. Authored situations carry trigger conditions on that state, offer choices, and write effects back into it. A flight-risk conversation happens because a specific engineer's motivation fell; the choice made in it changes what that engineer does next. Career levels swap the action set, time step, visible detail and active situation pool.

- **Per-level distinctness — strong.** Level modules change actions, visibility and situations over a shared model.
- **Learnability — strong.** Situations are authored moments where the better choice can be designed and explained, and the model makes the lesson play out in later turns.
- **Traceable consequences — strong.** Situations surface the state that caused them, which turns diffuse simulation effects into visible moments.
- **Replayability — partial.** The same situations recur across runs, but they fire for different people at different times and land in different states.
- **Build and balance cost — partial.** Two systems to build, plus a contract between them (what state situations may read and write) that must stay coherent.
- **Content cost per hour of play — partial.** The model fills time between situations, but situations remain the main source of drama and still need steady writing.

*Summary:* combines authored lessons with simulated consequences, at the cost of building and coordinating two systems.

## Selection

**Hybrid: simulation with authored situations.** It is the only option strong on all three major criteria. Per-level distinctness (from *A fresh role over a continuous system*) rules against the narrative game; learnability (from *Learnable over ambiguous*) and traceable consequences rule against the pure simulation, whose lessons are hard to read. The narrative game wins on build cost, and the pure simulation wins on replayability; both are moderate criteria and are traded away knowingly.

Committing to the hybrid obligates a clearly specified boundary between the simulation core and the situation engine: which state situations may read, which effects they may write, and how a situation's trigger and outcome are made visible to the player. It forecloses a fully emergent game in which situations are generated rather than written, and it means content writing is ongoing work for the life of the project.
