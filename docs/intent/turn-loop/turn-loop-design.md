---
parent: high-level-design
prefix: LOOP
---

# Turn Loop

## Context and Design Philosophy

The turn loop runs a career from its first week to its end. It holds the whole run as one value, accepts the player's inputs as commands, and calls the other components in the right order: the career level to begin and commit each week, the situation engine to present and resolve situations, the simulation core to advance time, and the performance review when one is due. It decides nothing about management itself; every rule it applies belongs to another component.

Three principles shape it:

- **One run, one value.** The run state holds everything a run needs to continue: the simulation, situation engine and level states, the current phase, and the commands applied so far. It is plain data, so saving a run is writing it and loading is reading it back.
- **Every input is a command.** The player changes the run only by commands, applied one at a time by one function that returns the new run or an error. Because every component is deterministic, a run is reproducible from its seed, its content and its list of commands, which makes bugs reproducible and replays possible.
- **The phase decides what is allowed.** Each command is valid only in certain phases. A command the phase does not allow is an error, and the run is unchanged; the UI cannot put the run into an inconsistent state.

## The Run

| Part | Meaning |
|---|---|
| seed | The seed the run started from |
| level id | The active career level |
| simulation state | The simulation core's state |
| engine state | The situation engine's state |
| level state | The active career level's state |
| plan | The level's pending plan for this week (for the line manager, the decisions on inbox demands), held until the week ends |
| phase | `planning`, `review` or `ended` |
| presented | The situations presented this week, with what happened to each: open, answered (with its aftermath line) or expired |
| last week | The level's report and the situation aftermaths from the week just ended, for the UI to show; empty until the first week ends |
| review | In the `review` phase, the review's result waiting to be acknowledged: rating, outcome, each measure with its verdict, the score, and the quarter's debrief records |
| ending | In the `ended` phase, why the run ended: `burnout`, `managedOut` or `completed` |
| commands | Every command applied successfully, in order; a command that failed changed nothing and is not recorded |

## Phases and Commands

**Planning.** The week is open. The level has begun it (for the line manager, demands have arrived) and the situation engine has presented this week's situations. The player may, in any order and as often as they like:

- **plan**: a level-specific planning command (for the line manager, a calendar edit or a decision on an inbox demand), passed to the level;
- **answer**: pick a choice for a presented situation, resolved by the situation engine at once against the current state;
- **end week**: close the week (see *A Week*).

Situations left unanswered when the week ends are not an error: the situation engine closes them as ignored at its next selection.

**Review.** A review has been conducted; its result waits for the player. The only command is **acknowledge**, which applies the result: continue with the next week, promote, or end the run as managed out.

**Ended.** No command is allowed.

## A Week

A run begins with week 0 in the planning phase. **End week** then does, in order:

1. The level commits the week with the pending plan, returning the new simulation and level states and its report. If the level rejects the plan (for the line manager, too many hours), the command is an error and the run is unchanged.
2. The simulation advances by the level's time step.
3. The level's after-advance step runs. If it reports burnout, the run ends with `burnout`.
4. If the advance reached or passed a multiple of the level's review cadence, the loop asks the performance review for a result and enters the review phase. A level's time step need not divide its cadence: a monthly level reviewed every 13 weeks is reviewed after the advance that crosses week 13, 26 and so on, so no review is skipped.
5. Otherwise the next week begins: the level begins the week, and the situation engine selects situations for the level, up to its limit.

Whenever the loop selects or resolves situations, it tells the situation engine how many weeks remain until the next review is held: the weeks to the end of the step that reaches the next multiple of the cadence. With a one-week step, that is the cadence less the weeks since the last review. Content can then time evaluations to the review cycle.

**Acknowledge** applies the review's result: `continue` begins the next week; `managedOut` ends the run; `promote` moves the run to the next career level, or ends it as `completed` when the player is at the highest level the game has.

## Career Level Contract

Every career level provides the same operations, so the loop runs any level and a promotion can swap one for another:

| Operation | Purpose |
|---|---|
| parameters | Level id, time step in weeks, situations per week, review cadence |
| start | Create the simulation and level states for a new run from a seed |
| begin week | Prepare the week (for the line manager, inbox arrivals) |
| empty plan, update plan | Hold and change the week's pending plan from level-specific planning commands, rejecting invalid ones |
| commit | Apply the week's plan, returning new states, the change log and a report; or an error |
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
| `newRun` | seed, content, dependencies | a run in week 0's planning phase |
| `apply` | run, command, content, dependencies | the new run, or an error and the unchanged run |
| `replay` | seed, content, dependencies, commands | the run those commands produce from a new run |

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| How the UI drives a run | Commands applied by one function to one serializable run state | Separate step functions over a run object; the UI calling each component directly | One run value makes saving trivial; one list of commands makes runs replayable, which the HLD's determinism is for; phase rules live in one place. Step functions need their own logging for replay and spread phase checks around; the UI orchestrating components would put game rules in the presentation layer. |
| When the plan is applied | Held in the run until end week, then committed by the level in one step | Applying each planning command to the simulation at once | Actions take effect as the week's work, after the player has seen the week's situations; committing once lets the level check the whole week (the hours budget) before anything changes. |
| Situations | Answered during planning and resolved at once | Answered after the plan is committed | A situation's outcome should inform the player's plan for the week; the line manager design presents situations alongside planning. |
| Unanswered situations | Allowed; closed as ignored at the next selection | Require every situation to be answered | Ignoring is a choice a debrief can name; forcing an answer removes it. |
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
