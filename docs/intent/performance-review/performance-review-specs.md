# Performance Review — Specs

Design: [performance-review-design.md](performance-review-design.md)

## Measures

- [x] **REVIEW-MEASURE-001**: When the performance review scores a measure, it shall give the verdict at target when the value differs from the target by no more than the tolerance, above target when it is beyond the tolerance on the better side, and below target when it is beyond the tolerance on the worse side, the better side being set by the measure's direction.
- [x] **REVIEW-MEASURE-002**: When the performance review is conducted, it shall add to the level's measures a reputation measure holding the player's reputation, with the review's own target and tolerance, higher being better.

## The rating

- [x] **REVIEW-RATE-001**: When the performance review is conducted, it shall compute the score as the average over all measures of 1 for each above target, 0 for each at target and −1 for each below target.
- [x] **REVIEW-RATE-002**: When the performance review has a score, it shall give the highest rating whose threshold the score reaches, from `outstanding` down to `below`, and shall give `meets` to a score of 0.
- [x] **REVIEW-RATE-004**: When the level's assessment gives a rating ceiling, the performance review shall give the lower of the score's rating and the ceiling, and return the ceiling's reason when it lowered the rating.
- [x] **REVIEW-RATE-003**: When the performance review gives a rating, it shall rate the player through the simulation core with the rule `review.quarterly` as the cause, and return the resulting simulation state.

## The outcome

- [x] **REVIEW-OUT-001**: When the rating leaves the player on a failed improvement plan, the performance review shall give the outcome `managedOut`.
- [x] **REVIEW-OUT-002**: When the player is not managed out, the level says promotion is possible, and both this rating and the player's previous rating are `exceeds` or better, the performance review shall give the outcome `promote`.
- [x] **REVIEW-OUT-004**: When neither managing out nor promotion applies and the level's assessment says this is its last review, the performance review shall give the outcome `stayed`.
- [x] **REVIEW-OUT-003**: When neither managing out, promotion nor the level's last review applies, including at a first review with no previous rating, the performance review shall give the outcome `continue`.

## What the review returns

- [x] **REVIEW-RESULT-001**: When the performance review is conducted, it shall return the rating, the outcome, the score, each measure with its verdict, the ceiling's reason when a ceiling lowered the rating, and the debrief records it was given.
- [x] **REVIEW-RESULT-002**: The performance review shall leave its input simulation state unchanged and use no randomness, giving the same result for the same input.
