---
parent: high-level-design
prefix: BAL
---

# Balance Harness

## Context and Design Philosophy

The HLD sets a success metric that code can check: across seeded runs, choices that follow sound practice outperform naive ones, and no context-blind strategy reliably wins. The balance harness checks it. Scripted strategies play many seeded runs of a career level through the real turn loop, performance review and content, and the harness compares how each strategy fares. The comparison runs as part of the test suite, so a change to tuning, content or rules that makes poor management pay, or good management stop paying, fails the build.

It is test tooling: nothing in it ships in the game.

Three principles shape it:

- **Strategies play as a player would.** A strategy sees only what the player sees (the level's view, the current moment, and review results) and acts only through turn loop commands. It never reads hidden values, so a strategy that wins does so by playing well, not by peeking.
- **Real game, real content.** Runs use the compiled situation content, the real career level, the real performance review and the real tuning. The harness adds strategies and measurement, nothing else.
- **Relations, not magic numbers.** The checks compare strategies with each other (sound practice beats every naive strategy) and against a few thresholds. The thresholds are tuning values set from measurement, kept in one place, and changed deliberately: when a check fails, the first remedy is the game's own tuning or content, and loosening a threshold to make a check pass needs its own justification in the commit that does it.

## Strategies

A **strategy** plays a week the way the player does, moment by moment. At the start of each week it may change habits. Then, for each current moment in turn, it picks one of the offered choices or lets the moment wait, seeing what the player would see at that point: the level's view, the moment's day, time, text and choices, and for a line manager moment its difficulty. When no moment is left, the harness ends the week and acknowledges any review, until the run ends or reaches the weeks played.

| Strategy | Habits | Work moments | Night pages | Interviews | Work intake | Check-ins | Situations | Final evaluations |
|---|---|---|---|---|---|---|---|---|
| **Idle** | Defaults | Lets them wait | Lets them wait | Lets them wait | Lets it wait | Lets them wait | Lets them wait | Lets them wait |
| **Hero** | Takes night pages and signs approvals itself | Does them itself | Takes over | Interviews itself | Takes it on | Picks the first offered choice | Picks the first offered choice | Picks the first offered choice (lets them go) |
| **Delegator** | Defaults | Gives them to the least stressed engineer offered, and lets them wait when none is | Leaves them to the engineer on call | Asks the least stressed engineer | Takes it on | Picks the first offered choice | Picks the first offered choice | Picks the first offered choice (lets them go) |
| **Contrarian** | Defaults | Pushes back | Leaves them to the engineer on call | Skips | Declines | Picks the last offered choice | Picks the last offered choice | Picks the last offered choice (one more quarter) |
| **Sound practice** | Defaults, with the growth focus on the engineer a *Help someone grow* goal names, or else one whose known want is growth (or, before any is known, the least skilled); routine approvals left with itself, since handing them to the strongest engineer piles routine onto the person doing the most work | Gives the work to the engineer offered whose skill band reaches its difficulty band and whose stress band is at most *busy*; with none, does it itself while its own energy band is at least *okay*, and otherwise gives it as a stretch to an offered engineer whose stress band is at most *busy*, or pushes back | Leaves the page to the engineer on call when their skill band reaches the page's difficulty band, and otherwise backs them up | Interviews itself while its energy band is at least *okay*, and otherwise asks the least stressed engineer | Takes it on while the team has fewer than two projects and its energy band is at least *okay*, and otherwise declines | Cuts scope when the project is behind or overdue and its reputation band is at least *fair*; re-plans a project that is only at risk while its energy band is at least *okay*; otherwise pushes on | Picks the situation's better choice from the table below | Lets them go: someone still delivering poorly at the end of an improvement plan weighs on the team |

A sixth strategy, **sound practice with other habits**, plays exactly as sound practice but holds 1:1s every week and runs ceremonies light. It is a measurement, not a check: reported beside the others, it shows how much the habits themselves matter, which no check enforces.

Idle, Hero, Delegator and Contrarian are the **naive** strategies: each applies one rule regardless of context. Picking the first or last offered choice stands in for "always agree" and "always push back", since a situation's choices come in no particular order.

Strategies are measuring instruments: their rules live in this document, not in specs, so a strategy can be refined without a spec change. A strategy only ever picks a choice the moment offers, so the turn loop never refuses a command; a refusal is a bug in the strategy and fails the harness.

## Better Choices

Sound practice needs to know which choice in each situation is the better one. The harness keeps a table mapping each situation id to its better choice's id. Every line manager situation in the content must have an entry naming a choice the situation has, except onboarding situations (ids starting `onboarding-`), which have no better choice; a missing or wrong entry fails the harness, so adding a situation means deciding its better choice. When the table's choice is not offered (its `availableIf` does not hold), sound practice picks the first offered choice.

The naive strategies' first and last picks are honest only if choice order says nothing about which choice is better, and the same holds for a player, who would otherwise learn to pick a position rather than read the scene. Authors place the better choice where the scene reads best, and the harness holds the spread: it fails if more than half of the table's situations list their better choice first, or more than half list it last, in the order the situation file gives its choices.

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
| Measuring habits | A variant of sound practice with other habits, reported but not checked | No habit variant; a check that the habits change the result | Without a variant nothing shows whether habits matter at all. A check would need a threshold no measurement supports yet; reporting first lets tuning decide whether one is worth adding. |
| How a strategy plays a week | Habit changes at the start of the week, then one decision per moment as it becomes current | One list of commands for the whole week | The turn loop plays moments in order, and a later moment can depend on an earlier choice; deciding each as it comes is what the player does. |
| When balance is checked | In the test suite with 20 seeds per strategy, plus a report command with more | Only in the report command | Every commit is checked, so content or tuning changes cannot quietly break balance. |
| Context-blind choices | First or last offered choice | A hand-labelled "agreeable" choice per situation | Choice order carries no meaning, so first and last are honest stand-ins for a fixed habit, with no extra labelling. |
| Keeping choice order meaningless | Authors vary where the better choice sits, and a check fails if more than half of situations put it first, or more than half put it last | The situation engine shuffling choices with its seeded generator when it presents them | Shuffling makes position unlearnable but can put choices in an order that reads badly (an "ignore it" before the options it ignores); an authored order with a spread check keeps the reading order in the writer's hands. |

## Open Questions & Future Decisions

### Deferred
1. Strategies for higher career levels, written when those levels exist.
2. Whether to check that sound practice wins on most individual seeds, not only on average.

## References

- [High-level design](../../high-level-design.md) — Success Metrics
- [Turn loop](../turn-loop/turn-loop-design.md)
- [Line manager level](../line-manager/line-manager-design.md)
- [Performance review](../performance-review/performance-review-design.md)
