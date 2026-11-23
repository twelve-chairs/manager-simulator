# Success-Metric Playtests — Specs

Design: [playtest-design.md](playtest-design.md)

## Playing runs

- [x] **PLAY-RUN-001**: When the success-metric playtests run, they shall play the first-timer and the sound player each on the same eight fixed seeds, every run from a new run until it ends, at whichever level it ends.
- [x] **PLAY-RUN-002**: The success-metric playtests shall act only through the page's controls and measure only what the page shows, reading no save or game state after seeding a run.
- [x] **PLAY-RUN-003**: When a first-timer meets a moment, it shall let the moment wait one time in ten, pick a random offered choice two times in ten, and otherwise make the sound player's choice, keeping the sound player's habits, drawing from its own generator seeded with the run's seed.
- [x] **PLAY-RUN-005**: When a scripted player reaches the handover, it shall choose the engineer who trusts the player most among those whose want it knows to be growth, if that engineer's trust is shown as *trusting* or better, and otherwise an outside hire.
- [x] **PLAY-RUN-006**: When the sound player plays the senior manager, it shall keep coaching oversight of every manager and fortnightly 1:1s, and choose: each situation's better choice from the balance harness's better-choice table, or its first offered choice when that one is not offered; coach on an escalation or a surfaced problem; move a head on a staffing request; agree on a dispute; give new work to the team with room; ask for the evidence on an approval; promote from the team when replacing a manager or adding a team; let a manager go at a final evaluation; and settle calibration by moving every head to what its team delivered.
- [x] **PLAY-RUN-007**: When the sound player plays the line manager, it shall keep the default habits but the growth focus, set the growth focus as the balance design's sound practice does, and choose on each moment as the balance design's sound practice does, taking each situation's better choice from the balance harness's better-choice table and reading the page's band words where the balance harness reads the view's bands.
- [x] **PLAY-RUN-008**: When the sound player plays one of the success-metric playtests' seeds through the line manager, it shall receive the same review ratings as the balance harness's sound practice playing that seed.
- [x] **PLAY-RUN-004**: When the success-metric playtests play the same player and seed against the same build, they shall produce the same scorecard.

## The session clock

The worse half of a person's bands is struggling or flat for motivation, and strained or overwhelmed for stress.


- [x] **PLAY-CLOCK-001**: When a scene, review or ended screen is shown for the first time, the session clock shall add the time to read its words at 230 words a minute, and shall count no words from the team panel, the header, the habits panel, the habit controls shown Before Monday, or a closed disclosure other than its summary.
- [x] **PLAY-CLOCK-002**: When a scripted player answers a moment or lets it wait, the session clock shall add 4 seconds.
- [x] **PLAY-CLOCK-003**: When a scripted player makes any other click, the session clock shall add 1 second.

## A promotion in the first session

- [x] **PLAY-PROMO-001**: When a review promotes the player, the scorecard shall record the run's estimated session time at that review, if it is the run's first promotion.
- [x] **PLAY-PROMO-002**: When a run ends without a promotion, the scorecard shall record it as not promoted.
- [x] **PLAY-PROMO-003**: The scorecard shall report the share of first-timer runs promoted within 60 estimated minutes beside the target share of one half, and shall fail no check on it.

## Bad outcomes can be traced

- [x] **PLAY-TRACE-001**: When the ended screen's career summary lists an engineer as quit, the scorecard shall record whether the engineer's card showed, in one of the last four weeks it was on screen, their motivation or stress in the worse half of its bands.
- [x] **PLAY-TRACE-002**: When a review is rated partial or below, the scorecard shall record whether, in the four weeks before it (or the weeks the run has had, when fewer), a project was shown as behind or overdue, or an engineer's motivation or stress in the worse half of its bands.
- [x] **PLAY-TRACE-003**: When a project is first shown as overdue, the scorecard shall record whether, in the four weeks before (or the weeks the run has had, when fewer), it was shown as behind or with its risk elevated, high or severe.
- [x] **PLAY-TRACE-004**: When the burnout warning is first shown in a run, the scorecard shall record whether, in the four weeks before (or the weeks the run has had, when fewer), the player's energy was shown as tired or running on fumes.
- [x] **PLAY-TRACE-005**: The scorecard shall report, for quits, low ratings, overdue projects and burnout warnings each, the share of events that had a warning sign, and shall fail no check on them.

## Choices feel consequential

- [x] **PLAY-CHOICE-001**: When a scripted player answers a moment, the success-metric playtests shall fail unless the next scene is that moment's reaction with text that is not empty.
- [x] **PLAY-CHOICE-002**: The scorecard shall report the share of answered moments whose reaction showed at least one chip.
- [x] **PLAY-CHOICE-003**: The scorecard shall report the share of memory notes added by a choice that are still on the person's card two weeks later.

## The shape of a session

- [x] **PLAY-SHAPE-001**: The scorecard shall report, per run, the mean number of decisions per week, the fewest and the most in any week, and the share of weeks with none.
- [x] **PLAY-SHAPE-002**: The scorecard shall report, per run, the longest run of consecutive moments of the same kind, where a line manager moment is of the kind its title names before the colon, a senior manager moment of the kind its title's fixed wording names, and each situation is a kind of its own.
- [x] **PLAY-SHAPE-003**: The scorecard shall report, per run, how many times a situation was shown again within 13 weeks of last being shown.
- [x] **PLAY-SHAPE-004**: The scorecard shall report, per run, the share of its reaction texts that are distinct.

## Promotion changes the job

- [x] **PLAY-JOB-001**: When a run is promoted into a second career level, the scorecard shall record, for each level, the panels the page showed by their headings, the habits it offered by their labels with any person's name left out, and the kinds of the career level's own moments, and list, in each part, those the first level showed and the second did not and those the second showed and the first did not.
- [x] **PLAY-JOB-002**: The scorecard shall report, across a player's promoted runs, each panel, habit and kind of moment that stopped or started appearing at the promotion, with the number of runs in which it did, and shall fail no check on it.

## Skill can be learned

- [x] **PLAY-SKILL-001**: The scorecard shall report the average review rating of the first-timer's runs and of the sound player's runs.

## The scorecard

- [x] **PLAY-CARD-001**: When a player's runs finish, the success-metric playtests shall attach that player's scorecard to the playtest report as JSON and print it as a table, with one row per run giving its seed and ending, the measures under each success metric's heading, and each hard check marked passed or failed.
- [x] **PLAY-CARD-002**: When a run finishes, the success-metric playtests shall attach the run's own summary to the playtest report.

## The human script

- [x] **PLAY-HUMAN-001**: The human playtest script shall have a section for setup, and a heading for each of the HLD's success metrics, each with what to watch for and questions to ask afterwards.
- [x] **PLAY-HUMAN-002**: The human playtest script shall have a record sheet with a space for the version shown on the start screen and one for each success metric's heading.
