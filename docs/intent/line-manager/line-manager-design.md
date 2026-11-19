---
parent: high-level-design
prefix: LINE
---

# Line Manager Level

## Context and Design Philosophy

The line manager level is the first career level: the player leads one team of engineers, week by week. It defines what the player can do each week, what they can see, the demands that compete for their time, and the scorecard their reviews read. It does not order the turn (the turn loop does), write situations (content does), or decide ratings and promotion (the performance review does).

The level's core struggle is **time**. A line manager has more to do than hours to do it in: their people need 1:1s, coaching and recognition; their projects need planning and ceremonies; and a stream of hands-on work arrives every week (approvals, design reviews, customer requests, on-call escalations). Learning which of that work to do personally, which to delegate, and which to let slide is the level's main lesson, as the HLD sets out.

Four principles shape it:

- **The week is a budget.** Every action and every demand handled personally costs hours from a fixed weekly budget. Working past it is possible and raises the player's stress. Nothing is free, so every choice is also a choice not to do something else.
- **The calendar carries over.** The player builds a recurring weekly calendar once and edits it as things change, rather than planning every week from scratch. Most weeks the player's attention goes to the inbox and to situations, not to re-entering the same 1:1s.
- **Neglect shows.** Whoever gets no 1:1s drifts; a project nobody plans gets riskier; a request left in the inbox expires with a consequence. The level never punishes neglect with a message; the simulation and the inbox make it visible.
- **Delegation is a real choice with known costs.** Delegating a demand costs the delegate time and stress and may grow them; whether it goes well depends on their skill against the demand's difficulty, not on a roll, so the player can learn when to delegate and to whom.

## The Organization

A run at this level starts from an organization the level generates from the run's seed: one team led by the player, of five engineers with varied skill, motivation, stress and wants, and two projects, one on track and one already at risk. Names come from a fixed list of fictional names in the level's data. All teams are simulated in detail.

## Visibility

The player sees what a manager of this team would see, which is less than the simulation holds:

| Value | What the player sees |
|---|---|
| Name, role, tenure, team | Exactly |
| Motivation and stress | A coarse band (for example *energized*, *fine*, *flat*, *struggling*) |
| Skill | A coarse band |
| Want | Unknown until the player has held a 1:1 with that person; known from then on |
| Trust | Not shown |
| Performance level | Exactly (the player set or inherited it) |
| Project progress, deadline, schedule status | Exactly |
| Project risk and tech debt | A coarse band |
| Player reputation and stress | A coarse band |
| Calendar, open vacancies and their interviews | Exactly |
| Inbox demands: type, subject, hours, expiry | Exactly |
| Demand difficulty | A band on the same scale as skill, so the player can compare a demand with a possible delegate |

Every banded value uses the same scale of bands over 0–100 (the number of bands and their cut-offs are tuning values), so bands of different values compare directly.

Hidden wants are what make 1:1s matter beyond the trust they build. An action or situation choice serves a person's want whether or not the player knows it; knowing the want is what tells the player where to aim.

## The Weekly Calendar

The player has a weekly budget of **hours**. The calendar holds **entries**: an action, its target (a person, the team, a project, a vacancy or the player), a cadence (every week, every other week, or this week only), and for an every-other-week entry a start week. Recurring entries stay in the calendar from week to week until the player removes them; one-off entries are removed after the week they run in. An every-other-week entry runs in its start week and in every second week after; its start week is the week it was added unless the player picks the following week. An entry must name an action from the catalogue and a target of the kind that action takes, and an action marked one-off can only be scheduled as one-off. Any action may be scheduled for this week only.

The level starts the player with a default calendar: a 1:1 with each engineer every other week, staggered so that alternate engineers (in id order) start in the first and second week, and the team's ceremonies every week.

### Actions

| Action | Id | Target | Hours | What it does |
|---|---|---|---|---|
| 1:1 | `line-manager.one-on-one` | person | 1 | Raises trust; reveals the person's want; small motivation gain |
| Coaching | `line-manager.coaching` | person | 2 | Slowly raises skill; serves a want for growth |
| Recognition | `line-manager.recognition` | person | 1 | Raises motivation; serves a want for recognition |
| Training | `line-manager.training` | person | 1 (one-off) | Sends the person on a course: raises skill, and their stress for that week; serves a want for growth |
| Ceremonies | `line-manager.ceremonies` | team | 4 | Keeps the team's projects from drifting (without them, project risk rises each week); gives each engineer a small motivation gain that serves a want for stability |
| Project planning | `line-manager.project-planning` | project | 3 | Lowers the project's risk |
| Scope negotiation | `line-manager.scope-negotiation` | project | 2 (one-off) | Reduces the project's scope; costs some reputation |
| Team event | `line-manager.team-event` | team | 3 (one-off) | Raises motivation and lowers stress across the team |
| Interview | `line-manager.interview` | vacancy | 2 (one-off) | Advances a vacancy toward a hire |
| Recovery time | `line-manager.recovery` | player | 2 | Lowers the player's stress |

An entry whose target is no longer valid when the week commits (a person who has left the team, a project that is no longer active, a filled vacancy) does not run, costs no hours, and is removed from the calendar; the player is told which entries dropped and why. This covers changes made during the week's planning, such as a situation choice that moves someone to another team.

The level's action ids, together with the ids it uses for delegating and for accepting or declining work intake, are listed in the player action catalogue that situation content is checked against (see the situation engine's *Validation*).

Every action that targets a person (1:1, coaching, recognition, training), and every delegation, adds an entry to that person's history with the action's id as its cause. Situations can then ask how long it has been since someone's last 1:1, or how often they have been delegated to, through the situation engine's `history` condition.

An action's effects are submitted to the simulation core as one batch per week, each with the action's id as its cause, so history and debriefs can name what the player did. Effect sizes are tuning values, not design.

### Overtime

Hours planned past the budget are overtime. The level allows overtime up to a cap, and each overtime hour raises the player's stress at the end of the week. A week whose plan would exceed the cap cannot be committed.

## The Inbox

Each week, **demands** arrive in the player's inbox: hands-on work that needs doing by someone. A demand has a type, a subject (a project, or a person when it is a request from them), an hour cost, a difficulty, and a last week: the week it arrived plus the type's expiry weeks. A demand left undecided through its last week expires at that week's commit.

| Demand | Typical subject | Hours | Expiry weeks | If it expires |
|---|---|---|---|---|
| Approval (release, access) | project | 1 | 1 | The project loses progress while blocked |
| Design review | project | 3 | 2 | The project's tech debt rises |
| Customer request | project | 2 | 2 | The player's reputation falls |
| On-call escalation | project | 4 | 0 (this week) | The player's reputation falls and the project's risk rises |
| Expense, travel or conference approval | person | 1 | 2 | The requester's motivation falls |
| Work intake | team | 2 | 2 | The player's reputation falls |

A work intake demand arrives whenever the team has fewer than two active projects and no work intake demand is already in the inbox. How many of the other demands arrive, and of which types, depends on the state: more projects mean more approvals and customer requests; higher risk and tech debt mean more on-call escalations. The level draws arrivals from its own seeded generator, held in the level's state, so changing the level's content never changes the simulation's own random rolls.

The player decides each demand in the week's plan:

- **Handle it**: it costs the player its hours and resolves this week.
- **Delegate it** to an engineer on the team: it costs the player nothing, raises the delegate's stress, and serves a want for growth or autonomy. If the delegate's skill meets the demand's difficulty, it resolves as if handled; if not, it still resolves, and the delegate's skill rises a little, but with a reduced version of the expiry consequence. Repeatedly delegating to the same person compounds their stress.
- **Leave it**: it stays in the inbox and expires when its time runs out, applying its consequence.

An engineer may take several delegated demands in one week, each raising their stress again. A request from a person cannot be delegated to that person. A delegation to someone who is no longer an active engineer on the team when the week commits (because a situation that week moved them or they left) does not happen: the demand stays in the inbox undecided, and the player is told why. If that week was the demand's last, its last week moves to the following week instead of the demand expiring, so the player is never penalized for a decision a situation undid. The level does not refuse a delegation to someone already struggling; the player can see their stress band and the choice is theirs.

**Work intake** is a request to take on a new project, and is decided differently: the player **accepts** it (costing its hours and starting the project through the simulation core's start-project effect, with a name from the level's data), **declines** it (no hours; a small loss of reputation), or leaves it to expire (a larger loss). It cannot be delegated. Work intake is how the team gets new projects once its first ones finish.

A demand whose subject is gone before it is decided (a project completed or cancelled, a requester who has left) leaves the inbox with no consequence. If the player had decided it that week, the decision has nothing to act on: it costs no hours and the player is told why.

## Where the Line Manager's Duties Live

The HLD lists the line manager's responsibilities. At this level each is one of three things: an **action** the player schedules, a **demand** that arrives in the inbox, or a **situation** written as content.

| Duty | Where it lives |
|---|---|
| 1:1s and feedback, coaching, recognition, training | Actions |
| Agile ceremonies, project management | Actions (ceremonies, project planning, scope negotiation) |
| Team events | Action |
| Interviewing | Action, against a vacancy |
| Approvals (release, access, expense, travel, conference), design reviews, customer interaction, incidents and on-call | Demands |
| Work intake | Demand |
| Evaluations, self-evaluations, promotion cases, arguing ratings in calibration | Situations, presented around review time |
| Improvement plans and the terminations that follow failed ones | Situations, triggered by a person's plan |
| Conflicts, leave, onboarding, product ownership disputes, architecture decisions | Situations |

## A Week

Within a turn, the level provides the turn loop with these steps, in this order:

1. **Arrive**: new demands enter the inbox.
2. **Plan**: the player edits the calendar and decides inbox demands. Situations for the week are presented alongside the plan.
3. **Commit**: the planned actions and handled or delegated demands apply as effect batches; overtime raises the player's stress; demands that expire this week apply their consequences.
4. **Advance**: the simulation advances one week.

Situations come from the situation engine, tagged `line-manager`, up to two per week. Answering a situation costs no hours, and its choice applies when the player picks it, during planning.

The burnout check (below) runs after the simulation advances; where it sits relative to the performance review is the turn loop's to order.

## Vacancies and Hiring

The team has a **target headcount**, its starting size. When the simulation has advanced, and when a week begins to commit, the level compares the team's active engineers and open vacancies with it; for each engineer short, for any reason (a quit, a firing, a move to another team), it opens a **vacancy**; a team never has more open vacancies than it is short of engineers, and cannot grow past its target headcount through hiring. Interviews advance a vacancy; after a set number of interviews the level hires a new engineer, generated from the level's seed with a name from the fictional list, through the simulation core's hire effect. An unfilled vacancy means one fewer pair of hands on the team's projects.

## Scorecard, Reviews and the End of the Level

The level defines the scorecard its performance reviews read, and their cadence; the performance review decides the rating and promotion.

- **Cadence**: a review every 13 weeks, at weeks 13, 26, 39 and so on; "since the last review" means the 13 weeks before the review.
- **Scorecard**:
  - **Delivery**: the number of the team's projects completed by their deadline since the last review, and the share of its active projects neither overdue nor behind schedule.
  - **Retention**: the number of engineers who quit the team since the last review, and how many of them were rated meets or above.
  - **Team health**: the team's average motivation and average stress, and the share of its engineers who have had a 1:1 in the four weeks before the review.

  The level reports these measures; turning them into a rating is the performance review's job.
- **Promotion**: possible from the fourth review on, when the performance review rates the player highly enough.
- **Burnout**: if the player's stress stays at or above the burnout threshold (a tuning value) for four consecutive weeks, the run ends.
- **Managed out**: the performance review ends the run when the player fails an improvement plan.

## Level State

The level keeps its own serializable state beside the simulation's and the situation engine's: its generator state, the calendar, the inbox, the wants the player has learned, open vacancies and their interview counts, the week each of the team's projects completed, and the counters its rules need (consecutive weeks at or above the burnout threshold). The simulation core records that a project completed but not when, so the level notes each completion after the simulation advances. Like the other components, every operation returns a new state and leaves its input unchanged.

## Interface

| Operation | Input | Output |
|---|---|---|
| `startRun` | seed | simulation state, level state |
| `levelParameters` | — | level id `line-manager`, time step 1 week, situation limit 2, review cadence 13 weeks |
| `arriveDemands` | level state, simulation state | new level state |
| `editCalendar` | level state, simulation state, entries to add and to remove | new level state, or an error naming the invalid entry |
| `view` | level state, simulation state | what the player can see (see *Visibility*) |
| `commitWeek` | level state, simulation state, a decision for each inbox demand | new level state, new simulation state, change log, and a report of dropped entries, delegation outcomes and expired demands; or an error |
| `afterAdvance` | level state, simulation state | new level state, and whether the player has burned out |
| `scorecard` | level state, simulation state | the scorecard measures since the last review |

The turn loop calls these in the order of *A Week*; situations are selected and resolved through the situation engine between `arriveDemands` and `commitWeek`.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Core loop | A weekly hours budget spent through a calendar of actions, with an inbox of hands-on demands to handle, delegate or leave | An inbox where every decision is a situation; standing policies with weeks advancing until a situation interrupts | Makes the line manager's struggle (time pulled between people and hands-on work) the mechanic itself. An all-situation inbox plays as pure triage with no proactive management, and lives or dies by writing volume. Standing policies are how a senior manager or director works; keeping them for those levels makes promotion change the game. |
| Re-planning each week | A calendar that carries over, with one-off entries for this week | Plan every week from scratch | Planning 13 weeks a quarter from scratch is tedious; editing a standing calendar keeps attention on the week's inbox and situations. |
| Hands-on work | Arrives as inbox demands with an expiry and a consequence | Fixed recurring chores; technical puzzles | The HLD excludes technical puzzles; demands with consequences make letting work slide a real choice, and delegating it a lesson. |
| Delegation outcome | Decided by the delegate's skill against the demand's difficulty | A random chance of success | Deterministic outcomes are learnable: the player can see why a delegation went badly and choose better next time. |
| Wants | Hidden until a 1:1 reveals them | Always visible | Makes 1:1s matter beyond trust, and mirrors the real job: a manager learns what someone wants by asking. |
| Duty mapping | Scheduled care as actions, hands-on work as demands, judgment-heavy moments (evaluations, conflicts, improvement plans) as situations | Everything as actions; everything as situations | Each kind of duty gets the mechanic that matches how it reaches a real manager: care is planned, hands-on work arrives, and hard conversations are moments with choices worth writing. |
| Situation cost | Situations cost no hours | Each situation costs hours | Keeps the budget about the player's own planning; situations are already constrained by the per-week limit. |
| Visible values | Coarse bands for motivation, stress, skill, risk and standing; trust hidden | Exact numbers | A manager reads people, not dashboards; bands keep the player reasoning about people rather than optimizing numbers. |

## Open Questions & Future Decisions

### Deferred
1. Contractors, interns, entry-level program engineers and remote workers: whether they are distinct kinds of hire with their own costs and behavior.
2. Whether some situations should cost hours (a long incident, a difficult conversation).
3. Leave: whether engineers take leave that removes them from the team for some weeks.
4. Tuning: hour costs, the budget, the overtime cap, band cut-offs and effect sizes are set by play-testing, not by this design.
5. Changing wants: people's priorities shift in real teams; if the simulation core gains want changes, the player's learned want would go stale until their next 1:1.

## References

- [High-level design](../../high-level-design.md)
- [Simulation core](../simulation-core/simulation-core-design.md)
- [Situation engine](../situation-engine/situation-engine-design.md)
- [Original idea notes (2023)](../../references/2023-idea-notes.md)
