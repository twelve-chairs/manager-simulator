# Turn Loop — Specs

Design: [turn-loop-design.md](turn-loop-design.md)

## The run

- [x] **LOOP-RUN-001**: When a new run is created from a seed, the turn loop shall start the lowest career level it is given (the line manager), begin week 0, present its situations through the situation engine, and put the run in the planning phase with no last week.
- [x] **LOOP-RUN-002**: The turn loop shall represent a run as plain data that survives serialization to JSON and back without change.
- [x] **LOOP-RUN-003**: The turn loop shall return a new run from every command and leave the input run unchanged.
- [x] **LOOP-RUN-004**: When a command is applied successfully, the turn loop shall append it to the run's command list; a command that fails shall not be recorded.
- [x] **LOOP-RUN-005**: When a run is replayed from a seed, content and list of commands, the turn loop shall produce a run identical to the one those commands produced when applied one by one.

## Commands

- [x] **LOOP-CMD-001**: If a command is not allowed in the run's current phase, then the turn loop shall return an error and leave the run unchanged.
- [x] **LOOP-CMD-002**: When a plan command is applied in the planning phase, the turn loop shall pass it to the active level, keep the level's new state and plan, and return the level's error with the run unchanged if the level rejects it.
- [x] **LOOP-CMD-003**: When an answer command is applied in the planning phase, the turn loop shall resolve it through the situation engine, take the new simulation and engine states, and record the situation as answered with its aftermath line, or as expired.
- [x] **LOOP-CMD-004**: If the situation engine returns an error for an answer command, then the turn loop shall return that error and leave the run unchanged.
- [x] **LOOP-CMD-005**: When the week is ended with situations still unanswered, the turn loop shall end it as usual, leaving the situation engine to close them as ignored.

## A week

- [x] **LOOP-WEEK-001**: When the week is ended, the turn loop shall have the active level commit the week's plan, and if the level rejects it, return the level's error and leave the run unchanged.
- [x] **LOOP-WEEK-002**: When the level has committed the week, the turn loop shall advance the simulation by the level's time step and then run the level's after-advance step.
- [x] **LOOP-WEEK-003**: When the level's after-advance step reports burnout, the turn loop shall end the run with the ending `burnout`, without conducting a review that would be due.
- [x] **LOOP-WEEK-004**: When an advance takes the simulation to or past a multiple of the level's review cadence that it had not reached before, and the run has not ended, the turn loop shall call the performance review with the level id, the simulation state, the level's assessment, the situation engine's debrief records since the week of the player's previous rating (or since week 0 when there is none), and a record with the status `ignored` for each of the week's situations still open, take the simulation state it returns, and enter the review phase holding its rating, outcome, measures with verdicts, score and debrief records.
- [x] **LOOP-WEEK-005**: When the next week begins, the turn loop shall have the level begin the week, start an empty plan, and present situations selected by the situation engine for the level's id up to the level's limit.
- [x] **LOOP-WEEK-007**: When the turn loop selects or resolves situations, it shall give the situation engine the weeks until the next review is held: from the current week to the end of the first step, counting whole steps of the level's time step, that reaches the next multiple of the review cadence.
- [x] **LOOP-WEEK-006**: When a week ends, the turn loop shall keep the level's report and the aftermath lines of the situations answered that week as the run's last week.

## Reviews

- [x] **LOOP-REV-001**: When a review with the outcome `continue` is acknowledged, the turn loop shall begin the next week.
- [x] **LOOP-REV-002**: When a review with the outcome `managedOut` is acknowledged, the turn loop shall end the run with the ending `managedOut`.
- [x] **LOOP-REV-003**: When a review with the outcome `promote` is acknowledged at the highest career level the turn loop is given, the turn loop shall end the run with the ending `completed`.
