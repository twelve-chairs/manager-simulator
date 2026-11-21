---
parent: high-level-design
prefix: LOOP
---

# Turn Loop

## Context and Design Philosophy

The turn loop runs a career from its first week to its end. It holds the whole run as one value, accepts the player's inputs as commands, and calls the other components in the right order: the career level to begin and end each week and to apply choices in its moments, the situation engine to present and resolve situations, the simulation core to advance time, and the performance review when one is due. It decides nothing about management itself; every rule it applies belongs to another component.

A week plays as one **sequence of moments**: the career level's moments (a design review, a night page, an interview) and the week's story situations, together, in order through the week. The loop owns that sequence. It merges what the level and the situation engine produce, sorts it by day and time, and plays it one moment at a time.

Four principles shape it:

- **One run, one value.** The run state holds everything a run needs to continue: the simulation, situation engine and level states, the current phase, and the commands applied so far. It is plain data, so saving a run is writing it and loading is reading it back.
- **Every input is a command.** The player changes the run only by commands, applied one at a time by one function that returns the new run or an error. Because every component is deterministic, a run is reproducible from its seed, its content and its list of commands, which makes bugs reproducible and replays possible.
- **The phase decides what is allowed.** Each command is valid only in certain phases. A command the phase does not allow is an error, and the run is unchanged; the UI cannot put the run into an inconsistent state.
- **The week is played in order.** Only the current moment can be answered or let wait. A later moment, a callback to Monday on Thursday, then always follows what the player did earlier in the week, and the week reads as a story rather than a form filled in any order.

## The Run

| Part | Meaning |
|---|---|
| seed | The seed the run started from |
| level id | The active career level |
| simulation state | The simulation core's state |
| engine state | The situation engine's state |
| level state | The active career level's state |
| phase | `week`, `review` or `ended` |
| week | The week's moments in the order they play: for each, whether it is the level's or a situation, its id, its day and time, its title (kept so the recap can name it after the level has moved on), and what happened to it: open, answered (with its reaction or aftermath line), waited, or expired |
| presented | The situations presented this week |
| last week | The recap of the week just ended: the level's recap and what happened to each of the week's moments; empty until the first week ends |
| review | In the `review` phase, the review's result waiting to be acknowledged: rating, outcome, each measure with its verdict, the score, and the quarter's debrief records |
| ending | In the `ended` phase, why the run ended: `burnout`, `managedOut` or `completed` |
| commands | Every command applied successfully, in order; a command that failed changed nothing and is not recorded |

## Phases and Commands

**Week.** The week is open. The level has begun it (for the line manager, work has arrived and its moments are made) and the situation engine has presented this week's situations. The **current moment** is the first in the week's sequence that is still open. The player may:

- **plan**: a level-specific command that applies at once to the level (for the line manager, a habit change), passed to the level; allowed at any point in the week;
- **answer**: pick a choice for the current moment. A level moment's choice goes to the level, a situation's to the situation engine, and either applies at once against the current state. Answering any other moment is an error;
- **let it wait**: move past the current moment without answering it;
- **end week**: close the week (see *A Week*), allowed at any point. Moments not yet reached are let wait.

An earlier moment can leave a later level moment impossible to answer (the engineer on call for Thursday's page left on Tuesday). After every answer, the loop records as **expired** each level moment the level no longer reports open, as the situation engine expires a situation whose people are gone.

A moment let wait is not an error. The level closes its own unanswered moments at the week's end, and the situation engine closes unanswered situations as ignored at its next selection.

**Review.** A review has been conducted; its result waits for the player. The only command is **acknowledge**, which applies the result: continue with the next week, promote, or end the run as managed out.

**Ended.** No command is allowed.

## A Week

A run begins with week 0 in the week phase. **Beginning a week**:

1. The level begins the week and supplies its moments, each with an id, a day and a time.
2. The situation engine selects situations for the level, up to its limit, each with a day and a time.
3. The loop orders them into the week's sequence: by day, then by time (morning, afternoon, night). Within one day and time, urgent situations come first, then the level's moments, in the order the level gave them, and then the other situations; situations keep the order the engine selected them in. An urgent situation is one its author marked as needing the player before anything else, such as the first morning's onboarding, so it leads its slot rather than queuing behind routine work.

**End week** then does, in order:

1. Every moment still open in the sequence is marked let wait.
2. The level ends the week, returning the new simulation and level states and its recap. If the level returns an error, the command is an error and the run is unchanged.
3. The simulation advances by the level's time step.
4. The level's after-advance step runs. If it reports burnout, the run ends with `burnout`.
5. If the advance reached or passed a multiple of the level's review cadence, the loop asks the performance review for a result and enters the review phase. A level's time step need not divide its cadence: a monthly level reviewed every 13 weeks is reviewed after the advance that crosses week 13, 26 and so on, so no review is skipped.
6. Otherwise the next week begins.

Whenever the loop selects or resolves situations, it tells the situation engine how many weeks remain until the next review is held: the weeks to the end of the step that reaches the next multiple of the cadence. With a one-week step, that is the cadence less the weeks since the last review. Content can then time evaluations to the review cycle.

**Acknowledge** applies the review's result: `continue` begins the next week; `managedOut` ends the run; `promote` moves the run to the next career level, or ends it as `completed` when the player is at the highest level the game has.

## Career Level Contract

Every career level provides the same operations, so the loop runs any level and a promotion can swap one for another:

| Operation | Purpose |
|---|---|
| parameters | Level id, time step in weeks, situations per week, review cadence |
| start | Create the simulation and level states for a new run from a seed |
| begin week | Prepare the week and make the level's moments for it |
| moments | The week's level moments, each with its id, day, time, title and whether it is still open |
| plan | Apply a level-specific command at once to the level, or reject it |
| choose | Apply a choice for one of the level's open moments at once, returning new states, the change log and a reaction; or an error |
| end week | Apply the week's end, returning new states, the change log and the level's recap; or an error |
| after advance | Run the level's checks after the simulation advances, reporting burnout |
| scorecard | The level's raw measures |
| assess | The measures the performance review scores, each with its target, tolerance and direction, and whether promotion is possible yet |
| view | What the player can see |

A level supplies these through an adapter over its own operations (for the line manager, see its design's *Turn Loop Contract*).

## Performance Review Interface

The loop calls the performance review with the level id, the simulation state, the level's assessment, and the situation engine's debrief records since the week of the player's previous rating (or since week 0, at the first review), together with a record marked ignored for each situation of the week just ended that is still open. The situation engine closes those only at its next selection, after the review, so without them the last week's unanswered situations would reach no review; their week keeps them out of the next review's window. The review returns a new simulation state (it rates the player), its rating, an outcome of `continue`, `promote` or `managedOut`, each measure with its verdict, the score, and the debrief records, all of which the run holds until the player acknowledges the review. How the rating and outcome are decided is the review's design. The review keeps no state of its own in the run: the simulation records every rating the player has had, so a rule that looks at earlier reviews (two strong reviews in a row, say) reads them there.

## Content

The loop is given the loaded situations with each command that needs them; they are not part of the run state. A run replayed with different content can therefore differ, which is expected: content decides which situations appear. A run saved with older content may hold an open situation the newer content no longer has; answering it is an error from the situation engine, and it closes as ignored when the next week begins.

## Dependencies

The loop is given the career levels it can run and the performance review as dependencies, rather than importing them. Tests can run the loop with a stand-in review, and the game can run before every level exists.

## Interface

| Operation | Input | Output |
|---|---|---|
| `newRun` | seed, content, dependencies | a run in week 0's week phase |
| `apply` | run, command, content, dependencies | the new run, or an error and the unchanged run |
| `replay` | seed, content, dependencies, commands | the run those commands produce from a new run |

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| How the UI drives a run | Commands applied by one function to one serializable run state | Separate step functions over a run object; the UI calling each component directly | One run value makes saving trivial; one list of commands makes runs replayable, which the HLD's determinism is for; phase rules live in one place. Step functions need their own logging for replay and spread phase checks around; the UI orchestrating components would put game rules in the presentation layer. |
| Shape of a week | One sequence of the level's moments and the situations, sorted by day and time, with urgent situations leading their slot, owned by the loop | The level and the situation engine each presenting their own list; situations after the level's moments; the level's moments always first within a slot | The HLD's week is a run of moments with story situations among them. Only the loop sees both sources, so only it can order them; a fixed source order would put Monday's situation after Friday's page. Within a slot, the level's moments first would put a routine check-in ahead of the first morning's onboarding; urgent content is written to come first. |
| Order of play | Only the current moment can be answered or let wait | Answer any open moment in any order | Callbacks and reactions assume what came earlier in the week has happened. Free order lets a Thursday scene resolve before the Monday one it refers to, and turns the week back into a form. |
| Choices and habits as commands | `answer` for every moment, level or situation; `plan` for level commands that change no moment, such as habits | Level moment choices as planning commands | The loop has to know which moment a choice answers to keep the order, so a choice is an answer whoever owns the moment. `plan` stays for what can happen at any point in the week. |
| Moments the player passes | Allowed, as letting it wait; closed by their owner (the level at the week's end, the situation engine at its next selection) | Require every moment to be answered | Letting things wait is a real management choice that the level and debriefs can name; forcing an answer removes it. |
| Recap | The level's recap and the outcome of every moment, held as the run's last week | The level's recap alone | The recap is where the week's consequences are explained; situations are part of the week. |
| Burnout before review | The burnout check runs before a due review | Review first | A burned-out player does not sit through a review; the run has already ended. |
| Promotion past the top level | Ends the run as `completed` | Keep playing the top level | The HLD ends a run on promotion past the top level; until more levels exist, the line manager is the top. |

## Open Questions & Future Decisions

### Deferred
1. Converting a run's state on promotion to a higher level: each higher level's design defines how it takes over a run from the level below. Until one does, a review that promotes the player below the highest level the loop is given has no way forward: acknowledging it is an error, and the run stays in the review phase. This cannot happen while the line manager is the only level.
2. Undo within a week, which replaying the week's commands without the last one would make possible.
3. Whether the command list is trimmed for long runs, at the cost of full replay.

## References

- [High-level design](../../high-level-design.md)
- [Simulation core](../simulation-core/simulation-core-design.md)
- [Situation engine](../situation-engine/situation-engine-design.md)
- [Line manager level](../line-manager/line-manager-design.md)
