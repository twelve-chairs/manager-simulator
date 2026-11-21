# Balance Harness — Specs

Design: [balance-design.md](balance-design.md)

## Playing runs

- [x] **BAL-PLAY-001**: When the balance harness plays a run, it shall start a new run from the seed with the compiled situation content, the real career levels and the real performance review, and play up to 78 weeks or until the run ends.
- [x] **BAL-PLAY-002**: When the balance harness plays a week, it shall let the strategy change habits through plan commands at the start of the week, then for each current moment give the strategy only the level's view, that moment (its day, time, title, text and offered choices), the week and the run's review results, apply the choice or wait it returns, and end the week once no moment is open.
- [x] **BAL-PLAY-003**: When a review is waiting, the balance harness shall acknowledge it.
- [x] **BAL-PLAY-004**: If the turn loop refuses a command a strategy returns, then the balance harness shall fail with the strategy, seed, week and error.
- [x] **BAL-PLAY-005**: When the balance harness plays the same strategy and seed with the same content, it shall produce the same results.

## Better choices

- [x] **BAL-CHOICE-001**: The balance harness shall fail if a line manager situation in the content, other than one whose id starts with `onboarding-`, has no entry in the better-choice table, or its entry names a choice the situation does not have.
- [x] **BAL-CHOICE-002**: The balance harness shall fail if more than half of the situations in the better-choice table list their better choice first among their choices in the situation file, or more than half list it last.

## Measures

- [x] **BAL-MEASURE-001**: When a run ends or reaches 78 weeks, the balance harness shall record, reading the run itself rather than the player's view, the run's review ratings, whether it ended promoted, burned out or managed out, and how many engineers rated meets or above quit.
- [x] **BAL-MEASURE-002**: When the balance harness compares strategies, it shall report for each the average review score, scoring every run over its six review slots (ratings counted `below` 0 to `outstanding` 4, a slot missed after burning out or being managed out counted 0, and a slot missed after a promotion counted as the last rating), the promotion, burnout and managed-out shares, and the average regretted quits over its runs.
- [x] **BAL-MEASURE-003**: When the balance harness compares strategies, it shall report sound practice with other habits (1:1s every week and light ceremonies) beside the others, and shall include it in no check.

## Checks

- [x] **BAL-CHECK-001**: The balance harness shall fail unless sound practice's average review score exceeds every naive strategy's by at least the score margin its tuning sets.
- [x] **BAL-CHECK-002**: The balance harness shall fail unless sound practice's promotion share is at least the minimum its tuning sets.
- [x] **BAL-CHECK-003**: The balance harness shall fail if any naive strategy's promotion share exceeds the maximum its tuning sets.
- [x] **BAL-CHECK-004**: The balance harness shall fail if sound practice's burnout share exceeds the maximum its tuning sets.
