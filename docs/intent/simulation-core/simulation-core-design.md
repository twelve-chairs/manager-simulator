---
parent: high-level-design
prefix: SIM
---

# Simulation Core

## Context and Design Philosophy

The simulation core is the model of the organization the player manages: its people, teams and projects, and the player's own standing. It advances that model one time step at a time and applies changes requested by the rest of the game. It has no UI and no knowledge of situations or career levels beyond two parameters it is given: the length of a time step and which teams are simulated in detail.

Three principles shape it:

- **Every change has a cause.** Each change to the simulation records what caused it: a player action, a situation choice, or a simulation rule. This is what lets consequences be traced and debriefs explain why things happened.
- **Same inputs, same outcome.** Given the same starting state, seed and sequence of inputs, the core produces the same result. All randomness comes from a seeded generator whose state is part of the simulation state, and everything the core iterates over is processed in ascending id order.
- **Cause and effect follows real practice; pace does not.** The rules connecting management choices to outcomes are meant to reflect how those choices tend to play out in real teams. Rates, durations and magnitudes are tuned for play.

The core reports the state; it does not judge it. Whether the player has burned out, been managed out or earned a promotion is decided by the career level and performance review, from values the core exposes.

## Game Time

The state holds the current **game week**, starting at 0. A time step has a length in weeks: a week is 1, a month is 4, a quarter is 13. Every duration the core measures (tenure, how long a want has gone unserved, how long motivation has been low) is counted in weeks, so a change of step length on promotion neither resets nor distorts them.

## The Model

All simulated values are integers from 0 to 100 unless stated otherwise. A change that would take a value outside that range is clamped to it.

### Person

A person is an engineer or a manager below the player.

| Field | Meaning |
|---|---|
| `id`, `name` | Stable identity |
| `role` | `engineer` or `manager` |
| `skill` | How good they are at their role (engineering for engineers, management for managers) |
| `motivation` | How engaged they are |
| `stress` | Current load and strain |
| `trust` | Their trust in their own manager (the player, or a manager the player manages) |
| `want` | What matters most to them: `growth`, `recognition`, `stability` or `autonomy` |
| `performance` | Their performance level: `unrated`, or a rating of `below`, `partial`, `meets`, `exceeds` or `outstanding` (see *Performance level*) |
| `joinedWeek` | Game week they joined; tenure is derived from it |
| `wantServedWeek` | Game week their want was last served; starts at `joinedWeek` |
| `lowMotivationWeeks`, `highStressWeeks` | Consecutive weeks motivation has been low or stress high; drive departure |
| `teamId` | The team they belong to (for managers: the team they lead) |
| `status` | `active`, `departed`, or `aggregated` (folded into an aggregate team; see *Team*) |
| `departure` | When departed: the game week and reason (`quit`, `fired`, `transferred`) |
| `history` | Notable things that happened to them (see *History*) |

A person's `want` is fixed for as long as they are in the simulation. It changes how effects land: an effect tagged as serving their want has a larger positive impact on motivation, and an effect tagged as working against it has a larger negative one. A person's want counts as **served** whenever an effect tagged as serving it is applied to them, whatever field the effect changes: a stretch assignment that only raises stress still serves someone who wants growth.

`trust` changes how the player's actions land and whether people stay. Positive motivation effects caused by the player — player actions and situation choices — are scaled down when the target's trust is low, and low trust raises the chance of departure.

### Performance level

A person's **performance level** is the rating their manager's evaluations give them, on a five-step scale: below expectations (`below`), partially meets (`partial`), meets (`meets`), exceeds (`exceeds`) and outstanding (`outstanding`). It is distinct from skill: skill is what they can do, the rating is what the organization has officially said about it, and the two can disagree. A person in the starting organization, and the player, may already be rated; that rating is recorded as given in week 0 by the starting organization (cause `rule.startingOrganization`), so it counts toward their plan. A hired person starts `unrated`.

Everyone has a performance level: every person and the player. Only a **rate** effect changes a rating (see *Effects, Causes and History*). No advance rule changes it. What a rating does to the person's motivation or trust is expressed by the effects submitted with it, so it lands when it is given and carries the cause of that evaluation or calibration choice.

`below` and `partial` are **low** ratings. Consecutive low ratings put someone on a plan, derived from their ratings rather than stored:

| Consecutive low ratings, most recent first | Plan |
|---|---|
| None (unrated, or latest rating `meets` or better) | none |
| One | coaching plan |
| Two | performance improvement plan (PIP) |
| Three or more | failed PIP |

A rate effect either adds a new rating (an evaluation) or is a **revision** that replaces the latest rating (a calibration adjusting a rating just given), so that one review cycle never counts twice. A rating of `meets` or better ends any plan. A person whose PIP fails is removed, with departure reason `fired` and the cause of the rate effect that gave the third low rating; the removal takes effect after the rest of the batch is applied, so the effects submitted with the rating still land. If they led a team, it becomes leaderless. The player's failed PIP is reported, not acted on: what it means for the run is decided by the performance review. Departed people and people in aggregate teams have no plans, since they are no longer individuals the player manages.

To let the rest of the game compare a rating with the work behind it, the core derives each active person's **contribution**, from 0 to 100, from their skill, motivation and stress, the same factors that give a team its capacity for project work. Contribution maps onto the rating scale by fixed bands, giving the rating the person's work **corresponds to**. Both are derived, not stored, and exist only for active people.

Departed and aggregated people stay in the state so that history and debriefs can refer to them. Only active people are simulated or can be targeted by effects.

### Player standing

| Field | Meaning |
|---|---|
| `reputation` | How the player's own manager rates them |
| `stress` | The player's own load |
| `performance` | The player's own performance level, on the same scale as a person's; set by their performance reviews |
| `ratingHistory` | Every rating the player has been given: game week, rating and cause |

What the player can do with their time is defined by the active career level, not by the core.

### Organization

The state holds only the player's own organization: every team in it is under the player, directly or through managers they manage. Teams outside it (peers, dependencies) are not modeled.

### Team

A team has a leader (the player, a managed person, or none), a list of projects, and one of two representations:

- **Detailed**: a list of member people, each simulated individually.
- **Aggregate**: a summary in place of members — `headcount`, `skill`, `motivation`, `stress`, `attritionRisk` and `ratings` — simulated as a unit. `ratings` counts how many of the team's people hold each performance level, including `unrated`; its counts always sum to the headcount. A team given in aggregate form in the starting organization without rating counts has all its heads `unrated`.

A change to a detailed team's skill, motivation or stress, whether from an effect or a rule, applies to each of its active members; a detailed team has no values of its own.

Which teams are detailed is decided by the active career level. Converting a team from detailed to aggregate computes the summary from its active members and marks those members `aggregated`. A person who leads the team is not a member and stays active, so a senior manager's line managers remain individuals while their teams become aggregates. Conversion is one-way: the core never turns an aggregate back into individuals.

Hiring into an aggregate team raises its headcount by one instead of adding a person; the new head counts as `unrated`. Moving a person into an aggregate team marks them `aggregated`, raises its headcount by one and adds one to the count for their rating. Whenever an aggregate team loses headcount, by attrition or by a value effect, each head lost is taken from a rating chosen at random, weighted by how many people hold it and by a per-rating weight that is higher at both ends of the scale: strong performers are recruited away and weak ones are managed out; a gain from a value effect counts as `unrated`.

A team has at most one leader. Moving a team's leader to another team makes them a member there and leaves their old team leaderless. Setting a leader on a team that already has one is invalid; the current leader must be removed or moved first.

A team whose leader departs becomes **leaderless** until a new leader is set. Leaderless teams accumulate stress faster.

### Project

| Field | Meaning |
|---|---|
| `scope` | Total work, in work units (not 0–100 bounded) |
| `progress` | Work units completed |
| `risk` | Likelihood of a setback when advanced |
| `techDebt` | Accumulated shortcuts; raises risk and slows progress |
| `startWeek` | The game week it started |
| `deadlineWeek` | The game week by which it is expected to finish |
| `teamId` | The team working on it |
| `status` | `active`, `completed` or `cancelled` |

A project completes during an advance when its progress reaches its scope. An active project is **overdue** when the current game week is past its deadline. It is **behind schedule** when it is not overdue and its share of scope completed is less than its share of the time from start to deadline that has elapsed. Both are derived, not stored.

## Effects, Causes and History

The rest of the game changes the simulation only by submitting **effects**. Every effect carries a **cause**, which is one of:

- a player action (the action's id),
- a situation choice (the situation id and choice id),
- a simulation rule (the rule's id).

There are two kinds of effect:

- **Value effects** change a numeric field of a person, a team, a project or the player's standing by a signed amount. A value effect may carry **want tags** (wants it serves or works against) and, when it targets a person, a **history note**.
- **Structural effects** change the shape of the organization:
  - hire a person into a team,
  - remove a person (quit, fired or transferred),
  - move a person to another team,
  - set a team's leader (the team must be leaderless, and the person must not already lead a team),
  - rate a person or the player (give an active person or the player a rating, either as a new rating or as a revision of the latest one; a rating for a person may carry a history note),
  - re-rate within an aggregate team (move a number of heads from one performance level to a rating, for calibration at levels where the team's people are not individuals; the team must be aggregate and hold at least that many heads at the first level; moving heads to the level they are already at changes nothing),
  - start a project for a team,
  - reassign a project to another team,
  - cancel a project.

Effects are submitted in batches. Each effect in a batch is validated against the state as left by the effects before it, so a batch can remove a team's leader and then set a new one. If any effect lacks a cause, targets something that does not exist, targets a person who is not active, carries a history note on anything but a person, sets a leader where that is invalid, or re-rates more heads than the team holds at that level, the whole batch is rejected with an error naming the invalid effect, and the state is unchanged. A valid batch is applied in the order given, with each value effect clamped as it is applied. Want tags on an effect that targets anything other than a person are ignored.

Every applied change, whether from a submitted effect or from a rule during an advance, is recorded in the **change log** for the operation, with its cause and the value before and after. The change log is returned to the caller; the core does not keep change logs from earlier operations.

A value effect with a history note is also appended to the target person's `history`, with the game week, the cause and the note. History is the durable record that situations trigger on ("passed over for promotion twice") and debriefs cite ("her motivation fell after you…"). Every rate effect for a person is also appended to their history, with the rating it gave and its note if it has one (a rating for the player goes to the player's rating history), so that situations can trigger on a run of ratings ("rated below what they delivered twice"). Only individual people have history; aggregate teams do not.

## Advancing Time

`advance` moves the simulation forward one time step of a given length in weeks. Rule magnitudes scale with step length, so that a quarter is roughly a month's change three times over, not the same as a week's.

Each advance applies these rules in this order, every change recorded with its rule as the cause:

1. **Project work.** Each active project gains progress from its team's capacity, which depends on headcount, skill, motivation and stress. Tech debt reduces the progress gained. A project whose progress reaches its scope completes.
2. **Setbacks.** Each active project may suffer a setback, with probability rising with risk and tech debt. A setback removes progress and raises the team's stress.
3. **Stress.** Stress rises on teams with overdue or behind-schedule projects, and on leaderless teams; it recovers on teams that are on track.
4. **Want drift.** A person whose want was last served longer ago than the drift threshold loses motivation; one whose want was served within it regains motivation slowly.
5. **Departure.** A person may quit, with probability rising with how long their motivation has been low or their stress high, and with low trust. An aggregate team instead loses headcount according to its attrition risk. When a departing person leads a team, that team becomes leaderless.
6. **Player standing.** The player's reputation moves with the delivery health of the projects they are responsible for, and their stress moves with the number of teams in trouble.
7. **Game time.** The game week advances by the step length.

Exact formulas and constants are tuning, kept in code next to the rules that use them.

## Reading the State

Situations, career levels and debriefs read the state through read-only queries: people matching a condition, a person's history, team summaries (computed for detailed teams, stored for aggregate ones), a person's contribution and the rating it corresponds to, the plan a person or the player is on, overdue and behind-schedule projects, leaderless teams, and the player's standing. Queries never change the state.

## Interface

| Operation | Input | Output |
|---|---|---|
| `create` | seed, starting organization | state |
| `applyEffects` | state, batch of effects | new state and change log, or an error naming the invalid effect |
| `advance` | state, step length in weeks | new state and change log |
| `aggregateTeam` | state, team id, cause | new state with that team in aggregate form, and change log |
| queries | state, query parameters | read-only results |

State is plain, serializable data. Every operation returns a new state and leaves its input unchanged.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Detail of a simulated person | A few core numbers, one main want, trust in their manager, and a history of notable events | Only a few numbers per person; full people with traits, several goals and peer relationships | The want makes the same action land differently on different people, and history makes consequences traceable and explainable, which are the game's learning goals. Peer relationships multiply rule interactions and balancing cost, and most of that detail disappears once individuals become aggregates at higher levels; friction between peers is written into situations instead. |
| Cause on every change | Every change carries a cause, collected in a per-operation change log | Record only final values; record causes only for history notes | Debriefs and traceable consequences need to explain any change, not just the notable ones. Returning the log instead of storing it bounds the state's size; history keeps what must last. |
| Invalid effects | Reject the whole batch with an error; state unchanged | Skip invalid effects silently; apply the valid part | Invalid effects are content or code bugs. Silent skipping hides them, and partial application leaves a situation's outcome half-done. |
| Batch validation | Each effect validated against the state left by the effects before it; all-or-nothing commit | Validate every effect against the starting state | Real management moves are sequences (move the old lead out, then appoint a new one); validating against the starting state would reject them. |
| Want served | Any effect tagged as serving the want, whatever field it changes | Only tagged effects that raise motivation; a dedicated serve-want effect | Lets content express a choice that is hard on someone but is what they wanted, which is both realistic and a lesson. |
| Durations | Counted in game weeks | Counted in time steps | Step length changes on promotion; counting in steps would make "sustained" mean something different at each level. |
| Detailed vs aggregate teams | Two team forms, one-way conversion | Simulate every person at every level; drop teams from the model once out of view | Higher levels must not show individuals, but their teams' health still has to move and matter. Simulating everyone individually keeps detail the player never sees; converting back would have to invent people. |
| Value scale | Integers 0–100 | Floating-point values; unbounded values | Integers read clearly in debriefs and the UI and compare reliably in situation triggers. |
| Pure, serializable state | Operations return new state; randomness from a seeded generator held in the state; iteration in id order | Mutable objects; global random source | Makes saves trivial, makes runs reproducible for tests and bug reports, and lets the turn loop discard a state safely. |
| Performance level scale | A five-step rating plus `unrated`, changed only by a rate effect | A 0–100 value changed by value effects | Real evaluations assign a rating rather than adding points to one, and calibration is an argument over which step someone belongs on. A distinct `unrated` keeps new hires from being silently treated as average. |
| Ratings in aggregate teams | Aggregate summaries keep a count per rating, adjusted by a re-rate effect | Calibrate only the managers who remain individuals; keep teams detailed wherever calibration happens | Calibration at senior manager is about the spread of ratings across teams ("four exceeds on one team, none on the other"), which survives aggregation as counts. Keeping teams detailed would show individuals the level is meant to hide. |
| Consequences of a rating | Expressed by the effects submitted with the rate effect, at the moment it is given; core derives contribution so content can compare | An ongoing rule draining motivation from anyone rated below their contribution | Landing the consequence with the evaluation gives it a cause a debrief can name, keeps the rule set small, and avoids overlapping with want drift. History keeps the rating so later situations can follow up. |
| Coaching plans and PIPs | Derived from consecutive low ratings; a person's failed PIP removes them automatically | A stored plan field content can set; a failed PIP handed to the player to decide | Deriving keeps plan and ratings from disagreeing. Automatic removal makes the PIP's stakes unambiguous; the player's work is avoiding that outcome through coaching, and handling its effect on the team. |
| Revising a rating | A rate effect may be marked as a revision, replacing the latest rating | Every rate effect adds a rating; ratings in the same game week count as one | Calibration adjusts ratings already given; counting the adjustment as a second rating would put people on a PIP from one review cycle. Same-week merging breaks when calibration falls in a later week than the evaluation. |
| Removal after a failed PIP | Applied after the rest of the batch | Applied at the rate effect, in batch order | Content naturally submits a rating together with its consequences; removing the person mid-batch would make those later effects target a departed person and reject the batch. |
| Judging outcomes | The core reports values; career levels and reviews decide burnout, dismissal and promotion | The core declares burnout or dismissal itself | What counts as failure differs by career level, which the core does not know about. |

## Open Questions & Future Decisions

### Deferred
1. Formulas and constants for each advance rule, settled during implementation and balancing.
2. How many weeks a want must go unserved, or motivation stay low, before drift or departure begins.
3. Whether the player has a want of their own that shapes their stress.
4. How Director-and-above levels represent organizations of several aggregate teams (one aggregate per senior manager's org, or teams kept separate in aggregate form).
5. Whether history is capped per person.
6. Whether aggregate teams need a lasting record of notable events.

## References

- [High-level design](../../high-level-design.md)
- [Decision: Simulated organization with authored situations](../../decisions/simulation-and-situations.md)
