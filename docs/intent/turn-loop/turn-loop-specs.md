# Turn Loop — Specs

Design: [turn-loop-design.md](turn-loop-design.md)

## The run

- [x] **LOOP-RUN-001**: When a new run is created from a seed, the turn loop shall start the lowest career level it is given (the line manager), with a level start week of 0, begin week 0, and put the run in the week phase with no last week.
- [x] **LOOP-RUN-002**: The turn loop shall represent a run as plain data that survives serialization to JSON and back without change.
- [x] **LOOP-RUN-003**: The turn loop shall return a new run from every command and leave the input run unchanged.
- [x] **LOOP-RUN-004**: When a command is applied successfully, the turn loop shall append it to the run's command list; a command that fails shall not be recorded.
- [x] **LOOP-RUN-005**: When a run is replayed from a seed, content and list of commands, the turn loop shall produce a run identical to the one those commands produced when applied one by one.

## Commands

- [x] **LOOP-CMD-001**: If a command is not allowed in the run's current phase, then the turn loop shall return an error and leave the run unchanged.
- [x] **LOOP-CMD-002**: When a plan command is applied in the week phase, the turn loop shall pass it to the active level and keep the level's new state, or return the level's error with the run unchanged if the level rejects it.
- [x] **LOOP-CMD-003**: When an answer command for the current moment is applied in the week phase, the turn loop shall apply the choice at once, through the active level for a level moment and through the situation engine for a situation, take the new states, and record the moment as answered with its reaction or aftermath line, or as expired when the situation engine reports it expired.
- [x] **LOOP-CMD-004**: If the active level or the situation engine returns an error for an answer command, then the turn loop shall return that error and leave the run unchanged.
- [x] **LOOP-CMD-006**: If an answer or wait command is applied when the moment it names is not the current moment, or when no moment in the week is open, then the turn loop shall return an error and leave the run unchanged.
- [x] **LOOP-CMD-008**: When an answer command has applied, the turn loop shall record as expired each open level moment in the week's sequence that the active level no longer reports as open.
- [x] **LOOP-CMD-007**: When a wait command is applied in the week phase, the turn loop shall record the current moment as waited without passing anything to the level or the situation engine.
- [x] **LOOP-CMD-005**: When the week is ended with moments still open, the turn loop shall record each as waited and end the week as usual, leaving the level to close its own moments at the week's end and the situation engine to close the situations as ignored at its next selection.

## A week

- [x] **LOOP-WEEK-001**: When the week is ended, the turn loop shall have the active level end the week, and if the level returns an error, return that error and leave the run unchanged.
- [x] **LOOP-WEEK-002**: When the level has ended the week, the turn loop shall advance the simulation by the level's time step and then run the level's after-advance step.
- [x] **LOOP-WEEK-003**: When the level's after-advance step reports burnout, the turn loop shall end the run with the ending `burnout`, without conducting a review that would be due.
- [x] **LOOP-WEEK-004**: When an advance takes the simulation to or past a multiple of the level's review cadence, counted from the level start week, that it had not reached before, and the run has not ended, the turn loop shall call the performance review with the level id, the simulation state, the level's assessment, the situation engine's debrief records since the week of the player's previous rating (or since week 0 when there is none), and a record with the status `ignored` for each of the week's situations still open, take the simulation state it returns, and enter the review phase holding its rating, outcome, measures with verdicts, score and debrief records.
- [x] **LOOP-WEEK-005**: When a week begins, the turn loop shall have the level begin the week, have the situation engine select situations for the level's id up to the level's limit, and hold the level's moments and the situations together as the week's sequence, each with the title its owner gives it (the level's title for its moment, the situation's title from the content).
- [x] **LOOP-WEEK-010**: When a turn begins at a level whose time step is longer than a week, the turn loop shall place each situation on day *d* × the weeks per step of the turn, *d* being the day of the week the situation engine gave it.
- [x] **LOOP-WEEK-008**: The turn loop shall order the week's sequence by day, then by time (morning, afternoon, night), and within one day and time put the `urgent` situations first, then the level's moments in the order the level gave them, then the other situations, keeping situations in the order the situation engine selected them.
- [x] **LOOP-WEEK-009**: The turn loop shall treat the first moment in the week's sequence that is still open as the current moment.
- [x] **LOOP-WEEK-007**: When the turn loop selects or resolves situations, it shall give the situation engine the weeks until the next review is held: from the current week to the end of the first step, counting whole steps of the level's time step from the level start week, that reaches the next multiple of the review cadence counted from the level start week.
- [x] **LOOP-WEEK-006**: When a week ends, the turn loop shall keep the level's recap and, for each moment of the week, its day, time and what happened to it (answered with its reaction or aftermath line, waited, or expired) as the run's last week.

## Reviews

- [x] **LOOP-REV-001**: When a review with the outcome `continue` is acknowledged, the turn loop shall begin the next week.
- [x] **LOOP-REV-002**: When a review with the outcome `managedOut` is acknowledged, the turn loop shall end the run with the ending `managedOut`.
- [x] **LOOP-REV-004**: When a review with the outcome `stayed` is acknowledged, the turn loop shall end the run with the ending `stayed`.
- [x] **LOOP-REV-003**: When a review with the outcome `promote` is acknowledged at the highest career level the turn loop is given, the turn loop shall end the run with the ending `completed`.
- [x] **LOOP-REV-005**: When a review with the outcome `promote` is acknowledged below the highest career level the turn loop is given, the turn loop shall put the run in the handover phase with the next level's handover choices.

## Handover

- [x] **LOOP-HAND-001**: When a hand over command is applied in the handover phase with a choice the next level accepts, the turn loop shall have the next level take the run over from the active level's state and the simulation, make the next level the active level with a level start week of the current week, and begin its first turn.
- [x] **LOOP-HAND-004**: When a hand over command applies, the turn loop shall keep the level below's id, its final state and the simulation as it left it in the run's earlier levels, in the order the run left them.
- [x] **LOOP-HAND-002**: If a hand over command's choice is rejected by the next level, then the turn loop shall return the level's error and leave the run unchanged.
- [x] **LOOP-HAND-003**: In the handover phase, the turn loop shall allow only the hand over command.
