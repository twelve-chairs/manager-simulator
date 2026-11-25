# Balance Harness — Specs

Design: [balance-design.md](balance-design.md)

## Playing runs

- [x] **BAL-PLAY-001**: When the balance harness plays a run, it shall start a new run from the seed with the compiled situation content, the real career levels and the real performance review, and play up to 78 weeks or until the run ends.
- [x] **BAL-PLAY-002**: When the balance harness plays a week, it shall let the strategy change habits through plan commands at the start of the week, then for each current moment give the strategy only the level's view, that moment (its day, time, title, text and offered choices), the week and the run's review results, apply the choice or wait it returns, and end the week once no moment is open.
- [x] **BAL-PLAY-003**: When a review is waiting, the balance harness shall acknowledge it.
- [x] **BAL-PLAY-004**: If the turn loop refuses a command a strategy returns, then the balance harness shall fail with the strategy, seed, week and error.
- [x] **BAL-PLAY-005**: When the balance harness plays the same strategy and seed with the same content, it shall produce the same results.

## Better choices

- [x] **BAL-CHOICE-001**: The balance harness shall fail if a situation in the content, at any career level, other than one whose id starts with `onboarding-`, has no entry in the better-choice table, or its entry names a choice the situation does not have.
- [x] **BAL-CHOICE-002**: The balance harness shall fail if, for any career level, more than half of that level's situations in the better-choice table list their better choice first among their choices in the situation file, or more than half list it last.
- [x] **BAL-CHOICE-003**: The balance harness shall fail if a situation in the content, at any career level, other than one whose id starts with `onboarding-`, has no wait debrief.

## Measures

- [x] **BAL-MEASURE-001**: When a run ends or reaches 78 weeks, the balance harness shall record, reading the run itself rather than the player's view, the run's review ratings, whether it ended promoted, burned out or managed out, and how many engineers rated meets or above quit.
- [x] **BAL-MEASURE-002**: When the balance harness compares strategies, it shall report for each the average review score, scoring every run over its six review slots (ratings counted `below` 0 to `outstanding` 4, a slot missed after burning out or being managed out counted 0, and a slot missed after a promotion counted as the last rating), the promotion, burnout and managed-out shares, and the average regretted quits over its runs.
- [x] **BAL-MEASURE-003**: When the balance harness compares strategies, it shall report sound practice with other habits (1:1s every week and light ceremonies) beside the others, and shall include it in no check.
- [x] **BAL-MEASURE-004**: When the balance harness compares strategies, it shall report for each the quiet-week share: of the line manager weeks its runs played, the share in which, after the strategy's habit changes, the week had no moment, neither a level moment nor a situation.

## Checks

- [x] **BAL-CHECK-001**: The balance harness shall fail unless sound practice's average review score exceeds every naive strategy's by at least the score margin its tuning sets.
- [x] **BAL-CHECK-002**: The balance harness shall fail unless sound practice's promotion share is at least the minimum its tuning sets.
- [x] **BAL-CHECK-003**: The balance harness shall fail if any naive strategy's promotion share exceeds the maximum its tuning sets.
- [x] **BAL-CHECK-004**: The balance harness shall fail if sound practice's burnout share exceeds the maximum its tuning sets.
- [x] **BAL-CHECK-005**: The balance harness shall fail if sound practice's quiet-week share exceeds the maximum its tuning sets.

## The senior manager

- [x] **BAL-SENIOR-001**: When the balance harness plays a senior manager run, it shall start a line manager run from the seed, hand it over to an outside hire, and play the senior manager level through the turn loop with the compiled situation content, the real career levels and the real performance review, for up to 36 months or until the run ends.
- [x] **BAL-SENIOR-002**: When the balance harness plays a senior manager month, it shall give the strategy only the level's view and the month's open moments with their choices, act only through plan and answer commands, and fail with the strategy, seed, month and error if the turn loop refuses a command.
- [x] **BAL-SENIOR-003**: When a senior manager run ends or reaches 36 months, the balance harness shall record its review ratings, whether it ended promoted, burned out or managed out, and its regretted attrition, and report for each senior strategy the average review score over six review slots and the promotion, burnout and managed-out shares, as it does for the line manager.
- [x] **BAL-SENIOR-004**: The balance harness shall report sound practice with skip-levels beside the other senior strategies, and shall include it in no check.
- [x] **BAL-SENIOR-005**: The balance harness shall fail unless, at the senior manager, sound practice's average review score exceeds every naive strategy's by at least the senior score margin, sound practice's promotion share is at least the senior minimum, no naive strategy's promotion share exceeds the senior maximum, and sound practice's burnout share is at most the senior maximum.
- [x] **BAL-SENIOR-006**: The balance harness shall fail if, at the senior manager, sound practice's managed-out share exceeds the maximum sound managed-out share.
- [x] **BAL-SENIOR-007**: When the balance report runs, it shall print the senior manager's table beside the line manager's.
- [x] **BAL-SENIOR-008**: When a senior manager strategy meets a presented situation, idle shall let it wait, hero and the delegator shall pick the first offered choice, the contrarian the last, and sound practice, with or without skip-levels, the situation's better choice from the better-choice table, or the first offered choice when that one is not offered.

## The director

- [x] **BAL-DIR-001**: When the balance harness plays a director run, it shall start a line manager run from the seed, hand it over to an outside hire at the senior manager and at once to an outside hire at the director, and play the director level through the turn loop with the compiled situation content, the real career levels and the real performance review, for up to 12 quarters or until the run ends.
- [x] **BAL-DIR-002**: When the balance harness plays a director quarter, it shall give the strategy only the level's view and the quarter's open moments with their choices, act only through plan and answer commands, and fail with the strategy, seed, quarter and error if the turn loop refuses a command.
- [x] **BAL-DIR-003**: When a director run ends or reaches 12 quarters, the balance harness shall record its review ratings, whether it ended promoted, burned out or managed out, and its regretted attrition, and report for each director strategy the average review score over six review slots and the promotion, burnout and managed-out shares, as it does for the line manager.
- [x] **BAL-DIR-004**: The balance harness shall play the director strategies as the balance design's table states them, and report sound practice with a listening tour beside the others, including it in no check.
- [x] **BAL-DIR-005**: The balance harness shall fail unless, at the director, sound practice's average review score exceeds every naive strategy's by at least the director score margin, sound practice's promotion share is at least the director minimum, no naive strategy's promotion share exceeds the director maximum, and sound practice's burnout share is at most the director maximum.
- [x] **BAL-DIR-006**: The balance harness shall fail if, at the director, sound practice's managed-out share exceeds the maximum sound managed-out share.
- [x] **BAL-DIR-007**: When the balance report runs, it shall print the director's table beside the other levels'.
