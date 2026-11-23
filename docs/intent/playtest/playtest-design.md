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

- **First-timer.** Plays the way a new player does: mostly sound choices, sometimes a random choice, sometimes letting a moment wait. It is the existing playtests' *mixed* player: on each moment it lets the moment wait one time in ten, picks a random offered choice two times in ten, and otherwise plays as the sound player does, with the same habits. Its randomness comes from its own seeded generator, so a run can be replayed.
- **Sound.** Plays the balance design's sound practice (`docs/intent/balance/balance-design.md`) on every moment, reading only the page: the default habits, with the growth focus on the engineer a *Help someone grow* goal names, or else one whose shown want is growth, or else the least skilled; work, interviews, work intake, check-ins, night pages and final evaluations by the balance design's rules, reading skill, stress, energy and reputation as the page's band words; and each situation's better choice from the balance harness's better-choice table, which the playtest passes to the page, or its first offered choice when that one is not offered. It is reported beside the first-timer as a reference, and nothing is checked against it. Because it plays the strategy the balance harness measures, and sees what the harness's strategies see (the line manager shows them only bands), it receives the same review ratings at the line manager as the harness's sound practice on the same seed; a playtest checks this on the eight seeds, so the two cannot drift apart unnoticed.

Each player plays a fixed set of **eight seeds**, from a new run until the run ends, at whichever level it ends.

### At the senior manager

A run promoted from the line manager goes on at the senior manager, and every scripted player plays it too:

- **The handover.** The player picks the engineer who trusts them most among those who want growth, if one trusts them at least *trusting*; otherwise an outside hire. That is the choice sound practice makes: someone likely to grow into the role, or a manager who already has it.
- **Sound practice** keeps coaching oversight and fortnightly 1:1s, answers each situation from the better-choice table as at the first level, and on each of the level's own moments: coaches a manager through an escalation or a problem a skip-level raised; moves a head between teams when asked; gets disputing managers to agree; gives new work to the team with room; asks for the evidence on an approval; promotes the new manager from the team when replacing one or adding a team; lets a manager on a failed plan go; and settles calibration on the evidence, moving every head to what its team delivered.
- **The first-timer** plays sound practice with its random choices and waits, as at the first level.
- **The naive players** keep their character: the hero steps in on every escalation and decides every dispute; the delegator lets managers handle everything and accepts every proposal; the decliner declines and refuses where it can; the waiter lets half the situations wait.

The playtests check the senior manager's screens as they check the line manager's: the month wording, the managers panel, the calibration scene, the recap, the review and the career summary.

### At the director

A run promoted from the senior manager goes on at the director, and every scripted player plays it too:

- **The handover** follows the senior manager's rule, among the player's managers: the one who trusts them most among those who want growth, if one trusts them at least *trusting*; otherwise an outside hire.
- **Sound practice** keeps the default habits, answers each situation from the better-choice table, and on each of the level's own moments: spreads the quarter's headcount across the groups; funds the first bet on offer on the group with the lowest stress; coaches a senior manager through a group in trouble or a problem the listening tour surfaced; promotes a new senior manager from the group; lets a senior manager on a failed plan go; negotiates with a peer who trusts the player and agrees otherwise; splits a large group, promoting from it, and merges a small one; and tells the quarterly review straight.
- **The first-timer** plays sound practice with its random choices and waits.
- **The naive players** keep their character: the hero takes every decision itself and gives all the heads to the most stretched group; the delegator agrees to every ask and leads with the wins; the decliner refuses, holds heads back and funds no bet; the waiter lets half the situations wait.

The playtests check the director's screens as they check the senior manager's, with the quarter's wording: thirteen weeks a turn, a moment's place as its week of the quarter and day.

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
- The longest run of consecutive moments of the same kind. A career level's moment is of its kind: at the line manager, the kind its title names before the colon ("Check-in: Ada" is a check-in); at the senior manager and the director, the kind its title's fixed wording names, around the names it carries ("… needs help" is an escalation, "… disagree" a dispute, "… is in trouble" a group in trouble). Each situation is a kind of its own.
- How often a situation comes back within 13 weeks of last being shown.
- The share of reaction texts that are distinct, across all the run's reactions.

### Promotion changes the job

The HLD asks whether a promoted player can name one thing they no longer do and one new thing they have to learn. The proxy is what the page offers on either side of the handover, in three parts a player could name:

- **Panels**: the panels a week shows beside the scene, by their headings ("Your team", "Your managers").
- **Habits**: the habits the habits panel offers, by their labels. A habit set per person counts once, with the person's name left out (oversight of each manager counts as "Oversight").
- **Kinds of moment**: the career level's own moments, by their kind as *The shape of a session* defines it. Situations are left out: every level has them, and their titles are each situation's own.

For each promotion a run reaches, the scorecard lists, in each part, what the level left showed and the level reached never did (what the player no longer does) and what the level reached showed and the level left never did (what they now have to learn). Across a player's runs it reports, for each promotion (line manager to senior manager, senior manager to director), each item with the number of runs it appeared in.

This is reported rather than checked. The two levels as designed differ in every part, so a check would only catch the handover breaking, which the senior manager playtest already catches; the proxy's use is to set what the page offered beside what human playtesters name when asked what changed.

### Skill can be learned

The balance harness checks this across hundreds of runs of the turn loop. The scorecard only reports the average review rating of the first-timer and the sound player as played in the browser, as a cross-check that the page does not change what the balance harness measures.

## The Scorecard

Each player's runs produce one scorecard, attached to the playtest's HTML report as JSON and printed as a table: one row per run with its seed and ending, then the measures under the headings above, with the hard checks marked passed or failed. A run's own summary is attached as well, so a failed check can be replayed from its seed.

## The Human Script

`playtest/HUMAN.md` is for a facilitator running a session with one player. It covers:

- **Setup:** the live site in a fresh browser profile, the version from the start screen written down, 30 to 60 minutes, the player thinking aloud, and no coaching.
- **Later sessions** for a player who wants to go on to a promotion they didn't reach: the same run, carried over by the browser's save or an exported one, played to the next promotion and a little beyond, a session for each. It records *Promotion changes the job*; *A promotion in the first session* is recorded from the first session alone.
- **What to watch for and note**, under each metric's heading: when the first promotion comes, moments where the player connects an outcome to an earlier choice or is surprised by one, choices they make without reading, and any time they say it feels like a quiz.
- **Questions to ask afterwards**, under each metric's heading, worded so that they don't lead the player.
- **A record sheet** with the version and one space per heading, so a round of sessions can be compared with the scorecard for the same version.

## The AI Playtester

Between rounds of human sessions, an **AI playtester** plays the game as a newcomer would and answers the human script's questions afterwards. It is a third kind of evidence, between the scripted players, which know the game's rules and measure proxies, and people, whose experience is the thing measured: it reads only what the page shows, so it can show whether a newcomer can work out what to do from the words on screen, where the wording confuses, and what a player names when asked what changed at a promotion. It does not replace human sessions: it reads every word, never tires, and already knows a good deal about management, so it overrates clarity and underrates tedium, and its report says so.

**How it plays.** A Playwright run plays the real page from a new run, as the scripted players do. At each screen that asks for a decision (a moment, the scene before a turn, a handover, headcount, bets), the harness sends Claude the screen as text: the header, the panels, the scene and its choices, each with its id; and the last recap or review the player read. Claude replies, in a fixed structured form the harness checks, with a short think-aloud and an action: a choice the screen offers, letting the moment wait, habit changes before a turn, or a placement of heads or bets. A reply that names something the screen does not offer is sent back once with the reason, and a second bad reply lets the moment wait. The harness makes the other clicks itself (Continue, Start, Finish, closing a recap, acknowledging a review), so the playtester spends its turns on decisions.

**What it remembers.** Each reply carries the playtester's own notebook, a few hundred words it rewrites as it goes: what it has learned, what it suspects, what it would do differently. The notebook and the current screen are all it sees; it never sees the game's state, its code or this design. Each decision is a separate request, so a run's cost grows with its decisions, not with its length squared.

**Personas.** A run plays as one persona: a newly promoted manager, a seasoned engineer managing for the first time, or a sceptic who tries the edges. The persona and the game's framing (fiction, simplified, played from the screen) form a fixed system prompt, cached across the run's requests.

**The interview.** At each promotion and at the end of the run, the playtester answers the human script's questions for the metrics it has reached, from its notebook and its think-aloud, under the same headings, so its report can be set beside human record sheets and the scorecard.

**The report.** A run writes a Markdown report and the run's transcript (every screen sent, every reply, every action taken) to a folder git ignores. The report opens with the version, persona, seed, model, how far the run got, the number of requests and the tokens they used, and the caveat that this is a model, not a person; then the interview, then each level's notable moments: the think-aloud where the playtester was confused, surprised, or chose against the better choice.

**Running it.** It runs only when asked, with `npm run playtest:ai`, never in `npm test`, the playtest suite or CI, so it spends nothing unless someone runs it. It reads the Anthropic credentials already in the environment (an API key, or a signed-in profile) and stops with a message if there are none; no key is ever written to the repository. A run is bounded: by default it plays to the first promotion, and options take it further (to the director, or to the end), choose the persona and seed, and cap the number of decisions. It uses Claude Opus 5.5, with refusal fallbacks enabled.

**What leaves the machine.** Only the text of the game's own screens and the persona prompt are sent. The game itself still makes no network requests; this is test tooling, like the build, and its one new dependency, the Anthropic SDK, is a development dependency the game never loads.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Home | Its own leaf, beside the balance harness | A section of the UI design | It is a measuring instrument with its own measures and thresholds, as the balance harness is; the UI design already describes how the playtests run. |
| Checks | Hard checks on the solid proxies, the rest reported | A threshold on every proxy; report only | The soft proxies' right values are unknown until human sessions; failing on them would fail for reasons players may not care about. Reporting only would let a clear regression through, such as a choice with no reaction. |
| Quits with a warning sign | Reported as a share | A hard check that every quit had a sign; a hard check on a minimum share | The simulation's base chance to quit and its hidden trust make some quits unforeseeable by design, so an every-quit check fails on the game as designed; a minimum share would be a guess that random runs sit close to. |
| Promotion within a session | Reported against a target share of half the first-timer runs | A hard check now | The level's pacing may not reach a promotion within an hour; a check that fails until the pacing changes would hide every other failure of the weekly playtest. |
| Session length | Estimated from words read and decisions made | Wall-clock time of the scripted run; a fixed number of weeks | Scripted players click instantly, so wall-clock time measures the machine. A fixed number of weeks ignores how much each week asks the player to read. |
| First-timer | The existing *mixed* player | A new strategy; the sound player | It already plays as a new player might, mostly well with some mistakes and waiting. The sound player would overstate how quickly a first session gets anywhere. |
| The sound player's rules | The balance design's sound practice, read from the page, with the harness's better-choice table passed to the page | The playtests' own sound player, with weekly 1:1s and its own list of better choices | The scorecard sets the page's results beside the balance harness's, which holds only if both play the same strategy. Weekly 1:1s cost enough energy that the harness promotes sound practice with them in far fewer runs, and a second list of better choices drifts from the table as situations are added. |
| What the players read | Only the page | The save or the run state | The metrics are about what a player experiences; a proxy read from the game's state could hold while the screen hides it. |
| Human script | A Markdown file beside the playtests | In this design; a document outside the repo | A facilitator should not need to read a design doc to run a session, and the script should change with the game it tests. |
| Reaching a promotion with people | Later sessions on the same run, one for each promotion a player goes on to | A starting point at the senior manager for playtesters; asking only players promoted in one session | The metric is about the change itself, so the player has to have done the first job; a run started at the second level has nothing to compare. Most first runs end their first hour unpromoted, so asking only those promoted would leave the metric with few answers. |
| An AI playtester | A model plays the real page from its text, decision by decision, keeps its own notebook, and answers the human script's questions | A model reviewing transcripts of the scripted players' runs; a person-free replacement for human sessions | Only a player that chooses can show whether a newcomer finds the better choices from the words on screen; a reviewer of another player's choices cannot. A model is not a person, so it complements human sessions rather than replacing them. |
| When the AI playtester runs | Only on request, with credentials from the environment | In CI or the weekly playtest run | Each run costs money and gives different answers each time; it is a tool to reach for, not a check to keep green. |
| How it remembers | A notebook it rewrites each decision, sent with the screen | The whole run's history in one growing conversation | A run is hundreds of decisions; a notebook keeps every request small and its cost flat, and makes what it learned readable in the report. |
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
