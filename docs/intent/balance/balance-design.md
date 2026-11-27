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
| **Delegator** | Defaults | Gives them to the least stressed engineer offered (design reviews piling up, each to whoever can handle it), and lets them wait when none is | Leaves them to the engineer on call | Asks the least stressed engineer | Takes it on | Picks the first offered choice | Picks the first offered choice | Picks the first offered choice (lets them go) |
| **Contrarian** | Defaults | Pushes back | Leaves them to the engineer on call | Skips | Declines | Picks the last offered choice | Picks the last offered choice | Picks the last offered choice (one more quarter) |
| **Sound practice** | Defaults, with the growth focus on the engineer a *Help someone grow* goal names, or else one whose known want is growth (or, before any is known, the least skilled); routine approvals left with itself, since handing them to the strongest engineer piles routine onto the person doing the most work | Fixes the debt a design review touches first when the review's text calls the project's tech debt *elevated* or worse; otherwise gives the work to the engineer offered whose skill band reaches its difficulty band and whose stress band is at most *busy*; with none, does it itself while its own energy band is at least *okay*, and otherwise offers a customer a smaller change, or gives the work as a stretch to an offered engineer whose stress band is at most *busy*, or pushes back | Backs up the engineer on call (only pages beyond their skill reach it) while its own energy band is at least *okay*, and otherwise rolls the change back | Interviews itself while its energy band is at least *okay*, and otherwise asks the least stressed engineer | Takes it on while the team has fewer than two projects and its energy band is at least *okay*, and otherwise declines | Cuts scope when the project is behind or overdue and its reputation band is at least *fair*; re-plans a project that is only at risk while its energy band is at least *okay*; otherwise pushes on | Picks the situation's better choice from the table below | Lets them go: someone still delivering poorly at the end of an improvement plan weighs on the team |

A sixth strategy, **sound practice with other habits**, plays exactly as sound practice but holds 1:1s every week and runs ceremonies light. It is a measurement, not a check: reported beside the others, it shows how much the habits themselves matter, which no check enforces.

Idle, Hero, Delegator and Contrarian are the **naive** strategies: each applies one rule regardless of context. Picking the first or last offered choice stands in for "always agree" and "always push back", since a situation's choices come in no particular order.

Strategies are measuring instruments: their rules live in this document, not in specs, so a strategy can be refined without a spec change. A strategy only ever picks a choice the moment offers, so the turn loop never refuses a command; a refusal is a bug in the strategy and fails the harness.

## Better Choices

Sound practice needs to know which choice in each situation is the better one. The harness keeps a table mapping each situation id to its better choice's id. Every situation in the content, at every career level, must have an entry naming a choice the situation has, except onboarding situations (ids starting `onboarding-`), which have no better choice; a missing or wrong entry fails the harness, so adding a situation means deciding its better choice. Each such situation must also have a wait debrief, the lesson the review shows when the player let it wait, so a skipped situation still teaches something; a missing one fails the harness. When the table's choice is not offered (its `availableIf` does not hold), sound practice picks the first offered choice.

The naive strategies' first and last picks are honest only if choice order says nothing about which choice is better, and the same holds for a player, who would otherwise learn to pick a position rather than read the scene. Authors place the better choice where the scene reads best, and the harness holds the spread: it fails if, at any career level, more than half of the table's situations for that level list their better choice first, or more than half list it last, in the order the situation file gives its choices.

## Measures and Checks

For each strategy, the harness plays a set of seeds for up to 78 weeks (six reviews) and, reading the run itself (which strategies never see), records per run: the review ratings, whether the player was promoted (at the line manager, the highest level so far, a promotion completes the run), burned out or managed out, and how many engineers rated meets or above quit. Across runs it reports:

- the **average review score**, with ratings counted `below` 0 to `outstanding` 4. Every run is scored over its six review slots, so that ending early is scored as what it was: a slot missed after burning out or being managed out counts 0, and a slot missed after a promotion counts as the last rating;
- the **promotion share**, **burnout share** and **managed-out share**;
- the average number of **regretted quits**.
- the **quiet-week share**: of the line manager weeks played, the share in which the week had no moment at all, neither a level moment nor a situation.

The checks, with thresholds from the harness's tuning:

1. Sound practice's average review score exceeds every naive strategy's by at least the score margin.
2. Sound practice's promotion share is at least the minimum promotion share.
3. No naive strategy's promotion share exceeds the maximum naive promotion share.
4. Sound practice's burnout share is at most the maximum sound burnout share.
5. Sound practice's quiet-week share is at most the maximum quiet-week share. A week is a short run of moments (HLD); a well-run team should change the problems the player faces, not empty the week, so the check fails when content only reaches a team in trouble.

The test suite runs 40 seeds per strategy and must stay within about 25 seconds; a report command runs more seeds and prints the table for tuning. Forty seeds keeps one unlucky seed from moving a share by more than a few points, so a strategy whose true share sits near a threshold does not pass or fail by chance. A share can still drift across a threshold by less than forty seeds resolve, so the weekly playtest run also runs the checks at 200 seeds, and such drift shows within a week rather than when someone next prints the table.

## The Senior Manager

The senior manager level is measured the same way, on its own. Each run starts the level directly: a line manager run from the seed is handed over to an outside hire, with the same handover for every strategy, so strategies differ only in how they play the level and not in whom they promote. The run then plays through the turn loop with the real level, review and content for up to 36 months (six reviews, the whole level), and a promotion completes it.

A strategy sees what the player sees (the senior manager's view: managers, teams as their managers report them, the month's moments and their choices) and acts through the same commands.

| Strategy | Habits | Escalations and surfaced problems | Staffing, disputes, new work | Approvals | Calibration | Replacing managers, final evaluations, restructuring | Stay conversations | Situations |
|---|---|---|---|---|---|---|---|---|
| **Idle** | Defaults | Lets them wait | Lets them wait | Lets them wait | Lets it wait (proposals stand, and the room trims to the curve) | Lets them wait | Lets them wait | Lets them wait |
| **Hero** | Close oversight of every manager | Steps in | Decides disputes; takes on new work spread across the teams; declines a move | Approves | Accepts every proposal; over the curve, argues for an exception | Hires from outside; gives one more period | Gives them what they want | Picks the first offered choice |
| **Delegator** | Hands-off oversight of every manager | Lets the manager handle it | Lets disputes run; gives new work to the team with room; moves a head | Approves | Accepts every proposal; over the curve, lets the room trim | Hires from outside; gives one more period | Wishes them well | Picks the first offered choice |
| **Contrarian** | Defaults | Lets the manager handle it | Declines; decides disputes | Refuses | Marks every team down a rating from its proposal; over the curve, argues for an exception | Hires from outside; lets a manager go | Wishes them well | Picks the last offered choice |
| **Sound practice** | Defaults (coaching oversight, fortnightly 1:1s) | Coaches | Moves a head; gets managers to agree; gives new work to the team with room | Asks for the evidence | Settles on the evidence: every head at what its team delivered; over the curve, lets the room trim | Promotes from the team; lets a manager on a failed plan go | Gives them what they want | Picks the situation's better choice from the better-choice table |

A sixth strategy, **sound practice with skip-levels**, plays as sound practice with monthly skip-level listening. Like sound practice with other habits at the line manager, it is reported and checked against nothing.

The measures are the line manager's, over six review slots; regretted attrition counts heads rated meets or above lost from the group's teams. The checks are the line manager's four, against thresholds in the senior manager's own harness tuning, and a fifth, since a sound player managed out is the senior manager's particular way of being unfair:

5. Sound practice's managed-out share is at most the maximum sound managed-out share.

The test suite runs 40 seeds per senior strategy within the same budget; the report command prints the senior table beside the line manager's.

## The Director

The director level is measured the same way, on its own. Each run starts the level directly: a line manager run from the seed is handed over to an outside hire at the senior manager, and that at once to an outside hire at the director, the same for every strategy. The run then plays through the turn loop with the real levels, review and content for up to 12 quarters (six reviews, the whole level), and a promotion completes it.

A strategy sees what the player sees (the director's view: senior managers, groups as last surveyed, the executive and peers, the bets, the quarter's moments and their choices) and acts through the same commands.

| Strategy | Habits | Headcount | Bets | Groups in trouble, surfaced problems | Peers' asks | Quarterly review | New senior managers, final evaluations, org design | Stay conversations | Situations |
|---|---|---|---|---|---|---|---|---|---|
| **Idle** | Defaults | Lets it wait (held back) | Lets them wait (none funded) | Lets them wait | Lets them wait | Lets it wait (told straight) | Lets them wait | Lets them wait | Lets them wait |
| **Hero** | Time upward | All to the most stretched group | Funds two, on the first groups | Takes the decision | Agrees | Promises more | Hires from outside; gives one more period; leaves the shape | Gives them what they want | Picks the first offered choice |
| **Delegator** | Time with the organization, fortnightly staff meetings | Spreads them | Funds none | Coaches | Agrees | Leads with the wins | Promotes from the group; gives one more period; leaves the shape | Wishes them well | Picks the first offered choice |
| **Contrarian** | Defaults | Holds them back | Funds none | Replaces the senior manager | Refuses | Leads with the wins | Hires from outside; lets them go; leaves the shape | Wishes them well | Picks the last offered choice |
| **Sound practice** | Defaults (balanced time, weekly staff meetings) | Spreads them | Funds one, the offer with the least work per week to its deadline, on the group with the lowest stress | Coaches | Negotiates with a peer who trusts the player, agrees otherwise | Tells it straight | Promotes from the group; lets a senior manager on a failed plan go; splits a large group and merges a small one | Gives them what they want | Picks the situation's better choice from the better-choice table |

A sixth strategy, **sound practice with a listening tour**, plays as sound practice with the quarterly listening tour, and is reported and checked against nothing.

The measures are the line manager's, over six review slots; regretted attrition counts heads rated meets or above lost from the organization's groups. The checks are the senior manager's five, against thresholds in the director's own harness tuning.

The test suite runs 40 seeds per director strategy within the same budget; the report command prints the director table beside the other two.

## The VP

The VP level is measured the same way, on its own. Each run starts the level directly: a line manager run from the seed is handed over to an outside hire at each of the three promotions, the same for every strategy, and plays through the turn loop with the real levels, review and content for up to 12 quarters (six reviews, the whole level). A promotion completes the run.

A strategy sees what the player sees (the VP's view: directors, divisions as last surveyed, the leadership team, the year's plan, the quarter's moments and their choices) and acts through the same commands.

| Strategy | Habits | Annual planning | Company priority | Leadership disputes | Directors at odds | Cuts | All-hands | New directors, final evaluations | Stay conversations | Situations |
|---|---|---|---|---|---|---|---|---|---|---|
| **Idle** | Defaults | Lets it wait (asks for the plan) | Lets it wait (spread) | Lets them wait | Lets them wait | Lets them wait (across) | Lets it wait (short) | Lets them wait | Lets them wait | Lets them wait |
| **Hero** | The function first; reviews plans closely | Asks for more | Puts the first division on it | Sides with the function | Decides it | Cuts across | Celebrates | Hires from outside; gives one more period | Gives them what they want | Picks the first offered choice |
| **Delegator** | Defaults | Asks for the plan | Spreads it | Settles it for the company | Has them settle it together | Cuts across | Keeps it short | Promotes from the division; gives one more period | Wishes them well | Picks the first offered choice |
| **Contrarian** | The function first | Asks for more | Pushes back | Sides with the function | Leaves it | Cuts in waves | Celebrates | Hires from outside; lets them go | Wishes them well | Picks the last offered choice |
| **Sound practice** | The leadership team first; sets direction and steps back | Asks for the plan | Puts the calmest division on it | Brokers a trade with a peer who trusts the player, settles it for the company otherwise | Has them settle it together | Cuts once | Tells them what is hard | Promotes from the division; lets a director on a failed plan go | Gives them what they want | Picks the situation's better choice from the better-choice table |

A sixth strategy, **sound practice with close review**, plays as sound practice with plans reviewed closely, and is reported and checked against nothing.

The measures and checks are the director's, against thresholds in the VP's own harness tuning. The test suite runs 40 seeds per VP strategy; the report command prints the VP table beside the other three.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Where better choices are declared | A table in the harness, with a check that every situation has an entry | A field on the choice in the situation file | Keeps test-only knowledge out of the game's data and needs no change to the content format, while still forcing every new situation to name its better choice. |
| What strategies see | The player's view and commands only | Reading the simulation state | A strategy that peeks at hidden values proves nothing about what a player can learn. |
| Measuring habits | A variant of sound practice with other habits, reported but not checked | No habit variant; a check that the habits change the result | Without a variant nothing shows whether habits matter at all. A check would need a threshold no measurement supports yet; reporting first lets tuning decide whether one is worth adding. |
| How a strategy plays a week | Habit changes at the start of the week, then one decision per moment as it becomes current | One list of commands for the whole week | The turn loop plays moments in order, and a later moment can depend on an earlier choice; deciding each as it comes is what the player does. |
| When balance is checked | In the test suite with 40 seeds per strategy, plus a report command with more, which the weekly playtest run also runs at 200 seeds | Only in the report command; 200 seeds on every commit | Every commit is checked, so content or tuning changes cannot quietly break balance; 200 seeds on every commit would slow every push for a drift a weekly run catches. |
| Context-blind choices | First or last offered choice | A hand-labelled "agreeable" choice per situation | Choice order carries no meaning, so first and last are honest stand-ins for a fixed habit, with no extra labelling. |
| Keeping choice order meaningless | Authors vary where the better choice sits, and a check fails if more than half of situations put it first, or more than half put it last | The situation engine shuffling choices with its seeded generator when it presents them | Shuffling makes position unlearnable but can put choices in an order that reads badly (an "ignore it" before the options it ignores); an authored order with a spread check keeps the reading order in the writer's hands. |
| Where a senior run starts | A line manager run from the seed, handed over at once to an outside hire, the same for every strategy | Play each strategy's own line manager run to a promotion first; let each strategy choose the handover | Most line manager runs are not promoted, so playing up to one would measure few senior runs and mix the two levels' balance; a shared handover keeps the senior measures about how each strategy plays the senior level. |
| Managed out as a check | A fifth check at the senior manager: sound practice's managed-out share stays low | The line manager's four checks only | Playtests showed sound practice managed out at the senior manager while every other check could pass; the check holds the level to the HLD's learnable-over-ambiguous tenet. |
| Where a director run starts | A line manager run from the seed, handed over at once at both promotions to outside hires, the same for every strategy | Play each strategy up through both earlier levels | As at the senior manager: few runs reach the director by play, and a shared start keeps its measures about how each strategy plays this level. |
| Where a VP run starts | A line manager run from the seed, handed over at once at all three promotions to outside hires, the same for every strategy | Play each strategy up through the earlier levels | As at the director: a shared start keeps the VP's measures about how each strategy plays this level. |
| Sound practice's habits at the VP | The leadership team first, directors given room | The function first, as the default | The VP level's lesson is which team a leader belongs to first; sound practice plays the answer the level teaches. |
| Choice order across levels | The spread check holds at each career level on its own | One check over every situation | A player meets one level's situations at a time; a spread that holds only across all of them could leave one level's better choices mostly first. |

## Open Questions & Future Decisions

### Deferred
1. Whether to check that sound practice wins on most individual seeds, not only on average.

## References

- [High-level design](../../high-level-design.md) — Success Metrics
- [Turn loop](../turn-loop/turn-loop-design.md)
- [Line manager level](../line-manager/line-manager-design.md)
- [Performance review](../performance-review/performance-review-design.md)
