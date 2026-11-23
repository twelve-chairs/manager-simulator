---
parent: high-level-design
prefix: PLAY
---

# Success-Metric Playtests

## Context and Design Philosophy

The HLD's success metrics are about playtesters: whether they reach a promotion in their first session, whether they can trace a bad outcome to an earlier decision, whether a session feels like playing a game. Only people can answer those questions, so the project runs **human playtest sessions** from a written script (`playtest/HUMAN.md`). Human sessions are slow and happen rarely, so **scripted browser players** also measure a proxy for each metric on every playtest run: something visible on screen that has to be true for the metric to be met. A proxy that holds does not prove a metric is met; a proxy that fails shows that it cannot be met. Between human rounds the scripted players catch regressions, and in each round they tell the facilitator what to watch for.

This is test tooling: nothing in it ships in the game. It extends the existing playtests (see the UI design's *Build*): the same harness, the same fixed seeds, the same `npm run playtest`, and it can be pointed at the live site in the same way.

Four principles shape it:

- **The player's view only.** A scripted player acts only through the page's own controls and measures only what the page shows. Like the existing playtests, it seeds a run by writing a save with no commands, but it never reads the save or any game state after that. A proxy the player could not see would measure the game's internals, not the player's experience.
- **One heading per metric.** The automated scorecard and the human script use the same headings, one per HLD success metric, so a round of human sessions can be set beside the scorecard for the same version.
- **Hard checks only where the proxy is solid.** A proxy fails the playtest only when it follows directly from the metric and the game as designed always meets it. The softer proxies are reported, with no threshold, until human sessions show what their values should be.
- **Estimated time, not wall-clock time.** Scripted players click instantly, so session length is estimated from what a person would have to read and decide. The estimate is a model, and its constants are kept in one place.

## The Players

- **First-timer.** Plays the way a new player does: mostly sound choices, sometimes a random choice, sometimes letting a moment wait. It is the existing playtests' *mixed* player: on each moment it lets the moment wait one time in ten, picks a random offered choice two times in ten, and otherwise plays sound practice, with 1:1s every week. Its randomness comes from its own seeded generator, so a run can be replayed.
- **Sound.** The existing playtests' *sound* player, which plays sound practice on every moment. It is reported beside the first-timer as a reference, and nothing is checked against it.

Each player plays a fixed set of **eight seeds**, from a new run until the run ends, at whichever level it ends.

### At the senior manager

A run promoted from the line manager goes on at the senior manager, and every scripted player plays it too:

- **The handover.** The player picks the engineer who trusts them most among those who want growth, if one trusts them at least *trusting*; otherwise an outside hire. That is the choice sound practice makes: someone likely to grow into the role, or a manager who already has it.
- **Sound practice** keeps coaching oversight and fortnightly 1:1s, and on each moment: coaches a manager through an escalation or a problem a skip-level raised; moves a head between teams when asked; gets disputing managers to agree; gives new work to the team with room; asks for the evidence on an approval; promotes the new manager from the team when replacing one or adding a team; lets a manager on a failed plan go; and settles calibration on the evidence, moving every head to what its team delivered.
- **The first-timer** plays sound practice with its random choices and waits, as at the first level.
- **The naive players** keep their character: the hero steps in on every escalation and decides every dispute; the delegator lets managers handle everything and accepts every proposal; the decliner declines and refuses where it can; the waiter lets half the situations wait.

The playtests check the senior manager's screens as they check the line manager's: the month wording, the managers panel, the calibration scene, the recap, the review and the career summary.

## The Session Clock

The **estimated session time** at any point of a run is the sum of:

- **Reading.** The words of each scene, review and ended screen the first time it is shown, at **230 words a minute**. The team panel, the header and the habits panel are not counted, nor are the habit controls Before Monday shows: a player glances at them rather than reading them each time. Nor is anything inside a closed disclosure but its summary, since the scripted players never open one.
- **Deciding.** **4 seconds** for each moment answered or let wait.
- **Moving on.** **1 second** for every other click (Continue, Start week, Finish the week, acknowledging a review).

The three constants live together in the playtest code.

## Metrics and Proxies

### A promotion in the first session

The HLD sets a session at 20 to 60 minutes. For each run, the scorecard records the estimated session time at the first review that promotes the player, and records "not promoted" for a run that ends without one. It reports the share of first-timer runs promoted within 60 estimated minutes, the **target share**, which is half: the HLD's metric speaks of playtesters as a group, and some first sessions go badly in any game. The target share is kept with the clock's constants.

This is reported rather than checked. A promotion needs two strong reviews in a row from the third review on, so the earliest promotion is at week 39, and the share a first-timer reaches within an hour depends on pacing the scorecard is there to measure. It becomes a hard check once measured runs show the pacing meets the target share.

### Bad outcomes can be traced to earlier decisions

The **bad events** a player sees are: an engineer quitting (their card leaves the team panel, and the ended screen's career summary lists them as quit rather than let go or moved), a review rated *partial* or *below*, a project shown as overdue, and the burnout warning. The **worse half** of a person's bands is *struggling* or *flat* for motivation and *strained* or *overwhelmed* for stress; the middle band is in neither half. For each bad event, the scorecard records whether a **warning sign** showed on screen in the four weeks before it, or in the weeks the run has had when it is younger than that:

- A quit: in the last four weeks the person's card was on screen, it showed their motivation or stress in the worse half of its bands. A memory note does not count: almost everyone has one, so it would warn of nothing.
- A low rating: a project shown as behind or overdue, or an engineer's motivation or stress in the worse half of its bands. The scorecard's measures show only on the review itself, and goals show progress rather than a verdict, so neither can warn beforehand.
- An overdue project: the project shown as behind, or with its risk *elevated*, *high* or *severe*.
- The burnout warning: the player's energy shown as *tired* or *running on fumes*.

All four kinds are reported as the share of events that had a warning sign. Quits are reported rather than checked because the simulation lets anyone quit: each engineer has a small chance to leave every week even with no risk factor, and low trust, which no card shows, raises it (the simulation core's *Departure*). So a share of quits come with no sign by design, and whether every quit should be foreshadowed is a question for the game's design, not for this instrument.

### Choices feel consequential

**Hard check:** every answered moment is followed at once by its reaction, whose text is not empty. This is the HLD's "every choice gets a reaction at once", stated directly.

Reported: the share of answered moments that show at least one chip (a band that moved, a person who left or joined, or a new memory note), and the share of memory notes that a choice added and that are still on the person's card two weeks later, which is how the game lets people bring past choices up.

### It feels like a game, not a test

No proxy can tell a game from a test, so nothing here is checked. Reported, as the shape a session has:

- Decisions per week: the mean, and the fewest and most in any week.
- The share of weeks with no decision at all.
- The longest run of consecutive moments of the same kind. A career level's moment is of its kind: at the line manager, the kind its title names before the colon ("Check-in: Ada" is a check-in); at the senior manager, the kind its title's fixed wording names, around the names it carries ("… needs help" is an escalation, "… disagree" a dispute). Each situation is a kind of its own.
- How often a situation comes back within 13 weeks of last being shown.
- The share of reaction texts that are distinct, across all the run's reactions.

### Promotion changes the job

The HLD asks whether a promoted player can name one thing they no longer do and one new thing they have to learn. The proxy is what the page offers on either side of the handover, in three parts a player could name:

- **Panels**: the panels a week shows beside the scene, by their headings ("Your team", "Your managers").
- **Habits**: the habits the habits panel offers, by their labels. A habit set per person counts once, with the person's name left out (oversight of each manager counts as "Oversight").
- **Kinds of moment**: the career level's own moments, by their kind as *The shape of a session* defines it. Situations are left out: both levels have them, and their titles are each situation's own.

For each run promoted into a second career level, the scorecard lists, in each part, what the first level showed and the second never did (what the player no longer does) and what the second showed and the first never did (what they now have to learn). Across a player's promoted runs it reports each item with the number of runs it appeared in.

This is reported rather than checked. The two levels as designed differ in every part, so a check would only catch the handover breaking, which the senior manager playtest already catches; the proxy's use is to set what the page offered beside what human playtesters name when asked what changed.

### Skill can be learned

The balance harness checks this across hundreds of runs of the turn loop. The scorecard only reports the average review rating of the first-timer and the sound player as played in the browser, as a cross-check that the page does not change what the balance harness measures.

## The Scorecard

Each player's runs produce one scorecard, attached to the playtest's HTML report as JSON and printed as a table: one row per run with its seed and ending, then the measures under the headings above, with the hard checks marked passed or failed. A run's own summary is attached as well, so a failed check can be replayed from its seed.

## The Human Script

`playtest/HUMAN.md` is for a facilitator running a session with one player. It covers:

- **Setup:** the live site in a fresh browser profile, the version from the start screen written down, 30 to 60 minutes, the player thinking aloud, and no coaching.
- **What to watch for and note**, under each metric's heading: when the first promotion comes, moments where the player connects an outcome to an earlier choice or is surprised by one, choices they make without reading, and any time they say it feels like a quiz.
- **Questions to ask afterwards**, under each metric's heading, worded so that they don't lead the player.
- **A record sheet** with the version and one space per heading, so a round of sessions can be compared with the scorecard for the same version.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Home | Its own leaf, beside the balance harness | A section of the UI design | It is a measuring instrument with its own measures and thresholds, as the balance harness is; the UI design already describes how the playtests run. |
| Checks | Hard checks on the solid proxies, the rest reported | A threshold on every proxy; report only | The soft proxies' right values are unknown until human sessions; failing on them would fail for reasons players may not care about. Reporting only would let a clear regression through, such as a choice with no reaction. |
| Quits with a warning sign | Reported as a share | A hard check that every quit had a sign; a hard check on a minimum share | The simulation's base chance to quit and its hidden trust make some quits unforeseeable by design, so an every-quit check fails on the game as designed; a minimum share would be a guess that random runs sit close to. |
| Promotion within a session | Reported against a target share of half the first-timer runs | A hard check now | The level's pacing may not reach a promotion within an hour; a check that fails until the pacing changes would hide every other failure of the weekly playtest. |
| Session length | Estimated from words read and decisions made | Wall-clock time of the scripted run; a fixed number of weeks | Scripted players click instantly, so wall-clock time measures the machine. A fixed number of weeks ignores how much each week asks the player to read. |
| First-timer | The existing *mixed* player | A new strategy; the sound player | It already plays as a new player might, mostly well with some mistakes and waiting. The sound player would overstate how quickly a first session gets anywhere. |
| What the players read | Only the page | The save or the run state | The metrics are about what a player experiences; a proxy read from the game's state could hold while the screen hides it. |
| Human script | A Markdown file beside the playtests | In this design; a document outside the repo | A facilitator should not need to read a design doc to run a session, and the script should change with the game it tests. |
| What counts as the job changing | Panels, habits and the level's own kinds of moment, each compared across the handover | Every heading on the page; moment kinds read from a mark the page adds for the playtests | They are what a player would name. Every heading would bury them under names of people and projects; a mark added for the playtests would be read by no player, and the title wording is what a player sees. |

## Open Questions & Future Decisions

### Deferred
1. Making *A promotion in the first session* a hard check, once the line manager level's pacing can meet it.
2. Whether every quit should be foreshadowed on screen (a sign of restlessness, visible trust, or no base chance to quit), and then whether quits with a warning become a hard check.
3. Thresholds for the reported proxies, set from the first rounds of human sessions.
4. Calibrating the session clock's constants against timed human sessions.

## References

- HLD: *Success Metrics*
- UI design: *Build* (the playtests)
- Balance design: the strategies the scripted players follow
