---
parent: high-level-design
prefix: REVIEW
---

# Performance Review

## Context and Design Philosophy

The performance review is how the player's own manager judges them. At each review the turn loop hands it the quarter's results; it scores them against the active career level's targets, gives the player a rating, and decides whether the run continues, the player is promoted, or they are managed out. It also gathers the quarter's situations, so the review the player reads explains what happened and why.

The review does not decide what a level measures or what counts as good: each career level supplies its measures and their targets, as the HLD has levels define their review criteria. Nor does it track the player's plan: the simulation core records every rating the player receives and reports whether they are on a coaching plan, an improvement plan, or have failed one.

Three principles shape it:

- **Every rating can be explained.** A rating is a tally of measures, each visibly below, at or above its target. The player can see which measures lifted or sank them, and which situations shaped the quarter.
- **Outcomes, not activity.** Measures are results (projects on schedule, people who stayed, a team that is not burning out), not counts of actions taken, so a player cannot earn a rating by going through the motions.
- **The boss's impression counts.** The player's reputation, which the simulation moves with how their projects are going, is one measure in every review, so being seen to deliver matters as well as delivering.

## Measures

A **measure** has a name, the player's value for the quarter, a target, a tolerance, and a direction (higher or lower is better). Its **verdict** is:

- **at target** when the value is within the tolerance of the target, the edges included;
- **above target** when it is beyond the tolerance on the better side;
- **below target** when it is beyond the tolerance on the worse side.

The career level supplies its measures through the turn loop's career level contract (*assess*), with their targets and tolerances; it also says whether promotion is possible yet, how many reviews remain before it is, how many reviews the level has left after this one, whether this is the level's last review, and any **ceiling** on the rating with the reason for it. The review adds one measure of its own to every review: the player's **reputation**, with its target and tolerance set by the review.

## The Rating

Each verdict scores one point (above), zero (at) or minus one (below). The **score** is the average over all measures, from −1 to 1, and maps to a rating by fixed thresholds: the highest scores earn *outstanding*, then *exceeds*, *meets*, *partial*, and the lowest *below*. The thresholds are tuning values; a quarter with every measure at target is *meets*. Some measures cannot score above target (no one can quit fewer than zero people), so the thresholds for *exceeds* and *outstanding* must be reachable without every measure above target.

A ceiling caps the rating: when the level gives one, the rating is the lower of the score's rating and the ceiling, and the review returns the ceiling's reason so the player can read why a strong quarter was rated lower. A level uses a ceiling for a result its manager would not overlook whatever the tally says, such as a team pushed to breaking point.

The review rates the player through the simulation core, with the rule `review.quarterly` as the cause, so the rating enters the player's rating history and plan like any other and the history shows it came from a review.

## The Outcome

After rating the player, the review decides, in this order:

1. **Managed out** if the player is now on a failed improvement plan (three low ratings in a row, as the simulation core counts them).
2. **Promote** if the level says promotion is possible and both this rating and the player's previous one are *exceeds* or better. A first review has no previous rating, so it never promotes.
3. **Stayed** if the level says this is its last review: the player has run out of time to be promoted at this level, and the run ends.
4. **Continue** otherwise.

## Standing

With the outcome, the review returns the player's **standing**: how near the rating came to the ones either side of it, and what the next reviews can do. A player reads from it, in words, how close they are to promotion or to being managed out; a score from −1 to 1 tells them neither.

- **Margin.** Whether one measure a verdict better (below to at, or at to above) would have earned the next rating up, and whether one measure a verdict worse would have dropped it to the next rating down. Each such step moves the score by one over the number of measures. No margin up is given when a ceiling lowered the rating, since the ceiling held it, not the tally, and none beyond *outstanding* or below *below*.
- **Toward promotion**, one of:
  - *promoted*, when the outcome is promote;
  - *ended*, when the run ends at this review (managed out, or the level's last review without a promotion);
  - *not open yet*, when promotion will not be possible at the next review either, with how many reviews until it is;
  - *out of time*, when two more ratings of *exceeds* or better are needed and the level has fewer than two reviews left;
  - *one more*, when this rating is *exceeds* or better and the next review can promote: one more such rating promotes;
  - *two in a row*, otherwise: promotion takes two ratings in a row of *exceeds* or better.

  *One more* and *two in a row* also carry how many reviews the level has left, so a player sees the window narrowing before it closes rather than learning at *out of time* that it already has.
- **What held it back.** When the rating is below *exceeds* and the run goes on, or this was the level's last review and it ended without a promotion, the measures scored below target. From the first review on, a player needs to know which part of the job kept the rating down while they can still change it, not only once promotion is in reach; the margin says how close they came, not where. When no measure was below target, the standing says so, since *exceeds* then takes more of them above it.
- **Plan.** When the rating leaves the player on a coaching plan, one more low rating puts them on an improvement plan; on an improvement plan, one more low rating and they are managed out.

## Debriefs

The review includes the debrief records the situation engine kept since the player's previous rating (or since the start of the run, at the first review), which the turn loop gathers from the situation engine. Counting from the previous rating rather than a fixed number of weeks keeps consecutive reviews' windows joined up whatever the level's time step: resolved situations with their debrief text, and those the player ignored or that expired. The review returns them with the measures, so the review the player reads names the conversations that went well, went badly, or never happened.

## Interface

| Operation | Input | Output |
|---|---|---|
| `conductReview` | level id, simulation state, the level's assessment (measures, whether promotion is possible, the reviews until it is, the reviews left at the level, whether this is the last review, and any rating ceiling with its reason), debrief records since the previous review | new simulation state, the rating, the outcome, the standing, each measure with its verdict, the score, the ceiling's reason when it lowered the rating, and the debrief records |

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| How a rating is reached | A tally of measures against level-set targets, with reputation as one measure | Rating mostly from reputation, adjusted by measures; targets that rise every review | A tally the player can see is the only option that explains the rating, which the HLD sets as a goal. Reputation-led ratings count delivery twice (reputation already follows it) and hide the reasons behind a band; rising targets are hard to tune and read as unfair when steady results fall. |
| Who sets targets | Each career level, through the contract | Targets held by the review per level | The HLD has levels define their review criteria; keeping targets with the level keeps the review generic and lets each level measure what its job is about. |
| Managed out | A failed improvement plan, as the simulation core reports it | A separate dismissal rule in the review | The core already tracks plans for everyone; the player's path from coaching to an improvement plan to dismissal is the same one the player puts their own people on. |
| Promotion | Two consecutive ratings of *exceeds* or better once the level allows it | One strong review; the player chooses when to go for promotion | One strong quarter is luck as often as skill; two in a row shows sustained performance, as real promotion cases ask for. |
| A result the tally should not average away | A ceiling on the rating set by the level, with a reason shown to the player | Weighting that measure more heavily; leaving it to the tally | A heavier weight is invisible: the player sees a lower score but not why. A ceiling names the reason, and leaves the level to say which results its manager would not overlook. |
| A run that never ends | The level's last review ends the run with the outcome `stayed` when the player is not promoted | Easier promotion (two strong reviews among the last three); no end | A steady player otherwise plays one level forever. Easier promotion still allows an endless run and raises every strategy's promotion rate; a last review gives each level a shape and an honest ending. |
| Telling the player where they stand | A standing in words: the margin to the ratings either side, what the next reviews can do toward promotion, and the plan's next step | The score alone; the score with the thresholds beside it; a progress bar toward promotion | A score with thresholds is still arithmetic the player has to do, and says nothing of the two-in-a-row rule. A bar suggests promotion accrues, when it is two consecutive ratings. A margin of one measure names something the player can change. |
| Explaining the quarter | Measures with verdicts, plus the quarter's debrief records | The rating alone | Traceable consequences are an HLD goal; the debriefs connect the rating to the choices that produced it. |

## Open Questions & Future Decisions

### Deferred
1. Whether the player can appeal or negotiate a rating, as a situation.
2. Whether the player chooses to pursue promotion, which would make it a decision rather than an outcome.
3. Weighting measures differently, if playtesting shows some matter more than others.

## References

- [High-level design](../../high-level-design.md)
- [Simulation core](../simulation-core/simulation-core-design.md)
- [Situation engine](../situation-engine/situation-engine-design.md)
- [Turn loop](../turn-loop/turn-loop-design.md)
- [Line manager level](../line-manager/line-manager-design.md)
