---
parent: high-level-design
prefix: BAL
---

# Balance Harness

## Context and Design Philosophy

The HLD sets a success metric that code can check: across seeded runs, choices that follow sound practice outperform naive ones, and no context-blind strategy reliably wins. The balance harness checks it. Scripted strategies play many seeded runs of a career level through the real turn loop, performance review and content, and the harness compares how each strategy fares. The comparison runs as part of the test suite, so a change to tuning, content or rules that makes poor management pay, or good management stop paying, fails the build.

It is test tooling: nothing in it ships in the game.

Three principles shape it:

- **Strategies play as a player would.** A strategy sees only what the player sees (the level's view, this week's situations, and review results) and acts only through turn loop commands. It never reads hidden values, so a strategy that wins does so by playing well, not by peeking.
- **Real game, real content.** Runs use the compiled situation content, the real career level, the real performance review and the real tuning. The harness adds strategies and measurement, nothing else.
- **Relations, not magic numbers.** The checks compare strategies with each other (sound practice beats every naive strategy) and against a few thresholds. The thresholds are tuning values set from measurement, kept in one place, and changed deliberately: when a check fails, the first remedy is the game's own tuning or content, and loosening a threshold to make a check pass needs its own justification in the commit that does it.

## Strategies

A **strategy** is a function from what the player can see this week to the commands it sends before ending the week. The harness applies those commands, ends the week, and acknowledges any review, until the run ends or reaches the weeks played.

| Strategy | Calendar | Inbox | Situations |
|---|---|---|---|
| **Idle** | Keeps the default calendar | Decides nothing | Answers nothing |
| **Hero** | Keeps the default calendar | Handles every demand it can within the overtime cap, accepts work intake | Picks the first offered choice |
| **Delegator** | Keeps the default calendar | Delegates every demand it can to the least stressed engineer (ties broken by engineer id), accepts work intake | Picks the first offered choice |
| **Contrarian** | Keeps the default calendar | Leaves everything | Picks the last offered choice |
| **Sound practice** | Keeps 1:1s and ceremonies; adds recognition, coaching or delegation-serving actions for people whose known want calls for it; takes recovery time when its own stress band is high; interviews for open vacancies | Handles on-call escalations itself; delegates other demands to the least stressed engineer whose skill band is at least the demand's difficulty band; handles what it cannot delegate while hours allow; accepts work intake | Picks the situation's better choice from the table below |

Idle, Hero, Delegator and Contrarian are the **naive** strategies: each applies one rule regardless of context. Picking the first or last offered choice stands in for "always agree" and "always push back", since a situation's choices come in no particular order.

Strategies are measuring instruments: their rules live in this document, not in specs, so a strategy can be refined without a spec change. Every strategy keeps its plan within the level's hours cap, so the turn loop never refuses a week; a refusal is a bug in the strategy and fails the harness.

## Better Choices

Sound practice needs to know which choice in each situation is the better one. The harness keeps a table mapping each situation id to its better choice's id. Every line manager situation in the content must have an entry naming a choice the situation has, except onboarding situations (ids starting `onboarding-`), which have no better choice; a missing or wrong entry fails the harness, so adding a situation means deciding its better choice. When the table's choice is not offered (its `availableIf` does not hold), sound practice picks the first offered choice.

## Measures and Checks

For each strategy, the harness plays a set of seeds for up to 78 weeks (six reviews) and, reading the run itself (which strategies never see), records per run: the review ratings, whether the player was promoted (at the line manager, the highest level so far, a promotion completes the run), burned out or managed out, and how many engineers rated meets or above quit. Across runs it reports:

- the **average review score**, with ratings counted `below` 0 to `outstanding` 4. Every run is scored over its six review slots, so that ending early is scored as what it was: a slot missed after burning out or being managed out counts 0, and a slot missed after a promotion counts as the last rating;
- the **promotion share**, **burnout share** and **managed-out share**;
- the average number of **regretted quits**.

The checks, with thresholds from the harness's tuning:

1. Sound practice's average review score exceeds every naive strategy's by at least the score margin.
2. Sound practice's promotion share is at least the minimum promotion share.
3. No naive strategy's promotion share exceeds the maximum naive promotion share.
4. Sound practice's burnout share is at most the maximum sound burnout share.

The test suite runs 20 seeds per strategy and must stay within about 15 seconds; a report command runs more seeds and prints the table for tuning.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Where better choices are declared | A table in the harness, with a check that every situation has an entry | A field on the choice in the situation file | Keeps test-only knowledge out of the game's data and needs no change to the content format, while still forcing every new situation to name its better choice. |
| What strategies see | The player's view and commands only | Reading the simulation state | A strategy that peeks at hidden values proves nothing about what a player can learn. |
| When balance is checked | In the test suite with 20 seeds per strategy, plus a report command with more | Only in the report command | Every commit is checked, so content or tuning changes cannot quietly break balance. |
| Context-blind choices | First or last offered choice | A hand-labelled "agreeable" choice per situation | Choice order carries no meaning, so first and last are honest stand-ins for a fixed habit, with no extra labelling. |

## Open Questions & Future Decisions

### Deferred
1. Strategies for higher career levels, written when those levels exist.
2. Whether to check that sound practice wins on most individual seeds, not only on average.

## References

- [High-level design](../../high-level-design.md) — Success Metrics
- [Turn loop](../turn-loop/turn-loop-design.md)
- [Line manager level](../line-manager/line-manager-design.md)
- [Performance review](../performance-review/performance-review-design.md)
